"""Schemas HTTP (contrato público consumido pela web UI e, no futuro, pelo bot do Discord)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from moodletracker.db.records import DocumentRecord, EventRecord, ItemRecord, RunRecord
from moodletracker.domain.models import ItemStatus, ItemType, PipelineStage, ReviewStatus

STAGES = [s.value for s in PipelineStage]


class ItemOut(BaseModel):
    id: int
    course_id: int
    course: str
    module: str
    title: str
    item_type: ItemType
    source_id: str
    size_bytes: int
    content_hash: str
    stage: PipelineStage
    stage_index: int
    status: ItemStatus
    error: str | None
    attempts: int
    duplicate_of_id: int | None
    review_status: ReviewStatus
    review_note: str | None
    reviewed_at: datetime | None
    collected_at: datetime
    processed_at: datetime | None
    updated_at: datetime

    @classmethod
    def of(cls, r: ItemRecord) -> ItemOut:
        return cls(
            id=r.id,
            course_id=r.course_id,
            course=r.course_name,
            module=r.module,
            title=r.title,
            item_type=r.item_type,
            source_id=r.source_id,
            size_bytes=r.size_bytes,
            content_hash=r.content_hash,
            stage=r.stage,
            stage_index=r.stage.order,
            status=r.status,
            error=r.error,
            attempts=r.attempts,
            duplicate_of_id=r.duplicate_of_id,
            review_status=r.review_status,
            review_note=r.review_note,
            reviewed_at=r.reviewed_at,
            collected_at=r.collected_at,
            processed_at=r.processed_at,
            updated_at=r.updated_at,
        )


class ItemPage(BaseModel):
    items: list[ItemOut]
    total: int
    limit: int
    offset: int


class ItemDetail(BaseModel):
    item: ItemOut
    documents: list[DocumentRecord]
    events: list[EventRecord]
    chunks: int
    embedded_chunks: int
    stages: list[str] = Field(default_factory=lambda: STAGES)


class CourseOut(BaseModel):
    id: int
    name: str
    slug: str
    items: int


class ReviewIn(BaseModel):
    status: ReviewStatus
    note: str | None = Field(default=None, max_length=2_000)


class DocumentContent(BaseModel):
    id: int
    path: str
    title: str
    locator: str
    frontmatter: dict[str, Any]
    markdown: str


class TriggerOut(BaseModel):
    accepted: bool
    detail: str


class HealthOut(BaseModel):
    status: str
    database: dict[str, str] | None
    scheduler: dict[str, object]
    collector: str
    embeddings: str
    error: str | None = None


class StatsOut(BaseModel):
    stats: dict[str, Any]
    runs: list[RunRecord]
    stages: list[str] = Field(default_factory=lambda: STAGES)
