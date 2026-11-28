"""Contratos da próxima fase: recuperação com citações e agente de rascunho.

Diretrizes anti-alucinação já fixadas no contrato:
* Toda resposta do agente referencia ``Citation`` vindas da recuperação (caminho do .md + localizador).
* ``DraftResult.unsupported_claims`` lista afirmações sem evidência — a UI destaca para revisão humana.
* Se a recuperação não trouxer evidência acima de ``min_relevance``, o agente deve responder que não sabe.
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

from moodletracker.db.records import ChunkHit


class Citation(BaseModel):
    document_path: str = Field(description="Caminho do .md no Second Brain (link [[wikilink]] na saída)")
    locator: str = Field(description="p. 3–5 · slide 7 · § Seção")
    quote: str = Field(description="Trecho literal que sustenta a afirmação")


class DraftResult(BaseModel):
    item_id: int
    summary_markdown: str
    citations: list[Citation]
    unsupported_claims: list[str] = Field(default_factory=list)
    model: str


class Retriever(Protocol):
    def retrieve(
        self, query: str, *, k: int = 8, course_id: int | None = None, min_relevance: float = 0.3
    ) -> list[ChunkHit]: ...


class ChatModel(Protocol):
    """Cliente LLM compatível com /v1/chat/completions (OpenAI, Ollama, APIs externas)."""

    model: str

    def complete(self, system: str, user: str, *, temperature: float = 0.1) -> str: ...


class DraftAgent(Protocol):
    """Gera resumo/rascunho de um item usando somente evidências recuperadas (estágio DRAFTED)."""

    def draft(self, item_id: int) -> DraftResult: ...
