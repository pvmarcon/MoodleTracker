import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { haptic } from '~/lib/haptics';
import { alpha, useTheme } from '~/theme';
import { Text } from './Text';

export function Chip({ active, onPress, children, icon }: { active?: boolean; onPress?: () => void; children: ReactNode; icon?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      style={({ pressed }) => ({
        height: 34,
        paddingHorizontal: 13,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: active ? alpha(c.accent, 0.6) : c.line,
        backgroundColor: active ? alpha(c.accent, 0.15) : c.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {icon}
      <Text variant="small" style={{ fontWeight: '600', color: active ? c.fg : c.muted }}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  const { c } = useTheme();
  const col = color ?? c.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 7, borderRadius: 7, backgroundColor: color ? alpha(color, 0.15) : c.surface2 }}>
      {typeof children === 'string' ? <Text variant="caption" style={{ color: col, fontWeight: '600' }}>{children}</Text> : children}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.select();
              onChange(o.value);
            }}
            style={{ flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent' }}
          >
            <Text variant="small" style={{ fontWeight: '600', color: on ? c.fg : c.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Big selectable option tile (generator steps, recalibration choices). */
export function OptionTile({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => ({
        borderWidth: 2,
        borderRadius: 16,
        padding: 12,
        borderColor: selected ? c.accent : c.line,
        backgroundColor: selected ? alpha(c.accent, 0.1) : 'transparent',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}
