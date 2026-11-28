"""Contratos do conector Moodle (implementação na próxima fase).

Duas estratégias previstas, intercambiáveis atrás de ``MoodleClient``:

1. **Web Services REST** (preferida): ``/webservice/rest/server.php`` com token do usuário.
   Funções: ``core_enrol_get_users_courses``, ``core_course_get_contents``,
   ``mod_assign_get_assignments`` e download via ``/webservice/pluginfile.php?token=…``.
2. **Playwright** (fallback quando a instituição desabilita web services): login com sessão
   persistida e raspagem das páginas de curso.

O ``MoodleCollector`` futuro converte ``MoodleResource`` → ``RawItem`` (baixando para um cache local)
e implementa ``moodletracker.collectors.base.Collector`` — o restante do pipeline não muda.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel


class MoodleCourse(BaseModel):
    id: int
    shortname: str
    fullname: str


class MoodleResource(BaseModel):
    """Arquivo, página ou atividade dentro de uma seção (aula/tópico) do curso."""

    course_id: int
    section_name: str
    module_id: int
    module_type: str  # resource | page | url | assign | folder | quiz …
    name: str
    file_url: str | None
    mimetype: str | None
    time_modified: datetime | None
    due_at: datetime | None = None  # atividades com prazo (assign/quiz)


class MoodleClient(Protocol):
    def list_courses(self) -> list[MoodleCourse]: ...

    def iter_resources(self, course: MoodleCourse) -> Iterator[MoodleResource]: ...

    def download(self, resource: MoodleResource, dest_dir: Path) -> Path: ...
