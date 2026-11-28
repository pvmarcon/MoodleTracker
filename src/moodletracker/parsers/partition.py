"""Agrupa seções em partições (um arquivo .md por aula/tópico)."""

from __future__ import annotations

from moodletracker.domain.models import ParsedDocument, Partition, Section


def _split_oversized(section: Section, max_chars: int) -> list[Section]:
    if len(section.markdown) <= max_chars:
        return [section]
    parts: list[Section] = []
    buf: list[str] = []
    size = 0
    for para in section.markdown.split("\n\n"):
        if buf and size + len(para) > max_chars:
            parts.append(section.model_copy(update={"markdown": "\n\n".join(buf)}))
            buf, size = [], 0
        buf.append(para)
        size += len(para) + 2
    if buf:
        parts.append(section.model_copy(update={"markdown": "\n\n".join(buf)}))
    return [
        p if i == 0 else p.model_copy(update={"title": f"{section.title} (cont. {i + 1})", "starts_partition": False})
        for i, p in enumerate(parts)
    ]


def partition_document(doc: ParsedDocument, max_chars: int) -> list[Partition]:
    """Regras:
    * ``starts_partition`` sempre abre uma nova partição (capítulo do sumário, slide de seção, h1/h2).
    * Se a partição corrente passaria de ``max_chars``, abre outra.
    * Seções maiores que ``max_chars`` são quebradas por parágrafo.
    """
    groups: list[list[Section]] = []
    current: list[Section] = []
    size = 0
    for original in doc.sections:
        for sec in _split_oversized(original, max_chars):
            seclen = len(sec.markdown)
            if current and (sec.starts_partition or size + seclen > max_chars):
                groups.append(current)
                current, size = [], 0
            current.append(sec)
            size += seclen
    if current:
        groups.append(current)

    if len(groups) == 1:
        return [Partition(ordinal=1, title=doc.title, sections=groups[0])]
    partitions: list[Partition] = []
    for i, g in enumerate(groups, start=1):
        head = g[0]
        title = head.title if head.starts_partition or i == 1 else f"{doc.title} — parte {i}"
        partitions.append(Partition(ordinal=i, title=title, sections=g))
    return partitions
