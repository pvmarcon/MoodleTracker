from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from moodletracker.brain.writer import SecondBrainWriter, read_markdown, safe_name
from moodletracker.domain.models import ItemType, ParsedDocument, RawItem, Section
from moodletracker.errors import BrainWriteError
from moodletracker.parsers.partition import partition_document
from moodletracker.pipeline.chunking import chunk_markdown

REQUIRED_FM = {"course", "module", "title", "source_file", "item_type", "collected_at", "content_hash"}


def _raw(tmp: Path, source_id: str = "BD/Aula 1/x.pdf", h: str = "a" * 64) -> RawItem:
    return RawItem(
        source_adapter="local_folder",
        source_id=source_id,
        source_uri="file:///x",
        course="BD",
        module="Aula 1",
        title="x",
        item_type=ItemType.PDF,
        local_path=tmp / "x.pdf",
        content_hash=h,
        size_bytes=10,
        collected_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def _doc(*sections: Section, title: str = "Doc") -> ParsedDocument:
    return ParsedDocument(title=title, item_type=ItemType.PDF, sections=list(sections))


def test_partition_respects_markers_and_budget() -> None:
    s = lambda t, n, start=False: Section(title=t, level=1, markdown="x" * n, locator=t, starts_partition=start)  # noqa: E731
    parts = partition_document(_doc(s("A", 100, True), s("B", 100), s("C", 100, True), s("D", 950)), max_chars=1_000)
    assert [[x.title for x in p.sections] for p in parts] == [["A", "B"], ["C"], ["D"]]
    assert parts[1].title == "C" and parts[2].title == "Doc — parte 3"


def test_oversized_section_is_split_by_paragraph() -> None:
    big = Section(title="Big", level=1, markdown="\n\n".join(["p" * 400] * 5), locator="p. 1")
    parts = partition_document(_doc(big), max_chars=1_000)
    assert len(parts) == 3
    assert parts[1].sections[0].title == "Big (cont. 2)"


def test_writer_frontmatter_links_and_cleanup(tmp_path: Path) -> None:
    w = SecondBrainWriter(tmp_path / "brain")
    doc = _doc(
        Section(title="Intro", level=1, markdown="## Intro\n\nTexto intro.", locator="p. 1", starts_partition=True),
        Section(title="Parte 2: final", level=1, markdown="Texto final.", locator="p. 2", starts_partition=True),
    )
    written = w.write(_raw(tmp_path), doc, partition_document(doc, 10_000))
    assert [d.path.name for d in written] == ["01 - Intro.md", "02 - Parte 2 - final.md"]
    meta, body = read_markdown(w.root / written[0].path)
    assert meta.keys() >= REQUIRED_FM
    assert meta["part"] == 1 and meta["parts"] == 2 and meta["locator"] == "p. 1"
    assert body.count("Intro") == 1  # "## Intro" do corpo removido: não repete o título
    assert "[[02 - Parte 2 - final]] →" in body
    index_meta, index_body = read_markdown(w.root / written[0].path.parent / "_index.md")
    assert index_meta["parts"] == 2 and "[[01 - Intro|Intro]]" in index_body

    # Reprocessar com menos partições remove arquivos antigos da pasta do material.
    single = _doc(Section(title="Só", level=1, markdown="Novo.", locator="p. 1"))
    w.write(_raw(tmp_path), single, partition_document(single, 10_000))
    names = sorted(p.name for p in (w.root / written[0].path.parent).glob("*.md"))
    assert names == ["01 - Doc.md", "_index.md"]


def test_writer_disambiguates_same_title_different_source(tmp_path: Path) -> None:
    w = SecondBrainWriter(tmp_path / "brain")
    doc = _doc(Section(title="A", level=1, markdown="a", locator=""))
    a = w.write(_raw(tmp_path, "BD/Aula 1/x.pdf"), doc, partition_document(doc, 1_000))
    b = w.write(_raw(tmp_path, "BD/Aula 1/x.pptx", h="b" * 64), doc, partition_document(doc, 1_000))
    assert a[0].path.parent != b[0].path.parent


def test_resolve_blocks_path_traversal(tmp_path: Path) -> None:
    w = SecondBrainWriter(tmp_path / "brain")
    with pytest.raises(BrainWriteError):
        w.resolve("../../etc/passwd")


def test_safe_name() -> None:
    assert safe_name('Aula: "SQL" / joins?') == "Aula - -SQL- - joins"
    assert safe_name("   ") == "sem-titulo"


def test_chunking_heading_paths_offsets_and_overlap() -> None:
    para = "Frase sobre índices B-tree e consultas por faixa. " * 6
    body = "\n".join(
        [
            "# Índices",
            "",
            "> Fonte: `x.pdf`",
            "",
            "## B-tree",
            "",
            para,
            "",
            para,
            "",
            "## Hash",
            "",
            para,
            "",
            "---",
            "[[_index|Índice]]",
        ]
    )
    chunks = chunk_markdown(body, document_ordinal=1, size=400, overlap=80)
    assert all(len(c.content) <= 400 + 90 for c in chunks)
    assert chunks[0].heading_path == "Índices › B-tree"
    assert chunks[-1].heading_path == "Índices › Hash"
    assert not any("Fonte:" in c.content or "[[_index" in c.content for c in chunks)
    first = chunks[0]
    assert body[first.char_start : first.char_start + 30] == first.content[:30]
    assert any(c.content.startswith("…") for c in chunks[1:])  # overlap aplicado dentro da mesma seção
    assert [c.ordinal for c in chunks] == list(range(1, len(chunks) + 1))
