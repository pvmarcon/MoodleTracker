from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from moodletracker.collectors import build_collector, sha256_file
from moodletracker.collectors.local_folder import LocalFolderCollector
from moodletracker.config import CollectorAdapter, Settings
from moodletracker.errors import CollectorError, ConfigurationError


def test_local_folder_maps_course_and_module(inbox: Path) -> None:
    (inbox / "Banco de Dados" / "solto.html").write_text("<p>oi</p>")
    (inbox / "Banco de Dados" / ".oculto.pdf").write_bytes(b"x")
    (inbox / "_rascunhos").mkdir()
    (inbox / "_rascunhos" / "a.pdf").write_bytes(b"x")
    (inbox / "Banco de Dados" / "notas.txt").write_text("ignorado")
    (inbox / "raiz.pdf").write_bytes(b"sem disciplina")
    (inbox / "Banco de Dados" / "vazio.html").write_bytes(b"")

    items = {i.source_id: i for i in LocalFolderCollector(inbox, (".pdf", ".pptx", ".html"), 10**8).discover()}
    assert set(items) == {
        "Banco de Dados/Aula 03 - Normalização/normalizacao.pdf",
        "Banco de Dados/Aula 04 - Índices/indices.pptx",
        "Banco de Dados/solto.html",
        "Engenharia de Software/Semana 2 - Requisitos/atividade-requisitos.html",
    }
    pdf = items["Banco de Dados/Aula 03 - Normalização/normalizacao.pdf"]
    assert (pdf.course, pdf.module, pdf.title) == ("Banco de Dados", "Aula 03 - Normalização", "normalizacao")
    assert pdf.content_hash == sha256_file(pdf.local_path)
    assert items["Banco de Dados/solto.html"].module == "Geral"


def test_local_folder_size_limit_and_missing_root(inbox: Path, tmp_path: Path) -> None:
    assert list(LocalFolderCollector(inbox, (".pdf",), max_bytes=10).discover()) == []
    with pytest.raises(CollectorError):
        list(LocalFolderCollector(tmp_path / "nope", (".pdf",), 10).discover())


def test_settings_validation(make_settings) -> None:  # type: ignore[no-untyped-def]
    s = make_settings(supported_extensions="PDF, .pptx")
    assert s.supported_extensions == (".pdf", ".pptx")
    with pytest.raises(ValidationError, match="chunk_overlap"):
        make_settings(chunk_size=300, chunk_overlap=300)
    with pytest.raises(ValidationError, match="MOODLE"):
        make_settings(collector_adapter="moodle")
    with pytest.raises(ValidationError):
        make_settings(log_level="verbose")


def test_moodle_adapter_not_available_yet(make_settings) -> None:  # type: ignore[no-untyped-def]
    s: Settings = make_settings(
        collector_adapter=CollectorAdapter.MOODLE, moodle_base_url="https://m", moodle_token="t"
    )
    with pytest.raises(ConfigurationError, match="Moodle"):
        build_collector(s)
