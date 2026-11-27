import { ArrowRight, CalendarClock, Flame, PartyPopper, Sparkles, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/Progress';
import { currentPhaseIndex, flattenRoadmap, updateTask } from '@/domain/roadmap';
import { formatLong, formatMinutes, isoDay, today } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import { useNav } from '@/store/navigation';
import type { Energy, Priority, Task, TaskRef } from '@/types';
import { TaskEditorSheet } from '../shared/TaskEditorSheet';
import { TaskRow } from '../shared/TaskRow';
import { useTaskToggle } from '../shared/useTaskToggle';
import { SuggestionCard } from '../suggestions/SuggestionCard';

const PRIORITY_CHIPS: { v: Priority; label: string }[] = [
  { v: 'high', label: 'Alta' },
  { v: 'medium', label: 'Média' },
  { v: 'low', label: 'Baixa' },
];
const ENERGY_CHIPS: { v: Energy; label: string; emoji: string }[] = [
  { v: 'high', label: 'Energia alta', emoji: '⚡' },
  { v: 'medium', label: 'Média', emoji: '🔋' },
  { v: 'low', label: 'Baixa', emoji: '🪫' },
];

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function TodayScreen() {
  const { roadmaps, profile, stats, suggestions, saveRoadmap } = useApp();
  const nav = useNav();
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
      if (r.status !== 'active' && r.status !== 'completed') continue;
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
    const byPriority = (a: TaskRef, b: TaskRef) => PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority];
    return { overdue: overdue.sort(byPriority), due: due.sort(byPriority), doneToday, upNext };
  }, [roadmaps, t]);

  const matches = (x: TaskRef) => (!priority || x.task.priority === priority) && (!energy || x.task.energy === energy);
  const filtersOn = !!priority || !!energy;

  const total = overdue.length + due.length + doneToday.length;
  const minutesDone = doneToday.reduce((s, x) => s + x.task.estimatedMinutes, 0);
  const minutesPlanned = minutesDone + [...overdue, ...due].reduce((s, x) => s + x.task.estimatedMinutes, 0);
  const ratio = total ? doneToday.length / total : 0;
  const allDone = total > 0 && doneToday.length === total;

  const bringToToday = (x: TaskRef) => saveRoadmap(updateTask(x.roadmap, x.task.id, { dueDate: t }));
  const saveEdit = (task: Task) => {
    if (!editing) return;
    saveRoadmap(updateTask(editing.roadmap, task.id, task));
    setEditing(null);
  };

  const topSuggestion = suggestions[0];
  const visibleOverdue = overdue.filter(matches);
  const visibleDue = due.filter(matches);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="pb-6">
      <ScreenHeader
        eyebrow={formatLong(t)}
        title={`${greeting}, ${profile.name.split(' ')[0]}`}
        right={
          <>
            <div className="flex h-9 items-center gap-1 rounded-xl px-2 text-[15px] font-bold" title="Sequência de dias">
              <Flame size={20} className={stats.streak ? 'fill-[#ff9600] text-[#ff9600]' : 'text-subtle'} />
              <span className={stats.streak ? 'text-[#ff9600]' : 'text-subtle'}>{stats.streak}</span>
            </div>
            <div className="flex h-9 items-center gap-1 rounded-xl px-2 text-[15px] font-bold text-warning" title="XP total">
              <Zap size={18} className="fill-warning" />
              {stats.xp}
            </div>
          </>
        }
      />

      {/* Daily progress */}
      <Card className="mt-3 overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-muted">Progresso de hoje</div>
            <div className="mt-0.5 text-[22px] font-extrabold tracking-tight">
              {doneToday.length}
              <span className="text-subtle">/{total || 0}</span>
              <span className="ml-1.5 text-[13px] font-medium text-muted">tarefas</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium text-muted">Tempo</div>
            <div className="mt-0.5 text-[15px] font-semibold">
              {formatMinutes(minutesDone)} <span className="text-subtle">/ {formatMinutes(Math.max(minutesPlanned, profile.dailyGoalMinutes))}</span>
            </div>
          </div>
        </div>
        <ProgressBar value={ratio} className="mt-3" />
        {allDone && (
          <div className="mt-3 flex animate-rise items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-[13px] font-semibold text-success">
            <PartyPopper size={16} /> Dia concluído! Sua sequência está garantida.
          </div>
        )}
      </Card>

      {topSuggestion && (
        <>
          <SectionTitle
            action={
              <button onClick={() => nav.setTab('suggestions')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent">
                Ver todas <ArrowRight size={13} />
              </button>
            }
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} /> Próximo passo sugerido
            </span>
          </SectionTitle>
          <SuggestionCard suggestion={topSuggestion} compact />
        </>
      )}

      {/* Filters */}
      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4">
        <Chip active={!filtersOn} onClick={() => { setPriority(null); setEnergy(null); }}>
          Todas
        </Chip>
        {PRIORITY_CHIPS.map((c) => (
          <Chip key={c.v} active={priority === c.v} onClick={() => setPriority(priority === c.v ? null : c.v)}>
            {c.v === 'high' ? '🚩 ' : ''}
            {c.label}
          </Chip>
        ))}
        <div className="my-1 w-px shrink-0 bg-line" />
        {ENERGY_CHIPS.map((c) => (
          <Chip key={c.v} active={energy === c.v} onClick={() => setEnergy(energy === c.v ? null : c.v)}>
            {c.emoji} {c.label}
          </Chip>
        ))}
      </div>

      {visibleOverdue.length > 0 && (
        <>
          <SectionTitle>
            <span className="text-danger">Atrasadas · {visibleOverdue.length}</span>
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {visibleOverdue.map((x) => (
              <TaskRow key={x.task.id} item={x} onToggle={(d) => toggle(x, d)} onOpen={() => setEditing(x)} />
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Para hoje{visibleDue.length ? ` · ${visibleDue.length}` : ''}</SectionTitle>
      {visibleDue.length > 0 ? (
        <Card className="divide-y divide-line overflow-hidden">
          {visibleDue.map((x) => (
            <TaskRow key={x.task.id} item={x} onToggle={(d) => toggle(x, d)} onOpen={() => setEditing(x)} />
          ))}
        </Card>
      ) : roadmaps.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🧭"
            title="Nenhum roadmap ainda"
            body="Conte seu objetivo e a IA monta uma trilha com tarefas diárias."
            action={
              <Button variant="primary" onClick={() => nav.reset('roadmaps', [{ name: 'generator' }])} icon={<Sparkles size={16} />}>
                Criar roadmap
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-xl">✨</div>
            <div className="text-sm">
              <div className="font-semibold">{filtersOn ? 'Nada com esses filtros' : 'Tudo em dia por aqui'}</div>
              <div className="text-muted">{filtersOn ? 'Tente outra combinação.' : 'Quer adiantar alguma coisa?'}</div>
            </div>
          </div>
          {!filtersOn && upNext.length > 0 && (
            <div className="mt-3 space-y-2">
              {upNext.map((x) => (
                <button
                  key={x.task.id}
                  onClick={() => bringToToday(x)}
                  className="tap flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left"
                >
                  <CalendarClock size={16} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-sm">{x.task.title}</span>
                  <span className="text-[12px] font-semibold text-accent">Adiantar</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {doneToday.length > 0 && (
        <>
          <SectionTitle>Concluídas · {doneToday.length}</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {doneToday.map((x) => (
              <TaskRow key={x.task.id} item={x} onToggle={(d) => toggle(x, d)} onOpen={() => setEditing(x)} />
            ))}
          </Card>
        </>
      )}

      <TaskEditorSheet
        open={!!editing}
        task={editing?.task ?? null}
        context={editing ? `${editing.roadmap.emoji} ${editing.roadmap.title} › ${editing.phase.title} › ${editing.topic.title}` : undefined}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onOpenTrail={() => {
          if (!editing) return;
          const id = editing.roadmap.id;
          setEditing(null);
          nav.reset('roadmaps', [{ name: 'roadmap', id }]);
        }}
      />
    </div>
  );
}
