"""Worker de agendamento (APScheduler) desacoplado do pipeline.

``PipelineTrigger`` é a porta usada pela API/CLI para disparar execuções sem saber se há scheduler:
* ``ScheduledWorker`` — roda em intervalo e aceita disparo manual (mesmo processo da API ou ``moodletracker worker``).
* ``InlineTrigger`` — sem scheduler: executa sob demanda em thread de fundo.
Execuções concorrentes são barradas pelo advisory lock no banco, então vários processos convivem com segurança.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Protocol

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_MAX_INSTANCES, JobExecutionEvent
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from moodletracker.domain.models import RunTrigger
from moodletracker.logs import get_logger
from moodletracker.pipeline.service import RunReport

log = get_logger(__name__)

RunFn = Callable[[RunTrigger], RunReport]
JOB_ID = "pipeline-interval"


class PipelineTrigger(Protocol):
    def trigger(self, trigger: RunTrigger = RunTrigger.MANUAL) -> bool: ...

    def status(self) -> dict[str, object]: ...


class ScheduledWorker:
    def __init__(self, run: RunFn, interval_seconds: int, *, blocking: bool = False) -> None:
        self._run = run
        self.interval_seconds = interval_seconds
        self._scheduler = (BlockingScheduler if blocking else BackgroundScheduler)(
            timezone=UTC, job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 60}
        )
        self._scheduler.add_listener(self._on_job_event, EVENT_JOB_ERROR | EVENT_JOB_MAX_INSTANCES)

    def _safe_run(self, trigger: RunTrigger) -> None:
        try:
            self._run(trigger)
        except Exception:
            log.exception("worker.run_crashed", trigger=trigger.value)

    def _on_job_event(self, event: JobExecutionEvent) -> None:
        if event.code == EVENT_JOB_MAX_INSTANCES:
            log.info("worker.overlap_skipped", job_id=event.job_id)
        elif event.exception is not None:
            log.error("worker.job_error", job_id=event.job_id, error=str(event.exception))

    def start(self) -> None:
        self._scheduler.add_job(
            self._safe_run,
            IntervalTrigger(seconds=self.interval_seconds, timezone=UTC),
            args=[RunTrigger.SCHEDULER],
            id=JOB_ID,
            replace_existing=True,
            next_run_time=datetime.now(UTC),
        )
        log.info("worker.started", interval_s=self.interval_seconds)
        self._scheduler.start()  # bloqueia no modo BlockingScheduler

    def trigger(self, trigger: RunTrigger = RunTrigger.MANUAL) -> bool:
        if not self._scheduler.running:
            return False
        self._scheduler.add_job(
            self._safe_run, args=[trigger], id="pipeline-manual", replace_existing=True, next_run_time=datetime.now(UTC)
        )
        return True

    def status(self) -> dict[str, object]:
        job = self._scheduler.get_job(JOB_ID) if self._scheduler.running else None
        return {
            "mode": "scheduler",
            "running": self._scheduler.running,
            "interval_seconds": self.interval_seconds,
            "next_run_at": job.next_run_time.isoformat() if job and job.next_run_time else None,
        }

    def shutdown(self, wait: bool = True) -> None:
        """Para o scheduler; por padrão aguarda a execução em andamento terminar (desligamento gracioso)."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=wait)
            log.info("worker.stopped", waited=wait)


class InlineTrigger:
    """Sem scheduler: dispara execuções em thread daemon, uma por vez."""

    def __init__(self, run: RunFn) -> None:
        self._run = run
        self._busy = threading.Lock()
        self._thread: threading.Thread | None = None

    def trigger(self, trigger: RunTrigger = RunTrigger.MANUAL) -> bool:
        if not self._busy.acquire(blocking=False):
            return False

        def target() -> None:
            try:
                self._run(trigger)
            except Exception:
                log.exception("trigger.run_crashed")
            finally:
                self._busy.release()

        self._thread = threading.Thread(target=target, name="pipeline-inline", daemon=True)
        self._thread.start()
        return True

    def status(self) -> dict[str, object]:
        return {"mode": "on-demand", "running": self._busy.locked(), "interval_seconds": None, "next_run_at": None}

    def shutdown(self, wait: bool = True, timeout_s: float = 120) -> None:
        """Aguarda a execução em andamento (se houver) antes de liberar recursos."""
        thread = self._thread
        if wait and thread is not None and thread.is_alive():
            log.info("trigger.waiting_inflight_run")
            thread.join(timeout_s)
