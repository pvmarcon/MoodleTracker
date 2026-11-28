"""Criação/validação do schema e geração do DDL de referência (``sql/schema.sql``).

Migrações versionadas (Alembic) entram quando o schema estabilizar; por ora ``init_db`` é idempotente.
"""

from __future__ import annotations

from sqlalchemy import Engine, Enum, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.schema import CreateIndex, CreateTable

from moodletracker.db.tables import Base, SchemaInfo
from moodletracker.errors import ConfigurationError

SCHEMA_VERSION = "1"
HNSW_INDEX = "ix_chunks_embedding_hnsw"


def _vector_ddl(dim: int) -> list[str]:
    return [
        f"ALTER TABLE chunks ALTER COLUMN embedding TYPE vector({dim})",
        f"CREATE INDEX IF NOT EXISTS {HNSW_INDEX} ON chunks USING hnsw (embedding vector_cosine_ops)",
    ]


def init_db(engine: Engine, embedding_dim: int) -> None:
    """Cria extensão, tabelas, coluna vetorial tipada e índice. Idempotente."""
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except (OperationalError, ProgrammingError) as exc:
        raise ConfigurationError(
            "Não foi possível habilitar a extensão pgvector. Use a imagem pgvector/pgvector (docker compose up -d db)."
        ) from exc

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        current = conn.execute(select(SchemaInfo.value).where(SchemaInfo.key == "embedding_dim")).scalar_one_or_none()
        if current is not None and int(current) != embedding_dim:
            raise ConfigurationError(
                f"O banco foi criado com embedding_dim={current}, mas MT_EMBEDDING_DIM={embedding_dim}. "
                "Ajuste a variável ou recrie o banco (os embeddings existentes seriam incompatíveis)."
            )
        if current is None:
            for stmt in _vector_ddl(embedding_dim):
                conn.execute(text(stmt))
            conn.execute(
                postgresql.insert(SchemaInfo)
                .values(
                    [
                        {"key": "embedding_dim", "value": str(embedding_dim)},
                        {"key": "schema_version", "value": SCHEMA_VERSION},
                    ]
                )
                .on_conflict_do_nothing()
            )


def check_db(engine: Engine, embedding_dim: int) -> dict[str, str]:
    """Verifica conectividade, pgvector e compatibilidade da dimensão. Levanta ``ConfigurationError``."""
    try:
        with engine.connect() as conn:
            ext = conn.execute(
                text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
            ).scalar_one_or_none()
            if ext is None:
                raise ConfigurationError("Extensão pgvector ausente. Rode `moodletracker db init`.")
            info = {k: v for k, v in conn.execute(select(SchemaInfo.key, SchemaInfo.value)).all()}
    except ProgrammingError as exc:
        raise ConfigurationError("Schema não inicializado. Rode `moodletracker db init`.") from exc
    except OperationalError as exc:
        raise ConfigurationError(f"Banco inacessível: {exc.orig}") from exc
    if info.get("embedding_dim") != str(embedding_dim):
        raise ConfigurationError(
            f"Dimensão de embedding divergente (banco={info.get('embedding_dim')}, config={embedding_dim})."
        )
    return {"pgvector": str(ext), **info}


def render_schema_sql(embedding_dim: int) -> str:
    """DDL completo para PostgreSQL (referência/revisão; a aplicação usa ``init_db``)."""
    dialect = postgresql.dialect()  # type: ignore[no-untyped-call]
    out = [
        "-- Gerado por `moodletracker db schema`. Não edite à mão: a fonte é src/moodletracker/db/tables.py",
        f"-- embedding_dim={embedding_dim}",
        "CREATE EXTENSION IF NOT EXISTS vector;",
        "",
    ]
    enums = {c.type.name: c.type for t in Base.metadata.sorted_tables for c in t.columns if isinstance(c.type, Enum)}
    for name in sorted(n for n in enums if n):
        values = ", ".join(f"'{v}'" for v in enums[name].enums)
        out.append(f"CREATE TYPE {name} AS ENUM ({values});")
    out.append("")
    for table in Base.metadata.sorted_tables:
        out.append(str(CreateTable(table).compile(dialect=dialect)).strip() + ";")
        for idx in sorted(table.indexes, key=lambda i: i.name or ""):
            out.append(str(CreateIndex(idx).compile(dialect=dialect)).strip() + ";")
        out.append("")
    out += [s + ";" for s in _vector_ddl(embedding_dim)]
    out.append(
        f"INSERT INTO schema_info (key, value) VALUES ('embedding_dim', '{embedding_dim}'), "
        f"('schema_version', '{SCHEMA_VERSION}') ON CONFLICT DO NOTHING;"
    )
    return "\n".join(out) + "\n"
