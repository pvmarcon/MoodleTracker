"""CLI: ``moodletracker [db init|db check|db schema|run|worker|serve|samples|search]``."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Annotated

import typer

from moodletracker.config import Settings, get_settings
from moodletracker.errors import ConfigurationError, MoodleTrackerError
from moodletracker.logs import configure_logging, get_logger

app = typer.Typer(
    no_args_is_help=True, add_completion=False, help="Pipeline Moodle → Second Brain (.md) → RAG (pgvector)."
)
db_app = typer.Typer(no_args_is_help=True, help="Banco de dados.")
app.add_typer(db_app, name="db")
log = get_logger("moodletracker.cli")


def _settings() -> Settings:
    try:
        s = get_settings()
    except Exception as exc:  # pydantic.ValidationError → mensagem legível
        typer.secho(f"Configuração inválida:\n{exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(2) from exc
    configure_logging(s)
    return s


def _fail(exc: Exception) -> None:
    typer.secho(f"Erro: {exc}", fg=typer.colors.RED, err=True)
    raise typer.Exit(1) from exc


@db_app.command("init")
def db_init() -> None:
    """Cria extensão pgvector, tabelas e índice vetorial (idempotente)."""
    from moodletracker.db.engine import make_engine
    from moodletracker.db.schema import check_db, init_db

    s = _settings()
    engine = make_engine(s)
    try:
        init_db(engine, s.embedding_dim)
        info = check_db(engine, s.embedding_dim)
    except ConfigurationError as exc:
        _fail(exc)
    finally:
        engine.dispose()
    typer.secho(f"Banco pronto: {info}", fg=typer.colors.GREEN)


@db_app.command("check")
def db_check() -> None:
    """Verifica conexão, pgvector e dimensão dos embeddings."""
    from moodletracker.db.engine import make_engine
    from moodletracker.db.schema import check_db

    s = _settings()
    engine = make_engine(s)
    try:
        typer.echo(check_db(engine, s.embedding_dim))
    except ConfigurationError as exc:
        _fail(exc)
    finally:
        engine.dispose()


@db_app.command("schema")
def db_schema(
    out: Annotated[Path | None, typer.Option(help="Grava em arquivo em vez de stdout")] = None,
    dim: Annotated[int | None, typer.Option(help="Dimensão do vetor (padrão: MT_EMBEDDING_DIM)")] = None,
) -> None:
    """Imprime o DDL de referência gerado a partir dos modelos ORM."""
    from moodletracker.db.schema import render_schema_sql

    sql = render_schema_sql(dim or Settings().embedding_dim)
    if out:
        out.write_text(sql, encoding="utf-8")
        typer.echo(f"Escrito em {out}")
    else:
        sys.stdout.write(sql)


@app.command()
def run() -> None:
    """Executa UMA passada do pipeline (coleta → .md → chunks → embeddings)."""
    from moodletracker.container import build_container
    from moodletracker.domain.models import RunStatus, RunTrigger

    s = _settings()
    c = build_container(s)
    try:
        report = c.pipeline().run(RunTrigger.CLI)
    except MoodleTrackerError as exc:
        _fail(exc)
    finally:
        c.close()
    color = typer.colors.GREEN if report.status is RunStatus.SUCCEEDED else typer.colors.RED
    typer.secho(f"Execução #{report.run_id}: {report.status.value} {report.as_stats()}", fg=color)
    if report.error:
        typer.secho(report.error, fg=typer.colors.RED, err=True)
    if report.status is RunStatus.FAILED:
        raise typer.Exit(1)


@app.command()
def worker() -> None:
    """Scheduler standalone (sem HTTP). Use com `serve` + MT_SCHEDULER_ENABLED=false para separar processos."""
    from moodletracker.container import build_container
    from moodletracker.scheduler.worker import ScheduledWorker

    s = _settings()
    c = build_container(s)
    w = ScheduledWorker(lambda t: c.pipeline().run(t), s.schedule_interval_seconds, blocking=True)
    try:
        w.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("worker.interrupted")
    finally:
        w.shutdown()
        c.close()


@app.command()
def serve(
    host: Annotated[str | None, typer.Option(help="Padrão: MT_API_HOST")] = None,
    port: Annotated[int | None, typer.Option(help="Padrão: MT_API_PORT")] = None,
    scheduler: Annotated[
        bool | None, typer.Option("--scheduler/--no-scheduler", help="Padrão: MT_SCHEDULER_ENABLED")
    ] = None,
) -> None:
    """API + web UI (e scheduler embutido, se habilitado)."""
    import uvicorn

    from moodletracker.api.app import create_app

    s = _settings()
    application = create_app(s, start_scheduler=scheduler)
    uvicorn.run(application, host=host or s.api_host, port=port or s.api_port, log_config=None)


@app.command()
def samples(dest: Annotated[Path | None, typer.Option(help="Padrão: MT_INBOX_DIR")] = None) -> None:
    """Cria materiais de exemplo (PDF, PPTX, HTML) na pasta de entrada."""
    from moodletracker.devtools.samples import create_sample_inbox

    s = _settings()
    for p in create_sample_inbox(dest or s.inbox_dir):
        typer.echo(f"  + {p}")


@app.command()
def search(
    query: str,
    k: Annotated[int, typer.Option("--k", "-k", min=1, max=50, help="Número de trechos")] = 5,
) -> None:
    """Busca semântica nos chunks (requer MT_EMBEDDING_PROVIDER configurado). Mostra as citações."""
    from moodletracker.container import build_container

    s = _settings()
    c = build_container(s)
    try:
        if c.embedder is None:
            raise ConfigurationError("Embeddings desativados (MT_EMBEDDING_PROVIDER=none).")
        vec = c.embedder.embed([query])[0]
        hits = c.repo.search_chunks(vec, k=k)
    except MoodleTrackerError as exc:
        _fail(exc)
    finally:
        c.close()
    if not hits:
        typer.echo("Nenhum trecho indexado com embedding.")
    for h in hits:
        typer.secho(f"[{1 - h.distance:.3f}] {h.document_path} · {h.locator}", fg=typer.colors.CYAN)
        typer.echo(f"   {h.heading_path}")
        typer.echo("   " + h.content[:240].replace("\n", " ") + ("…" if len(h.content) > 240 else ""))


if __name__ == "__main__":
    app()
