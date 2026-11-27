import { BatteryFull, BatteryLow, BatteryMedium, Clock, Flag, Hammer, RotateCcw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes, relativeDay, today } from '@/lib/date';
import type { Energy, TaskRef } from '@/types';
import { TaskCheckbox } from '~/ui/Checkbox';
import { Text } from '~/ui/Text';
import { useTheme } from '~/theme';

export function EnergyIcon({ energy, size = 13 }: { energy: Energy; size?: number }) {
  const { c } = useTheme();
  const I = energy === 'high' ? BatteryFull : energy === 'medium' ? BatteryMedium : BatteryLow;
  return <I size={size} color={energy === 'high' ? c.warning : energy === 'medium' ? c.muted : c.success} />;
}

export function TaskRow({
  item,
  onToggle,
  onOpen,
  showRoadmap = true,
  disabled,
  badge,
}: {
  item: TaskRef;
  onToggle: (done: boolean) => void;
  onOpen?: () => void;
  showRoadmap?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  const { c } = useTheme();
  const { task, roadmap, topic } = item;
  const done = !!task.completedAt;
  const color = ROADMAP_HEX[roadmap.color];
  const overdue = !done && !!task.dueDate && task.dueDate < today();

  return (
    <Pressable
      onPress={onOpen}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: pressed ? c.surface2 : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <View style={{ paddingTop: 1 }}>
        <TaskCheckbox checked={done} onChange={onToggle} color={color} disabled={disabled} label={`Concluir ${task.title}`} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {badge}
        <Text
          style={{
            color: done ? c.subtle : c.fg,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginTop: 5 }}>
          {showRoadmap ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '60%' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              <Text variant="caption" tone="subtle" numberOfLines={1}>{roadmap.title}</Text>
            </View>
          ) : (
            <Text variant="caption" tone="subtle" numberOfLines={1}>{topic.title}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color={c.subtle} />
            <Text variant="caption" tone="subtle">{formatMinutes(task.estimatedMinutes)}</Text>
          </View>
          <EnergyIcon energy={task.energy} />
          {task.kind === 'project' && <Hammer size={12} color={c.accent} />}
          {task.kind === 'review' && <RotateCcw size={12} color={c.accent} />}
          {task.priority === 'high' && !done && <Flag size={12} color={c.danger} fill={c.danger} />}
          {overdue && <Text variant="caption" tone="danger" style={{ fontWeight: '600' }}>{relativeDay(task.dueDate!)}</Text>}
          {!showRoadmap && !done && !overdue && task.dueDate && <Text variant="caption" tone="subtle">{relativeDay(task.dueDate)}</Text>}
        </View>
      </View>
    </Pressable>
  );
}
