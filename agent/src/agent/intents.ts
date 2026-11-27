import { Banknote, Compass, FileText, Map, MessageCircle, Mic } from 'lucide-react';
import type { IntentId } from './types';

export const INTENTS: Record<IntentId, { label: string; icon: typeof Map; color: string; prompt: string; hint: string }> = {
  roadmap: { label: 'Roadmap de estudos', icon: Map, color: 'rgb(var(--accent))', prompt: 'Quero virar dev back-end em 6 meses estudando 8h por semana', hint: 'Plano em fases com tarefas' },
  resume: { label: 'Revisar currículo', icon: FileText, color: 'rgb(var(--sky))', prompt: 'Revise meu currículo para uma vaga de desenvolvedor back-end', hint: 'Nota, reescritas e ATS' },
  interview: { label: 'Simular entrevista', icon: Mic, color: 'rgb(var(--mint))', prompt: 'Simule uma entrevista para front-end pleno', hint: 'Perguntas, cronômetro e rubrica' },
  salary: { label: 'Salário & proposta', icon: Banknote, color: 'rgb(var(--amber))', prompt: 'Recebi uma proposta de 9k como analista de dados pleno, é boa?', hint: 'Faixas e roteiro de negociação' },
  transition: { label: 'Mudar de área', icon: Compass, color: 'rgb(var(--rose))', prompt: 'Trabalho com vendas e quero mudar de área', hint: 'Caminhos e habilidades' },
  chat: { label: 'Conversa', icon: MessageCircle, color: 'rgb(var(--muted))', prompt: '', hint: '' },
};

export const QUICK_INTENTS: IntentId[] = ['roadmap', 'resume', 'interview', 'salary', 'transition'];
