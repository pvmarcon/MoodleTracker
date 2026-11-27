import { ArrowDown, FileUp, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { ResumeCanvas as Data } from '~/agent/types';
import { cn } from '~/lib/cn';
import { Bar, Box, CopyButton, Ring, Section, Tag } from './ui';

const TONE = { good: 'rgb(var(--mint))', warn: 'rgb(var(--amber))', bad: 'rgb(var(--rose))' } as const;

export function ResumeCanvas({ data, onAsk }: { data: Data; onAsk: (t: string) => void }) {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const scoreColor = data.score >= 75 ? TONE.good : data.score >= 55 ? TONE.warn : TONE.bad;

  return (
    <div className="space-y-6">
      <Box className="flex items-center gap-5 p-4">
        <Ring value={data.score} color={scoreColor}>
          <span className="text-[26px] font-semibold tracking-tight">{data.score}</span>
          <span className="text-[11px] text-subtle">/100</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] uppercase tracking-wider text-subtle">Vaga-alvo</div>
          <div className="text-[17px] font-semibold">{data.role}</div>
          <p className="mt-1 text-[13px] text-muted">
            {data.score >= 75 ? 'Pronto para candidaturas, com ajustes finos.' : 'Boa base. Ajustes de impacto podem dobrar suas respostas.'}
          </p>
        </div>
      </Box>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          setFile(e.dataTransfer.files[0]?.name ?? null);
        }}
        className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-3 transition', drag ? 'border-accent bg-accent/5' : 'border-line hover:border-subtle/60')}
      >
        <FileUp size={18} className="text-subtle" />
        <span className="flex-1 text-[13px] text-muted">{file ? <>Arquivo: <b className="text-fg">{file}</b> (análise real virá com a IA conectada)</> : 'Arraste seu currículo (PDF) ou clique para enviar'}</span>
        <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
      </label>

      <Section title="Por seção">
        <Box className="divide-y divide-line">
          {data.sections.map((s) => (
            <div key={s.name} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium">{s.name}</span>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: TONE[s.status] }}>{s.score}</span>
              </div>
              <Bar value={s.score} color={TONE[s.status]} className="mt-2" />
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.feedback}</p>
            </div>
          ))}
        </Box>
      </Section>

      <Section title="Reescritas sugeridas">
        <div className="space-y-3">
          {data.rewrites.map((r, i) => (
            <Box key={i} className="p-4">
              <p className="text-[13px] leading-relaxed text-subtle line-through decoration-rose/60">{r.before}</p>
              <ArrowDown size={14} className="my-2 text-subtle" />
              <p className="text-[14px] leading-relaxed text-fg">{r.after}</p>
              <div className="mt-3 flex items-center justify-between">
                <Tag tone="accent"><Sparkles size={11} /> {r.why}</Tag>
                <CopyButton text={r.after} />
              </div>
            </Box>
          ))}
        </div>
      </Section>

      <Section title="Palavras-chave (ATS)">
        <Box className="space-y-3 p-4">
          <div>
            <div className="mb-1.5 text-[12px] text-subtle">Você já tem</div>
            <div className="flex flex-wrap gap-1.5">{data.keywords.have.map((k) => <Tag key={k} tone="good">✓ {k}</Tag>)}</div>
          </div>
          <div>
            <div className="mb-1.5 text-[12px] text-subtle">Aparecem na vaga e faltam no CV</div>
            <div className="flex flex-wrap gap-1.5">
              {data.keywords.missing.map((k) => (
                <button key={k} onClick={() => onAsk(`Como incluir "${k}" no meu currículo de forma honesta?`)} className="rounded-md bg-rose/15 px-2 py-0.5 text-[12px] font-medium text-rose transition hover:bg-rose/25">
                  + {k}
                </button>
              ))}
            </div>
          </div>
        </Box>
      </Section>
    </div>
  );
}
