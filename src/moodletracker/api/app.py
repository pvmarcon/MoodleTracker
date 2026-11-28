"""FastAPI: API JSON + web UI estática (inspirada no Autobrr)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from moodletracker import __version__
from moodletracker.api.schemas import (
    CourseOut,
    DocumentContent,
    HealthOut,
    ItemDetail,
    ItemOut,
    ItemPage,
    ReviewIn,
    StatsOut,
    TriggerOut,
)
from moodletracker.brain.writer import read_markdown
from moodletracker.config import Settings
from moodletracker.container import Container, build_container
from moodletracker.db.records import EventRecord, ItemFilters
from moodletracker.db.repository import PipelineRepository
from moodletracker.db.schema import check_db
from moodletracker.domain.models import ItemStatus, ItemType, PipelineStage, ReviewStatus, RunTrigger
from moodletracker.errors import BrainWriteError, ConfigurationError, NotFoundError
from moodletracker.logs import get_logger
from moodletracker.scheduler.worker import InlineTrigger, PipelineTrigger, ScheduledWorker

log = get_logger(__name__)
STATIC_DIR = Path(__file__).resolve().parent.parent / "web" / "static"


# Dependências em nível de módulo (anotações são resolvidas no escopo global por causa de __future__.annotations).
def get_container(request: Request) -> Container:
    return request.app.state.container  # type: ignore[no-any-return]


def get_repo(request: Request) -> PipelineRepository:
    return get_container(request).repo


def get_trigger(request: Request) -> PipelineTrigger:
    return request.app.state.trigger  # type: ignore[no-any-return]


Repo = Annotated[PipelineRepository, Depends(get_repo)]
Trigger = Annotated[PipelineTrigger, Depends(get_trigger)]


def create_app(
    settings: Settings, *, container: Container | None = None, start_scheduler: bool | None = None
) -> FastAPI:
    owns_container = container is None
    c = container or build_container(settings)
    use_scheduler = settings.scheduler_enabled if start_scheduler is None else start_scheduler

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        try:
            check_db(c.engine, settings.embedding_dim)
        except ConfigurationError as exc:
            log.error("api.db_not_ready", error=str(exc))  # a UI mostra o erro em /api/health
        trigger: ScheduledWorker | InlineTrigger
        if use_scheduler:
            trigger = ScheduledWorker(lambda t: c.pipeline().run(t), settings.schedule_interval_seconds)
            trigger.start()
        else:
            trigger = InlineTrigger(lambda t: c.pipeline().run(t))
        app.state.trigger = trigger
        log.info("api.started", version=__version__, scheduler=use_scheduler)
        try:
            yield
        finally:
            trigger.shutdown()
            if owns_container:
                c.close()

    app = FastAPI(title="MoodleTracker", version=__version__, lifespan=lifespan)
    app.state.container = c

    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ConfigurationError)
    async def _config(_: Request, exc: ConfigurationError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    # ------------------------------------------------------------------ API

    @app.get("/api/health", response_model=HealthOut)
    def health(trigger: Trigger) -> HealthOut:
        db: dict[str, str] | None = None
        error = None
        try:
            db = check_db(c.engine, settings.embedding_dim)
        except ConfigurationError as exc:
            error = str(exc)
        emb = f"{settings.embedding_provider.value}:{settings.embedding_model}" if c.embedder else "desativado"
        return HealthOut(
            status="ok" if error is None else "degraded",
            database=db,
            scheduler=trigger.status(),
            collector=settings.collector_adapter.value,
            embeddings=emb,
            error=error,
        )

    @app.get("/api/stats", response_model=StatsOut)
    def stats(r: Repo) -> StatsOut:
        return StatsOut(stats=r.stats(), runs=r.list_runs(10))

    @app.get("/api/courses", response_model=list[CourseOut])
    def courses(r: Repo) -> list[CourseOut]:
        return [CourseOut(id=co.id, name=co.name, slug=co.slug, items=n) for co, n in r.list_courses()]

    @app.get("/api/items", response_model=ItemPage)
    def items(
        r: Repo,
        course_id: int | None = None,
        stage: PipelineStage | None = None,
        status: ItemStatus | None = None,
        review_status: ReviewStatus | None = None,
        item_type: ItemType | None = None,
        q: Annotated[str | None, Query(max_length=200)] = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> ItemPage:
        f = ItemFilters(
            course_id=course_id,
            stage=stage,
            status=status,
            review_status=review_status,
            item_type=item_type,
            q=q,
            limit=limit,
            offset=offset,
        )
        page = r.list_items(f)
        return ItemPage(items=[ItemOut.of(i) for i in page.items], total=page.total, limit=limit, offset=offset)

    @app.get("/api/items/{item_id}", response_model=ItemDetail)
    def item_detail(item_id: int, r: Repo) -> ItemDetail:
        item = r.get_item(item_id)
        total, embedded = r.count_chunks(item_id)
        return ItemDetail(
            item=ItemOut.of(item),
            documents=r.get_documents(item_id),
            events=r.list_events(limit=100, item_id=item_id),
            chunks=total,
            embedded_chunks=embedded,
        )

    @app.patch("/api/items/{item_id}/review", response_model=ItemOut)
    def review(item_id: int, body: ReviewIn, r: Repo) -> ItemOut:
        return ItemOut.of(r.set_review(item_id, body.status, body.note))

    @app.post("/api/items/{item_id}/reprocess", response_model=TriggerOut)
    def reprocess(item_id: int, r: Repo, trigger: Trigger) -> TriggerOut:
        r.requeue(item_id)
        started = trigger.trigger(RunTrigger.MANUAL)
        return TriggerOut(accepted=True, detail="Item na fila" + (" — execução iniciada" if started else ""))

    @app.get("/api/documents/{document_id}", response_model=DocumentContent)
    def document(document_id: int, r: Repo) -> DocumentContent:
        doc = r.get_document(document_id)
        try:
            path = c.writer.resolve(doc.path)
        except BrainWriteError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not path.is_file():
            raise HTTPException(status_code=410, detail="Arquivo .md não existe mais no Second Brain")
        meta, body = read_markdown(path)
        return DocumentContent(
            id=doc.id, path=doc.path, title=doc.title, locator=doc.locator, frontmatter=meta, markdown=body
        )

    @app.get("/api/events", response_model=list[EventRecord])
    def events(
        r: Repo,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        before_id: int | None = None,
        course_id: int | None = None,
    ) -> list[EventRecord]:
        return r.list_events(limit=limit, before_id=before_id, course_id=course_id)

    @app.post("/api/pipeline/run", response_model=TriggerOut, status_code=202)
    def run_pipeline(trigger: Trigger) -> TriggerOut:
        ok = trigger.trigger(RunTrigger.MANUAL)
        return TriggerOut(accepted=ok, detail="Execução iniciada" if ok else "Já existe uma execução em andamento")

    # ------------------------------------------------------------------ UI

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    return app
