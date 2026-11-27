import { ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { TransitionCanvas as Data } from '~/agent/types';
import { cn } from '~/lib/cn';
import { Box, Ring, Section, Tag } from './ui';

const DEMAND = { alta: 'good', média: 'warn', baixa: 'bad' } as const;

export function TransitionCanvas({ data, onAsk }: { data: Data; onAsk: (t: string) => void }) {
  const [sel, setSel] = useState(0);
  const p = data.paths[sel];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[12px] uppercase tracking-wider text-subtle">Partindo de</div>
        <h2 className="text-[20px] font-semibold tracking-tight first-letter:uppercase">{data.from}</h2>
      </div>

      <Section title="Caminhos possíveis">
        <div className="grid grid-cols-2 gap-2">
          {data.paths.map((x, i) => (
            <button
              key={x.title}
              onClick={() => setSel(i)}
              className={cn('flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98]', i === sel ? 'border-accent/50 bg-accent/5' : 'border-line bg-panel hover:border-subtle/50')}
            >
              <div className="flex w-full items-start justify-between">
                <span className="text-2xl">{x.emoji}</span>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'rgb(var(--mint))' }}>{x.overlap}%</span>
              </div>
              <span className="mt-2 text-[14px] font-medium leading-tight">{x.title}</span>
              <span className="mt-1 text-[12px] text-subtle">~{x.months} meses</span>
            </button>
          ))}
        </div>
      </Section>

      <Box key={sel} className="animate-rise p-5">
        <div className="flex items-center gap-4">
          <Ring value={p.overlap} size={84} stroke={8} color="rgb(var(--mint))">
            <span className="text-[19px] font-semibold">{p.overlap}%</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">{p.emoji} {p.title}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Tag tone={DEMAND[p.demand]}>Demanda {p.demand}</Tag>
              <Tag><Clock size={11} /> ~{p.months} meses</Tag>
              <Tag tone="good"><TrendingUp size={11} /> +{p.salaryDelta}% salário</Tag>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[12px] font-medium text-mint">Você reaproveita</div>
            <ul className="space-y-1.5">{p.reuse.map((r) => <li key={r} className="flex items-center gap-2 text-[14px]"><span className="h-1.5 w-1.5 rounded-full bg-mint" />{r}</li>)}</ul>
          </div>
          <div>
            <div className="mb-2 text-[12px] font-medium text-amber">Precisa aprender</div>
            <ul className="space-y-1.5">{p.learn.map((r) => <li key={r} className="flex items-center gap-2 text-[14px]"><span className="h-1.5 w-1.5 rounded-full bg-amber" />{r}</li>)}</ul>
          </div>
        </div>
        <button onClick={() => onAsk(`Quero me tornar ${p.title} em ${p.months} meses, monte meu roadmap de estudos`)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-[14px] font-medium text-bg transition active:scale-[0.98]">
          Gerar roadmap para {p.title} <ArrowRight size={16} />
        </button>
      </Box>
    </div>
  );
}
