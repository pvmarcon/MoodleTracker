import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronDown, Lock, Pencil, Plus, RefreshCcw, Settings2, Star, Trash2 } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
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
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes, formatShort, today } from '@/lib/date';
import { uid } from '@/lib/id';
import { useApp } from '@/store/AppStore';
import type { Phase, Roadmap, Task, TaskRef, Topic } from '@/types';
import { ConfirmSheet, NodeEditorSheet, RoadmapSettingsSheet } from '~/features/NodeSheets';
import { RecalibrateSheet } from '~/features/RecalibrateSheet';
import { TaskEditorSheet } from '~/features/TaskEditorSheet';
import { TaskRow } from '~/features/TaskRow';
import { useTaskToggle } from '~/features/useTaskToggle';
import { alpha, useTheme } from '~/theme';
import { Button, IconButton } from '~/ui/Button';
import { Card, Divider } from '~/ui/Card';
import { EmptyState } from '~/ui/EmptyState';
import { ProgressBar, ProgressRing } from '~/ui/Progress';
import { Screen, StackHeader } from '~/ui/Screen';
import { Text } from '~/ui/Text';
import { useToast } from '~/ui/Toast';

type NodeEdit = { kind: 'phase'; phase?: Phase; afterIndex?: number } | { kind: 'topic'; phaseId: string; topic?: Topic };
type TaskEdit = { task: Task; topicId: string; isNew: boolean; context: string };

const blankTask = (): Task => ({ id: uid('tk'), title: '', kind: 'practice', priority: 'medium', energy: 'medium', estimatedMinutes: 30, dueDate: today(), completedAt: null });

export default function RoadmapDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { roadmaps, profile, saveRoadmap, deleteRoadmap } = useApp();
  const toast = useToast();
  const toggle = useTaskToggle();
  const roadmap = roadmaps.find((r) => r.id === id);

  const [edit, setEdit] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [recal, setRecal] = useState(false);
  const [settings, setSettings] = useState(false);
  const [nodeEdit, setNodeEdit] = useState<NodeEdit | null>(null);
  const [taskEdit, setTaskEdit] = useState<TaskEdit | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body?: string; run: () => void } | null>(null);

  const d = useMemo(() => {
    if (!roadmap) return null;
    const tasks = roadmapTasks(roadmap);
    return { prog: progressOf(tasks), ci: currentPhaseIndex(roadmap), end: projectedEnd(roadmap), overdue: tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today()).length };
  }, [roadmap]);

  if (!roadmap || !d) {
    return (
      <Screen>
        <StackHeader />
        <EmptyState emoji="🫥" title="Roadmap não encontrado" />
      </Screen>
    );
  }

  const color = ROADMAP_HEX[roadmap.color];
  const late = !!d.end && d.end > roadmap.deadline;
  const isOpen = (p: Phase, i: number) => expanded[p.id] ?? (i === d.ci || edit);

  const saveNode = (v: { title: string; description?: string }) => {
    if (!nodeEdit) return;
    if (nodeEdit.kind === 'phase') saveRoadmap(nodeEdit.phase ? updatePhase(roadmap, nodeEdit.phase.id, v) : addPhase(roadmap, { id: uid('ph'), ...v, topics: [] }, nodeEdit.afterIndex));
    else saveRoadmap(nodeEdit.topic ? updateTopic(roadmap, nodeEdit.topic.id, v) : addTopic(roadmap, nodeEdit.phaseId, { id: uid('tp'), ...v, tasks: [] }));
    setNodeEdit(null);
  };

  return (
    <Screen
      header={
        <StackHeader
          title={`${roadmap.emoji}  ${roadmap.title}`}
          right={
            <>
              <IconButton label={edit ? 'Concluir edição' : 'Editar trilha'} active={edit} onPress={() => setEdit((v) => !v)}>
                {edit ? <Check size={20} color={c.accent} /> : <Pencil size={19} color={c.muted} />}
              </IconButton>
              <IconButton label="Configurar" onPress={() => setSettings(true)}>
                <Settings2 size={19} color={c.muted} />
              </IconButton>
            </>
          }
        />
      }
    >
      <Card style={{ padding: 16, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProgressRing value={d.prog.ratio} size={68} stroke={7} color={color}>
            <Text style={{ fontWeight: '800' }}>{Math.round(d.prog.ratio * 100)}%</Text>
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="subtle">Objetivo</Text>
            <Text style={{ marginTop: 2 }} numberOfLines={3}>{roadmap.goal}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Mini label="tarefas" value={`${d.prog.done}/${d.prog.total}`} />
          <Mini label="restante" value={formatMinutes(d.prog.minutesTotal - d.prog.minutesDone)} />
          <Mini label={late ? 'previsão' : 'prazo'} value={formatShort(late ? d.end! : roadmap.deadline)} danger={late} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Button block size="sm" variant={d.overdue || late ? 'primary' : 'secondary'} icon={<RefreshCcw size={14} color={d.overdue || late ? '#fff' : c.fg} />} onPress={() => setRecal(true)} style={{ minHeight: 40 }}>
            {`Recalibrar roadmap${d.overdue ? ` · ${d.overdue} atrasadas` : ''}`}
          </Button>
        </View>
      </Card>

      {roadmap.status === 'paused' && (
        <View style={{ marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: c.surface2 }}>
          <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>Roadmap pausado — tarefas não aparecem em Hoje.</Text>
        </View>
      )}

      <View style={{ marginTop: 24 }}>
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
            edit={edit}
            onToggleOpen={() => setExpanded((e) => ({ ...e, [phase.id]: !isOpen(phase, i) }))}
            onToggleTask={toggle}
            onOpenTask={(task, topic) => setTaskEdit({ task, topicId: topic.id, isNew: false, context: `${phase.title} › ${topic.title}` })}
            onAddTask={(topic) => setTaskEdit({ task: blankTask(), topicId: topic.id, isNew: true, context: `${phase.title} › ${topic.title}` })}
            onEditPhase={() => setNodeEdit({ kind: 'phase', phase })}
            onMovePhase={(dir) => saveRoadmap(movePhase(roadmap, phase.id, dir))}
            onDeletePhase={() => setConfirm({ title: `Excluir "${phase.title}"?`, body: `${phaseTasks(phase).length} tarefas serão removidas.`, run: () => saveRoadmap(removePhase(roadmap, phase.id)) })}
            onAddTopic={() => setNodeEdit({ kind: 'topic', phaseId: phase.id })}
            onEditTopic={(topic) => setNodeEdit({ kind: 'topic', phaseId: phase.id, topic })}
            onDeleteTopic={(topic) => setConfirm({ title: `Excluir "${topic.title}"?`, body: `${topic.tasks.length} tarefas serão removidas.`, run: () => saveRoadmap(removeTopic(roadmap, topic.id)) })}
          />
        ))}
        {edit ? (
          <Pressable onPress={() => setNodeEdit({ kind: 'phase', afterIndex: roadmap.phases.length - 1 })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 6 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: alpha(c.accent, 0.6), alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color={c.accent} />
            </View>
            <Text tone="accent" style={{ fontWeight: '700' }}>Adicionar fase</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 6 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: d.ci >= roadmap.phases.length ? alpha(color, 0.2) : c.surface2, opacity: d.ci >= roadmap.phases.length ? 1 : 0.6 }}>
              <Text style={{ fontSize: 20, lineHeight: 26 }}>🏆</Text>
            </View>
            <Text variant="small" tone="subtle">{d.ci >= roadmap.phases.length ? 'Objetivo alcançado!' : 'Linha de chegada'}</Text>
          </View>
        )}
      </View>

      <RecalibrateSheet roadmap={roadmap} open={recal} onClose={() => setRecal(false)} />
      <RoadmapSettingsSheet
        open={settings}
        roadmap={roadmap}
        onClose={() => setSettings(false)}
        onSave={(r: Roadmap, changed) => {
          if (changed) {
            saveRoadmap({ ...scheduleRoadmap(r, { studyDays: profile.studyDays, hoursPerWeek: r.hoursPerWeek }), lastRecalibratedAt: new Date().toISOString() });
            toast({ title: 'Datas redistribuídas', subtitle: 'Com o novo ritmo e prazo', icon: <RefreshCcw size={18} color={c.accent} /> });
          } else saveRoadmap(r);
          setSettings(false);
        }}
        onDelete={() => {
          setSettings(false);
          setConfirm({
            title: `Excluir "${roadmap.title}"?`,
            body: 'Essa ação não pode ser desfeita.',
            run: () => {
              router.back();
              deleteRoadmap(roadmap.id);
            },
          });
        }}
      />
      <NodeEditorSheet
        open={!!nodeEdit}
        heading={nodeEdit?.kind === 'phase' ? (nodeEdit.phase ? 'Editar fase' : 'Nova fase') : nodeEdit?.topic ? 'Editar tópico' : 'Novo tópico'}
        initial={nodeEdit?.kind === 'phase' ? { title: nodeEdit.phase?.title ?? '', description: nodeEdit.phase?.description } : { title: nodeEdit?.topic?.title ?? '', description: nodeEdit?.topic?.description }}
        onClose={() => setNodeEdit(null)}
        onSave={saveNode}
      />
      <TaskEditorSheet
        open={!!taskEdit}
        title={taskEdit?.isNew ? 'Nova tarefa' : 'Tarefa'}
        task={taskEdit?.task ?? null}
        context={taskEdit?.context}
        onClose={() => setTaskEdit(null)}
        onSave={(t) => {
          if (taskEdit) saveRoadmap(taskEdit.isNew ? addTask(roadmap, taskEdit.topicId, t) : updateTask(roadmap, t.id, t));
          setTaskEdit(null);
        }}
        onDelete={
          taskEdit && !taskEdit.isNew
            ? () => {
                saveRoadmap(removeTask(roadmap, taskEdit.task.id));
                setTaskEdit(null);
              }
            : undefined
        }
      />
      <ConfirmSheet open={!!confirm} title={confirm?.title ?? ''} body={confirm?.body} onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
    </Screen>
  );
}

function Mini({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: c.surface2 }}>
      <Text style={{ fontWeight: '800', color: danger ? c.danger : c.fg }}>{value}</Text>
      <Text variant="caption" tone="subtle">{label}</Text>
    </View>
  );
}

function Bouncy({ children }: { children: React.ReactNode }) {
  const y = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -3, duration: 420, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View style={{ transform: [{ translateY: y }], alignSelf: 'flex-start' }}>{children}</Animated.View>;
}

interface NodeProps {
  roadmap: Roadmap;
  phase: Phase;
  index: number;
  state: PhaseState;
  last: boolean;
  color: string;
  open: boolean;
  edit: boolean;
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

function PhaseNode(p: NodeProps) {
  const { c } = useTheme();
  const { phase, state, color, index, roadmap } = p;
  const prog = progressOf(phaseTasks(phase));
  const locked = state === 'locked';
  const firstPending = phaseTasks(phase).find((t) => !t.completedAt)?.id;

  return (
    <View style={{ paddingLeft: 66, paddingBottom: 20 }}>
      {/* rail */}
      <View style={{ position: 'absolute', left: 26, top: 56, bottom: 0, width: 4, borderRadius: 2, backgroundColor: state === 'done' ? color : c.line }} />
      {/* node: Duolingo-like coin with a darker bottom edge */}
      <Pressable onPress={p.onToggleOpen} accessibilityLabel={`Fase ${index + 1}: ${phase.title}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {state === 'current' && <View style={{ position: 'absolute', left: -6, top: -6, width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: alpha(color, 0.4) }} />}
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: locked ? c.line : 'rgba(0,0,0,0.25)' }}>
          <View style={{ width: 56, height: 51, borderRadius: 28, backgroundColor: locked ? c.surface2 : color, alignItems: 'center', justifyContent: 'center' }}>
            {state === 'done' && <Check size={26} strokeWidth={3.5} color="#fff" />}
            {state === 'current' && <Star size={24} color="#fff" fill="#fff" />}
            {locked && <Lock size={20} color={c.subtle} />}
          </View>
        </View>
      </Pressable>

      <Card style={[{ opacity: locked ? 0.7 : 1 }, state === 'current' && { borderColor: alpha(color, 0.6), borderWidth: 2 }]}>
        <Pressable onPress={p.onToggleOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <View style={{ flex: 1 }}>
            <Text variant="overline" style={{ color: locked ? c.subtle : color }}>
              Fase {index + 1}
              {state === 'current' ? ' · em andamento' : state === 'done' ? ' · concluída' : ''}
            </Text>
            <Text variant="h3" style={{ marginTop: 2 }}>{phase.title}</Text>
            {phase.description && <Text variant="small" tone="muted" style={{ marginTop: 2 }}>{phase.description}</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <ProgressBar value={prog.ratio} color={color} height={8} />
              <Text variant="caption" tone="subtle">{prog.done}/{prog.total}</Text>
            </View>
          </View>
          <View style={{ transform: [{ rotate: p.open ? '180deg' : '0deg' }] }}>
            <ChevronDown size={18} color={c.subtle} />
          </View>
        </Pressable>

        {p.edit && (
          <>
            <Divider />
            <View style={{ flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 4 }}>
              <IconButton label="Mover para cima" size={36} disabled={index === 0} onPress={() => p.onMovePhase(-1)}><ArrowUp size={16} color={c.muted} /></IconButton>
              <IconButton label="Mover para baixo" size={36} disabled={p.last} onPress={() => p.onMovePhase(1)}><ArrowDown size={16} color={c.muted} /></IconButton>
              <IconButton label="Renomear fase" size={36} onPress={p.onEditPhase}><Pencil size={15} color={c.muted} /></IconButton>
              <View style={{ flex: 1 }} />
              <IconButton label="Excluir fase" size={36} onPress={p.onDeletePhase}><Trash2 size={15} color={c.danger} /></IconButton>
            </View>
          </>
        )}

        {p.open && (
          <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
            {phase.topics.map((topic, ti) => (
              <View key={topic.id} style={{ borderTopWidth: ti ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: alpha(c.surface2, 0.6) }}>
                  <Text variant="overline" tone="muted" style={{ flex: 1 }}>{topic.title}</Text>
                  {p.edit && (
                    <>
                      <IconButton label="Renomear tópico" size={30} onPress={() => p.onEditTopic(topic)}><Pencil size={13} color={c.muted} /></IconButton>
                      <IconButton label="Excluir tópico" size={30} onPress={() => p.onDeleteTopic(topic)}><Trash2 size={13} color={c.danger} /></IconButton>
                    </>
                  )}
                </View>
                {topic.tasks.map((task, k) => {
                  const ref: TaskRef = { task, topic, phase, roadmap, phaseIndex: index };
                  return (
                    <Fragment key={task.id}>
                      {k > 0 && <Divider />}
                      <TaskRow
                        item={ref}
                        showRoadmap={false}
                        disabled={locked && !p.edit}
                        onToggle={(done) => p.onToggleTask(ref, done)}
                        onOpen={() => p.onOpenTask(task, topic)}
                        badge={
                          state === 'current' && task.id === firstPending && !p.edit ? (
                            <Bouncy>
                              <View style={{ backgroundColor: color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 5 }}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>COMECE AQUI</Text>
                              </View>
                            </Bouncy>
                          ) : undefined
                        }
                      />
                    </Fragment>
                  );
                })}
                {p.edit && (
                  <Pressable onPress={() => p.onAddTask(topic)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
                    <Plus size={15} color={c.accent} />
                    <Text variant="small" tone="accent" style={{ fontWeight: '700' }}>Adicionar tarefa</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {p.edit && (
              <Pressable onPress={p.onAddTopic} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line }}>
                <Plus size={15} color={c.accent} />
                <Text variant="small" tone="accent" style={{ fontWeight: '700' }}>Adicionar tópico</Text>
              </Pressable>
            )}
            {!phase.topics.length && !p.edit && <Text variant="small" tone="subtle" style={{ padding: 16 }}>Sem tópicos ainda.</Text>}
          </View>
        )}
      </Card>
    </View>
  );
}
