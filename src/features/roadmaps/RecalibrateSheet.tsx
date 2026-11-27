import { CalendarRange, Gauge, RefreshCcw, TimerReset } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { planRecalibration } from '@/domain/schedule';
import { cn } from '@/lib/cn';
import { formatMinutes, formatShort } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import type { Roadmap } from '@/types';

type Option = { id: string; title: string; body: string; icon: typeof Gauge; apply: { hoursPerWeek?: number; deadline?: string } };

export function RecalibrateSheet({ roadmap, open, onClose }: { roadmap: Roadmap; open: boolean; onClose: () => void }) {
  const { profile, recalibrate } = useApp();
  const toast = useToast();
  const plan = useMemo(() => (open ? planRecalibration(roadmap, profile.studyDays) : null), [open, roadmap, profile.studyDays]);
  const [choice, setChoice] = useState('keep');

  if (!plan) return null;
  const late = plan.slackDays < 0;
  const ahead = plan.slackDays > 7;

  const options: Option[] = [
    {
      id: 'keep',
      title: 'Redistribuir a partir de hoje',
      body: late
        ? `Mantém ${roadmap.hoursPerWeek}h/sem — termina ${-plan.slackDays} dias após o prazo.`
        : `Mantém ${roadmap.hoursPerWeek}h/sem e o prazo de ${formatShort(roadmap.deadline)}.`,
      icon: RefreshCcw,
      apply: {},
    },
  ];
  if (late) {
    options.push(
      {
        id: 'pace',
        title: `Aumentar ritmo para ${plan.requiredHoursPerWeek}h/sem`,
        body: `Cumpre o prazo de ${formatShort(roadmap.deadline)}.`,
        icon: Gauge,
        apply: { hoursPerWeek: plan.requiredHoursPerWeek },
      },
      {
        id: 'extend',
        title: `Estender prazo para ${formatShort(plan.projectedEnd!)}`,
        body: 'Mantém seu ritmo atual sem sobrecarga.',
        icon: CalendarRange,
        apply: { deadline: plan.projectedEnd! },
      },
    );
  }
  if (ahead && plan.projectedEnd) {
    options.push({
      id: 'advance',
      title: `Antecipar prazo para ${formatShort(plan.projectedEnd)}`,
      body: `Você está ${plan.slackDays} dias adiantado. Que tal chegar antes?`,
      icon: TimerReset,
      apply: { deadline: plan.projectedEnd },
    });
  }

  const apply = () => {
    const opt = options.find((o) => o.id === choice) ?? options[0];
    recalibrate(roadmap.id, opt.apply);
    toast({ message: 'Roadmap recalibrado', icon: <RefreshCcw size={16} className="text-accent" /> });
    setChoice('keep');
    onClose();
  };

  const paceRatio = plan.plannedMinutesPerDay ? plan.observedMinutesPerDay / plan.plannedMinutesPerDay : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Recalibrar roadmap"
      footer={
        <Button variant="primary" size="lg" block onClick={apply}>
          Aplicar
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Atrasadas" value={String(plan.overdueCount)} tone={plan.overdueCount ? 'danger' : undefined} />
        <Stat label="Restante" value={formatMinutes(plan.pendingMinutes)} />
        <Stat
          label={late ? 'Atraso' : 'Folga'}
          value={`${Math.abs(plan.slackDays)}d`}
          tone={late ? 'danger' : 'success'}
        />
      </div>
      <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
        Ritmo real (14 dias): <b className="text-fg">{plan.observedMinutesPerDay} min</b> por dia de estudo · planejado{' '}
        <b className="text-fg">{plan.plannedMinutesPerDay} min</b>
        {plan.observedMinutesPerDay > 0 && (
          <span className={paceRatio >= 1 ? 'text-success' : 'text-warning'}> ({Math.round(paceRatio * 100)}%)</span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setChoice(o.id)}
            className={cn(
              'tap flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors',
              choice === o.id ? 'border-accent bg-accent/10' : 'border-line',
            )}
          >
            <o.icon size={18} className={cn('mt-0.5 shrink-0', choice === o.id ? 'text-accent' : 'text-subtle')} />
            <div>
              <div className="text-[14px] font-semibold">{o.title}</div>
              <div className="mt-0.5 text-[12px] text-muted">{o.body}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="rounded-xl border border-line p-2.5 text-center">
      <div className={cn('text-[17px] font-bold', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>{value}</div>
      <div className="text-[11px] text-subtle">{label}</div>
    </div>
  );
}
