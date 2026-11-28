"""Contrato dos adapters de coleta.

Um *Collector* só descobre itens e garante um arquivo local legível. Não decide se o item é novo:
deduplicação e estado ficam no pipeline/banco, de modo que trocar a origem (pasta → Moodle) não
altera o resto do sistema.
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterator
from pathlib import Path
from typing import Protocol, runtime_checkable

from moodletracker.config import CollectorAdapter, Settings
from moodletracker.domain.models import RawItem
from moodletracker.errors import ConfigurationError

_HASH_BLOCK = 1024 * 1024


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while block := fh.read(_HASH_BLOCK):
            h.update(block)
    return h.hexdigest()


@runtime_checkable
class Collector(Protocol):
    """Origem de materiais. Implementações: ``LocalFolderCollector`` (agora), ``MoodleCollector`` (futuro)."""

    name: str

    def discover(self) -> Iterator[RawItem]:
        """Itera os itens disponíveis na origem. Erros por item devem ser logados e pulados;
        erros que inviabilizam a coleta inteira levantam ``CollectorError``."""
        ...

    def healthcheck(self) -> None:
        """Levanta ``CollectorError`` se a origem estiver inacessível."""
        ...


def build_collector(settings: Settings) -> Collector:
    from moodletracker.collectors.local_folder import LocalFolderCollector

    match settings.collector_adapter:
        case CollectorAdapter.LOCAL_FOLDER:
            return LocalFolderCollector(
                root=settings.inbox_dir,
                extensions=settings.supported_extensions,
                max_bytes=settings.max_file_bytes,
            )
        case CollectorAdapter.MOODLE:
            raise ConfigurationError(
                "O conector Moodle ainda não foi implementado nesta fase. "
                "Veja collectors/moodle/protocol.py e use MT_COLLECTOR_ADAPTER=local_folder."
            )
