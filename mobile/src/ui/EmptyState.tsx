import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '~/theme';
import { Text } from './Text';

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 }}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 38, lineHeight: 46 }}>{emoji}</Text>
      </View>
      <Text variant="h3" style={{ fontSize: 17, textAlign: 'center' }}>{title}</Text>
      {body && <Text variant="small" tone="muted" style={{ textAlign: 'center', marginTop: 6, maxWidth: 280 }}>{body}</Text>}
      {action && <View style={{ marginTop: 20 }}>{action}</View>}
    </View>
  );
}
