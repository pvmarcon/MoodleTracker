"""Utilitários de texto/Markdown compartilhados."""

from __future__ import annotations

import hashlib
import re
import unicodedata

_WS = re.compile(r"[ \t\u00a0]+")
_MULTI_NL = re.compile(r"\n{3,}")
_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")


def slugify(value: str, max_len: int = 60, fallback: str = "item") -> str:
    norm = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", norm).strip("-")
    slug = slug[:max_len].rstrip("-")
    return slug or fallback


def clean_inline(text: str) -> str:
    return _WS.sub(" ", text).strip()


def normalize_block(text: str) -> str:
    """Junta hifenização de quebra de linha e colapsa espaços, preservando parágrafos."""
    text = _HYPHEN_BREAK.sub(r"\1\2", text.replace("\r\n", "\n").replace("\r", "\n"))
    lines = [clean_inline(line) for line in text.split("\n")]
    return _MULTI_NL.sub("\n\n", "\n".join(lines)).strip()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def md_escape_table_cell(text: str) -> str:
    return clean_inline(text).replace("|", "\\|").replace("\n", " ")


def markdown_table(rows: list[list[str]]) -> str:
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    padded = [[md_escape_table_cell(c) for c in r] + [""] * (width - len(r)) for r in rows]
    header, *body = padded
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * width]
    out += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(out)
