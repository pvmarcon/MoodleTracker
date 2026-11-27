import { ChevronLeft, ChevronRight, Lightbulb, Pause, Play, RotateCcw, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InterviewCanvas as Data } from '~/agent/types';
import { cn } from '~/lib/cn';
import { Box, Section, Tag } from './ui';

const TYPE_TONE = { comportamental: 'accent', técnica: 'good', situacional: 'warn' } as const;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function InterviewCanvas({ data, onAsk }: { data: Data; onAsk: (t: string) => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  const [tip, setTip] = useState(false);
  const total = data.questions.length;
  const finished = i >= total;
  const q = data.questions[Math.min(i, total - 1)];

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const go = (n: number) => {
    setI(n);
    setSecs(0);
    setRunning(false);
    setTip(false);
  };

  const score = Math.round((Object.values(checks).filter(Boolean).length / data.questions.reduce((s, x) => s + x.rubric.length, 0)) * 100);

  if (finished) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber/15 text-amber"><Trophy size={30} /></div>
        <h2 className="mt-4 text-[22px] font-semibold tracking-tight">Simulação concluída</h2>
        <p className="mt-1 text-[14px] text-muted">Você cobriu <b className="text-fg">{score}%</b> dos critérios esperados.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { setChecks({}); setAnswers({}); go(0); }} className="flex items-center gap-1.5 rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-bg"><RotateCcw size={14} /> Refazer</button>
          <button onClick={() => onAsk('Quero só perguntas técnicas mais difíceis')} className="rounded-full border border-line px-4 py-2 text-[13px] text-muted hover:text-fg">Nível mais difícil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-subtle">Simulando para</div>
          <div className="text-[16px] font-semibold">{data.role}</div>
        </div>
        <div className="flex gap-1">
          {data.questions.map((_, k) => (
            <button key={k} onClick={() => go(k)} aria-label={`Pergunta ${k + 1}`} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-accent' : answers[k] ? 'w-3 bg-mint' : 'w-3 bg-line')} />
          ))}
        </div>
      </div>

      <Box key={i} className="animate-rise p-5">
        <div className="flex items-center justify-between">
          <Tag tone={TYPE_TONE[q.type]}>{q.type}</Tag>
          <span className="text-[12px] tabular-nums text-subtle">{i + 1} de {total}</span>
        </div>
        <p className="mt-4 font-serif text-[24px] leading-snug">“{q.q}”</p>
        <button onClick={() => setTip((t) => !t)} className="mt-4 flex items-center gap-1.5 text-[13px] text-amber">
          <Lightbulb size={14} /> {tip ? 'Esconder dica' : 'Ver dica'}
        </button>
        {tip && <p className="mt-2 animate-fade rounded-xl bg-amber/10 px-3 py-2 text-[13px] text-fg/90">{q.tip}</p>}
      </Box>

      <div className="flex items-center gap-3">
        <button onClick={() => setRunning((r) => !r)} className={cn('flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90', running ? 'bg-rose text-white' : 'bg-fg text-bg')} aria-label={running ? 'Pausar' : 'Iniciar cronômetro'}>
          {running ? <Pause size={18} className="fill-current" /> : <Play size={18} className="ml-0.5 fill-current" />}
        </button>
        <div>
          <div className={cn('font-mono text-[22px] tabular-nums', secs > 120 ? 'text-amber' : 'text-fg')}>{fmt(secs)}</div>
          <div className="text-[12px] text-subtle">{running ? 'Respondendo… (ideal: 1–2 min)' : 'Responda em voz alta ou por escrito'}</div>
        </div>
      </div>

      <textarea
        value={answers[i] ?? ''}
        onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
        placeholder="Rascunhe sua resposta aqui (opcional)…"
        className="min-h-[110px] w-full resize-none rounded-2xl border border-line bg-panel px-4 py-3 text-[14px] leading-relaxed placeholder:text-subtle focus:border-accent/40 focus:outline-none"
      />

      <Section title="Autoavaliação">
        <Box className="divide-y divide-line">
          {q.rubric.map((r) => {
            const key = `${i}:${r}`;
            return (
              <label key={key} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[14px]">
                <input type="checkbox" checked={!!checks[key]} onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))} className="h-4 w-4 accent-[rgb(var(--mint))]" />
                <span className={cn(checks[key] ? 'text-fg' : 'text-muted')}>{r}</span>
              </label>
            );
          })}
        </Box>
      </Section>

      <div className="flex justify-between">
        <button disabled={i === 0} onClick={() => go(i - 1)} className="flex items-center gap-1 rounded-full px-3 py-2 text-[13px] text-muted hover:text-fg disabled:opacity-30">
          <ChevronLeft size={16} /> Anterior
        </button>
        <button onClick={() => go(i + 1)} className="flex items-center gap-1 rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-bg active:scale-95">
          {i === total - 1 ? 'Finalizar' : 'Próxima'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
