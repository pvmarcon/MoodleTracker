import { describe, expect, it } from 'vitest';
import { buildTurn, mockAgent } from '~/agent/mockAgent';
import { detectHours, detectIntent, detectLevel, detectMoney, detectRole, detectWeeks } from '~/agent/router';
import type { AgentEvent } from '~/agent/types';
import { dayPart, pickGreeting, segments } from '~/lib/greeting';

describe('intent router', () => {
  it.each([
    ['Quero virar dev back-end em 6 meses', 'roadmap'],
    ['Revise meu currículo para vaga de back-end', 'resume'],
    ['Simule uma entrevista para front-end pleno', 'interview'],
    ['Recebi uma proposta de 9k, é boa?', 'salary'],
    ['Como negociar salário?', 'salary'],
    ['Trabalho com vendas e quero mudar de área', 'transition'],
    ['oi, tudo bem?', 'chat'],
  ])('%s → %s', (text, intent) => {
    expect(detectIntent(text)).toBe(intent);
  });

  it('extracts entities', () => {
    expect(detectRole('analista de dados pleno')).toBe('Analista de Dados');
    expect(detectLevel('vaga sênior')).toBe('Sênior');
    expect(detectWeeks('em 6 meses')).toBe(26);
    expect(detectHours('8h por semana')).toBe(8);
    expect(detectHours('2 horas por dia')).toBe(10);
    expect(detectMoney('proposta de 9k')).toBe(9000);
    expect(detectMoney('me ofereceram R$ 7.500')).toBe(7500);
  });

  it('cuts the transition origin at conjunctions', () => {
    const t = buildTurn('Trabalho com vendas e quero mudar de área', []);
    expect(t.canvas?.kind === 'transition' && t.canvas.from).toBe('vendas');
  });
});

describe('greetings', () => {
  it('maps hours to day parts', () => {
    expect([2, 9, 15, 21].map(dayPart)).toEqual(['madrugada', 'manha', 'tarde', 'noite']);
  });

  it('never repeats the previous greeting', () => {
    const night = new Date(2026, 10, 25, 21, 0);
    let prev = '';
    for (let i = 0; i < 20; i++) {
      const g = pickGreeting(night);
      expect(g.part).toBe('noite');
      expect(g.title).not.toBe(prev);
      prev = g.title;
    }
  });

  it('parses emphasis markers', () => {
    expect(segments('Boa noite. *Planejamos* o próximo?')).toEqual([
      { em: false, text: 'Boa noite. ' },
      { em: true, text: 'Planejamos' },
      { em: false, text: ' o próximo?' },
    ]);
  });
});

describe('mock agent event stream', () => {
  it('emits intent → status → canvas → text → suggestions → done', async () => {
    const events: AgentEvent[] = [];
    const msg = { id: '1', role: 'user' as const, text: 'Recebi uma proposta de 9k como analista de dados', createdAt: '' };
    for await (const e of mockAgent.run({ messages: [msg] })) events.push(e);
    const order = events.map((e) => e.type).filter((t, i, a) => t !== a[i - 1]);
    expect(order).toEqual(['intent', 'status', 'canvas', 'text', 'suggestions', 'done']);
    const canvas = events.find((e) => e.type === 'canvas');
    expect(canvas && canvas.type === 'canvas' && canvas.canvas.kind).toBe('salary');
  }, 15000);
});
