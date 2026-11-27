import type { Canvas } from '~/agent/types';

export const canvasTitle = (c: Canvas): string => {
  switch (c.kind) {
    case 'roadmap':
      return `Roadmap · ${c.roadmap.title}`;
    case 'resume':
      return `Análise de currículo · ${c.role}`;
    case 'interview':
      return `Simulador de entrevista · ${c.role}`;
    case 'salary':
      return `Faixa salarial · ${c.role} ${c.level}`;
    case 'transition':
      return 'Caminhos de transição';
  }
};
