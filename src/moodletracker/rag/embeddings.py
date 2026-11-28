"""Provedores de embeddings. ``openai`` cobre qualquer API compatível com ``POST /v1/embeddings``
(OpenAI, Ollama ≥0.1.26, LM Studio, vLLM, Together…)."""

from __future__ import annotations

import time
from collections.abc import Sequence
from typing import Protocol

import httpx

from moodletracker.config import EmbeddingProvider, Settings
from moodletracker.errors import EmbeddingError
from moodletracker.logs import get_logger

log = get_logger(__name__)
_RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504}


class Embedder(Protocol):
    model: str
    dim: int

    def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


class OpenAICompatibleEmbedder:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        dim: int,
        batch_size: int,
        timeout_s: float,
        max_retries: int = 3,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.model, self.dim, self.batch_size, self.max_retries = model, dim, batch_size, max_retries
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), headers=headers, timeout=timeout_s, transport=transport
        )

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            out.extend(self._embed_batch(list(texts[i : i + self.batch_size])))
        return out

    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = self._client.post("/embeddings", json={"model": self.model, "input": batch})
            except httpx.HTTPError as exc:
                if attempt == self.max_retries:
                    raise EmbeddingError(f"Falha de rede no provedor de embeddings: {exc}") from exc
                self._backoff(attempt, str(exc))
                continue
            if resp.status_code in _RETRY_STATUS and attempt < self.max_retries:
                self._backoff(attempt, f"HTTP {resp.status_code}")
                continue
            if resp.status_code >= 400:
                raise EmbeddingError(f"Provedor de embeddings respondeu {resp.status_code}: {resp.text[:300]}")
            return self._parse(resp, len(batch))
        raise EmbeddingError("Provedor de embeddings indisponível após novas tentativas")

    def _parse(self, resp: httpx.Response, expected: int) -> list[list[float]]:
        try:
            data = sorted(resp.json()["data"], key=lambda d: d["index"])
            vectors = [[float(x) for x in d["embedding"]] for d in data]
        except (ValueError, KeyError, TypeError) as exc:
            raise EmbeddingError(f"Resposta de embeddings em formato inesperado: {exc}") from exc
        if len(vectors) != expected:
            raise EmbeddingError(f"Esperados {expected} vetores, recebidos {len(vectors)}")
        if vectors and len(vectors[0]) != self.dim:
            raise EmbeddingError(
                f"Modelo '{self.model}' retornou dimensão {len(vectors[0])}, mas MT_EMBEDDING_DIM={self.dim}"
            )
        return vectors

    @staticmethod
    def _backoff(attempt: int, reason: str) -> None:
        delay = min(8.0, 0.5 * 2**attempt)
        log.warning("embeddings.retry", attempt=attempt, delay_s=delay, reason=reason)
        time.sleep(delay)

    def close(self) -> None:
        self._client.close()


def build_embedder(settings: Settings) -> Embedder | None:
    """``None`` quando desabilitado: o pipeline para no estágio CHUNKED (chunks prontos para embedar depois)."""
    match settings.embedding_provider:
        case EmbeddingProvider.NONE:
            return None
        case EmbeddingProvider.OPENAI:
            return OpenAICompatibleEmbedder(
                base_url=settings.embedding_base_url,
                api_key=settings.embedding_api_key.get_secret_value(),
                model=settings.embedding_model,
                dim=settings.embedding_dim,
                batch_size=settings.embedding_batch_size,
                timeout_s=settings.embedding_timeout_s,
            )
