"""Adapter de pasta local — permite testar o pipeline inteiro offline.

Convenção de pastas (espelha a estrutura do Moodle)::

    inbox/
      <Disciplina>/
        <Aula ou Módulo>/arquivo.pdf    → course=Disciplina, module=Aula ou Módulo
        arquivo-solto.pptx              → module="Geral"

Arquivos/pastas iniciados por ``.`` ou ``_`` são ignorados.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

from moodletracker.collectors.base import sha256_file
from moodletracker.domain.models import ItemType, RawItem
from moodletracker.errors import CollectorError
from moodletracker.logs import get_logger

log = get_logger(__name__)

DEFAULT_MODULE = "Geral"


class LocalFolderCollector:
    name = "local_folder"

    def __init__(self, root: Path, extensions: tuple[str, ...], max_bytes: int) -> None:
        self.root = root.expanduser().resolve()
        self.extensions = tuple(e.lower() for e in extensions)
        self.max_bytes = max_bytes

    def healthcheck(self) -> None:
        if not self.root.exists():
            raise CollectorError(f"Pasta de entrada não existe: {self.root}")
        if not self.root.is_dir():
            raise CollectorError(f"Caminho de entrada não é uma pasta: {self.root}")

    def discover(self) -> Iterator[RawItem]:
        self.healthcheck()
        for path in sorted(self.root.rglob("*")):
            rel = path.relative_to(self.root)
            if any(part.startswith((".", "_")) for part in rel.parts):
                continue
            if not path.is_file() or path.suffix.lower() not in self.extensions:
                continue
            try:
                item = self._to_raw_item(path, rel)
            except OSError as exc:
                log.warning("collector.file_unreadable", path=str(rel), error=str(exc))
                continue
            if item is not None:
                yield item

    def _to_raw_item(self, path: Path, rel: Path) -> RawItem | None:
        stat = path.stat()
        if stat.st_size > self.max_bytes:
            log.warning("collector.file_too_large", path=str(rel), size_bytes=stat.st_size, max_bytes=self.max_bytes)
            return None
        if stat.st_size == 0:
            log.warning("collector.file_empty", path=str(rel))
            return None

        parents = rel.parts[:-1]
        if not parents:
            log.warning("collector.file_without_course", path=str(rel), hint="coloque em inbox/<Disciplina>/...")
            return None
        course = parents[0]
        module = " / ".join(parents[1:]) or DEFAULT_MODULE

        return RawItem(
            source_adapter=self.name,
            source_id=rel.as_posix(),
            source_uri=path.as_uri(),
            course=course,
            module=module,
            title=path.stem.replace("_", " ").strip(),
            item_type=ItemType.from_suffix(path.suffix),
            local_path=path,
            content_hash=sha256_file(path),
            size_bytes=stat.st_size,
            collected_at=datetime.now(UTC),
            modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
        )
