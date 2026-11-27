import { Check, ChevronDown, Clock, Hammer, Layers, ListChecks, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RoadmapCanvas as Data } from '~/agent/types';
import { cn } from '~/lib/cn';
import { Bar, Box, Section, Stat } from './ui';

const KIND: Record<string, string> = { study: 'Estudo', practice: 'Prática', project: 'Projeto', review: 'Revisão' };

export function RoadmapCanvas({ data, onAsk }: { data: Data; onAsk: (t: string) => void }) {
  const { roadmap } = data;
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<number>(0);

  const phases = useMemo(() => {
    const totalMin = roadmap.phases.flatMap((p) => p.topics.flatMap((t) => t.tasks)).reduce((s, t) => s + t.estimatedMinutes, 0) || 1;
    let week = 1;
    return roadmap.phases.map((p, i) => {
      const tasks = p.topics.flatMap((t) => t.tasks.map((task, j) => ({ ...task, key: `${i}-${t.title}-${j}`, topic: t.title })));
      const min = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
      const span = Math.max(1, Math.round((min / totalMin) * data.weeks));
      const from = week;
      week += span;
      return { ...p, tasks, from, to: Math.min(data.weeks, from + span - 1) };
    });
  }, [roadmap, data.weeks]);

  const all = phases.flatMap((p) => p.tasks);
  const doneCount = all.filter((t) => done[t.key]).length;
  const hours = Math.round(all.reduce((s, t) => s + t.estimatedMinutes, 0) / 60);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-2xl">{roadmap.emoji}</div>
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">{roadmap.title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{data.hoursPerWeek}h por semana · {data.weeks} semanas</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="fases" value={<span className="inline-flex items-center gap-1.5"><Layers size={16} className="text-accent" />{phases.length}</span>} />
        <Stat label="tarefas" value={<span className="inline-flex items-center gap-1.5"><ListChecks size={16} className="text-accent" />{all.length}</span>} />
        <Stat label="no total" value={<span className="inline-flex items-center gap-1.5"><Clock size={16} className="text-accent" />{hours}h</span>} />
      </div>

      <Section title={`Progresso · ${doneCount}/${all.length}`}>
        <Bar value={(doneCount / Math.max(1, all.length)) * 100} color="rgb(var(--mint))" />
      </Section>

      <Section title="Trilha">
        <ol className="relative space-y-3">
          <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-px bg-line" />
          {phases.map((p, i) => {
            const pd = p.tasks.filter((t) => done[t.key]).length;
            const complete = pd === p.tasks.length && p.tasks.length > 0;
            const isOpen = open === i;
            return (
              <li key={i} className="relative pl-11">
                <span
                  className={cn(
                    'absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-semibold transition',
                    complete ? 'border-mint bg-mint text-bg' : isOpen ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel text-subtle',
                  )}
                >
                  {complete ? <Check size={15} strokeWidth={3} /> : i + 1}
                </span>
                <Box className={cn('overflow-hidden transition', isOpen && 'border-accent/30')}>
                  <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">Semanas {p.from}–{p.to}</div>
                      <div className="mt-0.5 font-medium">{p.title}</div>
                      {p.description && <div className="mt-0.5 text-[13px] text-muted">{p.description}</div>}
                    </div>
                    <span className="text-[12px] tabular-nums text-subtle">{pd}/{p.tasks.length}</span>
                    <ChevronDown size={16} className={cn('text-subtle transition', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <ul className="animate-fade border-t border-line">
                      {p.tasks.map((t) => (
                        <li key={t.key}>
                          <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 transition hover:bg-raised/50">
                            <input type="checkbox" checked={!!done[t.key]} onChange={(e) => setDone((d) => ({ ...d, [t.key]: e.target.checked }))} className="peer sr-only" />
                            <span className={cn('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50', done[t.key] ? 'border-mint bg-mint text-bg' : 'border-subtle/60')}>
                              {done[t.key] && <Check size={12} strokeWidth={3.5} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn('block text-[14px]', done[t.key] && 'text-subtle line-through')}>{t.title}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-subtle">
                                {t.topic} · {KIND[t.kind]} · {t.estimatedMinutes} min
                                {t.kind === 'project' && <Hammer size={12} className="text-amber" />}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </Box>
              </li>
            );
          })}
        </ol>
      </Section>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onAsk('Comprime esse roadmap para 8 semanas')} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:text-fg">
          <RotateCcw size={13} /> Ajustar prazo
        </button>
        <button onClick={() => onAsk(`Simule uma entrevista para ${roadmap.title}`)} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:text-fg">
          Treinar entrevista para essa vaga →
        </button>
      </div>
    </div>
  );
}
