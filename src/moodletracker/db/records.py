"""DTOs de leitura retornados pelo repositório (desacoplam ORM de API/serviços)."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict

from moodletracker.domain.models import (
    ItemStatus,
    ItemType,
    PipelineStage,
    RawItem,
    ReviewStatus,
    RunStatus,
    RunTrigger,
)


class _Rec(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CourseRecord(_Rec):
    id: int
    name: str
    slug: str


class ItemRecord(_Rec):
    id: int
    course_id: int
    course_name: str
    module: str
    title: str
    item_type: ItemType
    source_adapter: str
    source_id: str
    source_uri: str
    local_path: str
    content_hash: str
    size_bytes: int
    stage: PipelineStage
    status: ItemStatus
    error: str | None
    attempts: int
    duplicate_of_id: int | None
    review_status: ReviewStatus
    review_note: str | None
    reviewed_at: datetime | None
    collected_at: datetime
    modified_at: datetime | None
    processed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    extra: dict[str, Any]

    def to_raw(self) -> RawItem:
        return RawItem(
            source_adapter=self.source_adapter,
            source_id=self.source_id,
            source_uri=self.source_uri,
            course=self.course_name,
            module=self.module,
            title=self.title,
            item_type=self.item_type,
            local_path=Path(self.local_path),
            content_hash=self.content_hash,
            size_bytes=self.size_bytes,
            collected_at=self.collected_at,
            modified_at=self.modified_at,
        )


class DocumentRecord(_Rec):
    id: int
    item_id: int
    ordinal: int
    title: str
    path: str
    locator: str
    content_hash: str
    char_count: int


class EventRecord(_Rec):
    id: int
    item_id: int | None
    run_id: int | None
    kind: str
    stage: PipelineStage | None
    level: str
    message: str
    data: dict[str, Any]
    created_at: datetime
    item_title: str | None = None
    course_name: str | None = None


class RunRecord(_Rec):
    id: int
    trigger: RunTrigger
    status: RunStatus
    started_at: datetime
    finished_at: datetime | None
    stats: dict[str, Any]
    error: str | None


class ChunkHit(BaseModel):
    chunk_id: int
    item_id: int
    course: str
    document_path: str
    document_title: str
    locator: str
    heading_path: str
    content: str
    distance: float


class ItemFilters(BaseModel):
    course_id: int | None = None
    stage: PipelineStage | None = None
    status: ItemStatus | None = None
    review_status: ReviewStatus | None = None
    item_type: ItemType | None = None
    q: str | None = None
    limit: int = 100
    offset: int = 0


class Page[T](BaseModel):
    items: list[T]
    total: int
