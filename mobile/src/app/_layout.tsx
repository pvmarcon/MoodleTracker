import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Sparkles } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAIEnv } from '@/services/ai/env';
import { AppStoreProvider, useApp } from '@/store/AppStore';
import { repository } from '~/lib/storage';
import { ThemeProvider, useTheme } from '~/theme';
import { Button } from '~/ui/Button';
import { Sheet } from '~/ui/Sheet';
import { Text } from '~/ui/Text';
import { ToastProvider } from '~/ui/Toast';

// EXPO_PUBLIC_* vars are inlined at build time (must be accessed literally).
setAIEnv({
  provider: process.env.EXPO_PUBLIC_AI_PROVIDER as 'mock' | 'openai' | 'gemini' | undefined,
  openaiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  openaiModel: process.env.EXPO_PUBLIC_OPENAI_MODEL,
  geminiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  geminiModel: process.env.EXPO_PUBLIC_GEMINI_MODEL,
  proxyUrl: process.env.EXPO_PUBLIC_AI_PROXY_URL,
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider repository={repository}>
        <Themed />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}

function Themed() {
  const { profile, ready } = useApp();
  return (
    <ThemeProvider mode={profile.theme}>
      <ToastProvider>{ready ? <Navigator /> : <Splash />}</ToastProvider>
    </ThemeProvider>
  );
}

function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

function Navigator() {
  const { c, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="roadmap/[id]" />
        <Stack.Screen name="generator" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
      <Welcome />
    </>
  );
}

function Welcome() {
  const { profile, updateProfile, clearAll } = useApp();
  const { c } = useTheme();
  const close = () => updateProfile({ onboarded: true });
  return (
    <Sheet open={!profile.onboarded} onClose={close}>
      <View style={{ alignItems: 'center', paddingTop: 16 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={36} color="#fff" />
        </View>
        <Text variant="h2" style={{ marginTop: 20 }}>Bem-vindo à Trilha</Text>
        <Text variant="small" tone="muted" style={{ textAlign: 'center', marginTop: 8, maxWidth: 300 }}>
          Transforme objetivos em roadmaps com fases, tópicos e tarefas diárias. Carregamos dois roadmaps de exemplo para você explorar.
        </Text>
      </View>
      <View style={{ gap: 8, marginTop: 24 }}>
        <Button variant="primary" size="lg" block onPress={close}>Explorar exemplo</Button>
        <Button
          variant="ghost"
          block
          onPress={async () => {
            await clearAll();
            router.push('/generator');
          }}
        >
          Começar do zero
        </Button>
      </View>
    </Sheet>
  );
}
