# Trilha — Tarefas & Roadmaps com IA

App web mobile-first (PWA) para tarefas diárias e roadmaps de estudo/carreira guiados por objetivos.
Inspiração visual: a clareza do **Linear** e a gamificação do **Duolingo**.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173  (abra no celular pela mesma rede: --host já habilitado)
npm test           # testes da lógica de domínio (Vitest)
npm run build      # build de produção + service worker
```

Na primeira execução o app carrega **dados de exemplo** (roadmap de Back-end Java em andamento com sequência ativa e tarefas atrasadas, e um roadmap de Inglês). Dá pra recomeçar do zero no modal de boas-vindas ou em *Perfil → Dados*.

## Funcionalidades

| Aba | O que tem |
|---|---|
| **Hoje** | Tarefas do dia e atrasadas dos roadmaps ativos, filtros por prioridade/energia, checkbox com animação + XP + desfazer, barra de progresso diário, sequência 🔥, card de próximo passo sugerido, "Adiantar" quando o dia está livre |
| **Roadmaps** | Lista com progresso; **gerador em 4 passos** (objetivo → nível → horas/semana → prazo) → Fases → Tópicos → Tarefas; **trilha vertical** com fases desbloqueáveis, modo edição (adicionar/renomear/reordenar/excluir fases, tópicos e tarefas), configurações e **Recalibrar** |
| **Sugestões IA** | Motor proativo (atrasos → recalibrar, ritmo abaixo/acima do plano, projeto prático ao passar de 50% da fase, revisão espaçada após concluir fase, temas correlatos, hábito) + "Pedir ideias à IA" por roadmap, com "Adicionar à trilha" em um toque |
| **Perfil/Metas** | Nível/XP, gráfico dos últimos 7 dias vs meta diária, dias de estudo (usados no agendamento), tema escuro/claro, provedor de IA, exportar/importar backup |

**Recalibrar** reagenda as tarefas pendentes a partir de hoje respeitando a capacidade diária, compara o fim previsto com o prazo e o ritmo real dos últimos 14 dias, e oferece: manter, aumentar horas/semana (calculado para cumprir o prazo), estender prazo ou antecipar (se adiantado).

## IA

Configure em `.env` (veja `.env.example`) ou direto no app em *Perfil → Integração de IA*:

- `VITE_AI_PROVIDER=openai|gemini|mock` + `VITE_OPENAI_API_KEY` / `VITE_GEMINI_API_KEY` (e modelo opcional)
- `VITE_AI_PROXY_URL` — endpoint próprio que recebe `{ system, user }` e devolve `{ text }`. **Recomendado em produção**: chaves `VITE_*` ficam expostas no bundle do navegador.

Sem chave, o **Mock Inteligente** gera roadmaps reais a partir de uma base curada (back-end, front-end, dados, inglês, design ou genérico): detecta o domínio pelo objetivo, pula fundamentos para quem é intermediário/avançado, escala as durações ao orçamento de tempo e corta tarefas de baixa prioridade quando o prazo é apertado. Se um provedor real falhar, o app volta para o mock automaticamente e avisa. A saída do LLM é validada/normalizada (`services/ai/normalize.ts`) antes de entrar no app.

## Arquitetura

```
src/
  types/            modelo de domínio (Roadmap → Phase → Topic → Task), serializável
  domain/           lógica pura e testada: progresso/desbloqueio, agendador, recalibração, XP/sequência, motor de sugestões
  services/
    storage/        KeyValueStore assíncrono (mesma forma do AsyncStorage do React Native)
    repository.ts   AppRepository — fronteira de persistência (LocalStorage hoje; REST/Supabase depois)
    ai/             AIProvider (mock, OpenAI, Gemini, proxy), prompts, normalização, fallback
  store/            AppStore (Context) + navegador em pilha (tabs + stack, como React Navigation)
  components/       UI kit (Button, Sheet, Checkbox, Progress, Chip, Toast…) e layout (TabBar, headers)
  features/         telas: today, roadmaps, suggestions, profile
```

### Caminhos de migração
- **Backend**: implemente `AppRepository` com chamadas HTTP (`GET/PUT/DELETE /roadmaps/:id`, `GET/PUT /me/profile`) ou Supabase e troque a instância em `services/repository.ts`.
- **React Native/Expo**: `types/`, `domain/`, `services/ai` e `services/repository.ts` são TypeScript puro e podem ser reaproveitados; troque o `KeyValueStore` por AsyncStorage e o `navigation.tsx` por React Navigation (bottom tabs + native stack). Apenas os componentes de UI precisam ser reescritos.
