import { AlertTriangle, ArrowRight, Check, Clock, Layers, ListChecks, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton, Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { progressOf, roadmapTasks } from '@/domain/roadmap';
import { minutesPerStudyDay, projectedEnd } from '@/domain/schedule';
import { cn } from '@/lib/cn';
import { addDays, formatMinutes, formatShort, today } from '@/lib/date';
import { useApp, type CreateResult } from '@/store/AppStore';
import { useNav } from '@/store/navigation';
import type { RoadmapInput } from '@/types';

const GOAL_EXAMPLES = [
  'Vaga de Back-end Java Pleno',
  'Inglês fluente para entrevistas',
  'Migrar para Ciência de Dados',
  'Dominar React e TypeScript',
  'Portfólio de Product Design',
];

const LEVELS = [
  { id: 'zero', emoji: '🌱', title: 'Começando do zero', text: 'Iniciante, começando do zero.' },
  { id: 'basic', emoji: '📘', title: 'Tenho o básico', text: 'Tenho noções básicas, mas sem prática real.' },
  { id: 'mid', emoji: '🛠️', title: 'Intermediário', text: 'Nível intermediário, já pratiquei em projetos.' },
  { id: 'adv', emoji: '🚀', title: 'Avançado', text: 'Avançado, já trabalho com isso e quero aprofundar.' },
];

const DEADLINES = [
  { label: '1 mês', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 ano', days: 365 },
];

const LOADING_STEPS = ['Analisando seu objetivo', 'Mapeando o que você já sabe', 'Estruturando fases e tópicos', 'Distribuindo tarefas no calendário'];

type Step = 0 | 1 | 2 | 3 | 'loading' | 'done';

export function GeneratorScreen() {
  const { generateRoadmap, deleteRoadmap, profile } = useApp();
  const nav = useNav();
  const [step, setStep] = useState<Step>(0);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [levelDetail, setLevelDetail] = useState('');
  const [input, setInput] = useState<RoadmapInput>({ goal: '', currentLevel: '', hoursPerWeek: 6, deadline: addDays(today(), 90) });
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);

  useEffect(() => {
    if (step !== 'loading') return;
    setLoadingIdx(0);
    const id = setInterval(() => setLoadingIdx((i) => Math.min(LOADING_STEPS.length - 1, i + 1)), 450);
    return () => clearInterval(id);
  }, [step]);

  const currentLevel = [LEVELS.find((l) => l.id === levelId)?.text, levelDetail.trim()].filter(Boolean).join(' ');

  const run = async () => {
    setStep('loading');
    setError(null);
    try {
      if (result) deleteRoadmap(result.roadmap.id);
      const res = await generateRoadmap({ ...input, goal: input.goal.trim(), currentLevel });
      setResult(res);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar roadmap');
      setStep(3);
    }
  };

  const canNext =
    step === 0 ? input.goal.trim().length >= 3 : step === 1 ? !!levelId || levelDetail.trim().length > 2 : step === 2 ? input.hoursPerWeek > 0 : step === 3 ? input.deadline > today() : true;

  const stepIndex = typeof step === 'number' ? step : 4;
  const perDay = minutesPerStudyDay(input.hoursPerWeek, profile.studyDays);

  return (
    <div className="flex min-h-[calc(100dvh-64px)] flex-col pb-6">
      {/* Duolingo-style top bar: close + progress */}
      <div className="sticky top-0 z-30 -mx-4 flex h-14 items-center gap-3 bg-bg/85 px-2 pt-safe backdrop-blur-xl">
        <IconButton label="Fechar" onClick={nav.pop}>
          <X size={22} />
        </IconButton>
        <ProgressBar value={stepIndex / 4} color="rgb(var(--accent))" />
        <div className="w-4" />
      </div>

      {step === 0 && (
        <StepShell title="Qual é o seu objetivo principal?" subtitle="Seja específico: cargo, certificação, habilidade ou resultado.">
          <Textarea
            autoFocus
            value={input.goal}
            maxLength={160}
            onChange={(e) => setInput({ ...input, goal: e.target.value })}
            placeholder="Ex.: Conseguir minha primeira vaga como dev back-end Java"
            className="min-h-[110px] text-[17px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {GOAL_EXAMPLES.map((g) => (
              <button
                key={g}
                onClick={() => setInput({ ...input, goal: g })}
                className={cn('tap rounded-full border px-3 py-1.5 text-[13px]', input.goal === g ? 'border-accent bg-accent/15' : 'border-line text-muted')}
              >
                {g}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell title="Qual é a sua base atual?" subtitle="A IA pula o que você já domina.">
          <div className="grid grid-cols-2 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevelId(l.id)}
                className={cn(
                  'tap flex flex-col items-start gap-2 rounded-2xl border-2 p-3 text-left',
                  levelId === l.id ? 'border-accent bg-accent/10' : 'border-line',
                )}
              >
                <span className="text-2xl">{l.emoji}</span>
                <span className="text-[14px] font-semibold">{l.title}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Label hint="opcional">O que você já sabe?</Label>
            <Textarea value={levelDetail} onChange={(e) => setLevelDetail(e.target.value)} placeholder="Ex.: Sei Java e SQL básicos, nunca usei Spring." />
          </div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell title="Quanto tempo você tem?" subtitle="Seja realista — consistência vence intensidade.">
          <Card className="p-5 text-center">
            <div className="text-[44px] font-extrabold leading-none tracking-tight">
              {input.hoursPerWeek}
              <span className="ml-1 text-[18px] font-semibold text-muted">h/semana</span>
            </div>
            <div className="mt-2 text-[13px] text-muted">
              ≈ {formatMinutes(perDay)} por dia em {profile.studyDays.length} dias de estudo
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={input.hoursPerWeek}
              onChange={(e) => setInput({ ...input, hoursPerWeek: Number(e.target.value) })}
              className="mt-5 w-full accent-[rgb(var(--accent))]"
              aria-label="Horas por semana"
            />
          </Card>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[3, 5, 8, 12].map((h) => (
              <button
                key={h}
                onClick={() => setInput({ ...input, hoursPerWeek: h })}
                className={cn('tap h-11 rounded-xl border text-sm font-semibold', input.hoursPerWeek === h ? 'border-accent bg-accent/15' : 'border-line text-muted')}
              >
                {h}h
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell title="Até quando?" subtitle="O prazo define o ritmo e a profundidade do roadmap.">
          <div className="grid grid-cols-2 gap-2">
            {DEADLINES.map((d) => {
              const date = addDays(today(), d.days);
              return (
                <button
                  key={d.label}
                  onClick={() => setInput({ ...input, deadline: date })}
                  className={cn(
                    'tap rounded-2xl border-2 p-3 text-left',
                    input.deadline === date ? 'border-accent bg-accent/10' : 'border-line',
                  )}
                >
                  <div className="text-[15px] font-semibold">{d.label}</div>
                  <div className="text-[12px] text-muted">{formatShort(date)}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Label>Data personalizada</Label>
            <Input type="date" min={addDays(today(), 7)} value={input.deadline} onChange={(e) => setInput({ ...input, deadline: e.target.value })} />
          </div>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-[13px] text-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </StepShell>
      )}

      {step === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-white shadow-pop">
              <Sparkles size={34} />
            </div>
          </div>
          <h2 className="text-[20px] font-bold">Montando sua trilha…</h2>
          <ul className="mt-5 space-y-2.5 text-left">
            {LOADING_STEPS.map((s, i) => (
              <li key={s} className={cn('flex items-center gap-2.5 text-[14px] transition-opacity', i <= loadingIdx ? 'opacity-100' : 'opacity-30')}>
                {i < loadingIdx ? (
                  <Check size={16} className="text-success" />
                ) : (
                  <span className={cn('h-4 w-4 rounded-full border-2', i === loadingIdx ? 'animate-spin border-accent border-t-transparent' : 'border-line')} />
                )}
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'done' && result && <Preview result={result} onRegenerate={run} onStart={() => nav.reset('roadmaps', [{ name: 'roadmap', id: result.roadmap.id }])} />}

      {typeof step === 'number' && (
        <div className="mt-auto pt-6">
          <Button variant="primary" size="lg" block disabled={!canNext} onClick={() => (step === 3 ? run() : setStep((step + 1) as Step))}>
            {step === 3 ? (
              <>
                <Sparkles size={18} /> Gerar roadmap
              </>
            ) : (
              'Continuar'
            )}
          </Button>
          {step > 0 && (
            <Button variant="ghost" block className="mt-2" onClick={() => setStep((step - 1) as Step)}>
              Voltar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div key={title} className="animate-rise pt-4">
      <h1 className="text-[24px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[14px] text-muted">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Preview({ result, onRegenerate, onStart }: { result: CreateResult; onRegenerate: () => void; onStart: () => void }) {
  const r = result.roadmap;
  const prog = progressOf(roadmapTasks(r));
  const end = projectedEnd(r);
  return (
    <div className="flex flex-1 animate-rise flex-col pt-4">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-2 text-5xl">{r.emoji}</div>
        <h1 className="mt-4 text-[24px] font-extrabold tracking-tight">{r.title}</h1>
        <p className="mt-1 text-[13px] text-muted">Gerado por {result.providerLabel}</p>
      </div>

      {result.fallbackReason && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-[12px] text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>O provedor de IA falhou ({result.fallbackReason.slice(0, 90)}). Usamos o Mock Inteligente.</span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric icon={<Layers size={16} />} value={String(r.phases.length)} label="fases" />
        <Metric icon={<ListChecks size={16} />} value={String(prog.total)} label="tarefas" />
        <Metric icon={<Clock size={16} />} value={formatMinutes(prog.minutesTotal)} label="no total" />
      </div>

      <Card className="mt-4 divide-y divide-line">
        {r.phases.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-muted">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{p.title}</div>
              <div className="truncate text-[12px] text-subtle">{p.topics.map((t) => t.title).join(' · ')}</div>
            </div>
          </div>
        ))}
      </Card>
      {end && (
        <p className="mt-3 text-center text-[12px] text-muted">
          Término previsto em <b className="text-fg">{formatShort(end)}</b> · prazo {formatShort(r.deadline)}
        </p>
      )}

      <div className="mt-auto space-y-2 pt-6">
        <Button variant="success" size="lg" block onClick={onStart}>
          Começar trilha <ArrowRight size={18} />
        </Button>
        <Button variant="ghost" block icon={<RotateCcw size={16} />} onClick={onRegenerate}>
          Gerar novamente
        </Button>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 text-center">
      <div className="mx-auto mb-1 flex justify-center text-accent">{icon}</div>
      <div className="text-[17px] font-bold">{value}</div>
      <div className="text-[11px] text-subtle">{label}</div>
    </div>
  );
}
