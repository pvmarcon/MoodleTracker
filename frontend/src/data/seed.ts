import { materializeRoadmap } from '@/domain/factory';
import { flattenRoadmap, updateTask } from '@/domain/roadmap';
import { addDays, fromISODate, today } from '@/lib/date';
import { buildMockRoadmap } from '@/services/ai/mockProvider';
import { DOMAINS } from '@/services/ai/knowledge';
import type { Profile, Roadmap } from '@/types';

export const defaultProfile = (): Profile => ({
  name: 'Pedro',
  headline: 'Rumo a Dev Back-end Pleno',
  studyDays: [1, 2, 3, 4, 5, 6],
  dailyGoalMinutes: 60,
  theme: 'dark',
  ai: { provider: 'mock' },
  onboarded: false,
});

/** Mark the first `n` tasks done, one per day, ending yesterday (keeps a live streak). */
const completeFirst = (r: Roadmap, n: number): Roadmap => {
  let out = r;
  flattenRoadmap(r)
    .slice(0, n)
    .forEach(({ task }, i) => {
      const day = fromISODate(addDays(today(), i - n));
      day.setHours(19, 10 + i * 7, 0, 0);
      out = updateTask(out, task.id, { completedAt: day.toISOString() });
    });
  return out;
};

/**
 * Realistic sample state generated relative to "today": an in-progress back-end
 * roadmap (with a streak and a couple of overdue tasks to trigger the
 * recalibration suggestion) and a fresh English roadmap.
 */
export const seedRoadmaps = (profile: Profile): Roadmap[] => {
  const t = today();
  const backendDomain = DOMAINS.find((d) => d.id === 'backend')!;
  const englishDomain = DOMAINS.find((d) => d.id === 'english')!;

  const backendInput = {
    goal: 'Conseguir vaga de Desenvolvedor Back-end Java Pleno',
    currentLevel: 'Sei Java básico e OOP; nunca usei Spring em produção.',
    hoursPerWeek: 7,
    deadline: addDays(t, 120),
  };
  let backend = materializeRoadmap(buildMockRoadmap(backendInput, backendDomain), backendInput, {
    source: 'mock',
    color: 'violet',
    studyDays: profile.studyDays,
    startDate: addDays(t, -12),
  });
  backend = { ...completeFirst(backend, 7), title: 'Back-end Java Pleno', createdAt: fromISODate(addDays(t, -12)).toISOString() };

  const englishInput = {
    goal: 'Inglês fluente para entrevistas técnicas',
    currentLevel: 'Leio documentação bem, travo na conversação.',
    hoursPerWeek: 3,
    deadline: addDays(t, 75),
  };
  let english = materializeRoadmap(buildMockRoadmap(englishInput, englishDomain), englishInput, {
    source: 'mock',
    color: 'green',
    studyDays: profile.studyDays,
    startDate: addDays(t, -3),
  });
  english = { ...completeFirst(english, 2), title: 'Inglês para entrevistas' };

  return [backend, english];
};
