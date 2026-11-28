"""Modelos ORM (SQLAlchemy 2.0). Fonte da verdade do schema; ``sql/schema.sql`` é gerado a partir daqui.

A coluna ``chunks.embedding`` é declarada sem dimensão; ``db.schema.init_db`` aplica ``vector(<dim>)``
conforme ``MT_EMBEDDING_DIM`` e cria o índice HNSW (cosseno).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, ClassVar

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from moodletracker.domain.models import ItemStatus, ItemType, PipelineStage, ReviewStatus, RunStatus, RunTrigger


class EventLevel(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


def _pg_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e], validate_strings=True)


ITEM_TYPE = _pg_enum(ItemType, "item_type")
PIPELINE_STAGE = _pg_enum(PipelineStage, "pipeline_stage")
ITEM_STATUS = _pg_enum(ItemStatus, "item_status")
REVIEW_STATUS = _pg_enum(ReviewStatus, "review_status")
RUN_TRIGGER = _pg_enum(RunTrigger, "run_trigger")
RUN_STATUS = _pg_enum(RunStatus, "run_status")
EVENT_LEVEL = _pg_enum(EventLevel, "event_level")


class Base(DeclarativeBase):
    type_annotation_map: ClassVar[dict[Any, Any]] = {dict[str, Any]: JSONB}


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SchemaInfo(Base):
    __tablename__ = "schema_info"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class Course(TimestampMixin, Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)

    items: Mapped[list[Item]] = relationship(back_populates="course")


class Item(TimestampMixin, Base):
    """Material/atividade capturado + estado no pipeline."""

    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("source_adapter", "source_id", name="uq_items_source"),
        Index("ix_items_content_hash", "content_hash"),
        # Um único item "canônico" por hash: duplicatas apontam para ele via duplicate_of_id.
        Index(
            "uq_items_canonical_hash",
            "content_hash",
            unique=True,
            postgresql_where=text("duplicate_of_id IS NULL"),
        ),
        Index("ix_items_status_stage", "status", "stage"),
        Index("ix_items_course_created", "course_id", text("created_at DESC")),
        Index("ix_items_review", "review_status"),
        CheckConstraint("content_hash ~ '^[0-9a-f]{64}$'", name="ck_items_hash_format"),
        CheckConstraint("attempts >= 0", name="ck_items_attempts"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    module: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    item_type: Mapped[ItemType] = mapped_column(ITEM_TYPE, nullable=False)

    source_adapter: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    source_uri: Mapped[str] = mapped_column(Text, nullable=False)
    local_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    stage: Mapped[PipelineStage] = mapped_column(PIPELINE_STAGE, nullable=False)
    status: Mapped[ItemStatus] = mapped_column(ITEM_STATUS, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    duplicate_of_id: Mapped[int | None] = mapped_column(ForeignKey("items.id", ondelete="SET NULL"))

    review_status: Mapped[ReviewStatus] = mapped_column(
        REVIEW_STATUS, nullable=False, server_default=ReviewStatus.UNREVIEWED.value
    )
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    summary: Mapped[str | None] = mapped_column(Text, comment="Rascunho/resumo do agente (próxima fase)")

    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extra: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    course: Mapped[Course] = relationship(back_populates="items")
    documents: Mapped[list[Document]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="Document.ordinal"
    )


class Document(Base):
    """Partição .md gravada no Second Brain."""

    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("item_id", "ordinal", name="uq_documents_item_ordinal"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False, unique=True, comment="Relativo ao brain_dir")
    locator: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    item: Mapped[Item] = relationship(back_populates="documents")


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (UniqueConstraint("document_id", "ordinal", name="uq_chunks_document_ordinal"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    heading_path: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    char_start: Mapped[int] = mapped_column(Integer, nullable=False)
    token_estimate: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_model: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    trigger: Mapped[RunTrigger] = mapped_column(RUN_TRIGGER, nullable=False)
    status: Mapped[RunStatus] = mapped_column(RUN_STATUS, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    error: Mapped[str | None] = mapped_column(Text)


class ItemEvent(Base):
    """Feed de eventos (alimenta a UI e, no futuro, notificações do Discord)."""

    __tablename__ = "item_events"
    __table_args__ = (Index("ix_item_events_created", text("id DESC")),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("pipeline_runs.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    stage: Mapped[PipelineStage | None] = mapped_column(PIPELINE_STAGE)
    level: Mapped[EventLevel] = mapped_column(EVENT_LEVEL, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
