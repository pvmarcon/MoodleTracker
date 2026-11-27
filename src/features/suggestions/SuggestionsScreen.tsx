import { Bot, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { ScreenHeader } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Chip, Pill } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { currentPhaseIndex, isPhaseComplete } from '@/domain/roadmap';
import { uid } from '@/lib/id';
import { ROADMAP_HEX } from '@/lib/colors';
import { aiService, resolveProvider } from '@/services/ai';
import { useApp } from '@/store/AppStore';
import type { Suggestion } from '@/types';
import { SuggestionCard } from './SuggestionCard';

export function SuggestionsScreen() {
  const { suggestions, roadmaps, profile, dismissed } = useApp();
  const toast = useToast();
  const active = roadmaps.filter((r) => r.status === 'active');
  const [selected, setSelected] = useState<string | null>(active[0]?.id ?? null);
  const [ideas, setIdeas] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const provider = resolveProvider(profile.ai);

  const askAI = async () => {
    const r = active.find((x) => x.id === selected);
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
      if (res.fallbackReason) toast({ message: 'IA indisponível — usando Mock Inteligente' });
      const phaseId = r.phases[Math.min(ci, r.phases.length - 1)]?.id;
      setIdeas(
        res.data.map((i) => ({
          id: uid('idea'),
          kind: i.kind,
          title: i.title,
          body: i.body,
          task: i.task,
          roadmapId: r.id,
          phaseId,
          score: 0,
        })),
      );
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Falha ao gerar ideias' });
    } finally {
      setLoading(false);
    }
  };

  const visibleIdeas = ideas.filter((i) => !dismissed.includes(i.id));

  return (
    <div className="pb-6">
      <ScreenHeader
        title="Sugestões IA"
        right={
          <Pill tone={provider.id === 'mock' ? 'neutral' : 'accent'}>
            <Bot size={11} /> {provider.label}
          </Pill>
        }
      />
      <p className="text-[14px] text-muted">Com base nos seus objetivos e no seu ritmo de conclusão.</p>

      <SectionTitle>Próximos passos sugeridos</SectionTitle>
      {suggestions.length ? (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState emoji="🧘" title="Nada urgente" body="Você está em dia. Peça ideias novas à IA abaixo." />
        </Card>
      )}

      {active.length > 0 && (
        <>
          <SectionTitle>
            <span className="inline-flex items-center gap-1">
              <Wand2 size={12} /> Pedir ideias à IA
            </span>
          </SectionTitle>
          <Card className="p-4">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {active.map((r) => (
                <Chip
                  key={r.id}
                  active={selected === r.id}
                  onClick={() => setSelected(r.id)}
                  icon={<span className="h-2 w-2 rounded-full" style={{ background: ROADMAP_HEX[r.color] }} />}
                >
                  {r.title}
                </Chip>
              ))}
            </div>
            <Button variant="primary" block className="mt-3" loading={loading} icon={<Sparkles size={16} />} onClick={askAI}>
              Gerar ideias de projetos e temas
            </Button>
          </Card>
          {visibleIdeas.length > 0 && (
            <div className="mt-3 space-y-3">
              {visibleIdeas.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
