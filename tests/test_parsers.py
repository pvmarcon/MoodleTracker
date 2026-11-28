from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from moodletracker.devtools.samples import make_moodle_html, make_pdf, make_pptx
from moodletracker.domain.models import ItemType
from moodletracker.errors import ParseError, UnsupportedFormatError
from moodletracker.parsers import default_registry, partition_document
from moodletracker.parsers.html import HtmlParser
from moodletracker.parsers.pdf import PdfParser
from moodletracker.parsers.pptx import PptxParser

BODY = "Uma dependência funcional X → Y indica que X determina Y univocamente em toda instância da relação. " * 3


def test_pdf_toc_partitions_keep_body_and_strip_footer(tmp_path: Path) -> None:
    pdf = make_pdf(
        tmp_path / "a.pdf", "Normalização", [("Capítulo A", [BODY]), ("Capítulo B", [BODY]), ("Capítulo C", [BODY])]
    )
    doc = PdfParser().parse(pdf, title_hint="a")
    assert doc.title == "Normalização"
    assert doc.metadata["structure"] == "toc"
    assert [s.title for s in doc.sections] == ["Capítulo A", "Capítulo B", "Capítulo C"]
    assert all(s.starts_partition for s in doc.sections)
    assert [s.locator for s in doc.sections] == ["p. 1", "p. 2", "p. 3"]
    joined = "\n".join(s.markdown for s in doc.sections)
    assert joined.count("Uma dependência funcional") == 9  # corpo repetido entre páginas é preservado
    assert "Universidade Exemplo" not in joined  # rodapé repetido na margem é removido
    parts = partition_document(doc, max_chars=10_000)
    assert len(parts) == 3


def test_pdf_without_toc_detects_headings(tmp_path: Path) -> None:
    doc = pymupdf.open()
    for title in ("Introdução", "Desenvolvimento"):
        page = doc.new_page()
        page.insert_text((72, 80), title, fontsize=22)
        page.insert_textbox(pymupdf.Rect(72, 110, 540, 400), BODY, fontsize=11)
    path = tmp_path / "b.pdf"
    doc.save(path)
    parsed = PdfParser().parse(path, title_hint="Apostila")
    assert parsed.metadata["structure"] == "headings"
    assert [s.title for s in parsed.sections] == ["Introdução", "Desenvolvimento"]
    assert parsed.title == "Apostila"


def test_pdf_without_text_is_a_parse_error(tmp_path: Path) -> None:
    doc = pymupdf.open()
    doc.new_page()
    path = tmp_path / "scan.pdf"
    doc.save(path)
    with pytest.raises(ParseError, match="sem texto"):
        PdfParser().parse(path, title_hint="scan")


def test_corrupted_files_raise_parse_error(tmp_path: Path) -> None:
    bad_pdf = tmp_path / "x.pdf"
    bad_pdf.write_bytes(b"not a pdf")
    bad_pptx = tmp_path / "x.pptx"
    bad_pptx.write_bytes(b"not a zip")
    with pytest.raises(ParseError):
        PdfParser().parse(bad_pdf, title_hint="x")
    with pytest.raises(ParseError):
        PptxParser().parse(bad_pptx, title_hint="x")


def test_pptx_sections_notes_and_table(tmp_path: Path) -> None:
    path = make_pptx(
        tmp_path / "s.pptx",
        "Índices",
        [
            ("Fundamentos", [("B-tree", ["Balanceada", "> Nível interno", "Faixa"])]),
            ("Prática", [("EXPLAIN", ["Ler plano"])]),
        ],
    )
    doc = PptxParser().parse(path, title_hint="s")
    assert doc.title == "Índices"
    titles = [s.title for s in doc.sections]
    assert titles[:3] == ["Índices", "Fundamentos", "B-tree"]
    btree = doc.sections[2]
    assert btree.locator == "slide 3"
    assert "- Balanceada\n  - Nível interno" in btree.markdown
    assert "Notas do professor" in btree.markdown
    assert [s.title for s in doc.sections if s.starts_partition] == ["Fundamentos", "Prática"]
    table = next(s for s in doc.sections if s.title == "Resumo comparativo")
    assert "| Conceito | Quando usar | Custo |" in table.markdown
    assert len(partition_document(doc, 10_000)) == 3


def test_html_uses_moodle_main_region(tmp_path: Path) -> None:
    path = make_moodle_html(
        tmp_path / "p.html", "Atividade 1", [("Objetivo", ["Fazer X."]), ("Entrega", ["Até sexta."])]
    )
    doc = HtmlParser().parse(path, title_hint="p")
    assert doc.title == "Atividade 1"
    md = "\n".join(s.markdown for s in doc.sections)
    assert "Painel" not in md and "Calendário" not in md and "var M" not in md  # nav/aside/script removidos
    assert "[documentação](https://www.postgresql.org/docs/)" in md
    assert "**sexta-feira**" in md
    assert [s.title for s in doc.sections] == ["Atividade 1", "Objetivo", "Entrega"]


def test_html_latin1_and_relative_links(tmp_path: Path) -> None:
    path = tmp_path / "l.html"
    path.write_bytes(
        "<html><body><h1>Aula</h1><p>Avaliação <a href='/x'>interna</a></p></body></html>".encode("latin-1")
    )
    doc = HtmlParser().parse(path, title_hint="l")
    md = doc.sections[0].markdown
    assert "Avaliação interna" in md and "](/x)" not in md


def test_registry() -> None:
    reg = default_registry()
    assert set(reg.supported) == {ItemType.PDF, ItemType.PPTX, ItemType.HTML}
    with pytest.raises(UnsupportedFormatError):
        reg.get(ItemType.OTHER)
