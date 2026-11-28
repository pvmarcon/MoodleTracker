"""Configuração centralizada (Pydantic Settings).

Todas as variáveis usam o prefixo ``MT_`` e podem vir do ambiente ou de um ``.env``.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class CollectorAdapter(StrEnum):
    LOCAL_FOLDER = "local_folder"
    MOODLE = "moodle"


class EmbeddingProvider(StrEnum):
    NONE = "none"
    OPENAI = "openai"  # qualquer API compatível com /v1/embeddings (OpenAI, Ollama, LM Studio, vLLM…)


class LogFormat(StrEnum):
    CONSOLE = "console"
    JSON = "json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MT_", env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Banco -----------------------------------------------------------------
    database_url: str = "postgresql+psycopg://moodletracker:moodletracker@localhost:5432/moodletracker"
    db_pool_size: int = Field(default=5, ge=1, le=50)

    # --- Coleta ----------------------------------------------------------------
    collector_adapter: CollectorAdapter = CollectorAdapter.LOCAL_FOLDER
    inbox_dir: Path = Path("data/inbox")
    supported_extensions: tuple[str, ...] = (".pdf", ".pptx", ".html", ".htm")
    max_file_mb: float = Field(default=100, gt=0)

    # --- Second Brain ----------------------------------------------------------
    brain_dir: Path = Path("data/brain")
    partition_max_chars: int = Field(default=12_000, ge=1_000, description="Tamanho máximo de uma partição .md")

    # --- Chunking / embeddings -------------------------------------------------
    chunk_size: int = Field(default=1_200, ge=200)
    chunk_overlap: int = Field(default=150, ge=0)
    embedding_provider: EmbeddingProvider = EmbeddingProvider.NONE
    embedding_base_url: str = "http://localhost:11434/v1"
    embedding_api_key: SecretStr = SecretStr("")
    embedding_model: str = "nomic-embed-text"
    embedding_dim: int = Field(default=768, ge=8, le=16_000)
    embedding_batch_size: int = Field(default=32, ge=1, le=2_048)
    embedding_timeout_s: float = Field(default=60, gt=0)

    # --- LLM (agente de rascunho / RAG — próxima fase) -------------------------
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: SecretStr = SecretStr("")
    llm_model: str = "llama3.1"

    # --- Moodle (conector futuro) ----------------------------------------------
    moodle_base_url: str | None = None
    moodle_token: SecretStr | None = None

    # --- Agendamento -----------------------------------------------------------
    scheduler_enabled: bool = True
    schedule_interval_seconds: int = Field(default=300, ge=10)

    # --- API / Web -------------------------------------------------------------
    api_host: str = "127.0.0.1"
    api_port: int = Field(default=8000, ge=1, le=65_535)

    # --- Logs ------------------------------------------------------------------
    log_level: str = "INFO"
    log_format: LogFormat = LogFormat.CONSOLE

    @field_validator("supported_extensions", mode="before")
    @classmethod
    def _split_extensions(cls, v: object) -> object:
        if isinstance(v, str):
            return tuple(f".{e.strip().lstrip('.').lower()}" for e in v.split(",") if e.strip())
        return v

    @field_validator("log_level")
    @classmethod
    def _upper_level(cls, v: str) -> str:
        level = v.upper()
        if level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError(f"log_level inválido: {v}")
        return level

    @model_validator(mode="after")
    def _check_consistency(self) -> Settings:
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap deve ser menor que chunk_size")
        if self.collector_adapter is CollectorAdapter.MOODLE and not (self.moodle_base_url and self.moodle_token):
            raise ValueError("collector_adapter=moodle exige MT_MOODLE_BASE_URL e MT_MOODLE_TOKEN")
        return self

    @property
    def max_file_bytes(self) -> int:
        return int(self.max_file_mb * 1024 * 1024)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
