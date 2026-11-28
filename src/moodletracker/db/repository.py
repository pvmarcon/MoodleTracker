"""Acesso a dados do pipeline. Cada método é uma transação curta (unit of work).

Nenhuma regra de negócio de parsing vive aqui — apenas estado, deduplicação e consultas.
"""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, delete, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, sessionmaker

from moodletracker.db.records import (
    ChunkHit,
    CourseRecord,
    DocumentRecord,
    EventRecord,
    ItemFilters,
    ItemRecord,
    Page,
    RunRecord,
)
from moodletracker.db.tables import Chunk, Course, Document, EventLevel, Item, ItemEvent, PipelineRun
from moodletracker.domain.models import (
    ChunkDraft,
    ItemStatus,
    PipelineStage,
    RawItem,
    ReviewStatus,
    RunStatus,
    RunTrigger,
    WrittenDocument,
)
from moodletracker.errors import NotFoundError
from moodletracker.text import slugify

PIPELINE_LOCK_KEY = 0x4D54_5049  # "MTPI" — advisory lock global do pipeline
MAX_AUTO_RETRIES = 3


class DiscoveryOutcome(StrEnum):
    NEW = "new"
    CHANGED = "changed"
    UNCHANGED = "unchanged"
    RETRY = "retry"
    DUPLICATE = "duplicate"


def _now() -> datetime:
    return datetime.now(UTC)


def _item_record(item: Item, course_name: str) -> ItemRecord:
    rec = ItemRecord.model_validate(
        {**{c.key: getattr(item, c.key) for c in Item.__mapper__.column_attrs}, "course_name": course_name}
    )
    return rec


class PipelineRepository:
    def __init__(self, sessions: sessionmaker[Session]) -> None:
        self._sessions = sessions

    @contextmanager
    def _tx(self) -> Iterator[Session]:
        with self._sessions.begin() as s:
            yield s

    # ------------------------------------------------------------------ locking / runs

    @contextmanager
    def pipeline_lock(self) -> Iterator[bool]:
        """Advisory lock de sessão: impede execuções simultâneas (scheduler + gatilho manual + outro worker)."""
        with self._sessions() as s:
            acquired = bool(s.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": PIPELINE_LOCK_KEY}).scalar())
            try:
                yield acquired
            finally:
                if acquired:
                    s.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": PIPELINE_LOCK_KEY})
                s.commit()

    def start_run(self, trigger: RunTrigger, status: RunStatus = RunStatus.RUNNING) -> int:
        with self._tx() as s:
            run = PipelineRun(trigger=trigger, status=status)
            s.add(run)
            s.flush()
            return run.id

    def finish_run(self, run_id: int, status: RunStatus, stats: dict[str, Any], error: str | None = None) -> None:
        with self._tx() as s:
            s.execute(
                update(PipelineRun)
                .where(PipelineRun.id == run_id)
                .values(status=status, stats=stats, error=error, finished_at=_now())
            )

    def list_runs(self, limit: int = 20) -> list[RunRecord]:
        with self._sessions() as s:
            rows = s.scalars(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(limit)).all()
            return [RunRecord.model_validate(r) for r in rows]

    # ------------------------------------------------------------------ discovery

    def _course(self, s: Session, name: str) -> Course:
        course = s.scalar(select(Course).where(Course.name == name))
        if course is not None:
            return course
        base = slugify(name)
        slug, n = base, 2
        while s.scalar(select(Course.id).where(Course.slug == slug)) is not None:
            slug, n = f"{base}-{n}", n + 1
        stmt = pg_insert(Course).values(name=name, slug=slug).on_conflict_do_nothing(index_elements=["name"])
        s.execute(stmt)
        return s.scalars(select(Course).where(Course.name == name)).one()

    def _event(
        self,
        s: Session,
        *,
        kind: str,
        message: str,
        item_id: int | None = None,
        run_id: int | None = None,
        stage: PipelineStage | None = None,
        level: EventLevel = EventLevel.INFO,
        data: dict[str, Any] | None = None,
    ) -> None:
        s.add(
            ItemEvent(
                item_id=item_id, run_id=run_id, kind=kind, stage=stage, level=level, message=message, data=data or {}
            )
        )

    def register_discovered(self, raw: RawItem, run_id: int | None = None) -> tuple[int, DiscoveryOutcome]:
        """Registra/atualiza o item vindo do collector e decide se precisa (re)processar."""
        with self._tx() as s:
            course = self._course(s, raw.course)
            item = s.scalar(
                select(Item)
                .where(Item.source_adapter == raw.source_adapter, Item.source_id == raw.source_id)
                .with_for_update()
            )
            fields = {
                "course_id": course.id,
                "module": raw.module,
                "title": raw.title,
                "item_type": raw.item_type,
                "source_uri": raw.source_uri,
                "local_path": str(raw.local_path),
                "size_bytes": raw.size_bytes,
                "modified_at": raw.modified_at,
            }

            if item is not None and item.content_hash == raw.content_hash:
                for k, v in fields.items():
                    setattr(item, k, v)
                if item.status is ItemStatus.FAILED and item.attempts < MAX_AUTO_RETRIES:
                    item.status = ItemStatus.QUEUED
                    self._event(
                        s,
                        kind="item_retry",
                        item_id=item.id,
                        run_id=run_id,
                        stage=item.stage,
                        message=f"Nova tentativa ({item.attempts + 1}/{MAX_AUTO_RETRIES})",
                    )
                    return item.id, DiscoveryOutcome.RETRY
                return item.id, DiscoveryOutcome.UNCHANGED

            canonical = s.scalar(
                select(Item).where(Item.content_hash == raw.content_hash, Item.duplicate_of_id.is_(None))
            )
            if canonical is not None and (item is None or canonical.id != item.id):
                return self._register_duplicate(s, raw, item, canonical, fields, run_id)

            if item is None:
                item = Item(
                    **fields,
                    source_adapter=raw.source_adapter,
                    source_id=raw.source_id,
                    content_hash=raw.content_hash,
                    stage=PipelineStage.DISCOVERED,
                    status=ItemStatus.QUEUED,
                    collected_at=raw.collected_at,
                )
                s.add(item)
                s.flush()
                self._event(
                    s,
                    kind="item_discovered",
                    item_id=item.id,
                    run_id=run_id,
                    stage=PipelineStage.DISCOVERED,
                    message=f"Novo material em {raw.course} › {raw.module}",
                    data={"source_id": raw.source_id},
                )
                return item.id, DiscoveryOutcome.NEW

            old_hash = item.content_hash
            for k, v in fields.items():
                setattr(item, k, v)
            item.content_hash = raw.content_hash
            item.collected_at = raw.collected_at
            item.stage, item.status = PipelineStage.DISCOVERED, ItemStatus.QUEUED
            item.error, item.attempts, item.duplicate_of_id = None, 0, None
            item.review_status, item.review_note, item.reviewed_at = ReviewStatus.UNREVIEWED, None, None
            self._event(
                s,
                kind="item_changed",
                item_id=item.id,
                run_id=run_id,
                stage=PipelineStage.DISCOVERED,
                message="Arquivo modificado na origem — reprocessando",
                data={"old_hash": old_hash[:12], "new_hash": raw.content_hash[:12]},
            )
            return item.id, DiscoveryOutcome.CHANGED

    def _register_duplicate(
        self, s: Session, raw: RawItem, item: Item | None, canonical: Item, fields: dict[str, Any], run_id: int | None
    ) -> tuple[int, DiscoveryOutcome]:
        if item is None:
            item = Item(
                **fields,
                source_adapter=raw.source_adapter,
                source_id=raw.source_id,
                collected_at=raw.collected_at,
                content_hash=raw.content_hash,
                stage=canonical.stage,
                status=ItemStatus.DUPLICATE,
            )
            s.add(item)
        else:
            for k, v in fields.items():
                setattr(item, k, v)
            item.content_hash, item.status = raw.content_hash, ItemStatus.DUPLICATE
        item.duplicate_of_id = canonical.id
        s.flush()
        self._event(
            s,
            kind="item_duplicate",
            item_id=item.id,
            run_id=run_id,
            stage=PipelineStage.DISCOVERED,
            level=EventLevel.WARNING,
            message=f"Conteúdo idêntico ao item #{canonical.id} ({canonical.title})",
            data={"duplicate_of": canonical.id},
        )
        return item.id, DiscoveryOutcome.DUPLICATE

    # ------------------------------------------------------------------ processing state

    def claim_queued(self, limit: int = 50) -> list[ItemRecord]:
        """Marca itens da fila como PROCESSING (SKIP LOCKED permite múltiplos workers)."""
        with self._tx() as s:
            rows = s.execute(
                select(Item, Course.name)
                .join(Course)
                .where(Item.status == ItemStatus.QUEUED)
                .order_by(Item.created_at)
                .limit(limit)
                .with_for_update(of=Item, skip_locked=True)
            ).all()
            for item, _ in rows:
                item.status = ItemStatus.PROCESSING
            s.flush()
            return [_item_record(item, name) for item, name in rows]

    def advance(
        self,
        item_id: int,
        stage: PipelineStage,
        message: str,
        data: dict[str, Any] | None = None,
        run_id: int | None = None,
    ) -> None:
        with self._tx() as s:
            s.execute(update(Item).where(Item.id == item_id).values(stage=stage))
            self._event(
                s, kind="stage_completed", item_id=item_id, run_id=run_id, stage=stage, message=message, data=data
            )

    def complete(self, item_id: int, run_id: int | None = None) -> None:
        with self._tx() as s:
            s.execute(
                update(Item)
                .where(Item.id == item_id)
                .values(status=ItemStatus.COMPLETED, error=None, processed_at=_now())
            )
            self._event(s, kind="item_completed", item_id=item_id, run_id=run_id, message="Processamento concluído")

    def fail(self, item_id: int, stage: PipelineStage, error: str, run_id: int | None = None) -> None:
        with self._tx() as s:
            s.execute(
                update(Item)
                .where(Item.id == item_id)
                .values(status=ItemStatus.FAILED, error=error[:4_000], attempts=Item.attempts + 1)
            )
            self._event(
                s,
                kind="item_failed",
                item_id=item_id,
                run_id=run_id,
                stage=stage,
                level=EventLevel.ERROR,
                message=error[:500],
            )

    def requeue(self, item_id: int) -> None:
        with self._tx() as s:
            res = s.execute(
                update(Item)
                .where(Item.id == item_id, Item.status != ItemStatus.DUPLICATE)
                .values(status=ItemStatus.QUEUED, stage=PipelineStage.DISCOVERED, error=None, attempts=0)
            )
            if res.rowcount == 0:  # type: ignore[attr-defined]
                raise NotFoundError(f"Item {item_id} inexistente ou duplicata")
            self._event(
                s,
                kind="item_requeued",
                item_id=item_id,
                stage=PipelineStage.DISCOVERED,
                message="Reprocessamento solicitado",
            )

    def recover_stale(self) -> int:
        """Itens presos em PROCESSING (worker morto) voltam para a fila. Chamado com o lock adquirido."""
        with self._tx() as s:
            res = s.execute(update(Item).where(Item.status == ItemStatus.PROCESSING).values(status=ItemStatus.QUEUED))
            return int(res.rowcount)  # type: ignore[attr-defined]

    # ------------------------------------------------------------------ documents & chunks

    def replace_documents(
        self, item_id: int, written: Sequence[WrittenDocument]
    ) -> tuple[list[DocumentRecord], list[str]]:
        """Substitui as partições do item. Retorna (novos documentos, caminhos antigos que não existem mais)."""
        with self._tx() as s:
            old_paths = list(s.scalars(select(Document.path).where(Document.item_id == item_id)))
            s.execute(delete(Document).where(Document.item_id == item_id))
            s.flush()
            docs = [
                Document(
                    item_id=item_id,
                    ordinal=w.ordinal,
                    title=w.title,
                    path=w.path.as_posix(),
                    locator=w.locator,
                    content_hash=w.content_hash,
                    char_count=w.char_count,
                )
                for w in written
            ]
            s.add_all(docs)
            s.flush()
            new_paths = {d.path for d in docs}
            return [DocumentRecord.model_validate(d) for d in docs], [p for p in old_paths if p not in new_paths]

    def replace_chunks(self, item_id: int, doc_ids: dict[int, int], chunks: Sequence[ChunkDraft]) -> list[int]:
        """``doc_ids`` mapeia ordinal do documento → id. Retorna ids dos chunks na mesma ordem."""
        with self._tx() as s:
            s.execute(delete(Chunk).where(Chunk.item_id == item_id))
            rows = [
                Chunk(
                    item_id=item_id,
                    document_id=doc_ids[c.document_ordinal],
                    ordinal=c.ordinal,
                    content=c.content,
                    heading_path=c.heading_path,
                    char_start=c.char_start,
                    token_estimate=c.token_estimate,
                )
                for c in chunks
            ]
            s.add_all(rows)
            s.flush()
            return [r.id for r in rows]

    def set_embeddings(self, ids: Sequence[int], vectors: Sequence[Sequence[float]], model: str) -> None:
        if len(ids) != len(vectors):
            raise ValueError("ids e vetores com tamanhos diferentes")
        with self._tx() as s:
            for cid, vec in zip(ids, vectors, strict=True):
                s.execute(update(Chunk).where(Chunk.id == cid).values(embedding=list(vec), embedding_model=model))

    def chunk_texts(self, item_id: int) -> list[tuple[int, str]]:
        """(id, texto contextualizado) para embedar: inclui o caminho de títulos para melhorar a recuperação."""
        with self._sessions() as s:
            rows = s.execute(
                select(Chunk.id, Chunk.heading_path, Chunk.content).where(Chunk.item_id == item_id).order_by(Chunk.id)
            ).all()
            return [(cid, f"{hp}\n\n{content}" if hp else content) for cid, hp, content in rows]

    def search_chunks(self, embedding: Sequence[float], k: int = 8, course_id: int | None = None) -> list[ChunkHit]:
        """Busca por similaridade (cosseno). Cada hit carrega caminho + localizador para citação explícita."""
        dist = Chunk.embedding.cosine_distance(list(embedding)).label("distance")
        stmt = (
            select(Chunk, Document.path, Document.title, Document.locator, Course.name, dist)
            .join(Document, Document.id == Chunk.document_id)
            .join(Item, Item.id == Chunk.item_id)
            .join(Course, Course.id == Item.course_id)
            .where(Chunk.embedding.is_not(None))
            .order_by(dist)
            .limit(k)
        )
        if course_id is not None:
            stmt = stmt.where(Item.course_id == course_id)
        with self._sessions() as s:
            return [
                ChunkHit(
                    chunk_id=c.id,
                    item_id=c.item_id,
                    course=course,
                    document_path=path,
                    document_title=title,
                    locator=loc,
                    heading_path=c.heading_path,
                    content=c.content,
                    distance=float(d),
                )
                for c, path, title, loc, course, d in s.execute(stmt).all()
            ]

    # ------------------------------------------------------------------ queries (API)

    def _filtered(self, f: ItemFilters) -> Select[Item, str]:
        stmt = select(Item, Course.name).join(Course)
        if f.course_id is not None:
            stmt = stmt.where(Item.course_id == f.course_id)
        if f.stage is not None:
            stmt = stmt.where(Item.stage == f.stage)
        if f.status is not None:
            stmt = stmt.where(Item.status == f.status)
        if f.review_status is not None:
            stmt = stmt.where(Item.review_status == f.review_status)
        if f.item_type is not None:
            stmt = stmt.where(Item.item_type == f.item_type)
        if f.q:
            like = f"%{f.q.strip()}%"
            stmt = stmt.where(or_(Item.title.ilike(like), Item.module.ilike(like), Item.source_id.ilike(like)))
        return stmt

    def list_items(self, f: ItemFilters) -> Page[ItemRecord]:
        stmt = self._filtered(f)
        with self._sessions() as s:
            total = s.scalar(select(func.count()).select_from(stmt.subquery())) or 0
            rows = s.execute(
                stmt.order_by(Course.name, Item.module, Item.created_at.desc()).limit(f.limit).offset(f.offset)
            ).all()
            return Page[ItemRecord](items=[_item_record(i, n) for i, n in rows], total=total)

    def get_item(self, item_id: int) -> ItemRecord:
        with self._sessions() as s:
            row = s.execute(select(Item, Course.name).join(Course).where(Item.id == item_id)).first()
            if row is None:
                raise NotFoundError(f"Item {item_id} não encontrado")
            return _item_record(row[0], row[1])

    def get_documents(self, item_id: int) -> list[DocumentRecord]:
        with self._sessions() as s:
            docs = s.scalars(select(Document).where(Document.item_id == item_id).order_by(Document.ordinal)).all()
            return [DocumentRecord.model_validate(d) for d in docs]

    def get_document(self, document_id: int) -> DocumentRecord:
        with self._sessions() as s:
            doc = s.get(Document, document_id)
            if doc is None:
                raise NotFoundError(f"Documento {document_id} não encontrado")
            return DocumentRecord.model_validate(doc)

    def count_chunks(self, item_id: int) -> tuple[int, int]:
        with self._sessions() as s:
            total, embedded = s.execute(
                select(func.count(), func.count(Chunk.embedding)).where(Chunk.item_id == item_id)
            ).one()
            return int(total), int(embedded)

    def list_events(
        self, *, limit: int = 50, before_id: int | None = None, item_id: int | None = None, course_id: int | None = None
    ) -> list[EventRecord]:
        stmt = (
            select(ItemEvent, Item.title, Course.name)
            .outerjoin(Item, Item.id == ItemEvent.item_id)
            .outerjoin(Course, Course.id == Item.course_id)
            .order_by(ItemEvent.id.desc())
            .limit(limit)
        )
        if before_id is not None:
            stmt = stmt.where(ItemEvent.id < before_id)
        if item_id is not None:
            stmt = stmt.where(ItemEvent.item_id == item_id)
        if course_id is not None:
            stmt = stmt.where(Item.course_id == course_id)
        with self._sessions() as s:
            out = []
            for ev, title, course in s.execute(stmt).all():
                rec = EventRecord.model_validate(ev)
                out.append(rec.model_copy(update={"item_title": title, "course_name": course}))
            return out

    def list_courses(self) -> list[tuple[CourseRecord, int]]:
        with self._sessions() as s:
            rows = s.execute(
                select(Course, func.count(Item.id)).outerjoin(Item).group_by(Course.id).order_by(Course.name)
            ).all()
            return [(CourseRecord.model_validate(c), int(n)) for c, n in rows]

    def stats(self) -> dict[str, Any]:
        with self._sessions() as s:
            by_status = dict(s.execute(select(Item.status, func.count()).group_by(Item.status)).all())
            by_stage = dict(s.execute(select(Item.stage, func.count()).group_by(Item.stage)).all())
            by_review = dict(s.execute(select(Item.review_status, func.count()).group_by(Item.review_status)).all())
            chunks, embedded = s.execute(select(func.count(), func.count(Chunk.embedding))).one()
            documents = s.scalar(select(func.count()).select_from(Document)) or 0
            last_run = s.scalars(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(1)).first()
        return {
            "items": sum(by_status.values()),
            "by_status": {k.value: v for k, v in by_status.items()},
            "by_stage": {k.value: v for k, v in by_stage.items()},
            "by_review": {k.value: v for k, v in by_review.items()},
            "documents": documents,
            "chunks": int(chunks),
            "embedded_chunks": int(embedded),
            "last_run": RunRecord.model_validate(last_run).model_dump(mode="json") if last_run else None,
        }

    def set_review(self, item_id: int, status: ReviewStatus, note: str | None) -> ItemRecord:
        with self._tx() as s:
            item = s.get(Item, item_id)
            if item is None:
                raise NotFoundError(f"Item {item_id} não encontrado")
            item.review_status, item.review_note = status, (note or None)
            item.reviewed_at = None if status is ReviewStatus.UNREVIEWED else _now()
            label = {
                ReviewStatus.APPROVED: "aprovado",
                ReviewStatus.NEEDS_CHANGES: "marcado para ajustes",
                ReviewStatus.UNREVIEWED: "revisão removida",
            }[status]
            self._event(
                s,
                kind="item_reviewed",
                item_id=item_id,
                stage=item.stage,
                message=f"Item {label}",
                data={"review_status": status.value, "note": note or ""},
            )
            s.flush()
            course_name = s.scalar(select(Course.name).where(Course.id == item.course_id)) or ""
            return _item_record(item, course_name)
