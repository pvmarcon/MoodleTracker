import { ArrowUpRight, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KIND_LABEL } from '@/lib/colors';
import { formatMinutes, today } from '@/lib/date';
import type { Energy, Priority, Task, TaskKind } from '@/types';
import { useTheme } from '~/theme';
import { Button } from '~/ui/Button';
import { Segmented } from '~/ui/Chip';
import { DateStepper, Input, Label, Stepper } from '~/ui/Field';
import { Sheet } from '~/ui/Sheet';
import { Text } from '~/ui/Text';

const LVL = [
  { value: 'low' as const, label: 'Baixa' },
  { value: 'medium' as const, label: 'Média' },
  { value: 'high' as const, label: 'Alta' },
];

export function TaskEditorSheet({
  open,
  task,
  context,
  title = 'Tarefa',
  onClose,
  onSave,
  onDelete,
  onOpenTrail,
}: {
  open: boolean;
  task: Task | null;
  context?: string;
  title?: string;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete?: () => void;
  onOpenTrail?: () => void;
}) {
  const { c } = useTheme();
  const [d, setD] = useState<Task | null>(task);
  // Reset the draft when a different task is opened (React's "adjust state on prop change").
  const [src, setSrc] = useState(task);
  if (task !== src) {
    setSrc(task);
    setD(task);
  }
  if (!d) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setD({ ...d, [k]: v });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onDelete && <Button variant="danger" onPress={onDelete} icon={<Trash2 size={18} color={c.danger} />} />}
          <View style={{ flex: 1 }}>
            <Button variant="primary" block disabled={!d.title.trim()} onPress={() => onSave({ ...d, title: d.title.trim() })}>
              Salvar
            </Button>
          </View>
        </View>
      }
    >
      {context && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 16 }}>
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>{context}</Text>
          {onOpenTrail && (
            <Pressable onPress={onOpenTrail} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={8}>
              <Text variant="caption" tone="accent" style={{ fontWeight: '700' }}>Ver trilha</Text>
              <ArrowUpRight size={14} color={c.accent} />
            </Pressable>
          )}
        </View>
      )}
      <View style={{ gap: 16 }}>
        <View>
          <Label>Título</Label>
          <Input value={d.title} autoFocus={!task?.title} onChangeText={(v) => set('title', v)} placeholder="Ex.: Resolver 5 exercícios de Streams" />
        </View>
        <View>
          <Label>Descrição</Label>
          <Input multiline value={d.description ?? ''} onChangeText={(v) => set('description', v)} placeholder="Critério de pronto, links, notas…" />
        </View>
        <View>
          <Label>Duração</Label>
          <Stepper value={d.estimatedMinutes} step={5} min={5} max={480} format={formatMinutes} onChange={(v) => set('estimatedMinutes', v)} />
        </View>
        <View>
          <Label>Data</Label>
          <DateStepper value={d.dueDate ?? today()} onChange={(v) => set('dueDate', v)} />
        </View>
        <View>
          <Label>Tipo</Label>
          <Segmented<TaskKind> value={d.kind} onChange={(v) => set('kind', v)} options={(Object.keys(KIND_LABEL) as TaskKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        </View>
        <View>
          <Label>Prioridade</Label>
          <Segmented<Priority> value={d.priority} onChange={(v) => set('priority', v)} options={LVL} />
        </View>
        <View>
          <Label hint="esforço mental">Energia</Label>
          <Segmented<Energy> value={d.energy} onChange={(v) => set('energy', v)} options={LVL} />
        </View>
      </View>
    </Sheet>
  );
}
