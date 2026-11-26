import { uid } from '@/lib/id';
import type { GeneratedRoadmap, GeneratedTask } from '@/services/ai/types';
import type { Roadmap, RoadmapColor, RoadmapInput, Task } from '@/types';
import { scheduleRoadmap } from './schedule';

const COLORS: RoadmapColor[] = ['violet', 'green', 'blue', 'orange', 'pink', 'cyan'];

export const pickColor = (taken: RoadmapColor[]): RoadmapColor =>
  COLORS.find((c) => !taken.includes(c)) ?? COLORS[taken.length % COLORS.length];

export const taskFrom = (t: GeneratedTask): Task => ({ ...t, id: uid('tk'), dueDate: null, completedAt: null });

/** Turns provider output into a persisted, scheduled Roadmap. */
export const materializeRoadmap = (
  gen: GeneratedRoadmap,
  input: RoadmapInput,
  opts: { source: Roadmap['source']; color: RoadmapColor; studyDays: number[]; startDate?: string },
): Roadmap => {
  const now = new Date().toISOString();
  const base: Roadmap = {
    ...input,
    id: uid('rm'),
    title: gen.title,
    emoji: gen.emoji,
    color: opts.color,
    status: 'active',
    source: opts.source,
    createdAt: now,
    updatedAt: now,
    phases: gen.phases.map((p) => ({
      id: uid('ph'),
      title: p.title,
      description: p.description,
      topics: p.topics.map((tp) => ({
        id: uid('tp'),
        title: tp.title,
        description: tp.description,
        tasks: tp.tasks.map(taskFrom),
      })),
    })),
  };
  return scheduleRoadmap(base, { studyDays: opts.studyDays, hoursPerWeek: input.hoursPerWeek, startDate: opts.startDate });
};
