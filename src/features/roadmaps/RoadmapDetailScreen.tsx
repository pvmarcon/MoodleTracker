import { ArrowDown, ArrowUp, Check, ChevronDown, Lock, Pencil, Plus, RefreshCcw, Settings2, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StackHeader } from '@/components/layout/Header';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { useToast } from '@/components/ui/Toast';
import {
  addPhase,
  addTask,
  addTopic,
  currentPhaseIndex,
  movePhase,
  phaseState,
  phaseTasks,
  progressOf,
  removePhase,
  removeTask,
  removeTopic,
  roadmapTasks,
  updatePhase,
  updateTask,
  updateTopic,
  type PhaseState,
} from '@/domain/roadmap';
import { projectedEnd, scheduleRoadmap } from '@/domain/schedule';
import { uid } from '@/lib/id';
import { cn } from '@/lib/cn';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes, formatShort, today } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import { useNav } from '@/store/navigation';
import type { Phase, Roadmap, Task, TaskRef, Topic } from '@/types';
import { TaskEditorSheet } from '../shared/TaskEditorSheet';
import { TaskRow } from '../shared/TaskRow';
import { useTaskToggle } from '../shared/useTaskToggle';
import { ConfirmSheet, NodeEditorSheet, RoadmapSettingsSheet } from './NodeSheets';
import { RecalibrateSheet } from './RecalibrateSheet';

type NodeEdit =
  | { kind: 'phase'; phase?: Phase; afterIndex?: number }
  | { kind: 'topic'; phaseId: string; topic?: Topic };

type TaskEdit = { task: Task; topicId: string; isNew: boolean; context: string };

const blankTask = (): Task => ({
  id: uid('tk'),
  title: '',
  kind: 'practice',
  priority: 'medium',
  energy: 'medium',
  estimatedMinutes: 30,
  dueDate: today(),
  completedAt: null,
});

export function RoadmapDetailScreen({ id }: { id: string }) {
  const { roadmaps, profile, saveRoadmap, deleteRoadmap } = useApp();
  const nav = useNav();
  const toast = useToast();
  const toggle = useTaskToggle();
  const roadmap = roadmaps.find((r) => r.id === id);

  const [editMode, setEditMode] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [recalOpen, setRecalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nodeEdit, setNodeEdit] = useState<NodeEdit | null>(null);
  const [taskEdit, setTaskEdit] = useState<TaskEdit | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body?: string; run: () => void } | null>(null);

  const derived = useMemo(() => {
    if (!roadmap) return null;
    const tasks = roadmapTasks(roadmap);
    return {
      prog: progressOf(tasks),
      ci: currentPhaseIndex(roadmap),
      end: projectedEnd(roadmap),
      overdue: tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today()).length,
    };
  }, [roadmap]);

  if (!roadmap || !derived) {
    return (
      <>
        <StackHeader />
        <EmptyState emoji="🫥" title="Roadmap não encontrado" />
      </>
    );
  }

  const color = ROADMAP_HEX[roadmap.color];
  const { prog, ci, end, overdue } = derived;
  const isOpen = (p: Phase, i: number) => expanded[p.id] ?? (i === ci || editMode);
  const late = end && end > roadmap.deadline;

  const saveNode = (v: { title: string; description?: string }) => {
    if (!nodeEdit) return;
    if (nodeEdit.kind === 'phase') {
      saveRoadmap(
        nodeEdit.phase
          ? updatePhase(roadmap, nodeEdit.phase.id, v)
          : addPhase(roadmap, { id: uid('ph'), ...v, topics: [] }, nodeEdit.afterIndex),
      );
    } else {
      saveRoadmap(
        nodeEdit.topic
          ? updateTopic(roadmap, nodeEdit.topic.id, v)
          : addTopic(roadmap, nodeEdit.phaseId, { id: uid('tp'), ...v, tasks: [] }),
      );
    }
    setNodeEdit(null);
  };

  const saveTask = (t: Task) => {
    if (!taskEdit) return;
    saveRoadmap(taskEdit.isNew ? addTask(roadmap, taskEdit.topicId, t) : updateTask(roadmap, t.id, t));
    setTaskEdit(null);
  };

  return (
    <div className="pb-10">
      <StackHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>{roadmap.emoji}</span> {roadmap.title}
          </span>
        }
        right={
          <>
            <IconButton label={editMode ? 'Concluir edição' : 'Editar trilha'} onClick={() => setEditMode((v) => !v)} className={editMode ? 'bg-accent/15 text-accent' : ''}>
              {editMode ? <Check size={20} /> : <Pencil size={19} />}
            </IconButton>
            <IconButton label="Configurar" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={19} />
            </IconButton>
          </>
        }
      />

      {/* Hero */}
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={prog.ratio} size={68} stroke={7} color={color}>
            <span className="text-[15px] font-extrabold">{Math.round(prog.ratio * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-subtle">Objetivo</div>
            <p className="mt-0.5 line-clamp-2 text-[14px] font-medium leading-snug">{roadmap.goal}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="tarefas" value={`${prog.done}/${prog.total}`} />
          <Mini label="restante" value={formatMinutes(prog.minutesTotal - prog.minutesDone)} />
          <Mini label={late ? 'previsão' : 'prazo'} value={formatShort(late ? end! : roadmap.deadline)} tone={late ? 'danger' : undefined} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            block
            size="sm"
            variant={overdue || late ? 'primary' : 'secondary'}
            icon={<RefreshCcw size={14} />}
            onClick={() => setRecalOpen(true)}
            className="h-10"
          >
            Recalibrar roadmap{overdue ? ` · ${overdue} atrasadas` : ''}
          </Button>
        </div>
      </Card>

      {roadmap.status === 'paused' && (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-center text-[13px] text-muted">
          Roadmap pausado — tarefas não aparecem em Hoje.
        </div>
      )}

      {/* Trail */}
      <div className="mt-6">
        {roadmap.phases.map((phase, i) => (
          <PhaseNode
            key={phase.id}
            roadmap={roadmap}
            phase={phase}
            index={i}
            state={phaseState(roadmap, i)}
            last={i === roadmap.phases.length - 1}
            color={color}
            open={isOpen(phase, i)}
            editMode={editMode}
            onToggleOpen={() => setExpanded((e) => ({ ...e, [phase.id]: !isOpen(phase, i) }))}
            onToggleTask={(ref, done) => toggle(ref, done)}
            onOpenTask={(task, topic) =>
              setTaskEdit({ task, topicId: topic.id, isNew: false, context: `${phase.title} › ${topic.title}` })
            }
            onAddTask={(topic) => setTaskEdit({ task: blankTask(), topicId: topic.id, isNew: true, context: `${phase.title} › ${topic.title}` })}
            onEditPhase={() => setNodeEdit({ kind: 'phase', phase })}
            onMovePhase={(dir) => saveRoadmap(movePhase(roadmap, phase.id, dir))}
            onDeletePhase={() =>
              setConfirm({
                title: `Excluir "${phase.title}"?`,
                body: `${phaseTasks(phase).length} tarefas serão removidas.`,
                run: () => saveRoadmap(removePhase(roadmap, phase.id)),
              })
            }
            onAddTopic={() => setNodeEdit({ kind: 'topic', phaseId: phase.id })}
            onEditTopic={(topic) => setNodeEdit({ kind: 'topic', phaseId: phase.id, topic })}
            onDeleteTopic={(topic) =>
              setConfirm({
                title: `Excluir "${topic.title}"?`,
                body: `${topic.tasks.length} tarefas serão removidas.`,
                run: () => saveRoadmap(removeTopic(roadmap, topic.id)),
              })
            }
          />
        ))}

        {editMode ? (
          <button
            onClick={() => setNodeEdit({ kind: 'phase', afterIndex: roadmap.phases.length - 1 })}
            className="tap ml-[7px] mt-2 flex items-center gap-3 text-[14px] font-semibold text-accent"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-accent/60">
              <Plus size={20} />
            </span>
            Adicionar fase
          </button>
        ) : (
          <div className="ml-[7px] mt-1 flex items-center gap-3">
            <span
              className={cn('flex h-11 w-11 items-center justify-center rounded-full text-xl', ci >= roadmap.phases.length ? '' : 'grayscale opacity-60')}
              style={{ background: ci >= roadmap.phases.length ? `${color}33` : 'rgb(var(--surface-2))' }}
            >
              🏆
            </span>
            <span className="text-[13px] text-subtle">{ci >= roadmap.phases.length ? 'Objetivo alcançado!' : 'Linha de chegada'}</span>
          </div>
        )}
      </div>

      <RecalibrateSheet roadmap={roadmap} open={recalOpen} onClose={() => setRecalOpen(false)} />
      <RoadmapSettingsSheet
        open={settingsOpen}
        roadmap={roadmap}
        onClose={() => setSettingsOpen(false)}
        onSave={(r, scheduleChanged) => {
          if (scheduleChanged) {
            saveRoadmap({
              ...scheduleRoadmap(r, { studyDays: profile.studyDays, hoursPerWeek: r.hoursPerWeek }),
              lastRecalibratedAt: new Date().toISOString(),
            });
            toast({ message: 'Datas redistribuídas com o novo ritmo', icon: <RefreshCcw size={16} className="text-accent" /> });
          } else {
            saveRoadmap(r);
          }
          setSettingsOpen(false);
        }}
        onDelete={() => {
          setSettingsOpen(false);
          setConfirm({
            title: `Excluir "${roadmap.title}"?`,
            body: 'Essa ação não pode ser desfeita.',
            run: () => {
              deleteRoadmap(roadmap.id);
              nav.pop();
            },
          });
        }}
      />
      <NodeEditorSheet
        open={!!nodeEdit}
        heading={
          nodeEdit?.kind === 'phase' ? (nodeEdit.phase ? 'Editar fase' : 'Nova fase') : nodeEdit?.topic ? 'Editar tópico' : 'Novo tópico'
        }
        initial={
          nodeEdit?.kind === 'phase'
            ? { title: nodeEdit.phase?.title ?? '', description: nodeEdit.phase?.description }
            : { title: nodeEdit?.topic?.title ?? '', description: nodeEdit?.topic?.description }
        }
        onClose={() => setNodeEdit(null)}
        onSave={saveNode}
      />
      <TaskEditorSheet
        open={!!taskEdit}
        title={taskEdit?.isNew ? 'Nova tarefa' : 'Tarefa'}
        task={taskEdit?.task ?? null}
        context={taskEdit?.context}
        onClose={() => setTaskEdit(null)}
        onSave={saveTask}
        onDelete={
          taskEdit && !taskEdit.isNew
            ? () => {
                saveRoadmap(removeTask(roadmap, taskEdit.task.id));
                setTaskEdit(null);
              }
            : undefined
        }
      />
      <ConfirmSheet
        open={!!confirm}
        title={confirm?.title ?? ''}
        body={confirm?.body}
        onConfirm={() => confirm?.run()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <div className={cn('text-[15px] font-bold tabular-nums', tone === 'danger' && 'text-danger')}>{value}</div>
      <div className="text-[11px] text-subtle">{label}</div>
    </div>
  );
}

interface PhaseNodeProps {
  roadmap: Roadmap;
  phase: Phase;
  index: number;
  state: PhaseState;
  last: boolean;
  color: string;
  open: boolean;
  editMode: boolean;
  onToggleOpen(): void;
  onToggleTask(ref: TaskRef, done: boolean): void;
  onOpenTask(task: Task, topic: Topic): void;
  onAddTask(topic: Topic): void;
  onEditPhase(): void;
  onMovePhase(dir: -1 | 1): void;
  onDeletePhase(): void;
  onAddTopic(): void;
  onEditTopic(topic: Topic): void;
  onDeleteTopic(topic: Topic): void;
}

function PhaseNode(p: PhaseNodeProps) {
  const { phase, state, color, index, roadmap } = p;
  const prog = progressOf(phaseTasks(phase));
  const locked = state === 'locked';
  const firstPendingId = phaseTasks(phase).find((t) => !t.completedAt)?.id;

  return (
    <div className="relative pb-5 pl-[64px]">
      {/* Rail */}
      {!p.last || p.editMode ? (
        <div
          className="absolute bottom-0 left-[27px] top-14 w-[4px] rounded-full"
          style={{ background: state === 'done' ? color : 'rgb(var(--line))' }}
        />
      ) : (
        <div className="absolute bottom-0 left-[27px] top-14 w-[4px] rounded-full bg-line" />
      )}

      {/* Node */}
      <button
        onClick={p.onToggleOpen}
        aria-label={`Fase ${index + 1}: ${phase.title}`}
        className={cn('tap absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-full', locked && 'bg-surface-2 text-subtle')}
        style={
          locked
            ? { boxShadow: 'inset 0 -5px 0 rgba(0,0,0,.18)' }
            : { background: color, color: '#fff', boxShadow: 'inset 0 -5px 0 rgba(0,0,0,.22)' }
        }
      >
        {state === 'done' && <Check size={26} strokeWidth={3.5} />}
        {state === 'current' && <Star size={24} className="fill-white" />}
        {locked && <Lock size={20} />}
        {state === 'current' && (
          <span className="pointer-events-none absolute -inset-1.5 animate-pulse rounded-full border-[3px]" style={{ borderColor: `${color}66` }} />
        )}
      </button>

      <Card className={cn('overflow-hidden', state === 'current' && 'border-transparent ring-2', locked && 'opacity-70')} style={state === 'current' ? { ['--tw-ring-color' as string]: `${color}88` } : undefined}>
        <button onClick={p.onToggleOpen} className="flex w-full items-center gap-3 px-4 pb-3 pt-3.5 text-left">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: locked ? undefined : color }}>
              Fase {index + 1}
              {state === 'current' && ' · em andamento'}
              {state === 'done' && ' · concluída'}
            </div>
            <div className="mt-0.5 text-[16px] font-semibold leading-snug">{phase.title}</div>
            {phase.description && <div className="mt-0.5 text-[13px] text-muted">{phase.description}</div>}
            <div className="mt-2.5 flex items-center gap-2.5">
              <ProgressBar value={prog.ratio} color={color} height="h-2" />
              <span className="shrink-0 text-[12px] tabular-nums text-subtle">
                {prog.done}/{prog.total}
              </span>
            </div>
          </div>
          <ChevronDown size={18} className={cn('shrink-0 text-subtle transition-transform', p.open && 'rotate-180')} />
        </button>

        {p.editMode && (
          <div className="flex gap-1 border-t border-line px-2 py-1.5">
            <IconButton label="Mover para cima" className="h-8 w-8" disabled={index === 0} onClick={() => p.onMovePhase(-1)}>
              <ArrowUp size={16} />
            </IconButton>
            <IconButton label="Mover para baixo" className="h-8 w-8" disabled={p.last} onClick={() => p.onMovePhase(1)}>
              <ArrowDown size={16} />
            </IconButton>
            <IconButton label="Renomear fase" className="h-8 w-8" onClick={p.onEditPhase}>
              <Pencil size={15} />
            </IconButton>
            <div className="flex-1" />
            <IconButton label="Excluir fase" className="h-8 w-8 hover:text-danger" onClick={p.onDeletePhase}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        )}

        {p.open && (
          <div className="animate-fade-in border-t border-line">
            {phase.topics.map((topic) => (
              <div key={topic.id} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-2 bg-surface-2/50 px-4 py-2">
                  <span className="flex-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{topic.title}</span>
                  {p.editMode && (
                    <>
                      <IconButton label="Renomear tópico" className="h-7 w-7" onClick={() => p.onEditTopic(topic)}>
                        <Pencil size={13} />
                      </IconButton>
                      <IconButton label="Excluir tópico" className="h-7 w-7 hover:text-danger" onClick={() => p.onDeleteTopic(topic)}>
                        <Trash2 size={13} />
                      </IconButton>
                    </>
                  )}
                </div>
                <div className="divide-y divide-line/60">
                  {topic.tasks.map((task) => (
                    <div key={task.id}>
                      <TaskRow
                        item={{ task, topic, phase, roadmap, phaseIndex: index }}
                        showRoadmap={false}
                        badge={
                          state === 'current' && task.id === firstPendingId && !p.editMode ? (
                            <span
                              className="mb-1 inline-block animate-bounce rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
                              style={{ background: color }}
                            >
                              Comece aqui
                            </span>
                          ) : undefined
                        }
                        disabled={locked && !p.editMode}
                        onToggle={(d) => p.onToggleTask({ task, topic, phase, roadmap, phaseIndex: index }, d)}
                        onOpen={() => p.onOpenTask(task, topic)}
                      />
                    </div>
                  ))}
                  {p.editMode && (
                    <button onClick={() => p.onAddTask(topic)} className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-accent">
                      <Plus size={15} /> Adicionar tarefa
                    </button>
                  )}
                </div>
              </div>
            ))}
            {p.editMode && (
              <button onClick={p.onAddTopic} className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-[13px] font-semibold text-accent">
                <Plus size={15} /> Adicionar tópico
              </button>
            )}
            {!phase.topics.length && !p.editMode && <div className="px-4 py-4 text-[13px] text-subtle">Sem tópicos ainda.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}
