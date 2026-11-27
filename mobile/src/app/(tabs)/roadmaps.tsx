import { router } from 'expo-router';
import { CalendarDays, ChevronRight, Plus, Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { currentPhaseIndex, progressOf, roadmapTasks } from '@/domain/roadmap';
import { ROADMAP_HEX } from '@/lib/colors';
import { countdown, formatShort, today } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import type { Roadmap } from '@/types';
import { alpha, useTheme } from '~/theme';
import { IconButton } from '~/ui/Button';
import { Card, SectionTitle } from '~/ui/Card';
import { Pill } from '~/ui/Chip';
import { ProgressBar } from '~/ui/Progress';
import { LargeHeader, Screen } from '~/ui/Screen';
import { Text } from '~/ui/Text';

export default function RoadmapsScreen() {
  const { c } = useTheme();
  const { roadmaps } = useApp();
  const active = roadmaps.filter((r) => r.status === 'active');
  const others = roadmaps.filter((r) => r.status !== 'active');

  return (
    <Screen>
      <LargeHeader
        title="Roadmaps"
        right={
          <IconButton label="Novo roadmap" active onPress={() => router.push('/generator')}>
            <Plus size={22} color={c.accent} />
          </IconButton>
        }
      />
      <Pressable
        onPress={() => router.push('/generator')}
        style={({ pressed }) => ({
          marginTop: 12,
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: alpha(c.accent, 0.35),
          backgroundColor: alpha(c.accent, 0.14),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>Gerar roadmap com IA</Text>
          <Text variant="small" tone="muted">Objetivo, nível, tempo e prazo → trilha pronta</Text>
        </View>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>

      {active.length > 0 && <SectionTitle>Ativos · {active.length}</SectionTitle>}
      <View style={{ gap: 12 }}>
        {active.map((r) => <RoadmapCard key={r.id} roadmap={r} />)}
      </View>
      {others.length > 0 && (
        <>
          <SectionTitle>Pausados & concluídos</SectionTitle>
          <View style={{ gap: 12 }}>
            {others.map((r) => <RoadmapCard key={r.id} roadmap={r} />)}
          </View>
        </>
      )}
    </Screen>
  );
}

function RoadmapCard({ roadmap: r }: { roadmap: Roadmap }) {
  const { c } = useTheme();
  const tasks = roadmapTasks(r);
  const prog = progressOf(tasks);
  const ci = currentPhaseIndex(r);
  const phase = r.phases[ci];
  const color = ROADMAP_HEX[r.color];
  const overdue = tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today()).length;

  return (
    <Card style={{ padding: 16 }} onPress={() => router.push(`/roadmap/${r.id}`)}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: alpha(color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, lineHeight: 30 }}>{r.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{r.title}</Text>
            {r.status === 'paused' && <Pill>Pausado</Pill>}
            {r.status === 'completed' && <Pill color={c.success}>Concluído</Pill>}
          </View>
          <Text variant="small" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {phase ? `Fase ${ci + 1} de ${r.phases.length} · ${phase.title}` : 'Todas as fases concluídas'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <ProgressBar value={prog.ratio} color={color} height={10} />
        <Text variant="small" style={{ fontWeight: '700', width: 40, textAlign: 'right' }}>{Math.round(prog.ratio * 100)}%</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <Text variant="caption" tone="subtle">{prog.done}/{prog.total} tarefas</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <CalendarDays size={12} color={c.subtle} />
          <Text variant="caption" tone="subtle">{formatShort(r.deadline)} · {countdown(r.deadline)}</Text>
        </View>
        {overdue > 0 && <Text variant="caption" tone="danger" style={{ fontWeight: '600' }}>{overdue} atrasadas</Text>}
      </View>
    </Card>
  );
}
