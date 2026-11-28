"""Modelos de domínio (Pydantic) compartilhados entre camadas.

Independentes de banco/HTTP: o ORM em ``db/`` e os schemas da API mapeiam a partir daqui.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class ItemType(StrEnum):
    PDF = "pdf"
    PPTX = "pptx"
    HTML = "html"
    OTHER = "other"

    @classmethod
    def from_suffix(cls, suffix: str) -> ItemType:
        return {".pdf": cls.PDF, ".pptx": cls.PPTX, ".html": cls.HTML, ".htm": cls.HTML}.get(suffix.lower(), cls.OTHER)


class PipelineStage(StrEnum):
    """Estágios em ordem. ``DRAFTED`` pertence à próxima fase (agente de rascunho)."""

    DISCOVERED = "discovered"
    EXTRACTED = "extracted"
    MARKDOWN = "markdown"
    CHUNKED = "chunked"
    EMBEDDED = "embedded"
    DRAFTED = "drafted"

    @property
    def order(self) -> int:
        return list(PipelineStage).index(self)


class ItemStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DUPLICATE = "duplicate"


class ReviewStatus(StrEnum):
    UNREVIEWED = "unreviewed"
    APPROVED = "approved"
    NEEDS_CHANGES = "needs_changes"


class RunTrigger(StrEnum):
    SCHEDULER = "scheduler"
    MANUAL = "manual"
    CLI = "cli"


class RunStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


# --------------------------------------------------------------------------- coleta


class RawItem(BaseModel):
    """Item descoberto por um adapter de coleta, ainda sem processamento."""

    model_config = ConfigDict(frozen=True)

    source_adapter: str
    source_id: str = Field(description="Identificador estável na origem (caminho relativo, id do Moodle…)")
    source_uri: str
    course: str
    module: str
    title: str
    item_type: ItemType
    local_path: Path = Field(description="Arquivo local legível pelo parser (baixado ou original)")
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    size_bytes: int = Field(ge=0)
    collected_at: datetime
    modified_at: datetime | None = None


# --------------------------------------------------------------------------- parsing


class Section(BaseModel):
    """Bloco lógico extraído (capítulo do PDF, slide, seção HTML) já em Markdown."""

    title: str
    level: int = Field(ge=1, le=6)
    markdown: str
    locator: str = Field(description="Referência à origem para citação: 'p. 3–5', 'slide 7', '#secao'")
    starts_partition: bool = Field(default=False, description="Força início de nova partição (aula/tópico)")


class ParsedDocument(BaseModel):
    title: str
    item_type: ItemType
    sections: list[Section]
    metadata: dict[str, str] = Field(default_factory=dict)

    @property
    def char_count(self) -> int:
        return sum(len(s.markdown) for s in self.sections)


class Partition(BaseModel):
    """Conjunto de seções que vira UM arquivo .md (uma aula/tópico)."""

    ordinal: int = Field(ge=1)
    title: str
    sections: list[Section]

    @property
    def locator(self) -> str:
        locs = [s.locator for s in self.sections if s.locator]
        if not locs:
            return ""
        return locs[0] if len(locs) == 1 else f"{locs[0]} → {locs[-1]}"


class WrittenDocument(BaseModel):
    """Arquivo .md gravado no Second Brain."""

    ordinal: int
    title: str
    path: Path = Field(description="Caminho relativo ao brain_dir")
    locator: str
    content_hash: str
    char_count: int


class ChunkDraft(BaseModel):
    """Chunk pronto para persistir (embedding opcional)."""

    document_ordinal: int
    ordinal: int
    content: str
    heading_path: str
    char_start: int
    token_estimate: int
    embedding: list[float] | None = None
