import { BatteryFull, BatteryLow, BatteryMedium, Clock, Flag, Hammer, RotateCcw } from 'lucide-react';
import { TaskCheckbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/cn';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes, relativeDay, today } from '@/lib/date';
import type { Energy, TaskRef } from '@/types';

export const EnergyIcon = ({ energy, size = 13 }: { energy: Energy; size?: number }) => {
  const I = energy === 'high' ? BatteryFull : energy === 'medium' ? BatteryMedium : BatteryLow;
  return <I size={size} className={energy === 'high' ? 'text-warning' : energy === 'medium' ? 'text-muted' : 'text-success'} />;
};

export function TaskRow({
  item,
  onToggle,
  onOpen,
  showRoadmap = true,
  disabled,
  badge,
}: {
  badge?: React.ReactNode;
  item: TaskRef;
  onToggle: (done: boolean) => void;
  onOpen?: () => void;
  showRoadmap?: boolean;
  disabled?: boolean;
}) {
  const { task, roadmap, topic } = item;
  const done = !!task.completedAt;
  const color = ROADMAP_HEX[roadmap.color];
  const overdue = !done && task.dueDate && task.dueDate < today();

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 active:bg-surface-2',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="pt-0.5">
        <TaskCheckbox checked={done} onChange={onToggle} color={color} label={`Concluir ${task.title}`} disabled={disabled} />
      </div>
      <div className="min-w-0 flex-1">
        {badge}
        <div
          className={cn(
            'text-[15px] font-medium leading-snug transition-colors',
            done ? 'text-subtle line-through decoration-subtle/60' : 'text-fg',
          )}
        >
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-subtle">
          {showRoadmap ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="truncate">{roadmap.title}</span>
            </span>
          ) : (
            <span className="truncate">{topic.title}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {formatMinutes(task.estimatedMinutes)}
          </span>
          <EnergyIcon energy={task.energy} />
          {task.kind === 'project' && <Hammer size={12} className="text-accent" />}
          {task.kind === 'review' && <RotateCcw size={12} className="text-accent" />}
          {task.priority === 'high' && !done && <Flag size={12} className="fill-danger text-danger" />}
          {overdue && <span className="font-medium text-danger">{relativeDay(task.dueDate!)}</span>}
          {!showRoadmap && !done && !overdue && task.dueDate && <span>{relativeDay(task.dueDate)}</span>}
        </div>
      </div>
    </div>
  );
}
