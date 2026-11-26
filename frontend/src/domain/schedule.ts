import { addDays, diffDays, fromISODate, isoDay, today as todayISO } from '@/lib/date';
import type { ISODate, Roadmap } from '@/types';
import { mapTasks, roadmapTasks } from './roadmap';

export interface ScheduleOptions {
  startDate?: ISODate;
  studyDays: number[];
  hoursPerWeek: number;
}

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export const minutesPerStudyDay = (hoursPerWeek: number, studyDays: number[]) =>
  Math.max(15, Math.round((hoursPerWeek * 60) / Math.max(1, studyDays.length)));

const nextStudyDay = (from: ISODate, days: number[]): ISODate => {
  let d = from;
  for (let i = 0; i < 8; i++) {
    if (days.includes(fromISODate(d).getDay())) return d;
    d = addDays(d, 1);
  }
  return from;
};

/**
 * Greedy capacity scheduler: walks pending tasks in tree order and packs them
 * into study days without exceeding the daily budget. A task bigger than the
 * budget gets a day of its own. Completed tasks keep their dates.
 */
export const scheduleRoadmap = (r: Roadmap, opts: ScheduleOptions): Roadmap => {
  const days = opts.studyDays.length ? opts.studyDays : DEFAULT_DAYS;
  const capacity = minutesPerStudyDay(opts.hoursPerWeek, days);
  let day = nextStudyDay(opts.startDate ?? todayISO(), days);
  let used = 0;

  return mapTasks(r, (t) => {
    if (t.completedAt) return t;
    if (used > 0 && used + t.estimatedMinutes > capacity) {
      day = nextStudyDay(addDays(day, 1), days);
      used = 0;
    }
    used += t.estimatedMinutes;
    return { ...t, dueDate: day };
  });
};

export const projectedEnd = (r: Roadmap): ISODate | null => {
  const dates = roadmapTasks(r)
    .filter((t) => !t.completedAt && t.dueDate)
    .map((t) => t.dueDate!) as ISODate[];
  return dates.length ? dates.sort().at(-1)! : null;
};

/** Minutes actually completed per study day over the last `windowDays`. */
export const observedPace = (r: Roadmap, studyDays: number[], windowDays = 14, ref = todayISO()) => {
  const from = addDays(ref, -windowDays + 1);
  let minutes = 0;
  for (const t of roadmapTasks(r)) {
    const d = isoDay(t.completedAt);
    if (d && d >= from && d <= ref) minutes += t.estimatedMinutes;
  }
  let studyDayCount = 0;
  for (let i = 0; i < windowDays; i++) if (studyDays.includes(fromISODate(addDays(from, i)).getDay())) studyDayCount++;
  return studyDayCount ? minutes / studyDayCount : 0;
};

export interface RecalibrationPlan {
  /** Roadmap rescheduled from today keeping the current weekly hours. */
  rescheduled: Roadmap;
  overdueCount: number;
  pendingMinutes: number;
  projectedEnd: ISODate | null;
  deadline: ISODate;
  /** Positive = days of slack before deadline, negative = days late. */
  slackDays: number;
  /** Weekly hours needed to finish exactly on the deadline. */
  requiredHoursPerWeek: number;
  /** Observed minutes per study day (last 14 days). */
  observedMinutesPerDay: number;
  plannedMinutesPerDay: number;
}

export const planRecalibration = (r: Roadmap, studyDays: number[], ref = todayISO()): RecalibrationPlan => {
  const pending = roadmapTasks(r).filter((t) => !t.completedAt);
  const overdueCount = pending.filter((t) => t.dueDate && t.dueDate < ref).length;
  const pendingMinutes = pending.reduce((s, t) => s + t.estimatedMinutes, 0);

  const rescheduled = scheduleRoadmap(r, { startDate: ref, studyDays, hoursPerWeek: r.hoursPerWeek });
  const end = projectedEnd(rescheduled);
  const slackDays = end ? diffDays(end, r.deadline) : diffDays(ref, r.deadline);

  // Study days left until the deadline -> hours/week required.
  const daysLeft = Math.max(1, diffDays(ref, r.deadline) + 1);
  let studyDaysLeft = 0;
  for (let i = 0; i < daysLeft; i++) if (studyDays.includes(fromISODate(addDays(ref, i)).getDay())) studyDaysLeft++;
  const perDay = pendingMinutes / Math.max(1, studyDaysLeft);
  const requiredHoursPerWeek = Math.ceil(((perDay * Math.max(1, studyDays.length)) / 60) * 2) / 2; // round up to 0.5h

  return {
    rescheduled,
    overdueCount,
    pendingMinutes,
    projectedEnd: end,
    deadline: r.deadline,
    slackDays,
    requiredHoursPerWeek,
    observedMinutesPerDay: Math.round(observedPace(r, studyDays, 14, ref)),
    plannedMinutesPerDay: minutesPerStudyDay(r.hoursPerWeek, studyDays),
  };
};
