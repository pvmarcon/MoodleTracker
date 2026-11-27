import { diffDays, today } from '@/lib/date';
import type { RoadmapInput } from '@/types';

/** Total study minutes available between today and the deadline. */
export const capacityMinutes = (i: RoadmapInput): number => {
  const weeks = Math.max(1, diffDays(today(), i.deadline) / 7);
  return Math.round(weeks * i.hoursPerWeek * 60);
};
