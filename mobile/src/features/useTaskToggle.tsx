import { Zap } from 'lucide-react-native';
import { useCallback } from 'react';
import { View } from 'react-native';
import { xpFor } from '@/domain/stats';
import { useApp } from '@/store/AppStore';
import type { TaskRef } from '@/types';
import { alpha, useTheme } from '~/theme';
import { useToast } from '~/ui/Toast';

export function useTaskToggle() {
  const { setTaskDone } = useApp();
  const toast = useToast();
  const { c } = useTheme();
  return useCallback(
    (ref: TaskRef, done: boolean) => {
      setTaskDone(ref.roadmap.id, ref.task.id, done);
      if (done)
        toast({
          title: `+${xpFor(ref.task)} XP`,
          subtitle: ref.task.title,
          icon: (
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: alpha(c.warning, 0.15), alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={17} color={c.warning} fill={c.warning} />
            </View>
          ),
          action: { label: 'Desfazer', onPress: () => setTaskDone(ref.roadmap.id, ref.task.id, false) },
        });
    },
    [setTaskDone, toast, c],
  );
}
