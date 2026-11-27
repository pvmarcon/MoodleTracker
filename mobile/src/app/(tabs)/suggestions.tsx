import { Bot, Sparkles, Wand2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { currentPhaseIndex, isPhaseComplete } from '@/domain/roadmap';
import { ROADMAP_HEX } from '@/lib/colors';
import { uid } from '@/lib/id';
import { aiService, resolveProvider } from '@/services/ai';
import { useApp } from '@/store/AppStore';
import type { Suggestion } from '@/types';
import { SuggestionCard } from '~/features/SuggestionCard';
import { useTheme } from '~/theme';
import { Button } from '~/ui/Button';
import { Card, SectionTitle } from '~/ui/Card';
import { Chip, Pill } from '~/ui/Chip';
import { EmptyState } from '~/ui/EmptyState';
import { LargeHeader, Screen } from '~/ui/Screen';
import { Text } from '~/ui/Text';
import { useToast } from '~/ui/Toast';

export default function SuggestionsScreen() {
  const { c } = useTheme();
  const { suggestions, roadmaps, profile, dismissed } = useApp();
  const toast = useToast();
  const active = roadmaps.filter((r) => r.status === 'active');
  const [selected, setSelected] = useState<string | null>(active[0]?.id ?? null);
  const [ideas, setIdeas] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const provider = resolveProvider(profile.ai);

  const ask = async () => {
    const r = active.find((x) => x.id === selected) ?? active[0];
    if (!r) return;
    setLoading(true);
    try {
      const ci = currentPhaseIndex(r);
      const res = await aiService.suggestIdeas(
        {
          goal: r.goal,
          currentPhase: r.phases[ci]?.title,
          completedTopics: r.phases.filter(isPhaseComplete).flatMap((p) => p.topics.map((t) => t.title)),
          pendingTopics: r.phases.slice(ci).flatMap((p) => p.topics.map((t) => t.title)),
        },
        profile.ai,
      );
      if (res.fallbackReason) toast({ title: 'IA indisponível', subtitle: 'Usando o Mock Inteligente' });
      const phaseId = r.phases[Math.min(ci, r.phases.length - 1)]?.id;
      setIdeas(res.data.map((i) => ({ id: uid('idea'), kind: i.kind, title: i.title, body: i.body, task: i.task, roadmapId: r.id, phaseId, score: 0 })));
    } catch (e) {
      toast({ title: 'Falha ao gerar ideias', subtitle: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  const visible = ideas.filter((i) => !dismissed.includes(i.id));

  return (
    <Screen>
      <LargeHeader
        title="Sugestões IA"
        right={
          <Pill color={provider.id === 'mock' ? undefined : c.accent}>
            <Bot size={11} color={provider.id === 'mock' ? c.muted : c.accent} />
            <Text variant="caption" style={{ fontWeight: '600', color: provider.id === 'mock' ? c.muted : c.accent }}>{provider.label}</Text>
          </Pill>
        }
      />
      <Text variant="small" tone="muted">Com base nos seus objetivos e no seu ritmo de conclusão.</Text>

      <SectionTitle>Próximos passos sugeridos</SectionTitle>
      {suggestions.length ? (
        <View style={{ gap: 12 }}>{suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} />)}</View>
      ) : (
        <Card>
          <EmptyState emoji="🧘" title="Nada urgente" body="Você está em dia. Peça ideias novas à IA abaixo." />
        </Card>
      )}

      {active.length > 0 && (
        <>
          <SectionTitle>✦ Pedir ideias à IA</SectionTitle>
          <Card style={{ padding: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {active.map((r) => (
                <Chip key={r.id} active={(selected ?? active[0].id) === r.id} onPress={() => setSelected(r.id)} icon={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ROADMAP_HEX[r.color] }} />}>
                  {r.title}
                </Chip>
              ))}
            </ScrollView>
            <View style={{ marginTop: 12 }}>
              <Button variant="primary" block loading={loading} icon={<Wand2 size={16} color="#fff" />} onPress={ask}>
                Gerar ideias de projetos e temas
              </Button>
            </View>
          </Card>
          {visible.length > 0 && <View style={{ gap: 12, marginTop: 12 }}>{visible.map((s) => <SuggestionCard key={s.id} suggestion={s} />)}</View>}
        </>
      )}
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Sparkles size={14} color={c.subtle} />
      </View>
    </Screen>
  );
}
