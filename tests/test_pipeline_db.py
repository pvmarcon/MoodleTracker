from __future__ import annotations

import hashlib
import shutil
from collections.abc import Sequence
from pathlib import Path

import pytest

from moodletracker.container import Container, build_container
from moodletracker.db.records import ItemFilters
from moodletracker.devtools.samples import make_pdf
from moodletracker.domain.models import ItemStatus, PipelineStage, ReviewStatus, RunStatus, RunTrigger

pytestmark = pytest.mark.db

PDF = "Banco de Dados/Aula 03 - Normalização/normalizacao.pdf"


class FakeEmbedder:
    """Embedding determinístico (bag-of-words em 8 dimensões) para testar o RAG sem rede."""

    model = "fake-8"
    dim = 8

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        out = []
        for t in texts:
            v = [0.0] * 8
            for w in t.lower().split():
                v[int(hashlib.md5(w.encode()).hexdigest(), 16) % 8] += 1.0
            out.append(v)
        return out


@pytest.fixture
def container(clean_db: str, inbox: Path, make_settings) -> Container:  # type: ignore[no-untyped-def]
    c = build_container(make_settings(database_url=clean_db))
    yield c
    c.close()


def _by_source(c: Container) -> dict[str, object]:
    return {i.source_id: i for i in c.repo.list_items(ItemFilters(limit=500)).items}


def test_full_run_then_idempotent(container: Container) -> None:
    report = container.pipeline().run(RunTrigger.CLI)
    assert report.status is RunStatus.SUCCEEDED
    assert report.discovered == {"new": 3} and report.processed == 3 and report.failed == 0

    items = _by_source(container)
    pdf = items[PDF]
    assert pdf.status is ItemStatus.COMPLETED and pdf.stage is PipelineStage.CHUNKED  # sem embedder
    docs = container.repo.get_documents(pdf.id)
    assert [d.ordinal for d in docs] == [1, 2, 3]
    assert all(container.writer.resolve(d.path).is_file() for d in docs)
    total, embedded = container.repo.count_chunks(pdf.id)
    assert total >= 3 and embedded == 0
    kinds = [e.kind for e in container.repo.list_events(item_id=pdf.id)]
    assert kinds[-1] == "item_discovered" and kinds[0] == "item_completed"
    assert kinds.count("stage_completed") == 3

    again = container.pipeline().run(RunTrigger.SCHEDULER)
    assert again.discovered == {"unchanged": 3} and again.processed == 0


def test_changed_file_is_reprocessed_and_review_reset(container: Container, inbox: Path) -> None:
    container.pipeline().run(RunTrigger.CLI)
    pdf = _by_source(container)[PDF]
    container.repo.set_review(pdf.id, ReviewStatus.APPROVED, "ok")

    make_pdf(inbox / PDF, "Normalização v2", [("Único capítulo", ["Conteúdo totalmente novo sobre BCNF. " * 5])])
    report = container.pipeline().run(RunTrigger.CLI)
    assert report.discovered["changed"] == 1 and report.processed == 1

    updated = container.repo.get_item(pdf.id)
    assert updated.review_status is ReviewStatus.UNREVIEWED and updated.content_hash != pdf.content_hash
    docs = container.repo.get_documents(pdf.id)
    assert len(docs) == 1
    old_dir = container.writer.root / "Banco de Dados" / "Aula 03 - Normalização" / "Normalização de Dados"
    assert not old_dir.exists()  # pasta antiga (título mudou) removida


def test_duplicate_content_is_detected(container: Container, inbox: Path) -> None:
    copy = inbox / "Banco de Dados" / "Aula 05 - Revisão" / "copia.pdf"
    copy.parent.mkdir(parents=True)
    shutil.copy(inbox / PDF, copy)
    report = container.pipeline().run(RunTrigger.CLI)
    assert report.discovered["duplicate"] == 1 and report.processed == 3
    items = _by_source(container)
    dup = items["Banco de Dados/Aula 05 - Revisão/copia.pdf"]
    assert dup.status is ItemStatus.DUPLICATE and dup.duplicate_of_id == items[PDF].id
    assert container.repo.get_documents(dup.id) == []


def test_failure_is_recorded_with_stage_and_retried(container: Container, inbox: Path) -> None:
    bad = inbox / "Banco de Dados" / "Aula 06" / "corrompido.pdf"
    bad.parent.mkdir(parents=True)
    bad.write_bytes(b"%PDF-1.4 lixo")
    report = container.pipeline().run(RunTrigger.CLI)
    assert report.status is RunStatus.SUCCEEDED and report.failed == 1 and report.processed == 3
    item = _by_source(container)["Banco de Dados/Aula 06/corrompido.pdf"]
    assert item.status is ItemStatus.FAILED and item.stage is PipelineStage.DISCOVERED and item.attempts == 1
    assert "PDF" in (item.error or "")
    failed_ev = container.repo.list_events(item_id=item.id)[0]
    assert failed_ev.kind == "item_failed" and failed_ev.stage is PipelineStage.EXTRACTED

    for expected_attempts in (2, 3, 3):  # nova tentativa automática até MAX_AUTO_RETRIES
        container.pipeline().run(RunTrigger.SCHEDULER)
        assert container.repo.get_item(item.id).attempts == expected_attempts

    container.repo.requeue(item.id)
    assert container.repo.get_item(item.id).status is ItemStatus.QUEUED


def test_embeddings_and_semantic_search_with_citations(container: Container) -> None:
    container.embedder = FakeEmbedder()
    report = container.pipeline().run(RunTrigger.CLI)
    assert report.processed == 3
    pdf = _by_source(container)[PDF]
    assert pdf.stage is PipelineStage.EMBEDDED
    total, embedded = container.repo.count_chunks(pdf.id)
    assert total == embedded > 0

    query = FakeEmbedder().embed(["A BCNF exige que todo determinante seja superchave"])[0]
    hits = container.repo.search_chunks(query, k=3)
    assert hits and hits[0].document_path.endswith(".md") and hits[0].locator
    assert container.writer.resolve(hits[0].document_path).is_file()


def test_concurrent_run_is_skipped(container: Container) -> None:
    with container.repo.pipeline_lock() as acquired:
        assert acquired
        report = container.pipeline().run(RunTrigger.MANUAL)
    assert report.status is RunStatus.SKIPPED
    assert container.repo.list_runs(1)[0].status is RunStatus.SKIPPED
