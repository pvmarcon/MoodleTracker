from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from moodletracker.db.schema import render_schema_sql
from moodletracker.errors import EmbeddingError
from moodletracker.rag.embeddings import OpenAICompatibleEmbedder

ROOT = Path(__file__).resolve().parents[1]


def _embedder(handler, dim: int = 3, batch: int = 2) -> OpenAICompatibleEmbedder:  # type: ignore[no-untyped-def]
    return OpenAICompatibleEmbedder(
        base_url="http://emb/v1",
        api_key="k",
        model="m",
        dim=dim,
        batch_size=batch,
        timeout_s=5,
        transport=httpx.MockTransport(handler),
    )


def test_embedder_batches_and_orders_by_index(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        assert req.headers["authorization"] == "Bearer k"
        inputs = json.loads(req.content)["input"]
        calls.append(inputs)
        data = [{"index": i, "embedding": [float(len(t)), 0.0, 1.0]} for i, t in enumerate(inputs)][::-1]
        return httpx.Response(200, json={"data": data})

    vecs = _embedder(handler).embed(["a", "bb", "ccc"])
    assert calls == [["a", "bb"], ["ccc"]]
    assert [v[0] for v in vecs] == [1.0, 2.0, 3.0]


def test_embedder_retries_then_validates_dimension(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("moodletracker.rag.embeddings.time.sleep", lambda _: None)
    attempts = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(429, text="slow down")
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1, 0.2]}]})

    with pytest.raises(EmbeddingError, match="dimensão 2"):
        _embedder(handler, dim=3).embed(["x"])
    assert attempts["n"] == 2


def test_embedder_client_error_is_not_retried() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text="bad key")

    with pytest.raises(EmbeddingError, match="401"):
        _embedder(handler).embed(["x"])


def test_committed_schema_sql_is_in_sync() -> None:
    """sql/schema.sql é gerado por `moodletracker db schema --dim 768 --out sql/schema.sql`."""
    assert (ROOT / "sql" / "schema.sql").read_text(encoding="utf-8") == render_schema_sql(768)
