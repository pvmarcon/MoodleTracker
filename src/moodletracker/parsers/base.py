"""Contrato dos parsers e registro por tipo de item."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from moodletracker.domain.models import ItemType, ParsedDocument
from moodletracker.errors import UnsupportedFormatError


class Parser(Protocol):
    @property
    def item_types(self) -> tuple[ItemType, ...]: ...

    def parse(self, path: Path, *, title_hint: str) -> ParsedDocument:
        """Extrai o arquivo em seções Markdown. Levanta ``ParseError`` em falhas."""
        ...


class ParserRegistry:
    def __init__(self) -> None:
        self._parsers: dict[ItemType, Parser] = {}

    def register(self, parser: Parser) -> None:
        for t in parser.item_types:
            self._parsers[t] = parser

    def get(self, item_type: ItemType) -> Parser:
        try:
            return self._parsers[item_type]
        except KeyError:
            raise UnsupportedFormatError(f"Nenhum parser para o tipo '{item_type}'") from None

    @property
    def supported(self) -> tuple[ItemType, ...]:
        return tuple(self._parsers)


def default_registry() -> ParserRegistry:
    from moodletracker.parsers.html import HtmlParser
    from moodletracker.parsers.pdf import PdfParser
    from moodletracker.parsers.pptx import PptxParser

    reg = ParserRegistry()
    for p in (PdfParser(), PptxParser(), HtmlParser()):
        reg.register(p)
    return reg
