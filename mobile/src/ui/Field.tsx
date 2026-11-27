import { Minus, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { addDays, formatLong, relativeDay } from '@/lib/date';
import { useTheme } from '~/theme';
import { IconButton } from './Button';
import { Text } from './Text';

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text variant="small" tone="muted" style={{ fontWeight: '600' }}>
        {children}
      </Text>
      {hint && <Text variant="caption" tone="subtle">{hint}</Text>}
    </View>
  );
}

export function Input({ style, multiline, ...rest }: TextInputProps) {
  const { c } = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.subtle}
      multiline={multiline}
      style={[
        {
          minHeight: multiline ? 88 : 46,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface2,
          color: c.fg,
          fontSize: 16,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
      {...rest}
    />
  );
}

/** Numeric stepper (replaces sliders/number inputs on touch). */
export function Stepper({ value, onChange, step = 1, min = 0, max = 999, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface2, height: 46, paddingHorizontal: 4 }}>
      <IconButton label="Diminuir" size={38} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))}>
        <Minus size={18} color={c.fg} />
      </IconButton>
      <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>{format ? format(value) : value}</Text>
      <IconButton label="Aumentar" size={38} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))}>
        <Plus size={18} color={c.fg} />
      </IconButton>
    </View>
  );
}

/** Date picker without native modules: ±1 day stepper with relative label. */
export function DateStepper({ value, onChange, step = 1, min }: { value: string; onChange: (v: string) => void; step?: number; min?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface2, height: 52, paddingHorizontal: 4 }}>
      <IconButton label="Dia anterior" size={40} disabled={!!min && addDays(value, -step) < min} onPress={() => onChange(addDays(value, -step))}>
        <Minus size={18} color={c.fg} />
      </IconButton>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontWeight: '700' }}>{formatLong(value)}</Text>
        <Text variant="caption" tone="subtle">{relativeDay(value)}</Text>
      </View>
      <IconButton label="Próximo dia" size={40} onPress={() => onChange(addDays(value, step))}>
        <Plus size={18} color={c.fg} />
      </IconButton>
    </View>
  );
}
