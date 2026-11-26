import { addDays, isoDay, today as todayISO } from '@/lib/date';
import type { ISODate, Roadmap, Task } from '@/types';
import { roadmapTasks } from './roadmap';

/** Duolingo-style XP: base + duration bonus, projects are worth more. */
export const xpFor = (t: Task): number => {
  const base = 10 + Math.round(t.estimatedMinutes / 6);
  return t.kind === 'project' ? Math.round(base * 1.5) : base;
};

export const levelFor = (xp: number) => {
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const floor = 60 * (level - 1) ** 2;
  const ceil = 60 * level ** 2;
  return { level, progress: (xp - floor) / (ceil - floor), toNext: ceil - xp };
};

export interface Stats {
  xp: number;
  streak: number;
  completedTotal: number;
  minutesThisWeek: number;
  /** last 7 days, oldest first: minutes completed per day */
  week: { date: ISODate; minutes: number }[];
  activeDays: Set<ISODate>;
}

export const computeStats = (roadmaps: Roadmap[], ref: ISODate = todayISO()): Stats => {
  const tasks = roadmaps.flatMap(roadmapTasks).filter((t) => t.completedAt);
  const byDay = new Map<ISODate, number>();
  let xp = 0;
  for (const t of tasks) {
    xp += xpFor(t);
    const d = isoDay(t.completedAt)!;
    byDay.set(d, (byDay.get(d) ?? 0) + t.estimatedMinutes);
  }

  // Streak counts back from today; if nothing today yet, it can still be alive from yesterday.
  let streak = 0;
  let cursor = byDay.has(ref) ? ref : addDays(ref, -1);
  while (byDay.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(ref, i - 6);
    return { date, minutes: byDay.get(date) ?? 0 };
  });

  return {
    xp,
    streak,
    completedTotal: tasks.length,
    minutesThisWeek: week.reduce((s, d) => s + d.minutes, 0),
    week,
    activeDays: new Set(byDay.keys()),
  };
};
