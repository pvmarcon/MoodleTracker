import type { IntentId } from './types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** weight: specific intents (currículo, salário…) beat generic study words ("vaga de", "aprender"). */
const RULES: { intent: IntentId; weight: number; words: string[] }[] = [
  { intent: 'resume', weight: 3, words: ['curriculo', 'cv', 'resume', 'linkedin', 'portfolio', 'perfil profissional', 'ats'] },
  { intent: 'interview', weight: 3, words: ['entrevista', 'interview', 'recrutador', 'perguntas', 'simular', 'mock', 'processo seletivo', 'dinamica', 'behavioral'] },
  { intent: 'salary', weight: 3, words: ['salario', 'salarial', 'negociar', 'negociacao', 'aumento', 'proposta', 'oferta', 'remuneracao', 'quanto ganha', 'pagar', 'promocao'] },
  { intent: 'transition', weight: 3, words: ['mudar de area', 'mudar de carreira', 'transicao', 'migrar', 'trocar de area', 'trocar de carreira', 'recomecar', 'nova area', 'qual area', 'qual carreira', 'nao sei o que'] },
  { intent: 'roadmap', weight: 1, words: ['aprender', 'estudar', 'roadmap', 'trilha', 'plano de estudo', 'virar', 'me tornar', 'tornar', 'dominar', 'curso', 'certificacao', 'primeiro emprego', 'vaga de', 'quero ser'] },
];

/** Keyword router used by the mock. A real model replaces this with its own reasoning. */
export const detectIntent = (text: string): IntentId => {
  const t = ` ${norm(text)} `;
  let best: { intent: IntentId; score: number } = { intent: 'chat', score: 0 };
  for (const r of RULES) {
    const score = r.words.reduce((s, w) => (t.includes(w) ? s + r.weight * (w.includes(' ') ? 2 : 1) : s), 0);
    if (score > best.score) best = { intent: r.intent, score };
  }
  return best.intent;
};

const ROLE_HINTS: [RegExp, string][] = [
  [/back.?end|java|spring|node|api/, 'Desenvolvedor(a) Back-end'],
  [/front.?end|react|vue|angular|css/, 'Desenvolvedor(a) Front-end'],
  [/full.?stack/, 'Desenvolvedor(a) Full-stack'],
  [/dados|data|analytics|bi\b|sql/, 'Analista de Dados'],
  [/cientista|machine learning|\bml\b|\bia\b|inteligencia artificial/, 'Cientista de Dados / ML'],
  [/produto|product manager|\bpm\b|\bpo\b/, 'Product Manager'],
  [/design|ux|ui\b|figma/, 'Product Designer'],
  [/devops|cloud|aws|kubernetes|sre/, 'Engenheiro(a) DevOps / Cloud'],
  [/mobile|android|ios|react native|flutter/, 'Desenvolvedor(a) Mobile'],
  [/qa|teste|quality/, 'Analista de QA'],
  [/marketing|growth/, 'Analista de Marketing'],
];

export const detectRole = (text: string, fallback = 'Desenvolvedor(a) de Software'): string => {
  const t = norm(text);
  return ROLE_HINTS.find(([re]) => re.test(t))?.[1] ?? fallback;
};

const LEVELS: [RegExp, string][] = [
  [/estagi|estagio|intern/, 'Estágio'],
  [/junior|\bjr\b|primeiro emprego|iniciante/, 'Júnior'],
  [/senior|\bsr\b/, 'Sênior'],
  [/lead|lider|tech lead|staff|principal/, 'Liderança'],
  [/pleno|\bpl\b|mid/, 'Pleno'],
];

export const detectLevel = (text: string, fallback = 'Pleno') => LEVELS.find(([re]) => re.test(norm(text)))?.[1] ?? fallback;

/** "em 6 meses", "até dezembro", "1 ano" → weeks */
export const detectWeeks = (text: string, fallback = 16): number => {
  const t = norm(text);
  const m = t.match(/(\d+)\s*(semana|mes|meses|ano|anos)/);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (m[2].startsWith('semana')) return n;
  if (m[2].startsWith('mes')) return Math.round(n * 4.3);
  return n * 52;
};

export const detectHours = (text: string, fallback = 6): number => {
  const m = norm(text).match(/(\d+)\s*h(oras?)?\s*(por|\/|na)?\s*(semana|sem)/);
  if (m) return Number(m[1]);
  const d = norm(text).match(/(\d+)\s*h(oras?)?\s*(por|\/|ao|no)?\s*dia/);
  return d ? Number(d[1]) * 5 : fallback;
};

export const detectMoney = (text: string): number | undefined => {
  const t = norm(text).replace(/\./g, '');
  const k = t.match(/(\d+(?:,\d+)?)\s*k\b/);
  if (k) return Math.round(Number(k[1].replace(',', '.')) * 1000);
  const r = t.match(/r\$\s*(\d{3,6})/) ?? t.match(/\b(\d{4,6})\b/);
  return r ? Number(r[1]) : undefined;
};
