# MoodleTracker

Pipeline em Python 3.12 que monitora materiais e atividades do Moodle e faz quatro coisas:
1. Gera um **Second Brain em Markdown** por disciplina/aula, com frontmatter YAML e compatível com Obsidian/Git.
2. Indexa o conteúdo em **RAG** (PostgreSQL + pgvector).
3. Registra o **estágio de cada item** no banco.
4. Exibe tudo numa **web UI densa e escura inspirada no Autobrr**.

> Fase 1: coletor de **pasta local** (offline), parsers PDF/PPTX/HTML, `.md` particionado, chunks e embeddings opcionais, scheduler, API e UI.
> O conector Moodle, o agente de rascunho e o bot do Discord têm interfaces prontas. Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Rodando localmente

Requisitos: Python 3.12+, Docker (para o PostgreSQL) e [uv](https://docs.astral.sh/uv/) (ou pip).

```bash
cp .env.example .env
docker compose up -d db                      # PostgreSQL 16 + pgvector

uv venv -p 3.12 && source .venv/bin/activate
uv pip install -e ".[dev]"                   # ou: pip install -r requirements.txt -e .

moodletracker db init                        # extensão, tabelas, vector(N) + índice HNSW
moodletracker samples                        # (opcional) PDF/PPTX/HTML de exemplo em data/inbox
moodletracker run                            # uma passada do pipeline
moodletracker serve                          # UI + API em http://127.0.0.1:8000 (+ scheduler)
```

Coloque seus arquivos em `data/inbox/<Disciplina>/<Aula ou Módulo>/arquivo.(pdf|pptx|html)`. O resultado aparece em `data/brain/` e na UI.

### Embeddings (opcional)

Sem configuração, o pipeline para no estágio **chunks**. Para gerar vetores com Ollama local:

```bash
docker compose --profile ollama up -d && docker exec moodletracker-ollama ollama pull nomic-embed-text
# .env: MT_EMBEDDING_PROVIDER=openai  MT_EMBEDDING_MODEL=nomic-embed-text  MT_EMBEDDING_DIM=768
moodletracker run && moodletracker search "o que é BCNF?"
```

Também funciona com OpenAI (`MT_EMBEDDING_BASE_URL=https://api.openai.com/v1`, `text-embedding-3-small`, `MT_EMBEDDING_DIM=1536`) e qualquer API compatível com `/v1/embeddings`. A dimensão é fixada quando o banco é criado.

## Comandos

| Comando | Descrição |
|---|---|
| `moodletracker db init` / `db check` / `db schema` | cria/verifica o schema; imprime o DDL de referência |
| `moodletracker run` | uma execução do pipeline |
| `moodletracker serve [--no-scheduler]` | API + UI (scheduler embutido por padrão) |
| `moodletracker worker` | só o scheduler (para separar processos) |
| `moodletracker samples` | gera material de exemplo |
| `moodletracker search "pergunta"` | busca semântica com citações (`arquivo.md · p. 3`) |

## Desenvolvimento

```bash
pytest                       # testes de integração usam MT_TEST_DATABASE_URL (padrão: postgres local)
ruff check src tests && ruff format --check src tests
mypy src                     # strict
moodletracker db schema --dim 768 --out sql/schema.sql   # após mudar db/tables.py
```

Os testes marcados `db` criam e descartam o banco `moodletracker_test` e são pulados se não houver PostgreSQL acessível.

Toda a configuração fica em [.env.example](.env.example), com variáveis `MT_*` validadas por Pydantic Settings.
