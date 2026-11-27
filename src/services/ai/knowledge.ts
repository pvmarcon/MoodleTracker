/**
 * Curated knowledge base that powers the "Mock Inteligente" provider and the
 * proactive suggestion engine when no LLM key is configured.
 *
 * Compact DSL for tasks:  "Título | kind | priority | energy | minutes | descrição?"
 *   kind:     s = study, p = practice, j = project, r = review
 *   priority/energy: h | m | l
 */

export interface DomainTopic {
  title: string;
  description?: string;
  tasks: string[];
}

export interface DomainPhase {
  title: string;
  description: string;
  /** Phase is skipped for learners that already have a solid base. */
  fundamentals?: boolean;
  topics: DomainTopic[];
}

export interface Domain {
  id: string;
  title: (goal: string) => string;
  emoji: string;
  keywords: string[];
  phases: DomainPhase[];
  projectIdeas: string[];
  related: string[];
}

export const DOMAINS: Domain[] = [
  {
    id: 'backend',
    title: () => 'Back-end Java & APIs',
    emoji: '☕',
    keywords: ['java', 'spring', 'back-end', 'backend', 'api', 'microsservi', 'kotlin', 'jvm', 'node'],
    phases: [
      {
        title: 'Fundamentos sólidos',
        description: 'Linguagem, orientação a objetos e ferramentas do dia a dia.',
        fundamentals: true,
        topics: [
          {
            title: 'Java moderno',
            tasks: [
              'Revisar records, sealed classes e pattern matching | s | h | m | 45 | Leia a JEP e reescreva 3 classes antigas usando records.',
              'Exercícios de Streams e Collectors | p | h | m | 60',
              'Optional sem abuso: quando usar | s | m | l | 25',
            ],
          },
          {
            title: 'Git & build',
            tasks: [
              'Fluxo de branches e rebase interativo | p | m | m | 40',
              'Entender o ciclo de vida do Maven | s | m | l | 30',
            ],
          },
        ],
      },
      {
        title: 'Spring Boot na prática',
        description: 'Construir APIs REST robustas com persistência e validação.',
        topics: [
          {
            title: 'APIs REST',
            tasks: [
              'Criar CRUD com Spring Web e DTOs | p | h | h | 90 | Use records como DTO e valide com Bean Validation.',
              'Tratamento global de erros com @ControllerAdvice | p | h | m | 45',
              'Documentar a API com OpenAPI/Swagger | p | m | l | 30',
            ],
          },
          {
            title: 'Persistência com JPA',
            tasks: [
              'Mapear relacionamentos 1:N e N:N | s | h | h | 60',
              'Resolver problema N+1 com fetch join | p | h | h | 50',
              'Migrations com Flyway | p | m | m | 40',
            ],
          },
          {
            title: 'Testes',
            tasks: [
              'Testes unitários com JUnit 5 e Mockito | p | h | m | 60',
              'Testes de integração com Testcontainers | p | m | h | 75',
            ],
          },
        ],
      },
      {
        title: 'Arquitetura & mensageria',
        description: 'Desacoplar serviços, filas e boas práticas de design.',
        topics: [
          {
            title: 'Mensageria',
            tasks: [
              'Conceitos de filas, exchanges e routing keys (RabbitMQ) | s | h | m | 40',
              'Publicar e consumir eventos com Spring AMQP | p | h | h | 80',
              'Dead-letter queues e retentativas | p | m | h | 50',
            ],
          },
          {
            title: 'Design de software',
            tasks: [
              'Arquitetura hexagonal: portas e adaptadores | s | m | m | 45',
              'Refatorar um serviço aplicando SOLID | p | m | h | 60',
            ],
          },
        ],
      },
      {
        title: 'Produção & carreira',
        description: 'Observabilidade, deploy e preparação para entrevistas.',
        topics: [
          {
            title: 'Deploy & observabilidade',
            tasks: [
              'Dockerizar a aplicação com multi-stage build | p | h | m | 50',
              'Métricas com Actuator + Prometheus | p | m | m | 45',
              'Pipeline de CI com GitHub Actions | p | m | m | 45',
            ],
          },
          {
            title: 'Entrevistas',
            tasks: [
              'Projeto final: API completa publicada | j | h | h | 180 | Integre REST, JPA, filas e testes num único repositório.',
              'Simular entrevista de system design | r | m | h | 60',
            ],
          },
        ],
      },
    ],
    projectIdeas: [
      'API de encurtador de links com cache e métricas',
      'Serviço de notificações assíncronas com RabbitMQ',
      'Rastreador de tarefas acadêmicas integrado ao Moodle',
    ],
    related: ['Kafka e streaming de eventos', 'Spring Security + JWT', 'Redis para cache', 'Kubernetes básico'],
  },
  {
    id: 'frontend',
    title: () => 'Front-end com React',
    emoji: '⚛️',
    keywords: ['react', 'front', 'frontend', 'web', 'javascript', 'typescript', 'next', 'css', 'html'],
    phases: [
      {
        title: 'Base da web',
        description: 'HTML semântico, CSS moderno e JavaScript essencial.',
        fundamentals: true,
        topics: [
          {
            title: 'HTML & CSS',
            tasks: [
              'HTML semântico e acessibilidade básica | s | h | l | 40',
              'Layouts com Flexbox e Grid | p | h | m | 60',
            ],
          },
          {
            title: 'JavaScript',
            tasks: [
              'Closures, escopo e this | s | h | h | 50',
              'Promises, async/await e fetch | p | h | m | 60',
              'Métodos de array (map, filter, reduce) | p | m | l | 30',
            ],
          },
        ],
      },
      {
        title: 'React essencial',
        description: 'Componentes, estado e efeitos com TypeScript.',
        topics: [
          {
            title: 'Componentes',
            tasks: [
              'Props, composição e children | s | h | m | 40',
              'Estado com useState e eventos | p | h | m | 45',
              'Listas, keys e renderização condicional | p | m | l | 30',
            ],
          },
          {
            title: 'TypeScript',
            tasks: [
              'Tipando props e hooks | p | h | m | 45',
              'Generics e utility types | s | m | h | 40',
            ],
          },
        ],
      },
      {
        title: 'Apps reais',
        description: 'Dados remotos, roteamento, estado global e testes.',
        topics: [
          {
            title: 'Dados & rotas',
            tasks: [
              'Buscar dados com TanStack Query | p | h | m | 60',
              'Rotas aninhadas e loaders | p | m | m | 45',
            ],
          },
          {
            title: 'Qualidade',
            tasks: [
              'Testes com Vitest e Testing Library | p | h | m | 60',
              'Performance: memo, lazy e profiler | s | m | h | 45',
            ],
          },
        ],
      },
      {
        title: 'Portfólio',
        description: 'Projeto publicado e preparação para vagas.',
        topics: [
          {
            title: 'Entrega',
            tasks: [
              'Projeto final: dashboard responsivo publicado | j | h | h | 180',
              'Revisar fundamentos para entrevistas | r | m | m | 45',
            ],
          },
        ],
      },
    ],
    projectIdeas: ['Clone simplificado de um quadro Kanban', 'Dashboard de finanças pessoais', 'PWA de hábitos offline-first'],
    related: ['Next.js e SSR', 'React Native / Expo', 'Animações com Framer Motion', 'Design systems'],
  },
  {
    id: 'data',
    title: () => 'Dados & Machine Learning',
    emoji: '📊',
    keywords: ['dados', 'data', 'python', 'machine learning', 'ml', 'ia ', 'analytics', 'sql', 'estatística', 'cientista'],
    phases: [
      {
        title: 'Ferramentas básicas',
        description: 'Python, SQL e estatística descritiva.',
        fundamentals: true,
        topics: [
          {
            title: 'Python',
            tasks: ['Estruturas de dados e compreensões | p | h | m | 45', 'Ambientes virtuais e notebooks | s | m | l | 25'],
          },
          {
            title: 'SQL',
            tasks: ['JOINs, GROUP BY e subqueries | p | h | m | 60', 'Window functions | p | m | h | 45'],
          },
        ],
      },
      {
        title: 'Análise exploratória',
        description: 'Manipular, limpar e visualizar dados.',
        topics: [
          {
            title: 'pandas',
            tasks: ['Limpeza de dados com pandas | p | h | m | 60', 'Agregações e merges | p | h | m | 45'],
          },
          {
            title: 'Visualização',
            tasks: ['Gráficos com matplotlib/seaborn | p | m | l | 40', 'Contar uma história com dados | s | m | m | 30'],
          },
        ],
      },
      {
        title: 'Modelagem',
        description: 'Modelos supervisionados e avaliação.',
        topics: [
          {
            title: 'scikit-learn',
            tasks: [
              'Regressão e classificação | s | h | h | 60',
              'Validação cruzada e métricas | p | h | h | 50',
              'Feature engineering | p | m | h | 45',
            ],
          },
        ],
      },
      {
        title: 'Portfólio',
        description: 'Projeto ponta a ponta e comunicação.',
        topics: [
          {
            title: 'Entrega',
            tasks: ['Projeto final: análise + modelo publicado | j | h | h | 180', 'Revisão de estatística | r | m | m | 40'],
          },
        ],
      },
    ],
    projectIdeas: ['Análise de notas e frequência de disciplinas', 'Previsão de preços de imóveis', 'Dashboard de gastos com Streamlit'],
    related: ['Deep learning com PyTorch', 'dbt e engenharia de dados', 'LLMs e RAG', 'Testes A/B'],
  },
  {
    id: 'english',
    title: () => 'Inglês para carreira',
    emoji: '🗣️',
    keywords: ['inglês', 'ingles', 'english', 'idioma', 'fluência', 'fluencia', 'toefl', 'ielts', 'speaking'],
    phases: [
      {
        title: 'Base gramatical',
        description: 'Tempos verbais e vocabulário de alta frequência.',
        fundamentals: true,
        topics: [
          {
            title: 'Gramática',
            tasks: ['Present perfect vs past simple | s | h | m | 30', 'Phrasal verbs mais comuns no trabalho | p | m | l | 25'],
          },
          { title: 'Vocabulário', tasks: ['Flashcards: 50 palavras técnicas | r | m | l | 20'] },
        ],
      },
      {
        title: 'Compreensão',
        description: 'Ouvir e ler conteúdo real da sua área.',
        topics: [
          {
            title: 'Listening',
            tasks: ['Assistir talk técnica com legenda em inglês | p | m | l | 40', 'Shadowing de 5 minutos | p | h | m | 20'],
          },
          { title: 'Reading', tasks: ['Ler documentação oficial e resumir | p | m | m | 30'] },
        ],
      },
      {
        title: 'Conversação',
        description: 'Falar com confiança em reuniões e entrevistas.',
        topics: [
          {
            title: 'Speaking',
            tasks: [
              'Gravar pitch pessoal de 2 minutos | j | h | h | 30',
              'Conversa com nativo/tutor | p | h | h | 45',
              'Responder perguntas comportamentais (STAR) | p | h | m | 40',
            ],
          },
        ],
      },
      {
        title: 'Entrevista',
        description: 'Simulações completas e revisão.',
        topics: [
          {
            title: 'Simulações',
            tasks: ['Mock interview completa em inglês | j | h | h | 60', 'Revisar erros recorrentes | r | m | l | 25'],
          },
        ],
      },
    ],
    projectIdeas: ['Escrever um post técnico em inglês', 'Apresentar um projeto em vídeo de 5 min', 'Participar de um meetup online'],
    related: ['Escrita técnica', 'Pronúncia e entonação', 'Small talk em reuniões'],
  },
  {
    id: 'design',
    title: () => 'Product Design / UX',
    emoji: '🎨',
    keywords: ['design', 'ux', 'ui', 'figma', 'produto', 'product'],
    phases: [
      {
        title: 'Fundamentos visuais',
        description: 'Tipografia, cor, grid e hierarquia.',
        fundamentals: true,
        topics: [
          {
            title: 'Visual',
            tasks: ['Hierarquia tipográfica | s | h | m | 40', 'Teoria de cor e contraste | s | m | l | 30', 'Redesenhar uma tela existente | p | h | m | 60'],
          },
        ],
      },
      {
        title: 'Pesquisa & UX',
        description: 'Entender usuários e problemas.',
        topics: [
          {
            title: 'Pesquisa',
            tasks: ['Roteiro de entrevista com usuários | p | h | m | 45', 'Mapa de jornada | p | m | m | 45'],
          },
        ],
      },
      {
        title: 'Interface & sistemas',
        description: 'Componentes, protótipos e design systems.',
        topics: [
          {
            title: 'Figma',
            tasks: ['Auto layout e variants | p | h | m | 50', 'Protótipo interativo | p | m | m | 45', 'Mini design system | j | m | h | 90'],
          },
        ],
      },
      {
        title: 'Portfólio',
        description: 'Estudos de caso convincentes.',
        topics: [
          { title: 'Entrega', tasks: ['Estudo de caso completo | j | h | h | 180', 'Revisar com mentor | r | m | m | 40'] },
        ],
      },
    ],
    projectIdeas: ['Redesign de um app de transporte local', 'App de hábitos com foco em acessibilidade', 'Fluxo de onboarding para SaaS'],
    related: ['Microinterações e motion', 'Métricas de produto', 'Acessibilidade WCAG'],
  },
];

/** Fallback template when no domain matches: structured learning loop around the goal. */
export const genericDomain = (goal: string): Domain => {
  const g = goal.trim().replace(/\.$/, '') || 'seu objetivo';
  return {
    id: 'generic',
    title: () => g.length > 42 ? g.slice(0, 40) + '…' : g,
    emoji: '🎯',
    keywords: [],
    phases: [
      {
        title: 'Mapear o terreno',
        description: 'Entender o que é necessário para alcançar o objetivo.',
        fundamentals: true,
        topics: [
          {
            title: 'Pesquisa inicial',
            tasks: [
              `Listar habilidades exigidas para "${g}" | s | h | m | 40`,
              'Escolher 2 fontes principais de estudo | s | m | l | 25',
              'Autoavaliação de 1 a 5 em cada habilidade | r | m | l | 20',
            ],
          },
        ],
      },
      {
        title: 'Construir a base',
        description: 'Estudo focado nos pilares de maior impacto.',
        topics: [
          {
            title: 'Pilar principal',
            tasks: ['Estudar o pilar de maior peso | s | h | h | 60', 'Exercícios guiados | p | h | m | 45', 'Resumo em uma página | r | m | l | 25'],
          },
          {
            title: 'Pilar secundário',
            tasks: ['Estudar o segundo pilar | s | m | m | 45', 'Aplicar em um exemplo real | p | m | m | 45'],
          },
        ],
      },
      {
        title: 'Praticar com projetos',
        description: 'Transformar conhecimento em resultado visível.',
        topics: [
          {
            title: 'Projeto',
            tasks: ['Definir escopo de um mini projeto | p | h | m | 30', 'Executar o mini projeto | j | h | h | 120', 'Pedir feedback de alguém experiente | r | m | m | 30'],
          },
        ],
      },
      {
        title: 'Consolidar',
        description: 'Revisões espaçadas e próximos passos.',
        topics: [
          { title: 'Fechamento', tasks: ['Revisão geral | r | m | m | 45', 'Planejar o próximo objetivo | s | l | l | 20'] },
        ],
      },
    ],
    projectIdeas: [`Mini projeto aplicando "${g}" no seu contexto`, 'Ensinar o que aprendeu em um post', 'Desafio de 7 dias'],
    related: ['Técnicas de estudo ativo', 'Revisão espaçada', 'Networking na área'],
  };
};

const norm = (s: string) => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `;

export const detectDomain = (text: string): Domain => {
  const t = norm(text);
  let best: { d: Domain; score: number } | null = null;
  for (const d of DOMAINS) {
    const score = d.keywords.reduce((s, k) => (t.includes(norm(k).trim()) ? s + 1 : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { d, score };
  }
  return best?.d ?? genericDomain(text);
};

const ADVANCED = ['intermediario', 'avancado', 'ja trabalho', 'experiencia', 'senior', 'pleno', 'anos de', 'domino', 'profissional'];

export const isAdvanced = (level: string) => {
  const t = norm(level);
  return ADVANCED.some((k) => t.includes(k));
};
