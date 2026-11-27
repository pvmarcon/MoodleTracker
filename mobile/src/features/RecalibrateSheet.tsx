import { CalendarRange, Gauge, RefreshCcw, TimerReset } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { planRecalibration } from '@/domain/schedule';
import { formatMinutes, formatShort } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import type { Roadmap } from '@/types';
import { useTheme } from '~/theme';
import { Button } from '~/ui/Button';
import { OptionTile } from '~/ui/Chip';
import { Sheet } from '~/ui/Sheet';
import { Text } from '~/ui/Text';
import { useToast } from '~/ui/Toast';

type Opt = { id: string; title: string; body: string; Icon: typeof Gauge; apply: { hoursPerWeek?: number; deadline?: string } };

export function RecalibrateSheet({ roadmap, open, onClose }: { roadmap: Roadmap; open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { profile, recalibrate } = useApp();
  const toast = useToast();
  const [choice, setChoice] = useState('keep');
  const plan = useMemo(() => (open ? planRecalibration(roadmap, profile.studyDays) : null), [open, roadmap, profile.studyDays]);
  if (!plan) return null;

  const late = plan.slackDays < 0;
  const opts: Opt[] = [
    {
      id: 'keep',
      title: 'Redistribuir a partir de hoje',
      body: late ? `Mantém ${roadmap.hoursPerWeek}h/sem — termina ${-plan.slackDays} dias após o prazo.` : `Mantém ${roadmap.hoursPerWeek}h/sem e o prazo de ${formatShort(roadmap.deadline)}.`,
      Icon: RefreshCcw,
      apply: {},
    },
  ];
  if (late && plan.projectedEnd) {
    opts.push(
      { id: 'pace', title: `Aumentar ritmo para ${plan.requiredHoursPerWeek}h/sem`, body: `Cumpre o prazo de ${formatShort(roadmap.deadline)}.`, Icon: Gauge, apply: { hoursPerWeek: plan.requiredHoursPerWeek } },
      { id: 'extend', title: `Estender prazo para ${formatShort(plan.projectedEnd)}`, body: 'Mantém seu ritmo atual sem sobrecarga.', Icon: CalendarRange, apply: { deadline: plan.projectedEnd } },
    );
  }
  if (plan.slackDays > 7 && plan.projectedEnd) {
    opts.push({ id: 'advance', title: `Antecipar prazo para ${formatShort(plan.projectedEnd)}`, body: `Você está ${plan.slackDays} dias adiantado.`, Icon: TimerReset, apply: { deadline: plan.projectedEnd } });
  }
  const ratio = plan.plannedMinutesPerDay ? plan.observedMinutesPerDay / plan.plannedMinutesPerDay : 0;

  const apply = () => {
    recalibrate(roadmap.id, (opts.find((o) => o.id === choice) ?? opts[0]).apply);
    toast({ title: 'Roadmap recalibrado', icon: <RefreshCcw size={18} color={c.accent} /> });
    setChoice('keep');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Recalibrar roadmap" footer={<Button variant="primary" size="lg" block onPress={apply}>Aplicar</Button>}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Atrasadas" value={String(plan.overdueCount)} color={plan.overdueCount ? c.danger : undefined} />
        <Stat label="Restante" value={formatMinutes(plan.pendingMinutes)} />
        <Stat label={late ? 'Atraso' : 'Folga'} value={`${Math.abs(plan.slackDays)}d`} color={late ? c.danger : c.success} />
      </View>
      <View style={{ marginTop: 12, backgroundColor: c.surface2, borderRadius: 12, padding: 12 }}>
        <Text variant="small" tone="muted">
          Ritmo real (14 dias): <Text variant="small" style={{ fontWeight: '700' }}>{plan.observedMinutesPerDay} min</Text> por dia de estudo · planejado{' '}
          <Text variant="small" style={{ fontWeight: '700' }}>{plan.plannedMinutesPerDay} min</Text>
          {plan.observedMinutesPerDay > 0 && <Text variant="small" style={{ color: ratio >= 1 ? c.success : c.warning }}> ({Math.round(ratio * 100)}%)</Text>}
        </Text>
      </View>
      <View style={{ gap: 8, marginTop: 16 }}>
        {opts.map((o) => (
          <OptionTile key={o.id} selected={choice === o.id} onPress={() => setChoice(o.id)}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <o.Icon size={19} color={choice === o.id ? c.accent : c.subtle} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14 }}>{o.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{o.body}</Text>
              </View>
            </View>
          </OptionTile>
        ))}
      </View>
    </Sheet>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: color ?? c.fg }}>{value}</Text>
      <Text variant="caption" tone="subtle">{label}</Text>
    </View>
  );
}
