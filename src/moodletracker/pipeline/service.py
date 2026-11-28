"""Orquestração: coleta → dedup → extração → Markdown → chunks → embeddings.

Cada estágio concluído é registrado (``items.stage`` + ``item_events``). Falha em um item marca só
aquele item como FAILED (com o estágio onde parou) e o run continua.
"""

from __future__ import annotations

import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from moodletracker.brain.writer import SecondBrainWriter, read_markdown
from moodletracker.collectors.base import Collector
from moodletracker.config import Settings
from moodletracker.db.records import ItemRecord
from moodletracker.db.repository import DiscoveryOutcome, PipelineRepository
from moodletracker.domain.models import ChunkDraft, PipelineStage, RunStatus, RunTrigger
from moodletracker.errors import MoodleTrackerError
from moodletracker.integrations.notifier import EventKind, NotifierHub, PipelineEvent
from moodletracker.logs import get_logger
from moodletracker.parsers.base import ParserRegistry
from moodletracker.parsers.partition import partition_document
from moodletracker.pipeline.chunking import chunk_markdown
from moodletracker.rag.embeddings import Embedder

log = get_logger(__name__)


@dataclass
class RunReport:
    run_id: int | None
    status: RunStatus
    discovered: Counter[str] = field(default_factory=Counter)
    processed: int = 0
    failed: int = 0
    duration_s: float = 0.0
    error: str | None = None

    def as_stats(self) -> dict[str, Any]:
        return {
            "discovered": dict(self.discovered),
            "processed": self.processed,
            "failed": self.failed,
            "duration_s": round(self.duration_s, 2),
        }


class PipelineService:
    def __init__(
        self,
        *,
        settings: Settings,
        repo: PipelineRepository,
        collector: Collector,
        parsers: ParserRegistry,
        writer: SecondBrainWriter,
        embedder: Embedder | None,
        notifier: NotifierHub,
    ) -> None:
        self.settings = settings
        self.repo = repo
        self.collector = collector
        self.parsers = parsers
        self.writer = writer
        self.embedder = embedder
        self.notifier = notifier

    @property
    def terminal_stage(self) -> PipelineStage:
        return PipelineStage.EMBEDDED if self.embedder is not None else PipelineStage.CHUNKED

    # ------------------------------------------------------------------ run

    def run(self, trigger: RunTrigger) -> RunReport:
        started = time.monotonic()
        with self.repo.pipeline_lock() as acquired:
            if not acquired:
                run_id = self.repo.start_run(trigger, status=RunStatus.SKIPPED)
                self.repo.finish_run(run_id, RunStatus.SKIPPED, {}, "Outra execução em andamento")
                log.info("pipeline.skipped", trigger=trigger.value, reason="lock_busy")
                return RunReport(run_id=run_id, status=RunStatus.SKIPPED, error="Outra execução em andamento")

            run_id = self.repo.start_run(trigger)
            report = RunReport(run_id=run_id, status=RunStatus.RUNNING)
            log.info("pipeline.run_started", run_id=run_id, trigger=trigger.value)
            try:
                recovered = self.repo.recover_stale()
                if recovered:
                    log.warning("pipeline.recovered_stale", count=recovered)
                self._discover(run_id, report)
                self._process_queue(run_id, report)
                report.status = RunStatus.SUCCEEDED
            except MoodleTrackerError as exc:
                report.status, report.error = RunStatus.FAILED, str(exc)
                log.error("pipeline.run_failed", run_id=run_id, error=str(exc))
            except Exception as exc:
                report.status, report.error = RunStatus.FAILED, f"{type(exc).__name__}: {exc}"
                log.exception("pipeline.run_crashed", run_id=run_id)
            finally:
                report.duration_s = time.monotonic() - started
                self.repo.finish_run(run_id, report.status, report.as_stats(), report.error)

        log.info("pipeline.run_finished", run_id=run_id, status=report.status.value, **report.as_stats())
        self.notifier.publish(
            PipelineEvent(
                kind=EventKind.RUN_FINISHED, message=f"Execução {report.status.value}", data=report.as_stats()
            )
        )
        return report

    def _discover(self, run_id: int, report: RunReport) -> None:
        for raw in self.collector.discover():
            item_id, outcome = self.repo.register_discovered(raw, run_id=run_id)
            report.discovered[outcome.value] += 1
            if outcome in (DiscoveryOutcome.NEW, DiscoveryOutcome.CHANGED):
                kind = EventKind.ITEM_NEW if outcome is DiscoveryOutcome.NEW else EventKind.ITEM_CHANGED
                self.notifier.publish(
                    PipelineEvent(
                        kind=kind,
                        item_id=item_id,
                        course=raw.course,
                        title=raw.title,
                        stage=PipelineStage.DISCOVERED,
                        message=f"{raw.course} › {raw.module} › {raw.title}",
                    )
                )
            log.debug("pipeline.discovered", item_id=item_id, outcome=outcome.value, source_id=raw.source_id)

    def _process_queue(self, run_id: int, report: RunReport) -> None:
        while batch := self.repo.claim_queued(limit=25):
            for item in batch:
                if self.process_item(item, run_id=run_id):
                    report.processed += 1
                else:
                    report.failed += 1

    # ------------------------------------------------------------------ item

    def process_item(self, item: ItemRecord, run_id: int | None = None) -> bool:
        stage = PipelineStage.DISCOVERED
        bound = log.bind(item_id=item.id, source_id=item.source_id)
        started = time.monotonic()
        try:
            raw = item.to_raw()
            if not raw.local_path.exists():
                raise MoodleTrackerError(f"Arquivo não encontrado: {raw.local_path}")

            stage = PipelineStage.EXTRACTED
            doc = self.parsers.get(raw.item_type).parse(raw.local_path, title_hint=raw.title)
            self.repo.advance(
                item.id,
                stage,
                f"Extraídas {len(doc.sections)} seções ({doc.char_count} caracteres)",
                {"sections": len(doc.sections), **doc.metadata},
                run_id=run_id,
            )

            stage = PipelineStage.MARKDOWN
            partitions = partition_document(doc, self.settings.partition_max_chars)
            written = self.writer.write(raw, doc, partitions)
            docs, stale_paths = self.repo.replace_documents(item.id, written)
            if stale_paths:
                self.writer.remove(stale_paths)
            self.repo.advance(
                item.id,
                stage,
                f"{len(docs)} arquivo(s) .md gravado(s)",
                {"files": [d.path for d in docs]},
                run_id=run_id,
            )

            stage = PipelineStage.CHUNKED
            drafts: list[ChunkDraft] = []
            for d in docs:
                _, body = read_markdown(self.writer.resolve(d.path))
                drafts += chunk_markdown(
                    body, document_ordinal=d.ordinal, size=self.settings.chunk_size, overlap=self.settings.chunk_overlap
                )
            self.repo.replace_chunks(item.id, {d.ordinal: d.id for d in docs}, drafts)
            self.repo.advance(item.id, stage, f"{len(drafts)} chunks gerados", {"chunks": len(drafts)}, run_id=run_id)

            if self.embedder is not None and drafts:
                stage = PipelineStage.EMBEDDED
                pairs = self.repo.chunk_texts(item.id)
                vectors = self.embedder.embed([t for _, t in pairs])
                self.repo.set_embeddings([cid for cid, _ in pairs], vectors, self.embedder.model)
                self.repo.advance(
                    item.id,
                    stage,
                    f"{len(vectors)} embeddings ({self.embedder.model})",
                    {"model": self.embedder.model, "dim": self.embedder.dim},
                    run_id=run_id,
                )

            self.repo.complete(item.id, run_id=run_id)
            bound.info("pipeline.item_completed", stage=stage.value, ms=round((time.monotonic() - started) * 1000))
            self.notifier.publish(
                PipelineEvent(
                    kind=EventKind.ITEM_COMPLETED,
                    item_id=item.id,
                    course=item.course_name,
                    title=item.title,
                    stage=stage,
                    message=f"{len(docs)} partições, {len(drafts)} chunks",
                )
            )
            return True
        except MoodleTrackerError as exc:
            return self._fail(item, stage, str(exc), run_id, bound, unexpected=False)
        except Exception as exc:
            return self._fail(
                item, stage, f"Erro inesperado ({type(exc).__name__}): {exc}", run_id, bound, unexpected=True
            )

    def _fail(
        self, item: ItemRecord, stage: PipelineStage, error: str, run_id: int | None, bound: Any, *, unexpected: bool
    ) -> bool:
        """``stage`` é o estágio que estava em execução quando a falha ocorreu."""
        (bound.exception if unexpected else bound.warning)("pipeline.item_failed", stage=stage.value, error=error)
        self.repo.fail(item.id, stage, error, run_id=run_id)
        self.notifier.publish(
            PipelineEvent(
                kind=EventKind.ITEM_FAILED,
                item_id=item.id,
                course=item.course_name,
                title=item.title,
                stage=stage,
                message=error,
            )
        )
        return False
