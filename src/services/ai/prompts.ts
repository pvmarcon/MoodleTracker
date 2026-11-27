import type { RoadmapInput } from '@/types';
import type { SuggestContext } from './types';

const TASK_SCHEMA = `{"title": string, "description": string, "kind": "study"|"practice"|"project"|"review", "priority": "low"|"medium"|"high", "energy": "low"|"medium"|"high", "estimatedMinutes": number}`;

export const ROADMAP_SYSTEM = `Você é um mentor de carreira e estudos. Gere roadmaps práticos, realistas e em português do Brasil.
Responda APENAS com JSON válido no formato:
{"title": string, "emoji": string, "phases": [{"title": string, "description": string, "topics": [{"title": string, "description": string, "tasks": [${TASK_SCHEMA}]}]}]}
Regras:
- 3 a 6 fases (milestones) em ordem de dependência; 1 a 4 tópicos por fase; 2 a 5 tarefas por tópico.
- Tarefas são ações concretas e verificáveis (verbo no infinitivo), de 15 a 180 minutos.
- Inclua ao menos uma tarefa "project" nas fases finais e tarefas "review" periódicas.
- "energy" indica esforço cognitivo; "priority" indica impacto no objetivo.
- Respeite o tempo disponível: a soma de estimatedMinutes deve caber em ~85% da capacidade total.
- Pule fundamentos que o usuário já domina.`;

export const roadmapUserPrompt = (i: RoadmapInput, capacityMinutes: number) =>
  `Objetivo principal: ${i.goal}
Nível atual / base: ${i.currentLevel || 'não informado'}
Tempo disponível: ${i.hoursPerWeek} horas por semana
Prazo desejado: ${i.deadline}
Capacidade total estimada: ${capacityMinutes} minutos`;

export const IDEAS_SYSTEM = `Você é um mentor que sugere próximos passos. Responda APENAS com JSON:
{"ideas": [{"kind": "project"|"review"|"next-topic", "title": string, "body": string, "task": ${TASK_SCHEMA}}]}
Gere 3 ideias curtas, específicas e acionáveis em português do Brasil.`;

export const ideasUserPrompt = (c: SuggestContext) =>
  `Objetivo: ${c.goal}
Fase atual: ${c.currentPhase ?? 'concluída'}
Tópicos concluídos: ${c.completedTopics.join(', ') || 'nenhum'}
Tópicos pendentes: ${c.pendingTopics.join(', ') || 'nenhum'}`;
