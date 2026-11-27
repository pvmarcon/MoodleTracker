import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '~/lib/haptics';
import { alpha, useTheme } from '~/theme';

type Variant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const HEIGHT: Record<Size, number> = { sm: 34, md: 46, lg: 56 };

/** Chunky Duolingo-style button: 3D bottom edge that "presses" down. */
export function Button({
  children,
  onPress,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  loading,
  style,
  block,
}: {
  children?: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  block?: boolean;
}) {
  const { c } = useTheme();
  const [pressed, setPressed] = useState(false);
  const chunky = variant === 'primary' || variant === 'success';
  const bg = {
    primary: c.accent,
    success: c.success,
    secondary: c.surface2,
    ghost: 'transparent',
    danger: alpha(c.danger, 0.12),
  }[variant];
  const edge = variant === 'primary' ? c.accentDark : c.successDark;
  const fg = { primary: '#fff', success: '#fff', secondary: c.fg, ghost: c.muted, danger: c.danger }[variant];
  const h = HEIGHT[size];
  const off = disabled || loading;

  return (
    <Pressable
      disabled={off}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ alignSelf: block ? 'stretch' : 'flex-start', opacity: off ? 0.5 : 1, paddingBottom: chunky ? 4 : 0 }, style]}
    >
      {chunky && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 4, borderRadius: size === 'lg' ? 16 : 12, backgroundColor: edge }} />}
      <View
        style={{
          height: h,
          paddingHorizontal: size === 'sm' ? 12 : 18,
          borderRadius: size === 'lg' ? 16 : size === 'sm' ? 10 : 12,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
          borderColor: variant === 'danger' ? alpha(c.danger, 0.3) : c.line,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transform: [{ translateY: chunky && pressed ? 4 : 0 }, { scale: !chunky && pressed ? 0.97 : 1 }],
        }}
      >
        {loading ? <ActivityIndicator color={fg} size="small" /> : icon}
        {typeof children === 'string' ? (
          <Text
            style={{
              color: fg,
              fontWeight: size === 'lg' ? '800' : '600',
              fontSize: size === 'lg' ? 16 : size === 'sm' ? 13 : 15,
              letterSpacing: size === 'lg' ? 0.8 : 0,
              textTransform: size === 'lg' ? 'uppercase' : 'none',
            }}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}

export function IconButton({
  children,
  onPress,
  label,
  active,
  size = 40,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  label: string;
  active?: boolean;
  size?: number;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? alpha(c.accent, 0.15) : pressed ? c.surface2 : 'transparent',
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}
