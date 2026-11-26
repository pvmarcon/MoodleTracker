import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import type { Roadmap } from '@/types';

/** Title + description editor shared by phases and topics. */
export function NodeEditorSheet({
  open,
  heading,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  heading: string;
  initial: { title: string; description?: string };
  onClose: () => void;
  onSave: (v: { title: string; description?: string }) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  useEffect(() => {
    setTitle(initial.title);
    setDescription(initial.description ?? '');
  }, [initial.title, initial.description, open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={heading}
      footer={
        <Button variant="primary" block disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), description: description.trim() || undefined })}>
          Salvar
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Título</Label>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label hint="opcional">Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel = 'Excluir',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="text-sm text-muted">{body}</p>}
      <div className="mt-5 flex gap-2">
        <Button block onClick={onClose}>
          Cancelar
        </Button>
        <Button
          block
          variant="danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

const EMOJIS = ['🎯', '☕', '⚛️', '📊', '🗣️', '🎨', '🚀', '📚', '💼', '🧠', '🏋️', '🎓'];

export function RoadmapSettingsSheet({
  open,
  roadmap,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  roadmap: Roadmap;
  onClose: () => void;
  onSave: (r: Roadmap, scheduleChanged: boolean) => void;
  onDelete: () => void;
}) {
  const [d, setD] = useState(roadmap);
  useEffect(() => setD(roadmap), [roadmap, open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Configurar roadmap"
      footer={
        <div className="flex gap-2">
          <Button variant="danger" onClick={onDelete} icon={<Trash2 size={16} />} aria-label="Excluir roadmap" />
          <Button
            variant="primary"
            block
            onClick={() => onSave(d, d.hoursPerWeek !== roadmap.hoursPerWeek || d.deadline !== roadmap.deadline)}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Ícone</Label>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setD({ ...d, emoji: e })}
                className={`tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${d.emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-2'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Nome</Label>
          <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </div>
        <div>
          <Label>Objetivo</Label>
          <Textarea value={d.goal} onChange={(e) => setD({ ...d, goal: e.target.value })} className="min-h-[64px]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Horas/semana</Label>
            <Input type="number" min={1} max={60} value={d.hoursPerWeek} onChange={(e) => setD({ ...d, hoursPerWeek: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={d.deadline} onChange={(e) => e.target.value && setD({ ...d, deadline: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Segmented
            value={d.status === 'paused' ? 'paused' : 'active'}
            onChange={(v) => setD({ ...d, status: v })}
            options={[
              { value: 'active', label: 'Ativo' },
              { value: 'paused', label: 'Pausado' },
            ]}
          />
        </div>
      </div>
    </Sheet>
  );
}
