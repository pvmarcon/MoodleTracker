export const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;

export const relTime = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'agora';
  if (d < 3600) return `há ${Math.floor(d / 60)} min`;
  if (d < 86400) return `há ${Math.floor(d / 3600)} h`;
  const days = Math.floor(d / 86400);
  return days === 1 ? 'ontem' : `há ${days} dias`;
};
