from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

from moodletracker.config import Settings
from moodletracker.db.schema import init_db
from moodletracker.devtools.samples import create_sample_inbox

TEST_DB_URL = os.environ.get(
    "MT_TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/moodletracker_test"
)
TEST_DIM = 8


@pytest.fixture
def inbox(tmp_path: Path) -> Path:
    root = tmp_path / "inbox"
    create_sample_inbox(root)
    return root


@pytest.fixture
def make_settings(tmp_path: Path):  # type: ignore[no-untyped-def]
    def factory(**overrides: object) -> Settings:
        base: dict[str, object] = {
            "database_url": TEST_DB_URL,
            "inbox_dir": tmp_path / "inbox",
            "brain_dir": tmp_path / "brain",
            "embedding_dim": TEST_DIM,
            "scheduler_enabled": False,
            "_env_file": None,
        }
        base.update(overrides)
        return Settings(**base)  # type: ignore[arg-type]

    return factory


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """Cria um banco de teste descartável; pula testes `db` se não houver PostgreSQL+pgvector."""
    url = make_url(TEST_DB_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    except OperationalError as exc:
        pytest.skip(f"PostgreSQL indisponível para testes: {exc.orig}")
    engine = create_engine(TEST_DB_URL)
    init_db(engine, TEST_DIM)
    engine.dispose()
    yield TEST_DB_URL
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture
def clean_db(database_url: str) -> Iterator[str]:
    engine = create_engine(database_url)
    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE item_events, chunks, documents, items, courses, pipeline_runs RESTART IDENTITY CASCADE")
        )
    engine.dispose()
    yield database_url
