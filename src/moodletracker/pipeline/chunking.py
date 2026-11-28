"""Divide o corpo Markdown de cada partição em chunks para o RAG.

* Respeita títulos: cada chunk carrega ``heading_path`` ("Partição › Seção › Subseção") para contexto e citação.
* Agrupa parágrafos até ``chunk_size`` caracteres; parágrafos gigantes são cortados em fronteira de frase.
* ``overlap`` repete o final do chunk anterior no início do próximo (continuidade semântica).
* ``char_start`` aponta o offset no corpo do .md, permitindo citar o trecho exato.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from moodletracker.domain.models import ChunkDraft

_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*(?:<small>.*</small>)?\s*$")
_SENTENCE = re.compile(r"(?<=[.!?…])\s+")
# Linhas geradas pelo writer (fonte, régua e navegação) não são conteúdo.
_SKIP_LINE = re.compile(r"^\s*(>\s*Fonte:|-{3,}\s*$|←|\[\[_index)")


@dataclass
class _Para:
    text: str
    start: int
    heading_path: str


def estimate_tokens(text: str) -> int:
    return max(1, round(len(text) / 4))


def _paragraphs(body: str) -> list[_Para]:
    out: list[_Para] = []
    stack: list[tuple[int, str]] = []
    pos = 0
    for block in re.split(r"(\n{2,})", body):
        start = pos
        pos += len(block)
        text = "\n".join(line for line in block.split("\n") if not _SKIP_LINE.match(line)).strip()
        if not text:
            continue
        m = _HEADING.match(text) if "\n" not in text else None
        if m:
            level = len(m.group(1))
            stack = [(lv, t) for lv, t in stack if lv < level] + [(level, m.group(2).strip())]
            continue
        offset = block.find(text[: min(len(text), 40)])
        out.append(_Para(text=text, start=start + max(0, offset), heading_path=" › ".join(t for _, t in stack)))
    return out


def _split_long(p: _Para, size: int) -> list[_Para]:
    if len(p.text) <= size:
        return [p]
    pieces: list[_Para] = []
    buf, buf_start, offset = "", p.start, p.start
    for sentence in _SENTENCE.split(p.text):
        sent = sentence
        while len(sent) > size:  # frase sem pontuação gigantesca: corte duro
            if buf:
                pieces.append(_Para(buf, buf_start, p.heading_path))
                buf = ""
            pieces.append(_Para(sent[:size], offset, p.heading_path))
            sent, offset = sent[size:], offset + size
        if buf and len(buf) + len(sent) + 1 > size:
            pieces.append(_Para(buf, buf_start, p.heading_path))
            buf, buf_start = "", offset
        if not buf:
            buf_start = offset
        buf = f"{buf} {sent}".strip()
        offset += len(sent) + 1
    if buf:
        pieces.append(_Para(buf, buf_start, p.heading_path))
    return pieces


def chunk_markdown(body: str, *, document_ordinal: int, size: int, overlap: int) -> list[ChunkDraft]:
    paras = [piece for p in _paragraphs(body) for piece in _split_long(p, size)]
    chunks: list[ChunkDraft] = []
    buf: list[_Para] = []

    def emit() -> None:
        if not buf:
            return
        content = "\n\n".join(p.text for p in buf)
        chunks.append(
            ChunkDraft(
                document_ordinal=document_ordinal,
                ordinal=len(chunks) + 1,
                content=content,
                heading_path=buf[0].heading_path,
                char_start=buf[0].start,
                token_estimate=estimate_tokens(content),
            )
        )

    for p in paras:
        current = sum(len(x.text) + 2 for x in buf)
        heading_changed = bool(buf) and p.heading_path != buf[0].heading_path and current >= size // 3
        if buf and (current + len(p.text) > size or heading_changed):
            emit()
            tail = buf[-1].text[-overlap:] if overlap and not heading_changed else ""
            if tail and " " in tail:
                tail = tail[tail.index(" ") + 1 :]  # não começar no meio de uma palavra
            buf = (
                [_Para(f"… {tail}", buf[-1].start + len(buf[-1].text) - len(tail), buf[-1].heading_path)]
                if tail
                else []
            )
        buf.append(p)
    emit()
    return chunks
