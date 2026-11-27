import { Tabs } from 'expo-router';
import { CalendarCheck2, Map, Sparkles, UserRound } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/store/AppStore';
import { alpha, useTheme } from '~/theme';

type IconT = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const makeIcon = (accent: string) => (I: IconT) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return (
      <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? alpha(accent, 0.15) : 'transparent' }}>
        <I size={21} color={String(color)} strokeWidth={focused ? 2.4 : 2} />
      </View>
    );
  };

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { suggestions } = useApp();
  const badge = suggestions.filter((s) => s.score >= 60).length;
  const icon = makeIcon(c.accent);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.subtle,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line, height: 62 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: icon(CalendarCheck2) }} />
      <Tabs.Screen name="roadmaps" options={{ title: 'Roadmaps', tabBarIcon: icon(Map) }} />
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'Sugestões IA',
          tabBarIcon: icon(Sparkles),
          tabBarBadge: badge || undefined,
          tabBarBadgeStyle: { backgroundColor: c.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon(UserRound) }} />
    </Tabs>
  );
}
