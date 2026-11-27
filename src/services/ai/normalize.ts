import type { Energy, Priority, TaskKind } from '@/types';
import type { GeneratedIdea, GeneratedRoadmap, GeneratedTask } from './types';

/**
 * LLM output is untrusted: coerce it into a valid GeneratedRoadmap, dropping
 * anything malformed instead of crashing the UI.
 */
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const LEVELS = ['low', 'medium', 'high'] as const;
const KINDS = ['study', 'practice', 'project', 'review'] as const;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export const normalizeTask = (raw: unknown): GeneratedTask | null => {
  const t = obj(raw);
  const title = str(t.title);
  if (!title) return null;
  const minutes = Number(t.estimatedMinutes);
  return {
    title,
    description: str(t.description) || undefined,
    kind: oneOf<TaskKind>(t.kind, KINDS, 'study'),
    priority: oneOf<Priority>(t.priority, LEVELS, 'medium'),
    energy: oneOf<Energy>(t.energy, LEVELS, 'medium'),
    estimatedMinutes: Number.isFinite(minutes) ? Math.min(240, Math.max(10, Math.round(minutes / 5) * 5)) : 30,
  };
};

export const normalizeRoadmap = (raw: unknown): GeneratedRoadmap => {
  const r = obj(raw);
  const phases = arr(r.phases)
    .map((p) => {
      const po = obj(p);
      const topics = arr(po.topics)
        .map((tp) => {
          const to = obj(tp);
          const tasks = arr(to.tasks).map(normalizeTask).filter((x): x is GeneratedTask => !!x);
          return { title: str(to.title, 'Tópico'), description: str(to.description) || undefined, tasks };
        })
        .filter((tp) => tp.tasks.length);
      return { title: str(po.title, 'Fase'), description: str(po.description) || undefined, topics };
    })
    .filter((p) => p.topics.length);

  if (!phases.length) throw new Error('A IA retornou um roadmap vazio ou inválido.');
  return { title: str(r.title, 'Novo roadmap'), emoji: str(r.emoji, '🎯').slice(0, 4), phases };
};

export const normalizeIdeas = (raw: unknown): GeneratedIdea[] =>
  arr(obj(raw).ideas ?? raw)
    .map((i) => {
      const o = obj(i);
      const task = normalizeTask(o.task ?? { title: o.title, kind: o.kind === 'project' ? 'project' : 'study' });
      if (!task || !str(o.title)) return null;
      return {
        kind: oneOf(o.kind, ['project', 'review', 'next-topic'] as const, 'next-topic'),
        title: str(o.title),
        body: str(o.body),
        task,
      };
    })
    .filter((x): x is GeneratedIdea => !!x);

/** Extract a JSON object even if the model wrapped it in ```json fences. */
export const parseJSONLoose = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  return JSON.parse(start > 0 ? body.slice(start) : body);
};
