import { Zap } from 'lucide-react';
import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { xpFor } from '@/domain/stats';
import { useApp } from '@/store/AppStore';
import type { TaskRef } from '@/types';

/** Toggle + XP toast with undo — the core "quick action" loop of the app. */
export function useTaskToggle() {
  const { setTaskDone } = useApp();
  const toast = useToast();

  return useCallback(
    (ref: TaskRef, done: boolean) => {
      setTaskDone(ref.roadmap.id, ref.task.id, done);
      if (done) {
        toast({
          tone: 'success',
          icon: (
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/15">
              <Zap size={16} className="fill-warning text-warning" />
            </span>
          ),
          message: (
            <div>
              <div className="font-semibold">+{xpFor(ref.task)} XP</div>
              <div className="text-[12px] text-muted">{ref.task.title}</div>
            </div>
          ),
          action: { label: 'Desfazer', onClick: () => setTaskDone(ref.roadmap.id, ref.task.id, false) },
        });
      }
    },
    [setTaskDone, toast],
  );
}
