# Trilha Mentor — agente de carreira (UI)

Interface de um agente de IA para carreira, no estilo das interfaces de IA modernas (Venice.ai, ChatGPT, Claude). **Por enquanto as respostas são simuladas**: a UI está pronta para receber um modelo real.

```bash
cd agent
npm install
npm run dev      # http://localhost:5174
npm test         # roteador, saudações e fluxo de eventos
```

## Como funciona

1. **Tela inicial:** uma saudação gerada na hora, ligada à função do app e ao horário do dia (madrugada, manhã, tarde e noite, com toques de dia da semana). Ela nunca repete a anterior. Abaixo vêm a caixa de texto, com exemplos que se digitam sozinhos, e atalhos.
2. **O usuário diz o que quer** e a página se transforma em conversa. O agente mostra as etapas do "pensamento", responde em streaming e **gera um painel específico** para o pedido:

| Pedido (exemplo) | Painel gerado |
|---|---|
| "Quero virar dev back-end em 6 meses" | **Roadmap**: fases por semana, tarefas marcáveis, progresso |
| "Revise meu currículo para PM" | **Currículo**: nota, notas por seção, reescritas antes/depois, palavras-chave ATS, upload |
| "Simule uma entrevista front-end pleno" | **Entrevista**: pergunta por vez, cronômetro, rascunho, checklist de autoavaliação |
| "Recebi uma proposta de 9k, é boa?" | **Salário**: faixa p25–p90, marcador da proposta (editável), fatores, roteiro de negociação |
| "Trabalho com vendas e quero mudar de área" | **Transição**: caminhos com % de aproveitamento, tempo, demanda e "Gerar roadmap" |

Os painéis conversam com o chat. Botões como "Gerar roadmap para Analista de Dados" ou "Treinar entrevista para essa vaga" mandam uma nova mensagem e trocam o painel. No desktop o painel abre ao lado da conversa; no celular, em tela cheia.

## Arquitetura (pronta para IA real)

```
src/agent/types.ts      contrato: Message, Conversation, Canvas (5 tipos), AgentEvent, AgentProvider
src/agent/mockAgent.ts  agente simulado: emite os mesmos eventos que um LLM emitiria
src/agent/router.ts     detecção de intenção/entidades (só usado pelo mock)
src/agent/useChat.ts    estado das conversas, streaming, cancelamento, persistência local
src/canvases/           os painéis gerados (Roadmap, Resume, Interview, Salary, Transition)
src/components/         Home (saudação), Composer, Thread, Sidebar, Markdown
src/lib/greeting.ts     banco de saudações por período e dia da semana
```

O agente **não devolve HTML**. Ele emite um fluxo de eventos:

```ts
{ type: 'intent', intent: 'salary', title }   // a UI já mostra o esqueleto do painel certo
{ type: 'status', label: 'Cruzando faixas…' } // etapas de "pensamento"
{ type: 'canvas', canvas: { kind: 'salary', p25, p50, … } }
{ type: 'text', delta: '…' }                  // resposta em streaming
{ type: 'suggestions', items: [...] }
{ type: 'done' }
```

Para conectar um modelo (OpenAI, Gemini, Claude…), implemente `AgentProvider.run()`. Cada tipo de painel vira uma **ferramenta** (`render_roadmap`, `render_salary`…) cujo JSON Schema é o tipo correspondente em `types.ts`. O texto do modelo vira eventos `text` e a chamada de ferramenta vira um evento `canvas`. Depois é só passar o provider em `useChat(provider)`; a interface não muda. A chamada deve passar por um backend, para a chave não ficar exposta no navegador.

O painel de roadmap reaproveita o gerador do app principal (`../src/services/ai`, via o alias `@/`).
