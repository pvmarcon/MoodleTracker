"""Barramento de notificações do pipeline — ponto de extensão para o bot do Discord (e outros).

O core só conhece ``Notifier``; adicionar Discord/Telegram/e-mail = nova implementação registrada em
``build_notifiers`` sem tocar no pipeline. Falhas de um notifier nunca derrubam o processamento.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel, Field

from moodletracker.domain.models import PipelineStage
from moodletracker.logs import get_logger

log = get_logger(__name__)


class EventKind(StrEnum):
    ITEM_NEW = "item_new"
    ITEM_CHANGED = "item_changed"
    ITEM_COMPLETED = "item_completed"
    ITEM_FAILED = "item_failed"
    RUN_FINISHED = "run_finished"


class PipelineEvent(BaseModel):
    kind: EventKind
    message: str
    item_id: int | None = None
    course: str | None = None
    title: str | None = None
    stage: PipelineStage | None = None
    data: dict[str, object] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Notifier(Protocol):
    name: str

    def notify(self, event: PipelineEvent) -> None: ...


class LoggingNotifier:
    name = "log"

    def notify(self, event: PipelineEvent) -> None:
        log.info("notify", kind=event.kind.value, item_id=event.item_id, course=event.course, message=event.message)


class NotifierHub:
    def __init__(self, notifiers: Sequence[Notifier]) -> None:
        self._notifiers = list(notifiers)

    def publish(self, event: PipelineEvent) -> None:
        for n in self._notifiers:
            try:
                n.notify(event)
            except Exception:  # um canal com problema não pode parar o pipeline
                log.exception("notifier.failed", notifier=n.name, kind=event.kind.value)


def build_notifiers() -> list[Notifier]:
    return [LoggingNotifier()]
