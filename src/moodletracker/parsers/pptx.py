"""PPTX → seções Markdown (uma por slide) com python-pptx.

Slides de layout "Seção"/"Section Header" ou só com título iniciam nova partição (aula/tópico).
Notas do apresentador entram como citação; tabelas viram tabelas Markdown.
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any

from pptx import Presentation
from pptx.exc import PackageNotFoundError
from pptx.util import Emu

from moodletracker.domain.models import ItemType, ParsedDocument, Section
from moodletracker.errors import ParseError
from moodletracker.text import clean_inline, markdown_table

_SECTION_LAYOUT_HINTS = ("section", "seção", "secao", "cabeçalho da seção", "divider")


def _shape_markdown(shape: Any, skip_id: int | None) -> list[str]:
    out: list[str] = []
    if shape.shape_id == skip_id:
        return out
    if getattr(shape, "has_table", False) and shape.has_table:
        rows = [[cell.text for cell in row.cells] for row in shape.table.rows]
        table = markdown_table(rows)
        if table:
            out.append(table)
        return out
    if getattr(shape, "shape_type", None) is not None and shape.shape_type == 6:  # GROUP
        for sub in shape.shapes:
            out.extend(_shape_markdown(sub, skip_id))
        return out
    if not getattr(shape, "has_text_frame", False) or not shape.has_text_frame:
        return out
    lines: list[str] = []
    for para in shape.text_frame.paragraphs:
        text = clean_inline("".join(run.text for run in para.runs) or para.text)
        if not text:
            continue
        indent = "  " * max(0, int(para.level))
        lines.append(f"{indent}- {text}")
    if len(lines) == 1:
        lines = [lines[0].lstrip(" -").strip()]
    if lines:
        out.append("\n".join(lines))
    return out


def _is_section_slide(slide: Any, body: list[str]) -> bool:
    layout = (slide.slide_layout.name or "").lower()
    return any(h in layout for h in _SECTION_LAYOUT_HINTS) or (slide.shapes.title is not None and not body)


class PptxParser:
    item_types = (ItemType.PPTX,)

    def parse(self, path: Path, *, title_hint: str) -> ParsedDocument:
        try:
            prs = Presentation(str(path))
        except (PackageNotFoundError, zipfile.BadZipFile, KeyError, ValueError) as exc:
            raise ParseError(f"PPTX inválido ou corrompido: {exc}") from exc

        sections: list[Section] = []
        for idx, slide in enumerate(prs.slides, start=1):
            title_shape = slide.shapes.title
            title = clean_inline(title_shape.text) if title_shape is not None and title_shape.has_text_frame else ""
            skip = title_shape.shape_id if title_shape is not None else None
            ordered = sorted(slide.shapes, key=lambda s: (s.top or Emu(0), s.left or Emu(0)))
            body = [md for shape in ordered for md in _shape_markdown(shape, skip)]
            if not title and body:
                first = body.pop(0)
                title = clean_inline(first.splitlines()[0].lstrip("- "))[:100]
            notes = ""
            if slide.has_notes_slide:
                notes = clean_inline(slide.notes_slide.notes_text_frame.text or "")
            parts = list(body)
            if notes:
                parts.append(f"> **Notas do professor:** {notes}")
            sections.append(
                Section(
                    title=title or f"Slide {idx}",
                    level=2,
                    markdown="\n\n".join(parts),
                    locator=f"slide {idx}",
                    starts_partition=idx > 1 and _is_section_slide(slide, body),
                )
            )

        if not any(s.markdown.strip() or s.title for s in sections):
            raise ParseError("Apresentação sem texto extraível")

        core_title = clean_inline(prs.core_properties.title or "")
        title = core_title or (
            sections[0].title if sections and not sections[0].title.startswith("Slide ") else title_hint
        )
        # Slide-título de capa sem corpo não precisa virar seção vazia: vira introdução do documento.
        return ParsedDocument(
            title=title,
            item_type=ItemType.PPTX,
            sections=sections,
            metadata={"slides": str(len(sections))},
        )
