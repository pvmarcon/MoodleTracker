"""Second Brain: grava partições como Markdown com frontmatter YAML (compatível com Obsidian/Git).

Layout::

    brain/
      <Disciplina>/
        <Aula ou Módulo>/
          <Título do material>/
            _index.md                ← visão geral + links para as partes
            01 - Introdução.md
            02 - Formas normais.md

Cada material ocupa sua própria pasta; ao reprocessar, os .md antigos dela são substituídos.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from moodletracker.domain.models import ParsedDocument, Partition, RawItem, WrittenDocument
from moodletracker.errors import BrainWriteError
from moodletracker.text import sha256_text, slugify

_UNSAFE = re.compile(r'[<>"/\\|?*\x00-\x1f]+')
_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n?", re.DOTALL)
INDEX_NAME = "_index.md"


def safe_name(value: str, max_len: int = 80) -> str:
    name = _UNSAFE.sub("-", value.replace(":", " -")).strip(" .-")
    name = re.sub(r"\s+", " ", name)[:max_len].rstrip(" .-")
    return name or "sem-titulo"


def _strip_leading_heading(markdown: str, titles: set[str]) -> str:
    """Remove um título no início do corpo que repete o título da seção/partição (comum em PDFs)."""
    body = markdown.strip()
    first, _, rest = body.partition("\n")
    m = re.match(r"^#{1,6}\s+(.*)$", first)
    if m and m.group(1).strip() in titles:
        return rest.strip()
    return body


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    m = _FRONTMATTER.match(text)
    if not m:
        return {}, text
    data = yaml.safe_load(m.group(1)) or {}
    if not isinstance(data, dict):
        return {}, text
    return data, text[m.end() :]


def read_markdown(path: Path) -> tuple[dict[str, Any], str]:
    return split_frontmatter(path.read_text(encoding="utf-8"))


def _dump_frontmatter(data: dict[str, Any]) -> str:
    body = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=None, width=1_000)
    return f"---\n{body}---\n"


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


class SecondBrainWriter:
    def __init__(self, root: Path) -> None:
        self.root = root.expanduser().resolve()

    def item_dir(self, item: RawItem, doc_title: str) -> Path:
        base = self.root / safe_name(item.course) / safe_name(item.module)
        candidate = base / safe_name(doc_title or item.title)
        index = candidate / INDEX_NAME
        if index.exists():
            meta, _ = read_markdown(index)
            if meta.get("source_file") not in (None, item.source_id):
                # Outro material com o mesmo título no mesmo módulo: desambigua de forma determinística.
                candidate = (
                    base / f"{safe_name(doc_title or item.title)} ({item.item_type.value}-{item.content_hash[:6]})"
                )
        return candidate

    def write(self, item: RawItem, doc: ParsedDocument, partitions: list[Partition]) -> list[WrittenDocument]:
        if not partitions:
            raise BrainWriteError("Nada para gravar: documento sem partições")
        target = self.item_dir(item, doc.title)
        try:
            target.mkdir(parents=True, exist_ok=True)
            for old in target.glob("*.md"):
                old.unlink()
            written: list[WrittenDocument] = []
            names = [f"{p.ordinal:02d} - {safe_name(p.title, 70)}" for p in partitions]
            for i, part in enumerate(partitions):
                body = self._render_partition(item, doc, part, total=len(partitions), names=names, idx=i)
                path = target / f"{names[i]}.md"
                self._atomic_write(path, body)
                content = split_frontmatter(body)[1]
                written.append(
                    WrittenDocument(
                        ordinal=part.ordinal,
                        title=part.title,
                        path=path.relative_to(self.root),
                        locator=part.locator,
                        content_hash=sha256_text(content),
                        char_count=len(content),
                    )
                )
            self._atomic_write(target / INDEX_NAME, self._render_index(item, doc, partitions, names))
            return written
        except OSError as exc:
            raise BrainWriteError(f"Falha ao gravar em {target}: {exc}") from exc

    def remove(self, relative_paths: list[str]) -> None:
        """Remove partições antigas (e a pasta do material, se ficar só o índice)."""
        dirs: set[Path] = set()
        for rel in relative_paths:
            p = self.resolve(rel)
            if p.exists():
                p.unlink()
            dirs.add(p.parent)
        for d in dirs:
            remaining = [x for x in d.glob("*.md") if x.name != INDEX_NAME]
            if d.exists() and not remaining:
                shutil.rmtree(d, ignore_errors=True)

    def resolve(self, relative: str | Path) -> Path:
        """Resolve um caminho relativo garantindo que fique dentro do brain_dir (evita path traversal)."""
        p = (self.root / relative).resolve()
        if not p.is_relative_to(self.root):
            raise BrainWriteError(f"Caminho fora do Second Brain: {relative}")
        return p

    # ------------------------------------------------------------------ render

    def _base_meta(self, item: RawItem, title: str) -> dict[str, Any]:
        return {
            "course": item.course,
            "module": item.module,
            "title": title,
            "source_file": item.source_id,
            "item_type": item.item_type.value,
            "collected_at": _iso(item.collected_at),
            "content_hash": item.content_hash,
        }

    def _render_partition(
        self, item: RawItem, doc: ParsedDocument, part: Partition, *, total: int, names: list[str], idx: int
    ) -> str:
        meta = self._base_meta(item, part.title) | {
            "document_title": doc.title,
            "part": part.ordinal,
            "parts": total,
            "locator": part.locator,
            "tags": ["moodletracker", slugify(item.course), item.item_type.value],
        }
        lines = [_dump_frontmatter(meta), f"# {part.title}", ""]
        src = Path(item.source_id).name
        lines.append(
            f"> Fonte: `{src}` · {part.locator} · parte {part.ordinal}/{total}" if part.locator else f"> Fonte: `{src}`"
        )
        lines.append("")
        for sec in part.sections:
            if sec.title and sec.title != part.title:
                hashes = "#" * min(6, sec.level + 1)
                loc = f" <small>({sec.locator})</small>" if sec.locator else ""
                lines += [f"{hashes} {sec.title}{loc}", ""]
            body = _strip_leading_heading(sec.markdown, {sec.title, part.title})
            if body:
                lines += [body, ""]
        nav = []
        if idx > 0:
            nav.append(f"← [[{names[idx - 1]}]]")
        nav.append("[[_index|Índice]]")
        if idx < total - 1:
            nav.append(f"[[{names[idx + 1]}]] →")
        lines += ["---", " · ".join(nav), ""]
        return "\n".join(lines)

    def _render_index(self, item: RawItem, doc: ParsedDocument, partitions: list[Partition], names: list[str]) -> str:
        meta = self._base_meta(item, doc.title) | {"parts": len(partitions), "metadata": doc.metadata}
        lines = [
            _dump_frontmatter(meta),
            f"# {doc.title}",
            "",
            f"**Disciplina:** {item.course} · **Módulo:** {item.module}",
            "",
        ]
        lines += [
            f"{p.ordinal}. [[{names[i]}|{p.title}]]" + (f" — {p.locator}" if p.locator else "")
            for i, p in enumerate(partitions)
        ]
        lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _atomic_write(path: Path, text: str) -> None:
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".md")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(text)
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
