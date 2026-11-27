import { useEffect, type ReactNode, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '~/theme';

export function ProgressBar({ value, color, height = 12 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  const v = Math.min(1, Math.max(0, value));
  const anim = useState(() => new Animated.Value(v))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: v, duration: 450, useNativeDriver: false }).start();
  }, [v, anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ flex: 1, height, borderRadius: height, backgroundColor: c.surface2, overflow: 'hidden' }}>
      <Animated.View style={{ width, height, borderRadius: height, backgroundColor: color ?? c.success }}>
        {height >= 10 && v > 0.04 && (
          <View style={{ position: 'absolute', left: 8, right: 8, top: 3, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        )}
      </Animated.View>
    </View>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, color, children }: { value: number; size?: number; stroke?: number; color: string; children?: ReactNode }) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - v)}
        />
      </Svg>
      {children}
    </View>
  );
}
