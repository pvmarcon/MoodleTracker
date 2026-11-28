"""HTML (páginas do Moodle, exportações) → seções Markdown com BeautifulSoup."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup, UnicodeDammit
from bs4.element import NavigableString, PageElement, Tag

from moodletracker.domain.models import ItemType, ParsedDocument, Section
from moodletracker.errors import ParseError
from moodletracker.text import clean_inline, markdown_table, normalize_block

_DROP = ("script", "style", "noscript", "nav", "header", "footer", "aside", "form", "iframe", "svg", "button")
# Ordem de preferência para a região principal (Moodle usa #region-main / [role=main]).
_MAIN_SELECTORS = ("#region-main", "[role=main]", "main", "article", "#page-content", "body")
_HEADINGS = {f"h{i}": i for i in range(1, 7)}
_BLOCKS = {"p", "div", "section", "article", "ul", "ol", "table", "pre", "blockquote", "figure", *_HEADINGS}


def _inline(node: PageElement) -> str:
    if isinstance(node, NavigableString):
        return str(node)
    if not isinstance(node, Tag):
        return ""
    name = node.name
    inner = "".join(_inline(c) for c in node.children)
    text = clean_inline(inner)
    if not text and name != "br":
        return " " if inner and inner.isspace() else ""
    match name:
        case "br":
            return "\n"
        case "strong" | "b":
            return f"**{text}**"
        case "em" | "i":
            return f"*{text}*"
        case "code":
            return f"`{text}`"
        case "a":
            href = node.get("href")
            if isinstance(href, str) and urlparse(href).scheme in {"http", "https", "mailto"}:
                return f"[{text}]({href})"
            return text
        case "img":
            alt = node.get("alt")
            return f"[imagem: {alt}]" if isinstance(alt, str) and alt.strip() else ""
        case _:
            return inner


def _list(node: Tag, depth: int) -> str:
    lines: list[str] = []
    ordered = node.name == "ol"
    for i, li in enumerate(node.find_all("li", recursive=False), start=1):
        own = "".join(_inline(c) for c in li.children if not (isinstance(c, Tag) and c.name in {"ul", "ol"}))
        marker = f"{i}." if ordered else "-"
        lines.append(f"{'  ' * depth}{marker} {clean_inline(own)}")
        for sub in li.find_all(["ul", "ol"], recursive=False):
            lines.append(_list(sub, depth + 1))
    return "\n".join(line for line in lines if line.strip())


def _blocks(node: Tag) -> list[tuple[int | None, str]]:
    """Achata o DOM em (nível_de_título | None, markdown)."""
    out: list[tuple[int | None, str]] = []
    pending: list[str] = []

    def flush() -> None:
        text = normalize_block("".join(pending))
        if text:
            out.append((None, text))
        pending.clear()

    for child in node.children:
        if isinstance(child, NavigableString):
            pending.append(str(child))
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name
        if name in _HEADINGS:
            flush()
            text = clean_inline(child.get_text(" "))
            if text:
                out.append((_HEADINGS[name], text))
        elif name in {"ul", "ol"}:
            flush()
            md = _list(child, 0)
            if md:
                out.append((None, md))
        elif name == "table":
            flush()
            rows = [[c.get_text(" ") for c in tr.find_all(["th", "td"])] for tr in child.find_all("tr")]
            md = markdown_table(rows)
            if md:
                out.append((None, md))
        elif name == "pre":
            flush()
            out.append((None, f"```\n{child.get_text().strip()}\n```"))
        elif name == "blockquote":
            flush()
            text = normalize_block(child.get_text("\n"))
            if text:
                out.append((None, "\n".join(f"> {line}" for line in text.splitlines())))
        elif name in _BLOCKS:
            flush()
            out.extend(_blocks(child))
        else:
            pending.append(_inline(child))
    flush()
    return out


class HtmlParser:
    item_types = (ItemType.HTML,)

    def parse(self, path: Path, *, title_hint: str) -> ParsedDocument:
        try:
            raw = path.read_bytes()
        except OSError as exc:
            raise ParseError(f"Não foi possível ler o HTML: {exc}") from exc
        markup = UnicodeDammit(raw, ["utf-8", "windows-1252", "latin-1"]).unicode_markup
        if not markup:
            raise ParseError("Não foi possível decodificar o HTML")
        soup = BeautifulSoup(markup, "html.parser")

        page_title = clean_inline(soup.title.get_text()) if soup.title else ""
        for tag in soup.find_all(_DROP):
            tag.decompose()
        main = next((m for sel in _MAIN_SELECTORS if (m := soup.select_one(sel)) is not None), soup)

        blocks = _blocks(main)
        if not any(md for _, md in blocks):
            raise ParseError("HTML sem conteúdo textual")
        heading_levels = [lvl for lvl, _ in blocks if lvl is not None]
        top = min(heading_levels) if heading_levels else 1

        sections: list[Section] = []
        cur_title, cur_level = "", top
        buf: list[str] = []
        for lvl, md in blocks:
            if lvl is not None and lvl <= top + 1:
                if buf or cur_title:
                    sections.append(self._section(cur_title or "Introdução", cur_level, buf, top))
                cur_title, cur_level, buf = md, lvl, []
            elif lvl is not None:
                buf.append(f"{'#' * min(6, lvl - top + 2)} {md}")
            else:
                buf.append(md)
        sections.append(self._section(cur_title or "Conteúdo", cur_level, buf, top))

        h1 = next((md for lvl, md in blocks if lvl == top), "")
        return ParsedDocument(
            title=page_title or h1 or title_hint,
            item_type=ItemType.HTML,
            sections=[s for s in sections if s.markdown.strip() or s.title],
            metadata={"sections": str(len(sections))},
        )

    @staticmethod
    def _section(title: str, level: int, buf: list[str], top: int) -> Section:
        return Section(
            title=title,
            level=max(1, level - top + 1),
            markdown="\n\n".join(buf),
            locator=f"§ {title}",
            starts_partition=level == top,
        )
