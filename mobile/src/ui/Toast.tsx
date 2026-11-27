import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '~/theme';
import { Text } from './Text';

interface ToastItem {
  id: number;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
}

const Ctx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: Omit<ToastItem, 'id'>) => {
    if (timer.current) clearTimeout(timer.current);
    setItem({ ...t, id: ++seq.current });
    timer.current = setTimeout(() => setItem(null), 3200);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {item && <ToastView key={item.id} item={item} onDone={() => setItem(null)} />}
    </Ctx.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 72,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {item.icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>{item.title}</Text>
          {item.subtitle && (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>
        {item.action && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              item.action!.onPress();
              onDone();
            }}
          >
            <Text variant="small" tone="accent" style={{ fontWeight: '700' }}>
              {item.action.label}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export const useToast = () => useContext(Ctx);
