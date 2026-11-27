import type { ISODate } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-day ISO string (no timezone shift). */
export const toISODate = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromISODate = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = (): ISODate => toISODate(new Date());

export const addDays = (s: ISODate, n: number): ISODate => {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const diffDays = (a: ISODate, b: ISODate): number =>
  Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);

export const isoDay = (iso: string | null | undefined): ISODate | null => (iso ? toISODate(new Date(iso)) : null);

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const weekdayShort = (i: number) => WEEKDAYS[i];

export const formatShort = (s: ISODate): string => {
  const d = fromISODate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const formatLong = (s: ISODate): string => {
  const d = fromISODate(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

export const relativeDay = (s: ISODate, ref: ISODate = today()): string => {
  const n = diffDays(ref, s);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n < 0) return `há ${-n} dias`;
  if (n < 7) return `em ${n} dias`;
  return formatShort(s);
};

export const formatMinutes = (m: number): string => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${pad(r)}` : `${h}h`;
};

/** Countdown label for deadlines: "em 120 dias", "amanhã", "vencido há 3 dias". */
export const countdown = (s: ISODate, ref: ISODate = today()): string => {
  const n = diffDays(ref, s);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n < 0) return `vencido há ${-n} ${-n === 1 ? 'dia' : 'dias'}`;
  return `em ${n} dias`;
};
