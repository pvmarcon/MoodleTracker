"""Hierarquia de erros do domínio. Cada estágio levanta um tipo próprio para o pipeline registrar."""

from __future__ import annotations


class MoodleTrackerError(Exception):
    """Erro base."""


class ConfigurationError(MoodleTrackerError):
    """Configuração inválida ou recurso não disponível nesta fase."""


class CollectorError(MoodleTrackerError):
    """Falha ao descobrir/ler itens na origem."""


class ParseError(MoodleTrackerError):
    """Falha ao extrair conteúdo de um arquivo."""


class UnsupportedFormatError(ParseError):
    """Nenhum parser registrado para o tipo do arquivo."""


class BrainWriteError(MoodleTrackerError):
    """Falha ao gravar o Markdown no Second Brain."""


class EmbeddingError(MoodleTrackerError):
    """Falha no provedor de embeddings."""


class NotFoundError(MoodleTrackerError):
    """Entidade não encontrada."""
