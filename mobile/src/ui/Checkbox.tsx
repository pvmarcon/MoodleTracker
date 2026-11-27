import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { haptic } from '~/lib/haptics';
import { useTheme } from '~/theme';

const N = 8;

/** Round checkbox with a spring "pop" and a particle burst on completion. */
export function TaskCheckbox({ checked, onChange, color, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; color: string; disabled?: boolean; label: string }) {
  const { c } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [burst] = useState(() => new Animated.Value(0));

  const celebrate = () => {
    scale.setValue(0.6);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 3.5, tension: 220, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 550, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        if (!checked) {
          haptic.success();
          celebrate();
        } else haptic.tap();
        onChange(!checked);
      }}
      style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
              opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * 22] }) },
                { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * 22] }) },
              ],
            }}
          />
        );
      })}
      <Animated.View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: checked ? 0 : 2,
          borderColor: c.subtle,
          backgroundColor: checked ? color : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        {checked && <Check size={16} strokeWidth={3.5} color="#fff" />}
      </Animated.View>
      <View />
    </Pressable>
  );
}
