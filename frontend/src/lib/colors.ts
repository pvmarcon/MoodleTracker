import type { Energy, Priority, RoadmapColor, TaskKind } from '@/types';

export const ROADMAP_HEX: Record<RoadmapColor, string> = {
  violet: '#7c6cff',
  green: '#58cc02',
  blue: '#1cb0f6',
  orange: '#ff9600',
  pink: '#ff6fae',
  cyan: '#00c2b8',
};

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
export const ENERGY_LABEL: Record<Energy, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
export const KIND_LABEL: Record<TaskKind, string> = { study: 'Estudo', practice: 'Prática', project: 'Projeto', review: 'Revisão' };
