import { router } from 'expo-router';
import { ArrowRight, CalendarClock, Flame, PartyPopper, Sparkles, Zap } from 'lucide-react-native';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { currentPhaseIndex, flattenRoadmap, updateTask } from '@/domain/roadmap';
import { formatLong, formatMinutes, isoDay, today } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import type { Energy, Priority, Task, TaskRef } from '@/types';
import { SuggestionCard } from '~/features/SuggestionCard';
import { TaskEditorSheet } from '~/features/TaskEditorSheet';
import { TaskRow } from '~/features/TaskRow';
import { useTaskToggle } from '~/features/useTaskToggle';
import { alpha, useTheme } from '~/theme';
import { Button } from '~/ui/Button';
import { Card, Divider, SectionTitle } from '~/ui/Card';
import { Chip } from '~/ui/Chip';
import { EmptyState } from '~/ui/EmptyState';
import { ProgressBar } from '~/ui/Progress';
import { LargeHeader, Screen } from '~/ui/Screen';
import { Text } from '~/ui/Text';

const ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export default function TodayScreen() {
  const { c } = useTheme();
  const { roadmaps, profile, stats, suggestions, saveRoadmap } = useApp();
  const toggle = useTaskToggle();
  const [priority, setPriority] = useState<Priority | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [editing, setEditing] = useState<TaskRef | null>(null);
  const t = today();

  const { overdue, due, doneToday, upNext } = useMemo(() => {
    const overdue: TaskRef[] = [];
    const due: TaskRef[] = [];
    const doneToday: TaskRef[] = [];
    const upNext: TaskRef[] = [];
    for (const r of roadmaps) {
      const ci = currentPhaseIndex(r);
      const flat = flattenRoadmap(r);
      for (const x of flat) {
        if (x.task.completedAt) {
          if (isoDay(x.task.completedAt) === t) doneToday.push(x);
          continue;
        }
        if (r.status !== 'active' || x.phaseIndex > ci || !x.task.dueDate) continue;
        if (x.task.dueDate < t) overdue.push(x);
        else if (x.task.dueDate === t) due.push(x);
      }
      const next = flat.find((x) => !x.task.completedAt && (!x.task.dueDate || x.task.dueDate > t));
      if (r.status === 'active' && next) upNext.push(next);
    }
    const by = (a: TaskRef, b: TaskRef) => ORDER[a.task.priority] - ORDER[b.task.priority];
    return { overdue: overdue.sort(by), due: due.sort(by), doneToday, upNext };
  }, [roadmaps, t]);

  const match = (x: TaskRef) => (!priority || x.task.priority === priority) && (!energy || x.task.energy === energy);
  const filtersOn = !!priority || !!energy;
  const total = overdue.length + due.length + doneToday.length;
  const minutesDone = doneToday.reduce((s, x) => s + x.task.estimatedMinutes, 0);
  const minutesPlanned = minutesDone + [...overdue, ...due].reduce((s, x) => s + x.task.estimatedMinutes, 0);
  const allDone = total > 0 && doneToday.length === total;
  const vOverdue = overdue.filter(match);
  const vDue = due.filter(match);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const list = (items: TaskRef[]) => (
    <Card>
      {items.map((x, i) => (
        <Fragment key={x.task.id}>
          {i > 0 && <Divider />}
          <TaskRow item={x} onToggle={(d) => toggle(x, d)} onOpen={() => setEditing(x)} />
        </Fragment>
      ))}
    </Card>
  );

  return (
    <Screen>
      <LargeHeader
        eyebrow={formatLong(t)}
        title={`${greeting}, ${profile.name.split(' ')[0]}`}
        right={
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6 }}>
              <Flame size={20} color={stats.streak ? '#ff9600' : c.subtle} fill={stats.streak ? '#ff9600' : 'transparent'} />
              <Text style={{ fontWeight: '800', color: stats.streak ? '#ff9600' : c.subtle }}>{stats.streak}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4 }}>
              <Zap size={18} color={c.warning} fill={c.warning} />
              <Text style={{ fontWeight: '800', color: c.warning }}>{stats.xp}</Text>
            </View>
          </>
        }
      />

      <Card style={{ padding: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text variant="small" tone="muted" style={{ fontWeight: '600' }}>Progresso de hoje</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', marginTop: 2 }}>
              {doneToday.length}
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.subtle }}>/{total}</Text>
              <Text variant="small" tone="muted"> tarefas</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="small" tone="muted" style={{ fontWeight: '600' }}>Tempo</Text>
            <Text style={{ fontWeight: '700', marginTop: 4 }}>
              {formatMinutes(minutesDone)} <Text tone="subtle">/ {formatMinutes(Math.max(minutesPlanned, profile.dailyGoalMinutes))}</Text>
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <ProgressBar value={total ? doneToday.length / total : 0} />
        </View>
        {allDone && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: alpha(c.success, 0.12) }}>
            <PartyPopper size={16} color={c.success} />
            <Text variant="small" tone="success" style={{ fontWeight: '700' }}>Dia concluído! Sequência garantida.</Text>
          </View>
        )}
      </Card>

      {suggestions[0] && (
        <>
          <SectionTitle
            right={
              <Pressable onPress={() => router.navigate('/suggestions')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}>
                <Text variant="caption" tone="accent" style={{ fontWeight: '700' }}>Ver todas</Text>
                <ArrowRight size={13} color={c.accent} />
              </Pressable>
            }
          >
            ✦ Próximo passo sugerido
          </SectionTitle>
          <SuggestionCard suggestion={suggestions[0]} compact />
        </>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 24 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Chip active={!filtersOn} onPress={() => { setPriority(null); setEnergy(null); }}>Todas</Chip>
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <Chip key={p} active={priority === p} onPress={() => setPriority(priority === p ? null : p)}>
            {p === 'high' ? '🚩 Alta' : p === 'medium' ? 'Média' : 'Baixa'}
          </Chip>
        ))}
        <View style={{ width: 1, backgroundColor: c.line, marginVertical: 6 }} />
        {(['high', 'medium', 'low'] as Energy[]).map((e) => (
          <Chip key={e} active={energy === e} onPress={() => setEnergy(energy === e ? null : e)}>
            {e === 'high' ? '⚡ Energia alta' : e === 'medium' ? '🔋 Média' : '🪫 Baixa'}
          </Chip>
        ))}
      </ScrollView>

      {vOverdue.length > 0 && (
        <>
          <SectionTitle tone="danger">Atrasadas · {vOverdue.length}</SectionTitle>
          {list(vOverdue)}
        </>
      )}

      <SectionTitle>Para hoje{vDue.length ? ` · ${vDue.length}` : ''}</SectionTitle>
      {vDue.length > 0 ? (
        list(vDue)
      ) : roadmaps.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🧭"
            title="Nenhum roadmap ainda"
            body="Conte seu objetivo e a IA monta uma trilha com tarefas diárias."
            action={<Button variant="primary" icon={<Sparkles size={16} color="#fff" />} onPress={() => router.push('/generator')}>Criar roadmap</Button>}
          />
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(c.success, 0.15), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>
            <View>
              <Text style={{ fontWeight: '700' }}>{filtersOn ? 'Nada com esses filtros' : 'Tudo em dia por aqui'}</Text>
              <Text variant="small" tone="muted">{filtersOn ? 'Tente outra combinação.' : 'Quer adiantar alguma coisa?'}</Text>
            </View>
          </View>
          {!filtersOn &&
            upNext.map((x) => (
              <Pressable
                key={x.task.id}
                onPress={() => saveRoadmap(updateTask(x.roadmap, x.task.id, { dueDate: t }))}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface2, transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <CalendarClock size={16} color={c.accent} />
                <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{x.task.title}</Text>
                <Text variant="caption" tone="accent" style={{ fontWeight: '700' }}>Adiantar</Text>
              </Pressable>
            ))}
        </Card>
      )}

      {doneToday.length > 0 && (
        <>
          <SectionTitle>Concluídas · {doneToday.length}</SectionTitle>
          {list(doneToday)}
        </>
      )}

      <TaskEditorSheet
        open={!!editing}
        task={editing?.task ?? null}
        context={editing ? `${editing.roadmap.emoji} ${editing.roadmap.title} › ${editing.phase.title}` : undefined}
        onClose={() => setEditing(null)}
        onSave={(task: Task) => {
          if (editing) saveRoadmap(updateTask(editing.roadmap, task.id, task));
          setEditing(null);
        }}
        onOpenTrail={() => {
          const id = editing?.roadmap.id;
          setEditing(null);
          if (id) router.push(`/roadmap/${id}`);
        }}
      />
    </Screen>
  );
}
