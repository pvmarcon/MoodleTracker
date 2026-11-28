"""Composition root: monta as dependências a partir das Settings (usado por CLI, worker e API)."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Engine

from moodletracker.brain.writer import SecondBrainWriter
from moodletracker.collectors.base import build_collector
from moodletracker.config import Settings
from moodletracker.db.engine import make_engine, make_session_factory
from moodletracker.db.repository import PipelineRepository
from moodletracker.integrations.notifier import NotifierHub, build_notifiers
from moodletracker.parsers.base import default_registry
from moodletracker.pipeline.service import PipelineService
from moodletracker.rag.embeddings import Embedder, build_embedder


@dataclass
class Container:
    settings: Settings
    engine: Engine
    repo: PipelineRepository
    writer: SecondBrainWriter
    embedder: Embedder | None

    def pipeline(self) -> PipelineService:
        """Novo serviço por execução: o collector reflete a configuração atual."""
        return PipelineService(
            settings=self.settings,
            repo=self.repo,
            collector=build_collector(self.settings),
            parsers=default_registry(),
            writer=self.writer,
            embedder=self.embedder,
            notifier=NotifierHub(build_notifiers()),
        )

    def close(self) -> None:
        self.engine.dispose()


def build_container(settings: Settings) -> Container:
    engine = make_engine(settings)
    return Container(
        settings=settings,
        engine=engine,
        repo=PipelineRepository(make_session_factory(engine)),
        writer=SecondBrainWriter(settings.brain_dir),
        embedder=build_embedder(settings),
    )
