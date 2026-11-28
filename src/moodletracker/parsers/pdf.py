"""PDF → seções Markdown com PyMuPDF.

Estratégia de estrutura, em ordem:
1. Sumário embutido (``get_toc``): cada entrada nível 1 inicia uma partição (aula/capítulo).
2. Títulos detectados por tamanho de fonte (≥ 1.25× o corpo, linha curta).
3. Sem estrutura: uma seção por página; o particionador agrupa por tamanho.

Cabeçalhos/rodapés repetidos em ≥60% das páginas (mín. 3) são removidos.
"""

from __future__ import annotations

import re
import statistics
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pymupdf

from moodletracker.domain.models import ItemType, ParsedDocument, Section
from moodletracker.errors import ParseError
from moodletracker.text import clean_inline, normalize_block

HEADING_RATIO = 1.25
MAX_HEADING_CHARS = 120
MIN_TEXT_CHARS = 20
_DIGITS = re.compile(r"\d+")


MARGIN_RATIO = 0.08  # faixas superior/inferior onde vivem cabeçalhos e rodapés


@dataclass
class _Line:
    text: str
    size: float
    bold: bool
    in_margin: bool = False


@dataclass
class _Page:
    number: int  # 1-based
    lines: list[_Line] = field(default_factory=list)


def _page_lines(page: Any) -> list[_Line]:
    out: list[_Line] = []
    height = float(page.rect.height) or 1.0
    data = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT)
    for block in data.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            if not spans:
                continue
            text = clean_inline("".join(s["text"] for s in spans))
            size = max(float(s["size"]) for s in spans)
            bold = all(int(s.get("flags", 0)) & 16 for s in spans)
            y0, y1 = float(line["bbox"][1]), float(line["bbox"][3])
            in_margin = y1 <= height * MARGIN_RATIO or y0 >= height * (1 - MARGIN_RATIO)
            out.append(_Line(text=text, size=round(size, 1), bold=bold, in_margin=in_margin))
        out.append(_Line(text="", size=0, bold=False))  # fim de bloco = quebra de parágrafo
    return out


def _strip_repeating(pages: list[_Page]) -> None:
    """Remove linhas das margens que se repetem entre páginas (texto do corpo nunca é tocado)."""
    if len(pages) < 3:
        return
    counts: Counter[str] = Counter()
    for p in pages:
        keys = {_DIGITS.sub("#", ln.text.lower()) for ln in p.lines if ln.text and ln.in_margin and len(ln.text) < 100}
        counts.update(keys)
    threshold = max(3.0, 0.6 * len(pages))
    repeating = {k for k, c in counts.items() if c >= threshold}
    if not repeating:
        return
    for p in pages:
        p.lines = [ln for ln in p.lines if not (ln.in_margin and _DIGITS.sub("#", ln.text.lower()) in repeating)]


def _body_size(pages: list[_Page]) -> float:
    weighted: list[float] = []
    for p in pages:
        for ln in p.lines:
            if ln.text:
                weighted.extend([ln.size] * min(len(ln.text), 200))
    return statistics.median(weighted) if weighted else 0.0


def _heading_levels(pages: list[_Page], body: float) -> dict[float, int]:
    sizes = sorted(
        {ln.size for p in pages for ln in p.lines if ln.text and body and ln.size >= body * HEADING_RATIO},
        reverse=True,
    )
    return {s: min(i + 1, 3) for i, s in enumerate(sizes)}


def _lines_to_markdown(lines: list[_Line], levels: dict[float, int]) -> str:
    parts: list[str] = []
    para: list[str] = []

    def flush() -> None:
        if para:
            parts.append(normalize_block("\n".join(para)).replace("\n", " "))
            para.clear()

    for ln in lines:
        if not ln.text:
            flush()
            continue
        level = levels.get(ln.size)
        if level and len(ln.text) <= MAX_HEADING_CHARS:
            flush()
            parts.append(f"{'#' * (level + 1)} {ln.text}")
        elif ln.text.startswith(("•", "▪", "◦", "–", "- ")):
            flush()
            parts.append(f"- {ln.text.lstrip('•▪◦–- ').strip()}")
        else:
            para.append(ln.text)
    flush()
    return "\n\n".join(p for p in parts if p)


class PdfParser:
    item_types = (ItemType.PDF,)

    def parse(self, path: Path, *, title_hint: str) -> ParsedDocument:
        try:
            doc = pymupdf.open(path)
        except (pymupdf.FileDataError, RuntimeError) as exc:
            raise ParseError(f"PDF inválido ou corrompido: {exc}") from exc
        try:
            if doc.needs_pass:
                raise ParseError("PDF protegido por senha")
            pages = [_Page(number=i + 1, lines=_page_lines(page)) for i, page in enumerate(doc)]
            toc = [(lvl, clean_inline(t), pg) for lvl, t, pg in doc.get_toc(simple=True) if clean_inline(t)]
            meta_title = clean_inline((doc.metadata or {}).get("title") or "")
        finally:
            doc.close()

        _strip_repeating(pages)
        if sum(len(ln.text) for p in pages for ln in p.lines) < MIN_TEXT_CHARS:
            raise ParseError("PDF sem texto extraível (provavelmente digitalizado; OCR previsto para fase futura)")

        body = _body_size(pages)
        levels = _heading_levels(pages, body)
        sections = self._sections_from_toc(pages, toc, levels) if toc else self._sections_from_headings(pages, levels)
        title = meta_title or title_hint
        return ParsedDocument(
            title=title,
            item_type=ItemType.PDF,
            sections=[s for s in sections if s.markdown.strip()],
            metadata={"pages": str(len(pages)), "structure": "toc" if toc else ("headings" if levels else "pages")},
        )

    def _sections_from_toc(
        self, pages: list[_Page], toc: list[tuple[int, str, int]], levels: dict[float, int]
    ) -> list[Section]:
        entries = [(lvl, t, max(1, pg)) for lvl, t, pg in toc if lvl <= 2]
        sections: list[Section] = []
        # páginas antes do primeiro item do sumário (capa, apresentação)
        first = entries[0][2]
        if first > 1:
            md = "\n\n".join(_lines_to_markdown(p.lines, levels) for p in pages[: first - 1])
            sections.append(
                Section(title="Introdução", level=1, markdown=md, locator=f"p. 1–{first - 1}", starts_partition=True)
            )
        for i, (lvl, title, start) in enumerate(entries):
            nxt = entries[i + 1][2] if i + 1 < len(entries) else len(pages) + 1
            end = max(start, nxt - 1) if nxt > start else start
            md = "\n\n".join(_lines_to_markdown(p.lines, levels) for p in pages[start - 1 : end])
            loc = f"p. {start}" if start == end else f"p. {start}–{end}"
            sections.append(Section(title=title, level=lvl, markdown=md, locator=loc, starts_partition=lvl == 1))
        return sections

    def _sections_from_headings(self, pages: list[_Page], levels: dict[float, int]) -> list[Section]:
        if not levels:
            return [
                Section(
                    title=f"Página {p.number}",
                    level=1,
                    markdown=_lines_to_markdown(p.lines, levels),
                    locator=f"p. {p.number}",
                )
                for p in pages
            ]
        sections: list[Section] = []
        cur_title, cur_level, cur_start = "Início", 1, 1
        buf: list[_Line] = []
        top = min(levels.values())

        def close(end_page: int) -> None:
            md = _lines_to_markdown(buf, levels)
            if md.strip():
                loc = f"p. {cur_start}" if cur_start == end_page else f"p. {cur_start}–{end_page}"
                sections.append(
                    Section(
                        title=cur_title, level=cur_level, markdown=md, locator=loc, starts_partition=cur_level == top
                    )
                )

        for p in pages:
            for ln in p.lines:
                lvl = levels.get(ln.size) if ln.text and len(ln.text) <= MAX_HEADING_CHARS else None
                if lvl is not None and lvl <= 2:
                    close(p.number)
                    cur_title, cur_level, cur_start, buf = ln.text, lvl, p.number, []
                else:
                    buf.append(ln)
            buf.append(_Line("", 0, False))
        close(pages[-1].number)
        return sections
