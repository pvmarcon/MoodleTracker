import { TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { SalaryCanvas as Data } from '~/agent/types';
import { brl } from '~/lib/format';
import { Box, CopyButton, Section, Stat, Tag } from './ui';

export function SalaryCanvas({ data }: { data: Data; onAsk: (t: string) => void }) {
  const [offer, setOffer] = useState<number | undefined>(data.offer);
  const min = data.p25 * 0.6;
  const max = data.p90 * 1.1;
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const verdict =
    offer === undefined ? null : offer < data.p25 ? { t: 'Abaixo do mercado', tone: 'bad' as const } : offer < data.p50 ? { t: 'Abaixo da mediana', tone: 'warn' as const } : offer < data.p75 ? { t: 'Acima da mediana', tone: 'good' as const } : { t: 'Acima do mercado', tone: 'good' as const };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[12px] uppercase tracking-wider text-subtle">{data.location}</div>
        <h2 className="text-[20px] font-semibold tracking-tight">{data.role} · {data.level}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="25º percentil" value={brl(data.p25)} />
        <Stat label="mediana" value={brl(data.p50)} tone="rgb(var(--accent))" />
        <Stat label="75º percentil" value={brl(data.p75)} />
      </div>

      <Section title="Distribuição (salário bruto mensal)">
        <Box className="px-4 pb-4 pt-12">
          <div className="relative h-3 rounded-full bg-raised">
            <div className="absolute inset-y-0 origin-left animate-grow rounded-full bg-gradient-to-r from-accent/40 via-accent to-accent/40" style={{ left: pos(data.p25), right: `calc(100% - ${pos(data.p75)})` }} />
            <div className="absolute inset-y-0 rounded-r-full bg-accent/15" style={{ left: pos(data.p75), right: `calc(100% - ${pos(data.p90)})` }} />
            <div className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-fg" style={{ left: pos(data.p50) }} />
            {offer !== undefined && offer > 0 && (
              <div className="absolute -top-10 -translate-x-1/2 transition-[left] duration-500" style={{ left: pos(Math.min(max, Math.max(min, offer))) }}>
                <div className="whitespace-nowrap rounded-lg bg-amber px-2 py-1 text-[11px] font-semibold text-bg">Proposta {brl(offer)}</div>
                <div className="mx-auto h-5 w-[2px] bg-amber" />
              </div>
            )}
          </div>
          <div className="relative mt-2 h-4 text-[11px] text-subtle">
            {[['p25', data.p25], ['mediana', data.p50], ['p75', data.p75], ['p90', data.p90]].map(([l, v]) => (
              <span key={l} className="absolute -translate-x-1/2" style={{ left: pos(v as number) }}>{l}</span>
            ))}
          </div>
        </Box>
      </Section>

      <Section title="Avaliar uma proposta">
        <Box className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-raised/50 px-3 focus-within:border-accent/40">
            <span className="text-[13px] text-subtle">R$</span>
            <input
              inputMode="numeric"
              value={offer ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                setOffer(n || undefined);
              }}
              placeholder="Valor mensal bruto"
              className="w-full bg-transparent text-[15px] focus:outline-none"
            />
          </label>
          {verdict && <Tag tone={verdict.tone}>{verdict.t}</Tag>}
        </Box>
      </Section>

      <Section title="O que mexe na sua faixa">
        <Box className="divide-y divide-line">
          {data.factors.map((f) => (
            <div key={f.label} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
              {f.impact > 0 ? <TrendingUp size={16} className="text-mint" /> : <TrendingDown size={16} className="text-rose" />}
              <span className="flex-1 text-muted">{f.label}</span>
              <span className={f.impact > 0 ? 'font-medium text-mint' : 'font-medium text-rose'}>{f.impact > 0 ? '+' : ''}{f.impact}%</span>
            </div>
          ))}
        </Box>
      </Section>

      <Section title="Roteiro de negociação">
        <div className="space-y-3">
          {data.scripts.map((s, i) => (
            <Box key={s.title} className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[11px] text-subtle">{i + 1}</span>{s.title}</span>
                <CopyButton text={s.text} />
              </div>
              <p className="mt-2 font-serif text-[18px] leading-snug text-fg/90">“{s.text}”</p>
            </Box>
          ))}
        </div>
      </Section>
      <p className="text-[11px] text-subtle">Valores simulados para demonstração da interface.</p>
    </div>
  );
}
