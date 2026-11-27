/**
 * Time-aware, career-themed greetings. `*text*` marks the emphasized fragment
 * (rendered in serif italic with a gradient). Never repeats the previous one.
 */
export type DayPart = 'madrugada' | 'manha' | 'tarde' | 'noite';

export interface Greeting {
  title: string;
  subtitle: string;
  part: DayPart;
}

export const dayPart = (h: number): DayPart => (h < 5 ? 'madrugada' : h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite');

const BY_PART: Record<DayPart, { title: string; subtitle: string }[]> = {
  madrugada: [
    { title: 'O mundo dorme. *Sua carreira* não precisa.', subtitle: 'Ideias das 3h costumam ser as melhores — vamos anotar a sua?' },
    { title: 'Madrugada produtiva ou *insônia estratégica*?', subtitle: 'Seja qual for, dá para sair daqui com um próximo passo claro.' },
    { title: 'Silêncio total. *Hora de pensar grande.*', subtitle: 'Me conta onde você quer estar daqui a um ano.' },
    { title: 'Ainda acordado? *Vamos fazer valer.*', subtitle: 'Um plano pequeno agora vale mais que dez amanhã.' },
  ],
  manha: [
    { title: 'Bom dia. *Qual passo* cabe no café de hoje?', subtitle: 'Roadmaps, currículo, entrevistas — é só pedir.' },
    { title: 'Manhã fresca, *currículo afiado?*', subtitle: 'Começar o dia com uma candidatura forte muda a semana.' },
    { title: 'Bom dia! *Bora subir um degrau.*', subtitle: 'Me diga o que você quer conquistar e eu desenho o caminho.' },
    { title: 'A manhã é de quem *planeja.*', subtitle: 'Cinco minutos aqui economizam semanas de estudo sem rumo.' },
    { title: 'Bom dia. *Que carreira* vamos construir hoje?', subtitle: 'Pergunte qualquer coisa — de salário a transição de área.' },
  ],
  tarde: [
    { title: 'Boa tarde. *Pós-almoço* também é progresso.', subtitle: 'Que tal ensaiar aquela entrevista enquanto a energia volta?' },
    { title: 'Tarde boa para *destravar* uma decisão.', subtitle: 'Mudar de área, pedir aumento, escolher o que estudar…' },
    { title: 'Boa tarde! *O que vem depois* do seu cargo atual?', subtitle: 'Eu ajudo a enxergar o próximo nível — e o caminho até ele.' },
    { title: 'Metade do dia feita. *A outra metade* é sua.', subtitle: 'Escolha um objetivo e eu transformo em tarefas concretas.' },
  ],
  noite: [
    { title: 'Boa noite. *Planejamos* o próximo degrau?', subtitle: 'A noite é ótima para pensar no longo prazo.' },
    { title: 'Expediente encerrado. *Futuro aberto.*', subtitle: 'Me conta o que você quer construir fora do horário comercial.' },
    { title: 'Boa noite! *Uma conversa* pode mudar o ano.', subtitle: 'Currículo, entrevista, salário, transição — por onde começamos?' },
    { title: 'O dia acabou, *a ambição não.*', subtitle: 'Vamos transformar ela num plano que cabe na sua rotina.' },
    { title: 'Boa noite. *Hora de revisar* a rota.', subtitle: 'Onde você está, onde quer chegar e o que falta no meio.' },
  ],
};

const WEEKDAY: Partial<Record<number, { title: string; subtitle: string; parts: DayPart[] }[]>> = {
  1: [{ title: 'Segunda-feira: *a semana inteira* para avançar.', subtitle: 'Vamos definir a meta da semana?', parts: ['manha', 'tarde'] }],
  5: [{ title: 'Sextou! *Feche a semana* com uma vitória.', subtitle: 'Uma tarefa pequena hoje mantém o ritmo na segunda.', parts: ['tarde', 'noite'] }],
  6: [{ title: 'Sábado é dia de *investir em você.*', subtitle: 'Sem reuniões, sem pressa — só o seu próximo passo.', parts: ['manha', 'tarde'] }],
  0: [{ title: 'Domingo à noite: *prepare a semana* que vem.', subtitle: 'Um plano claro hoje tira a ansiedade de amanhã.', parts: ['noite'] }],
};

const KEY = 'mentor:last-greeting';
/** In-memory fallback when sessionStorage is unavailable (private mode, tests). */
let memLast: string | null = null;

export const pickGreeting = (now = new Date(), rand = Math.random): Greeting => {
  const part = dayPart(now.getHours());
  const pool = [...BY_PART[part], ...(WEEKDAY[now.getDay()] ?? []).filter((g) => g.parts.includes(part))];
  let last: string | null = memLast;
  try {
    last = sessionStorage.getItem(KEY) ?? memLast;
  } catch {
    /* ignore */
  }
  const options = pool.filter((g) => g.title !== last);
  const g = options[Math.floor(rand() * options.length)] ?? pool[0];
  memLast = g.title;
  try {
    sessionStorage.setItem(KEY, g.title);
  } catch {
    /* ignore */
  }
  return { title: g.title, subtitle: g.subtitle, part };
};

/** Split "*emphasis*" markers into segments. */
export const segments = (s: string) => s.split(/(\*[^*]+\*)/).filter(Boolean).map((p) => (p.startsWith('*') ? { em: true, text: p.slice(1, -1) } : { em: false, text: p }));

/** Example prompts rotated in the composer placeholder. */
export const PLACEHOLDERS = [
  'Quero virar dev back-end em 6 meses estudando 8h por semana…',
  'Revise meu currículo para uma vaga de Product Manager…',
  'Simule uma entrevista para front-end pleno…',
  'Recebi uma proposta de 9k como analista de dados, é boa?',
  'Trabalho com vendas e quero mudar de área…',
];
