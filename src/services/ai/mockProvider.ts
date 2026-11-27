import type { RoadmapInput, TaskKind } from '@/types';
import { capacityMinutes } from './capacity';
import { detectDomain, isAdvanced, type Domain } from './knowledge';
import type { AIProvider, GeneratedIdea, GeneratedRoadmap, GeneratedTask, SuggestContext } from './types';

const KIND: Record<string, TaskKind> = { s: 'study', p: 'practice', j: 'project', r: 'review' };
const LVL = { h: 'high', m: 'medium', l: 'low' } as const;

export const parseTask = (dsl: string): GeneratedTask => {
  const [title, k, p, e, min, description] = dsl.split('|').map((s) => s.trim());
  return {
    title,
    description: description || undefined,
    kind: KIND[k] ?? 'study',
    priority: LVL[p as keyof typeof LVL] ?? 'medium',
    energy: LVL[e as keyof typeof LVL] ?? 'medium',
    estimatedMinutes: Number(min) || 30,
  };
};

const round5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Mock Inteligente": deterministic generator that still adapts to the input:
 *  - detects the domain from the goal (back-end, front-end, dados, inglês, design, genérico)
 *  - skips fundamentals for intermediate/advanced learners
 *  - scales task durations to the time budget and trims low-priority tasks when tight
 *  - adds phase reviews when there is spare capacity
 */
export const buildMockRoadmap = (input: RoadmapInput, domain: Domain = detectDomain(`${input.goal} ${input.currentLevel}`)): GeneratedRoadmap => {
  const advanced = isAdvanced(input.currentLevel);
  let phases = domain.phases
    .filter((p) => !(advanced && p.fundamentals))
    .map((p) => ({
      title: p.title,
      description: p.description,
      topics: p.topics.map((t) => ({ title: t.title, description: t.description, tasks: t.tasks.map(parseTask) })),
    }));

  const total = phases.flatMap((p) => p.topics.flatMap((t) => t.tasks)).reduce((s, t) => s + t.estimatedMinutes, 0);
  const budget = capacityMinutes(input) * 0.85;
  let scale = Math.min(1.6, Math.max(0.6, budget / total));

  // Tight budget: drop low-priority tasks first.
  if (total * scale > budget) {
    phases = phases.map((p) => ({
      ...p,
      topics: p.topics
        .map((t) => ({ ...t, tasks: t.tasks.filter((x) => x.priority !== 'low') }))
        .filter((t) => t.tasks.length),
    }));
    const trimmed = phases.flatMap((p) => p.topics.flatMap((t) => t.tasks)).reduce((s, t) => s + t.estimatedMinutes, 0);
    scale = Math.min(1.6, Math.max(0.5, budget / trimmed));
  }

  phases = phases.map((p) => ({
    ...p,
    topics: p.topics.map((t) => ({
      ...t,
      tasks: t.tasks.map((x) => ({ ...x, estimatedMinutes: round5(x.estimatedMinutes * scale) })),
    })),
  }));

  // Spare capacity: spaced-repetition review at the end of every phase.
  if (scale >= 1.2) {
    phases = phases.map((p) => ({
      ...p,
      topics: [
        ...p.topics.slice(0, -1),
        {
          ...p.topics[p.topics.length - 1],
          tasks: [
            ...p.topics[p.topics.length - 1].tasks,
            { title: `Revisão espaçada: ${p.title}`, kind: 'review', priority: 'medium', energy: 'low', estimatedMinutes: 30 },
          ],
        },
      ],
    }));
  }

  const goal = input.goal.trim();
  return {
    title: goal.length <= 40 ? capitalize(goal) : domain.title(goal),
    emoji: domain.emoji,
    phases,
  };
};

export const buildMockIdeas = (ctx: SuggestContext): GeneratedIdea[] => {
  const domain = detectDomain(ctx.goal);
  const done = new Set(ctx.completedTopics.map((t) => t.toLowerCase()));
  const project = domain.projectIdeas[(ctx.completedTopics.length + ctx.goal.length) % domain.projectIdeas.length];
  const related = domain.related.filter((r) => !done.has(r.toLowerCase()));
  const nextRelated = related[ctx.completedTopics.length % Math.max(1, related.length)] ?? domain.related[0];
  const lastDone = ctx.completedTopics.at(-1);

  const ideas: GeneratedIdea[] = [
    {
      kind: 'project',
      title: `Projeto prático: ${project}`,
      body: `Aplique o que você já viu${ctx.currentPhase ? ` em "${ctx.currentPhase}"` : ''} num entregável real para o portfólio.`,
      task: { title: `Mini projeto: ${project}`, kind: 'project', priority: 'high', energy: 'high', estimatedMinutes: 120 },
    },
    {
      kind: 'next-topic',
      title: `Tema correlato: ${nextRelated}`,
      body: 'Costuma aparecer junto do seu objetivo em vagas e projetos. Uma introdução curta já abre portas.',
      task: { title: `Explorar ${nextRelated} (introdução)`, kind: 'study', priority: 'medium', energy: 'medium', estimatedMinutes: 45 },
    },
  ];
  if (lastDone) {
    ideas.push({
      kind: 'review',
      title: `Revisar "${lastDone}"`,
      body: 'Revisões espaçadas 2–7 dias depois consolidam a memória de longo prazo.',
      task: { title: `Revisão ativa: ${lastDone}`, kind: 'review', priority: 'medium', energy: 'low', estimatedMinutes: 25 },
    });
  }
  return ideas;
};

export const mockProvider: AIProvider = {
  id: 'mock',
  label: 'Mock Inteligente',
  async generateRoadmap(input) {
    await wait(900); // feels like a real call; lets the loading state breathe
    return buildMockRoadmap(input);
  },
  async suggestIdeas(ctx) {
    await wait(600);
    return buildMockIdeas(ctx);
  },
};
