import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '~/theme';
import { IconButton } from './Button';
import { Text } from './Text';

/** Scrollable screen with safe-area padding and a large-title header. */
export function Screen({ children, header, scroll = true }: { children: ReactNode; header?: ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>{header}{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={header ? [0] : undefined}
      >
        {header}
        {children}
      </ScrollView>
    </View>
  );
}

export function LargeHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 8, gap: 12 }}>
      <View style={{ flex: 1 }}>
        {eyebrow && (
          <Text variant="small" tone="subtle" style={{ fontWeight: '600', marginBottom: 2 }}>
            {eyebrow.charAt(0).toUpperCase() + eyebrow.slice(1)}
          </Text>
        )}
        <Text variant="title" numberOfLines={1}>{title}</Text>
      </View>
      {right && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{right}</View>}
    </View>
  );
}

/** Compact header with back button for stack screens. */
export function StackHeader({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, gap: 4, backgroundColor: c.bg, marginHorizontal: -8 }}>
      <IconButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <ChevronLeft size={26} color={c.fg} />
      </IconButton>
      <View style={{ flex: 1 }}>{typeof title === 'string' ? <Text style={{ fontWeight: '700' }} numberOfLines={1}>{title}</Text> : title}</View>
      {right}
    </View>
  );
}
