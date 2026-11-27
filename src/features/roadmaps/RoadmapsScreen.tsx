import { CalendarDays, ChevronRight, Pause, Plus, Sparkles, Trophy } from 'lucide-react';
import { ScreenHeader } from '@/components/layout/Header';
import { IconButton } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { currentPhaseIndex, progressOf, roadmapTasks } from '@/domain/roadmap';
import { ROADMAP_HEX } from '@/lib/colors';
import { countdown, formatShort, today } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import { useNav } from '@/store/navigation';
import type { Roadmap } from '@/types';

export function RoadmapsScreen() {
  const { roadmaps } = useApp();
  const nav = useNav();
  const active = roadmaps.filter((r) => r.status === 'active');
  const others = roadmaps.filter((r) => r.status !== 'active');

  return (
    <div className="pb-6">
      <ScreenHeader
        title="Roadmaps"
        right={
          <IconButton label="Novo roadmap" className="bg-accent/15 text-accent hover:bg-accent/25 hover:text-accent" onClick={() => nav.push({ name: 'generator' })}>
            <Plus size={22} />
          </IconButton>
        }
      />

      <button
        onClick={() => nav.push({ name: 'generator' })}
        className="tap relative mt-3 w-full overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/25 via-accent/10 to-transparent p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white shadow-pop">
            <Sparkles size={20} />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Gerar roadmap com IA</div>
            <div className="text-[13px] text-muted">Objetivo, nível, tempo e prazo → trilha pronta</div>
          </div>
          <ChevronRight size={18} className="text-muted" />
        </div>
      </button>

      {active.length > 0 && <SectionTitle>Ativos · {active.length}</SectionTitle>}
      <div className="space-y-3">
        {active.map((r, i) => (
          <RoadmapCard key={r.id} roadmap={r} index={i} onOpen={() => nav.push({ name: 'roadmap', id: r.id })} />
        ))}
      </div>

      {others.length > 0 && (
        <>
          <SectionTitle>Pausados & concluídos</SectionTitle>
          <div className="space-y-3">
            {others.map((r, i) => (
              <RoadmapCard key={r.id} roadmap={r} index={i} onOpen={() => nav.push({ name: 'roadmap', id: r.id })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RoadmapCard({ roadmap: r, onOpen, index }: { roadmap: Roadmap; onOpen: () => void; index: number }) {
  const prog = progressOf(roadmapTasks(r));
  const ci = currentPhaseIndex(r);
  const phase = r.phases[ci];
  const color = ROADMAP_HEX[r.color];
  const overdue = roadmapTasks(r).filter((t) => !t.completedAt && t.dueDate && t.dueDate < today()).length;

  return (
    <Card className="tap animate-rise cursor-pointer p-4" style={{ animationDelay: `${index * 50}ms` }} onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${color}22` }}>
          {r.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold">{r.title}</h3>
            {r.status === 'paused' && (
              <Pill>
                <Pause size={10} /> Pausado
              </Pill>
            )}
            {r.status === 'completed' && (
              <Pill tone="success">
                <Trophy size={10} /> Concluído
              </Pill>
            )}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {phase ? `Fase ${ci + 1} de ${r.phases.length} · ${phase.title}` : 'Todas as fases concluídas'}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={prog.ratio} color={color} height="h-2.5" />
        <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">{Math.round(prog.ratio * 100)}%</span>
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-[12px] text-subtle">
        <span>
          {prog.done}/{prog.total} tarefas
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} /> {formatShort(r.deadline)} · {countdown(r.deadline)}
        </span>
        {overdue > 0 && <span className="font-medium text-danger">{overdue} atrasadas</span>}
      </div>
    </Card>
  );
}
