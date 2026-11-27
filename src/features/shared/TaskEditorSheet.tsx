import { ArrowUpRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { KIND_LABEL } from '@/lib/colors';
import type { Energy, Priority, Task, TaskKind } from '@/types';

const LVL = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
] as const;

export function TaskEditorSheet({
  open,
  task,
  context,
  onClose,
  onSave,
  onDelete,
  onOpenTrail,
  title = 'Tarefa',
}: {
  open: boolean;
  task: Task | null;
  context?: string;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete?: () => void;
  onOpenTrail?: () => void;
  title?: string;
}) {
  const [draft, setDraft] = useState<Task | null>(task);
  useEffect(() => setDraft(task), [task]);
  if (!draft) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setDraft({ ...draft, [k]: v });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="danger" onClick={onDelete} icon={<Trash2 size={16} />} aria-label="Excluir tarefa" />
          )}
          <Button
            variant="primary"
            block
            disabled={!draft.title.trim()}
            onClick={() => onSave({ ...draft, title: draft.title.trim() })}
          >
            Salvar
          </Button>
        </div>
      }
    >
      {context && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">
          <span className="truncate">{context}</span>
          {onOpenTrail && (
            <button onClick={onOpenTrail} className="ml-2 inline-flex shrink-0 items-center gap-1 font-semibold text-accent">
              Ver trilha <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <Label>Título</Label>
          <Input value={draft.title} autoFocus={!task?.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Resolver 5 exercícios de Streams" />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Critério de pronto, links, notas…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duração (min)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={5}
              step={5}
              value={draft.estimatedMinutes}
              onChange={(e) => set('estimatedMinutes', Math.max(5, Number(e.target.value) || 5))}
            />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={draft.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />
          </div>
        </div>
        <div>
          <Label>Tipo</Label>
          <Segmented<TaskKind>
            value={draft.kind}
            onChange={(v) => set('kind', v)}
            options={(Object.keys(KIND_LABEL) as TaskKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
        </div>
        <div>
          <Label>Prioridade</Label>
          <Segmented<Priority> value={draft.priority} onChange={(v) => set('priority', v)} options={[...LVL]} />
        </div>
        <div>
          <Label hint="esforço mental">Energia</Label>
          <Segmented<Energy> value={draft.energy} onChange={(v) => set('energy', v)} options={[...LVL]} />
        </div>
      </div>
    </Sheet>
  );
}
