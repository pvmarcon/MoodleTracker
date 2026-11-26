import { BookOpenCheck, Compass, Gauge, Hammer, Plus, RefreshCcw, Sprout, X } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import { useNav } from '@/store/navigation';
import type { Suggestion, SuggestionKind } from '@/types';
import { RecalibrateSheet } from '../roadmaps/RecalibrateSheet';

const META: Record<SuggestionKind, { icon: typeof Hammer; tint: string; label: string }> = {
  project: { icon: Hammer, tint: 'text-[#ff9600] bg-[#ff9600]/15', label: 'Projeto' },
  review: { icon: BookOpenCheck, tint: 'text-[#1cb0f6] bg-[#1cb0f6]/15', label: 'Revisão' },
  'next-topic': { icon: Compass, tint: 'text-accent bg-accent/15', label: 'Próximo tema' },
  recalibrate: { icon: RefreshCcw, tint: 'text-danger bg-danger/15', label: 'Prazo' },
  pace: { icon: Gauge, tint: 'text-warning bg-warning/15', label: 'Ritmo' },
  habit: { icon: Sprout, tint: 'text-success bg-success/15', label: 'Hábito' },
};

export function SuggestionCard({ suggestion: s, compact }: { suggestion: Suggestion; compact?: boolean }) {
  const { getRoadmap, applySuggestion, dismissSuggestion } = useApp();
  const nav = useNav();
  const toast = useToast();
  const [recalOpen, setRecalOpen] = useState(false);
  const roadmap = s.roadmapId ? getRoadmap(s.roadmapId) : undefined;
  const meta = META[s.kind];

  const primary = (() => {
    if ((s.kind === 'recalibrate' || s.kind === 'pace') && roadmap)
      return { label: 'Recalibrar', icon: <RefreshCcw size={15} />, run: () => setRecalOpen(true) };
    if (s.task && roadmap)
      return {
        label: 'Adicionar à trilha',
        icon: <Plus size={15} />,
        run: () => {
          applySuggestion(s);
          toast({ message: `Adicionado em ${roadmap.title}`, icon: <Plus size={16} className="text-success" /> });
        },
      };
    if (roadmap) return { label: 'Abrir trilha', icon: <Compass size={15} />, run: () => nav.reset('roadmaps', [{ name: 'roadmap', id: roadmap.id }]) };
    if (s.kind === 'habit') return { label: 'Ver tarefas de hoje', icon: <Sprout size={15} />, run: () => nav.setTab('today') };
    return null;
  })();

  return (
    <Card className="animate-rise p-4">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.tint)}>
          <meta.icon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            {meta.label}
            {roadmap && (
              <>
                <span>·</span>
                <span className="inline-flex min-w-0 items-center gap-1 normal-case tracking-normal">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ROADMAP_HEX[roadmap.color] }} />
                  <span className="truncate">{roadmap.title}</span>
                </span>
              </>
            )}
          </div>
          <div className="mt-0.5 text-[15px] font-semibold leading-snug">{s.title}</div>
          {!compact && <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.body}</p>}
          {!compact && s.task && (
            <div className="mt-2 text-[12px] text-subtle">≈ {formatMinutes(s.task.estimatedMinutes)}</div>
          )}
        </div>
        <IconButton label="Dispensar" className="-mr-2 -mt-2 h-8 w-8" onClick={() => dismissSuggestion(s.id)}>
          <X size={16} />
        </IconButton>
      </div>
      {primary && (
        <div className="mt-3 flex gap-2 pl-[52px]">
          <Button size="sm" variant={s.kind === 'recalibrate' ? 'primary' : 'secondary'} icon={primary.icon} onClick={primary.run}>
            {primary.label}
          </Button>
        </div>
      )}
      {roadmap && <RecalibrateSheet roadmap={roadmap} open={recalOpen} onClose={() => setRecalOpen(false)} />}
    </Card>
  );
}
