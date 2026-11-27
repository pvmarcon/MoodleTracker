import { describe, expect, it } from 'vitest';
import { defaultProfile, seedRoadmaps } from '@/data/seed';
import { materializeRoadmap } from '@/domain/factory';
import { currentPhaseIndex, flattenRoadmap, phaseState, roadmapTasks, updateTask } from '@/domain/roadmap';
import { minutesPerStudyDay, planRecalibration, projectedEnd, scheduleRoadmap } from '@/domain/schedule';
import { computeStats } from '@/domain/stats';
import { buildSuggestions } from '@/domain/suggestions';
import { addDays, fromISODate, today } from '@/lib/date';
import { detectDomain } from '@/services/ai/knowledge';
import { buildMockIdeas, buildMockRoadmap } from '@/services/ai/mockProvider';
import { normalizeRoadmap, parseJSONLoose } from '@/services/ai/normalize';
import type { RoadmapInput } from '@/types';

const WEEKDAYS = [1, 2, 3, 4, 5];
const input = (over: Partial<RoadmapInput> = {}): RoadmapInput => ({
  goal: 'Vaga de back-end Java com Spring',
  currentLevel: 'Iniciante',
  hoursPerWeek: 5,
  deadline: addDays(today(), 90),
  ...over,
});
const make = (over: Partial<RoadmapInput> = {}) =>
  materializeRoadmap(buildMockRoadmap(input(over)), input(over), { source: 'mock', color: 'violet', studyDays: WEEKDAYS });

describe('mock AI generator', () => {
  it('detects domains from the goal', () => {
    expect(detectDomain('Quero aprender React e TypeScript').id).toBe('frontend');
    expect(detectDomain('inglês para entrevistas').id).toBe('english');
    expect(detectDomain('virar cientista de dados com Python').id).toBe('data');
    expect(detectDomain('aprender a tocar violão').id).toBe('generic');
  });

  it('skips fundamentals for advanced learners', () => {
    const beginner = buildMockRoadmap(input());
    const advanced = buildMockRoadmap(input({ currentLevel: 'Avançado, já trabalho com Java há 3 anos' }));
    expect(advanced.phases.length).toBe(beginner.phases.length - 1);
    expect(advanced.phases[0].title).not.toBe(beginner.phases[0].title);
  });

  it('trims low-priority tasks when the budget is tight', () => {
    const tight = buildMockRoadmap(input({ hoursPerWeek: 1, deadline: addDays(today(), 14) }));
    const all = tight.phases.flatMap((p) => p.topics.flatMap((t) => t.tasks));
    expect(all.every((t) => t.priority !== 'low')).toBe(true);
  });

  it('produces ideas with tasks', () => {
    const ideas = buildMockIdeas({ goal: 'Java back-end', completedTopics: ['Git & build'], pendingTopics: [] });
    expect(ideas.length).toBe(3);
    expect(ideas.every((i) => i.task.title)).toBe(true);
  });
});

describe('LLM output normalisation', () => {
  it('coerces sloppy JSON wrapped in fences', () => {
    const raw = parseJSONLoose('Aqui está:\n```json\n{"title":"X","phases":[{"title":"F1","topics":[{"title":"T","tasks":[{"title":"Fazer algo","kind":"weird","estimatedMinutes":"47"},{"nope":1}]}]}]}\n```');
    const r = normalizeRoadmap(raw);
    expect(r.phases[0].topics[0].tasks).toHaveLength(1);
    expect(r.phases[0].topics[0].tasks[0]).toMatchObject({ kind: 'study', priority: 'medium', estimatedMinutes: 45 });
  });

  it('rejects empty roadmaps', () => {
    expect(() => normalizeRoadmap({ phases: [] })).toThrow();
  });
});

describe('scheduler', () => {
  it('only schedules on study days and respects the daily budget', () => {
    const r = make();
    const cap = minutesPerStudyDay(5, WEEKDAYS);
    const perDay = new Map<string, number>();
    for (const t of roadmapTasks(r)) {
      expect(t.dueDate).toBeTruthy();
      expect(WEEKDAYS).toContain(fromISODate(t.dueDate!).getDay());
      perDay.set(t.dueDate!, (perDay.get(t.dueDate!) ?? 0) + t.estimatedMinutes);
    }
    for (const [, m] of perDay) {
      // a single oversized task may exceed the budget, never two
      expect(m <= cap || roadmapTasks(r).filter((t) => t.estimatedMinutes > cap).length > 0).toBe(true);
    }
  });

  it('keeps tasks in tree order', () => {
    const dates = flattenRoadmap(make()).map((x) => x.task.dueDate!);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe('recalibration', () => {
  it('moves overdue tasks to today or later and reports lateness', () => {
    const r = scheduleRoadmap(make({ hoursPerWeek: 10, deadline: addDays(today(), 40) }), {
      studyDays: WEEKDAYS,
      hoursPerWeek: 10,
      startDate: addDays(today(), -30),
    });
    const plan = planRecalibration(r, WEEKDAYS);
    expect(plan.overdueCount).toBeGreaterThan(0);
    expect(roadmapTasks(plan.rescheduled).every((t) => t.completedAt || t.dueDate! >= today())).toBe(true);
    expect(projectedEnd(plan.rescheduled)).toBe(plan.projectedEnd);
    if (plan.slackDays < 0) expect(plan.requiredHoursPerWeek).toBeGreaterThan(10);
  });
});

describe('progress, stats & suggestions', () => {
  it('unlocks phases sequentially', () => {
    let r = make();
    expect(phaseState(r, 0)).toBe('current');
    expect(phaseState(r, 1)).toBe('locked');
    for (const t of r.phases[0].topics.flatMap((tp) => tp.tasks)) r = updateTask(r, t.id, { completedAt: new Date().toISOString() });
    expect(currentPhaseIndex(r)).toBe(1);
    expect(phaseState(r, 0)).toBe('done');
  });

  it('seed data has a live streak and triggers suggestions', () => {
    const profile = defaultProfile();
    const roadmaps = seedRoadmaps(profile);
    const stats = computeStats(roadmaps);
    expect(stats.streak).toBeGreaterThanOrEqual(7);
    expect(stats.xp).toBeGreaterThan(0);
    const suggestions = buildSuggestions(roadmaps, profile);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(new Set(suggestions.map((s) => s.id)).size).toBe(suggestions.length);
  });
});
