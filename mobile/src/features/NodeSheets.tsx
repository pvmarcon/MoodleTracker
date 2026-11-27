import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { Roadmap } from '@/types';
import { alpha, useTheme } from '~/theme';
import { Button } from '~/ui/Button';
import { Segmented } from '~/ui/Chip';
import { DateStepper, Input, Label, Stepper } from '~/ui/Field';
import { Sheet } from '~/ui/Sheet';
import { Text } from '~/ui/Text';
import { today } from '@/lib/date';

export function NodeEditorSheet({ open, heading, initial, onClose, onSave }: { open: boolean; heading: string; initial: { title: string; description?: string }; onClose: () => void; onSave: (v: { title: string; description?: string }) => void }) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const key = `${open}|${initial.title}|${initial.description ?? ''}`;
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setTitle(initial.title);
    setDescription(initial.description ?? '');
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={heading}
      footer={
        <Button variant="primary" block disabled={!title.trim()} onPress={() => onSave({ title: title.trim(), description: description.trim() || undefined })}>
          Salvar
        </Button>
      }
    >
      <View style={{ gap: 16 }}>
        <View>
          <Label>Título</Label>
          <Input autoFocus value={title} onChangeText={setTitle} />
        </View>
        <View>
          <Label hint="opcional">Descrição</Label>
          <Input multiline value={description} onChangeText={setDescription} />
        </View>
      </View>
    </Sheet>
  );
}

export function ConfirmSheet({ open, title, body, confirmLabel = 'Excluir', onConfirm, onClose }: { open: boolean; title: string; body?: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <Text variant="small" tone="muted">{body}</Text>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
        <View style={{ flex: 1 }}>
          <Button block onPress={onClose}>Cancelar</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            block
            variant="danger"
            onPress={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

const EMOJIS = ['🎯', '☕', '⚛️', '📊', '🗣️', '🎨', '🚀', '📚', '💼', '🧠', '🏋️', '🎓'];

export function RoadmapSettingsSheet({ open, roadmap, onClose, onSave, onDelete }: { open: boolean; roadmap: Roadmap; onClose: () => void; onSave: (r: Roadmap, scheduleChanged: boolean) => void; onDelete: () => void }) {
  const { c } = useTheme();
  const [d, setD] = useState(roadmap);
  const [prev, setPrev] = useState({ roadmap, open });
  if (prev.roadmap !== roadmap || prev.open !== open) {
    setPrev({ roadmap, open });
    setD(roadmap);
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Configurar roadmap"
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="danger" onPress={onDelete} icon={<Trash2 size={18} color={c.danger} />} />
          <View style={{ flex: 1 }}>
            <Button variant="primary" block onPress={() => onSave(d, d.hoursPerWeek !== roadmap.hoursPerWeek || d.deadline !== roadmap.deadline)}>
              Salvar
            </Button>
          </View>
        </View>
      }
    >
      <View style={{ gap: 16 }}>
        <View>
          <Label>Ícone</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setD({ ...d, emoji: e })}
                style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: d.emoji === e ? alpha(c.accent, 0.2) : c.surface2, borderWidth: 2, borderColor: d.emoji === e ? c.accent : 'transparent' }}
              >
                <Text style={{ fontSize: 20, lineHeight: 26 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View>
          <Label>Nome</Label>
          <Input value={d.title} onChangeText={(v) => setD({ ...d, title: v })} />
        </View>
        <View>
          <Label>Objetivo</Label>
          <Input multiline value={d.goal} onChangeText={(v) => setD({ ...d, goal: v })} style={{ minHeight: 64 }} />
        </View>
        <View>
          <Label>Horas por semana</Label>
          <Stepper value={d.hoursPerWeek} min={1} max={60} onChange={(v) => setD({ ...d, hoursPerWeek: v })} format={(v) => `${v}h/sem`} />
        </View>
        <View>
          <Label hint="±1 semana">Prazo</Label>
          <DateStepper value={d.deadline} step={7} min={today()} onChange={(v) => setD({ ...d, deadline: v })} />
        </View>
        <View>
          <Label>Status</Label>
          <Segmented
            value={d.status === 'paused' ? 'paused' : 'active'}
            onChange={(v) => setD({ ...d, status: v })}
            options={[
              { value: 'active', label: 'Ativo' },
              { value: 'paused', label: 'Pausado' },
            ]}
          />
        </View>
      </View>
    </Sheet>
  );
}
