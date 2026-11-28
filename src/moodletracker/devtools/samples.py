"""Gera materiais de exemplo (PDF com sumário, PPTX com seções/notas/tabela, página HTML no formato do Moodle).

Usado por ``moodletracker samples`` (demo local) e pelos testes.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
from pptx import Presentation
from pptx.util import Inches

LOREM = (
    "A normalização organiza os dados para reduzir redundância e anomalias de atualização. "
    "Cada forma normal impõe restrições adicionais sobre as dependências funcionais da relação. "
)


def make_pdf(path: Path, title: str, chapters: list[tuple[str, list[str]]]) -> Path:
    """PDF com um capítulo por página-bloco, títulos em fonte maior, rodapé repetido e sumário (TOC)."""
    doc = pymupdf.open()
    toc: list[list[int | str]] = []
    for ch_title, paragraphs in chapters:
        page = doc.new_page()
        toc.append([1, ch_title, doc.page_count])
        y = 72.0
        page.insert_text((72, y), ch_title, fontsize=20)
        y += 36
        for para in paragraphs:
            rect = pymupdf.Rect(72, y, 540, y + 160)
            page.insert_textbox(rect, para, fontsize=11)
            y += 22 + 14 * (len(para) // 85 + 1)
        page.insert_text((72, 800), f"{title} — Universidade Exemplo", fontsize=8)
    doc.set_toc(toc)
    doc.set_metadata({"title": title})
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(path)
    doc.close()
    return path


def make_pptx(path: Path, title: str, sections: list[tuple[str, list[tuple[str, list[str]]]]]) -> Path:
    prs = Presentation()
    cover = prs.slides.add_slide(prs.slide_layouts[0])
    cover.shapes.title.text = title
    cover.placeholders[1].text = "Professor(a) Exemplo"
    for section_title, slides in sections:
        sec = prs.slides.add_slide(prs.slide_layouts[2])  # "Section Header"
        sec.shapes.title.text = section_title
        for slide_title, bullets in slides:
            s = prs.slides.add_slide(prs.slide_layouts[1])
            s.shapes.title.text = slide_title
            body = s.placeholders[1].text_frame
            body.text = bullets[0]
            for b in bullets[1:]:
                p = body.add_paragraph()
                p.text = b.lstrip("> ")
                p.level = 1 if b.startswith("> ") else 0
            s.notes_slide.notes_text_frame.text = f"Enfatizar: {slide_title.lower()}."
    tbl_slide = prs.slides.add_slide(prs.slide_layouts[5])
    tbl_slide.shapes.title.text = "Resumo comparativo"
    table = tbl_slide.shapes.add_table(3, 3, Inches(1), Inches(2), Inches(8), Inches(1.5)).table
    for r, row in enumerate(
        [
            ["Conceito", "Quando usar", "Custo"],
            ["Índice B-tree", "Igualdade e faixa", "Baixo"],
            ["Índice Hash", "Só igualdade", "Baixo"],
        ]
    ):
        for c, val in enumerate(row):
            table.cell(r, c).text = val
    path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(path))
    return path


def make_moodle_html(path: Path, title: str, sections: list[tuple[str, list[str]]]) -> Path:
    body = "".join(f"<h2 id='s{i}'>{h}</h2>" + "".join(f"<p>{p}</p>" for p in ps) for i, (h, ps) in enumerate(sections))
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title>
<script>var M = {{}};</script><style>.x{{}}</style></head>
<body><nav class="navbar">Painel · Meus cursos</nav>
<div id="page"><aside class="block">Calendário</aside>
<div id="region-main" role="main"><h1>{title}</h1>{body}
<ul><li>Leitura obrigatória: <a href="https://www.postgresql.org/docs/">documentação</a></li>
<li>Prazo: <strong>sexta-feira</strong></li></ul>
</div></div><footer>© Moodle</footer></body></html>"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    return path


def create_sample_inbox(root: Path) -> list[Path]:
    root.mkdir(parents=True, exist_ok=True)
    return [
        make_pdf(
            root / "Banco de Dados" / "Aula 03 - Normalização" / "normalizacao.pdf",
            "Normalização de Dados",
            [
                ("1. Dependências funcionais", [LOREM * 3, "Uma dependência X → Y indica que X determina Y. " * 4]),
                (
                    "2. Primeira e segunda formas normais",
                    [LOREM * 2, "A 2FN elimina dependências parciais da chave. " * 5],
                ),
                (
                    "3. Terceira forma normal e BCNF",
                    [LOREM * 2, "A BCNF exige que todo determinante seja superchave. " * 5],
                ),
            ],
        ),
        make_pptx(
            root / "Banco de Dados" / "Aula 04 - Índices" / "indices.pptx",
            "Índices em Bancos Relacionais",
            [
                (
                    "Fundamentos",
                    [
                        (
                            "O que é um índice",
                            ["Estrutura auxiliar de busca", "> Troca espaço por velocidade", "Custo na escrita"],
                        ),
                        ("B-tree", ["Balanceada", "Suporta faixa e ordenação"]),
                    ],
                ),
                ("Na prática", [("EXPLAIN ANALYZE", ["Ler o plano de execução", "Seq Scan vs Index Scan"])]),
            ],
        ),
        make_moodle_html(
            root / "Engenharia de Software" / "Semana 2 - Requisitos" / "atividade-requisitos.html",
            "Atividade: levantamento de requisitos",
            [
                ("Objetivo", ["Elaborar requisitos funcionais e não funcionais para um sistema de biblioteca."]),
                ("Entregáveis", ["Documento com casos de uso e critérios de aceitação.", "Diagrama de contexto."]),
                ("Critérios de avaliação", ["Clareza, rastreabilidade e testabilidade dos requisitos."]),
            ],
        ),
    ]
