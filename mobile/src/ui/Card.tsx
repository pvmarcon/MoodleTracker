import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '~/theme';
import { Text } from './Text';

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 16, overflow: 'hidden' };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, style, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      {children}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

export function SectionTitle({ children, right, tone = 'subtle' }: { children: ReactNode; right?: ReactNode; tone?: 'subtle' | 'danger' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8, paddingHorizontal: 4 }}>
      <Text variant="overline" tone={tone}>
        {children}
      </Text>
      {right}
    </View>
  );
}
