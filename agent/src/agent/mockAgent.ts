import { addDays, today } from '@/lib/date';
import { buildMockRoadmap } from '@/services/ai/mockProvider';
import { detectHours, detectIntent, detectLevel, detectMoney, detectRole, detectWeeks } from './router';
import type { AgentEvent, AgentProvider, Canvas, IntentId, InterviewCanvas, Message, ResumeCanvas, SalaryCanvas, TransitionCanvas } from './types';

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      rej(new DOMException('aborted', 'AbortError'));
    });
  });

const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);

interface Turn {
  intent: IntentId;
  title: string;
  steps: string[];
  text: string;
  canvas?: Canvas;
  suggestions: string[];
}

// ---------------------------------------------------------------- builders

const roadmapTurn = (text: string): Turn => {
  const weeks = detectWeeks(text, 16);
  const hoursPerWeek = detectHours(text, 6);
  const roadmap = buildMockRoadmap({ goal: text, currentLevel: text, hoursPerWeek, deadline: addDays(today(), weeks * 7) });
  const tasks = roadmap.phases.flatMap((p) => p.topics.flatMap((t) => t.tasks));
  const hours = Math.round(tasks.reduce((s, t) => s + t.estimatedMinutes, 0) / 60);
  return {
    intent: 'roadmap',
    title: roadmap.title,
    steps: ['Entendendo o objetivo', 'Estimando sua base atual', `Dividindo ${weeks} semanas em fases`, 'Gerando tarefas práticas'],
    text: `Montei uma trilha em **${roadmap.phases.length} fases** para **${roadmap.title}**, com ${tasks.length} tarefas (~${hours}h no total) cabendo em **${hoursPerWeek}h por semana** ao longo de ${weeks} semanas.\n\nComece pela primeira fase: ela destrava o resto. Marque as tarefas no painel conforme for avançando.`,
    canvas: { kind: 'roadmap', goal: text, hoursPerWeek, weeks, roadmap },
    suggestions: ['Tenho menos tempo, comprime para 8 semanas', 'Quais projetos práticos fazer?', 'Simular entrevista para essa vaga'],
  };
};

const resumeTurn = (text: string): Turn => {
  const role = detectRole(text);
  const seed = hash(text);
  const canvas: ResumeCanvas = {
    kind: 'resume',
    role,
    score: 58 + (Math.abs(seed) % 18),
    sections: [
      { name: 'Resumo profissional', score: 45, status: 'bad', feedback: 'Genérico. Diga para qual vaga você é a melhor escolha e com qual resultado concreto.' },
      { name: 'Experiência', score: 62, status: 'warn', feedback: 'Bullets descrevem tarefas, não impacto. Use verbo + ação + resultado mensurável.' },
      { name: 'Projetos', score: 78, status: 'good', feedback: 'Bons projetos. Coloque link e a stack logo no título.' },
      { name: 'Habilidades', score: 70, status: 'warn', feedback: 'Lista longa demais. Priorize o que a vaga pede e agrupe por categoria.' },
      { name: 'Formatação & ATS', score: 85, status: 'good', feedback: 'Uma coluna, fontes padrão — passa bem em sistemas de triagem.' },
    ],
    rewrites: [
      {
        before: 'Responsável pelo desenvolvimento de APIs da empresa.',
        after: 'Desenvolvi 12 APIs REST em Spring Boot que reduziram o tempo de integração com parceiros de 3 semanas para 4 dias.',
        why: 'Verbo de ação + escopo + resultado com número.',
      },
      {
        before: 'Participei de projetos com banco de dados.',
        after: 'Otimizei consultas PostgreSQL críticas (N+1, índices), cortando a latência p95 de 1,2s para 180ms.',
        why: 'Mostra profundidade técnica e impacto mensurável.',
      },
    ],
    keywords: {
      have: pick([['Java', 'SQL', 'Git', 'REST'], ['React', 'TypeScript', 'CSS', 'Git'], ['Python', 'SQL', 'Excel', 'Power BI']], seed),
      missing: pick([['Docker', 'Testes automatizados', 'Mensageria', 'CI/CD'], ['Testes (Vitest/Jest)', 'Acessibilidade', 'Next.js', 'Performance web'], ['dbt', 'Estatística', 'Airflow', 'Storytelling com dados']], seed),
    },
  };
  return {
    intent: 'resume',
    title: `Currículo · ${role}`,
    steps: ['Lendo a vaga-alvo', 'Avaliando cada seção', 'Comparando palavras-chave (ATS)', 'Reescrevendo bullets fracos'],
    text: `Analisei seu currículo mirando **${role}**. Nota geral **${canvas.score}/100**: boa base, mas o resumo e as experiências ainda falam de *tarefas* em vez de *resultados*.\n\nNo painel estão as notas por seção, reescritas sugeridas e as palavras-chave que faltam para a triagem automática.`,
    canvas,
    suggestions: ['Reescreva meu resumo profissional', 'Adapte para uma vaga específica', 'Como deixar meu LinkedIn igual?'],
  };
};

const QUESTIONS: InterviewCanvas['questions'] = [
  { q: 'Me conte sobre um projeto do qual você se orgulha. Qual foi exatamente a sua contribuição?', type: 'comportamental', tip: 'Use STAR: Situação, Tarefa, Ação, Resultado. Foque no "eu", não no "nós".', rubric: ['Contexto claro em 1–2 frases', 'Ação individual específica', 'Resultado com número', 'Aprendizado'] },
  { q: 'Conte sobre uma vez em que você discordou de alguém do time. Como resolveu?', type: 'comportamental', tip: 'Mostre escuta, dados e foco no objetivo comum — não em quem estava certo.', rubric: ['Conflito real (não hipotético)', 'Como buscou entender o outro lado', 'Decisão baseada em dados', 'Relação preservada'] },
  { q: 'Como você projetaria uma API para encurtar links que recebe 10 mil requisições por segundo?', type: 'técnica', tip: 'Comece pelos requisitos, depois modelo de dados, cache, escalabilidade e trade-offs.', rubric: ['Esclarece requisitos', 'Modelo de dados e geração de IDs', 'Cache e leitura em escala', 'Trade-offs explícitos'] },
  { q: 'Um deploy seu derrubou uma funcionalidade em produção numa sexta à noite. O que você faz?', type: 'situacional', tip: 'Prioridade: mitigar (rollback), comunicar, investigar a causa raiz, prevenir.', rubric: ['Mitiga antes de investigar', 'Comunica com transparência', 'Post-mortem sem culpados', 'Ação preventiva'] },
  { q: 'Por que você quer trabalhar aqui e não em outra empresa?', type: 'comportamental', tip: 'Conecte algo específico da empresa (produto, desafio, cultura) com sua trajetória.', rubric: ['Pesquisou a empresa', 'Conexão com objetivos pessoais', 'Entusiasmo genuíno', 'Evita clichês'] },
];

const interviewTurn = (text: string): Turn => {
  const role = detectRole(text);
  const level = detectLevel(text);
  return {
    intent: 'interview',
    title: `Entrevista · ${role}`,
    steps: ['Identificando cargo e senioridade', 'Selecionando perguntas por competência', 'Montando critérios de avaliação'],
    text: `Vamos treinar para **${role} (${level})**. Preparei ${QUESTIONS.length} perguntas misturando comportamentais, técnicas e situacionais.\n\nResponda no painel, por escrito ou em voz alta com o cronômetro. Depois compare com o checklist de cada pergunta.`,
    canvas: { kind: 'interview', role: `${role} · ${level}`, questions: QUESTIONS },
    suggestions: ['Quero só perguntas técnicas', 'Como responder "qual seu maior defeito?"', 'Quanto pedir de salário nessa vaga?'],
  };
};

const BASE_PLENO: Record<string, number> = {
  'Desenvolvedor(a) Back-end': 9500,
  'Desenvolvedor(a) Front-end': 8800,
  'Desenvolvedor(a) Full-stack': 9200,
  'Analista de Dados': 7800,
  'Cientista de Dados / ML': 11000,
  'Product Manager': 12500,
  'Product Designer': 8500,
  'Engenheiro(a) DevOps / Cloud': 11500,
  'Desenvolvedor(a) Mobile': 9300,
  'Analista de QA': 6800,
  'Analista de Marketing': 6200,
};
const LEVEL_MULT: Record<string, number> = { Estágio: 0.22, Júnior: 0.55, Pleno: 1, Sênior: 1.55, Liderança: 2.05 };
const round100 = (n: number) => Math.round(n / 100) * 100;

const salaryTurn = (text: string): Turn => {
  const role = detectRole(text);
  const level = detectLevel(text);
  const p50 = round100((BASE_PLENO[role] ?? 8500) * (LEVEL_MULT[level] ?? 1));
  const offer = detectMoney(text);
  const canvas: SalaryCanvas = {
    kind: 'salary',
    role,
    level,
    location: 'Brasil · CLT',
    p25: round100(p50 * 0.8),
    p50,
    p75: round100(p50 * 1.25),
    p90: round100(p50 * 1.55),
    offer,
    factors: [
      { label: 'Inglês fluente / vaga internacional', impact: 35 },
      { label: 'Empresa de produto vs. consultoria', impact: 15 },
      { label: 'Especialização (cloud, segurança, ML)', impact: 20 },
      { label: 'Cidade fora de capitais', impact: -10 },
    ],
    scripts: [
      { title: 'Ao receber a proposta', text: 'Muito obrigado pela proposta, fiquei animado com o desafio! Antes de responder, posso entender melhor o pacote completo: benefícios, bônus e política de reajuste?' },
      { title: 'Contraproposta', text: `Pelo escopo da posição e pelo que tenho visto de mercado para ${level.toLowerCase()} na área, eu estava considerando algo em torno de R$ ${round100(p50 * 1.15).toLocaleString('pt-BR')}. Existe flexibilidade para chegarmos nesse valor?` },
      { title: 'Se não houver margem no salário', text: 'Entendo a limitação na faixa. Faria sentido compensar com bônus de contratação, revisão em 6 meses ou um dia extra de home office?' },
    ],
  };
  const verdict =
    offer === undefined
      ? ''
      : offer < canvas.p25
        ? `\n\nA proposta de **R$ ${offer.toLocaleString('pt-BR')}** está **abaixo do 25º percentil**. Vale negociar com firmeza.`
        : offer < canvas.p50
          ? `\n\nA proposta de **R$ ${offer.toLocaleString('pt-BR')}** está entre o 25º percentil e a mediana. Há espaço para pedir ~10–15% a mais.`
          : `\n\nA proposta de **R$ ${offer.toLocaleString('pt-BR')}** está **acima da mediana**. Foque em benefícios e crescimento.`;
  return {
    intent: 'salary',
    title: `Salário · ${role} ${level}`,
    steps: ['Identificando cargo e senioridade', 'Cruzando faixas de mercado (simuladas)', 'Preparando roteiro de negociação'],
    text: `Para **${role} ${level}** (CLT, Brasil), a faixa estimada vai de **R$ ${canvas.p25.toLocaleString('pt-BR')}** a **R$ ${canvas.p75.toLocaleString('pt-BR')}**, com mediana em **R$ ${p50.toLocaleString('pt-BR')}**/mês.${verdict}\n\n_Valores de demonstração. Com a IA real conectada, isso virá de fontes atualizadas._`,
    canvas,
    suggestions: ['Recebi uma proposta de 9k, é boa?', 'Como pedir aumento para meu gestor?', 'Comparar CLT vs PJ'],
  };
};

const transitionTurn = (text: string): Turn => {
  const fromMatch = text.match(/(?:sou|trabalho (?:com|como)|atuo (?:com|como)|vim de|venho de)\s+([^,.!?]+)/i);
  const from = fromMatch ? fromMatch[1].split(/\s+(?:e|mas|porem|porém|só que|quero|ha|há)\s+/i)[0].trim() : 'sua área atual';
  const canvas: TransitionCanvas = {
    kind: 'transition',
    from,
    paths: [
      { title: 'Analista de Dados', emoji: '📊', overlap: 62, months: 6, demand: 'alta', salaryDelta: 18, reuse: ['Raciocínio analítico', 'Excel', 'Comunicação com áreas de negócio'], learn: ['SQL', 'Power BI', 'Estatística básica'] },
      { title: 'Product Manager', emoji: '🧭', overlap: 48, months: 9, demand: 'média', salaryDelta: 35, reuse: ['Gestão de stakeholders', 'Priorização', 'Visão de cliente'], learn: ['Discovery', 'Métricas de produto', 'Noções técnicas'] },
      { title: 'Desenvolvedor(a) Back-end', emoji: '⚙️', overlap: 30, months: 12, demand: 'alta', salaryDelta: 40, reuse: ['Lógica', 'Resolução de problemas'], learn: ['Java ou Node', 'Bancos de dados', 'APIs REST', 'Git'] },
      { title: 'UX / Product Designer', emoji: '🎨', overlap: 41, months: 8, demand: 'média', salaryDelta: 12, reuse: ['Empatia com usuário', 'Comunicação visual'], learn: ['Figma', 'Pesquisa com usuários', 'Design systems'] },
    ],
  };
  return {
    intent: 'transition',
    title: 'Transição de carreira',
    steps: ['Mapeando suas habilidades transferíveis', 'Comparando com áreas em demanda', 'Estimando tempo de transição'],
    text: `Comparei ${from === 'sua área atual' ? 'seu perfil' : `quem vem de **${from}**`} com 4 caminhos possíveis. O de **menor atrito** é *Analista de Dados* (62% das habilidades já se aproveitam). O de **maior retorno** é *Back-end*, mas leva mais tempo.\n\nToque num caminho no painel para ver o que você reaproveita e o que precisa aprender.`,
    canvas,
    suggestions: ['Montar roadmap para Analista de Dados', 'Dá para fazer a transição trabalhando?', 'Como explicar a mudança na entrevista?'],
  };
};

const chatTurn = (text: string, history: Message[]): Turn => {
  const lastCanvas = [...history].reverse().find((m) => m.canvas)?.canvas;
  const replies = [
    'Posso te ajudar de várias formas: montar um **roadmap de estudos**, revisar seu **currículo**, **simular entrevistas**, avaliar uma **proposta salarial** ou explorar uma **transição de carreira**.\n\nMe conta um pouco mais: qual é o seu momento agora?',
    'Boa pergunta. Para te dar algo útil e não genérico, preciso de contexto: **qual cargo** você mira, **qual sua experiência** hoje e **em quanto tempo** quer chegar lá?',
  ];
  return {
    intent: 'chat',
    title: text.length > 40 ? `${text.slice(0, 38)}…` : text,
    steps: ['Entendendo sua pergunta'],
    text: lastCanvas
      ? `Anotado! Continuo com o painel aberto ao lado. Se quiser, posso ajustá-lo: diga o que mudar (prazo, foco, nível) ou peça outra coisa.`
      : pick(replies, hash(text)),
    suggestions: lastCanvas ? ['Refazer com outro foco', 'Explique o próximo passo', 'Começar outro tema'] : ['Quero virar dev back-end em 6 meses', 'Revise meu currículo', 'Simule uma entrevista para mim', 'Quero mudar de área'],
  };
};

// ---------------------------------------------------------------- provider

export const buildTurn = (text: string, history: Message[]): Turn => {
  const intent = detectIntent(text);
  switch (intent) {
    case 'roadmap':
      return roadmapTurn(text);
    case 'resume':
      return resumeTurn(text);
    case 'interview':
      return interviewTurn(text);
    case 'salary':
      return salaryTurn(text);
    case 'transition':
      return transitionTurn(text);
    default:
      return chatTurn(text, history);
  }
};

/**
 * Simulated agent: emits the same event stream a real LLM + tool calls would,
 * with realistic pacing so the UI (thinking steps, streaming, canvas) can be designed now.
 */
export const mockAgent: AgentProvider = {
  id: 'mock',
  label: 'Mentor · demo',
  async *run({ messages, signal }) {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    const turn = buildTurn(last?.text ?? '', messages);
    yield { type: 'intent', intent: turn.intent, title: turn.title } satisfies AgentEvent;
    for (const s of turn.steps) {
      yield { type: 'status', label: s };
      await wait(380 + Math.random() * 260, signal);
    }
    if (turn.canvas) yield { type: 'canvas', canvas: turn.canvas };
    // Stream text in small word groups.
    const tokens = turn.text.split(/(\s+)/);
    for (let i = 0; i < tokens.length; i += 3) {
      yield { type: 'text', delta: tokens.slice(i, i + 3).join('') };
      await wait(22 + Math.random() * 30, signal);
    }
    yield { type: 'suggestions', items: turn.suggestions };
    yield { type: 'done' };
  },
};
