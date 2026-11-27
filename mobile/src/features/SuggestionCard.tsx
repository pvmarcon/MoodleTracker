import { router } from 'expo-router';
import { BookOpenCheck, Compass, Gauge, Hammer, Plus, RefreshCcw, Sprout, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import type { Suggestion, SuggestionKind } from '@/types';
import { alpha, useTheme } from '~/theme';
import { Button, IconButton } from '~/ui/Button';
import { Card } from '~/ui/Card';
import { Text } from '~/ui/Text';
import { useToast } from '~/ui/Toast';
import { RecalibrateSheet } from './RecalibrateSheet';

export function SuggestionCard({ suggestion: s, compact }: { suggestion: Suggestion; compact?: boolean }) {
  const { c } = useTheme();
  const { getRoadmap, applySuggestion, dismissSuggestion } = useApp();
  const toast = useToast();
  const [recal, setRecal] = useState(false);
  const roadmap = s.roadmapId ? getRoadmap(s.roadmapId) : undefined;

  const META: Record<SuggestionKind, { Icon: typeof Hammer; color: string; label: string }> = {
    project: { Icon: Hammer, color: '#ff9600', label: 'Projeto' },
    review: { Icon: BookOpenCheck, color: '#1cb0f6', label: 'Revisão' },
    'next-topic': { Icon: Compass, color: c.accent, label: 'Próximo tema' },
    recalibrate: { Icon: RefreshCcw, color: c.danger, label: 'Prazo' },
    pace: { Icon: Gauge, color: c.warning, label: 'Ritmo' },
    habit: { Icon: Sprout, color: c.success, label: 'Hábito' },
  };
  const m = META[s.kind];

  const primary = (() => {
    if ((s.kind === 'recalibrate' || s.kind === 'pace') && roadmap) return { label: 'Recalibrar', Icon: RefreshCcw, run: () => setRecal(true) };
    if (s.task && roadmap)
      return {
        label: 'Adicionar à trilha',
        Icon: Plus,
        run: () => {
          applySuggestion(s);
          toast({ title: 'Adicionado à trilha', subtitle: roadmap.title, icon: <Plus size={18} color={c.success} /> });
        },
      };
    if (roadmap) return { label: 'Abrir trilha', Icon: Compass, run: () => router.push(`/roadmap/${roadmap.id}`) };
    if (s.kind === 'habit') return { label: 'Ver tarefas de hoje', Icon: Sprout, run: () => router.navigate('/') };
    return null;
  })();
  const isPrimary = s.kind === 'recalibrate';

  return (
    <Card style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(m.color, 0.15) }}>
          <m.Icon size={19} color={m.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="overline" tone="subtle">{m.label}</Text>
            {roadmap && (
              <>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ROADMAP_HEX[roadmap.color] }} />
                <Text variant="caption" tone="subtle" numberOfLines={1} style={{ flexShrink: 1 }}>{roadmap.title}</Text>
              </>
            )}
          </View>
          <Text style={{ fontWeight: '700', marginTop: 2 }}>{s.title}</Text>
          {!compact && <Text variant="small" tone="muted" style={{ marginTop: 4 }}>{s.body}</Text>}
          {!compact && s.task && <Text variant="caption" tone="subtle" style={{ marginTop: 6 }}>≈ {formatMinutes(s.task.estimatedMinutes)}</Text>}
          {primary && (
            <View style={{ marginTop: 12 }}>
              <Button size="sm" variant={isPrimary ? 'primary' : 'secondary'} icon={<primary.Icon size={15} color={isPrimary ? '#fff' : c.fg} />} onPress={primary.run}>
                {primary.label}
              </Button>
            </View>
          )}
        </View>
        <View style={{ marginTop: -8, marginRight: -8 }}>
          <IconButton label="Dispensar" size={32} onPress={() => dismissSuggestion(s.id)}>
            <X size={16} color={c.subtle} />
          </IconButton>
        </View>
      </View>
      {roadmap && <RecalibrateSheet roadmap={roadmap} open={recal} onClose={() => setRecal(false)} />}
    </Card>
  );
}
