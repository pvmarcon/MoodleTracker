import { Sparkles } from 'lucide-react';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ToastProvider } from '@/components/ui/Toast';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { GeneratorScreen } from '@/features/roadmaps/GeneratorScreen';
import { RoadmapDetailScreen } from '@/features/roadmaps/RoadmapDetailScreen';
import { RoadmapsScreen } from '@/features/roadmaps/RoadmapsScreen';
import { SuggestionsScreen } from '@/features/suggestions/SuggestionsScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { AppStoreProvider, useApp } from '@/store/AppStore';
import { NavigationProvider, useNav } from '@/store/navigation';

function CurrentScreen() {
  const { tab, stack } = useNav();
  const top = stack.at(-1);
  if (top?.name === 'roadmap') return <RoadmapDetailScreen key={top.id} id={top.id} />;
  if (top?.name === 'generator') return <GeneratorScreen />;
  switch (tab) {
    case 'today':
      return <TodayScreen />;
    case 'roadmaps':
      return <RoadmapsScreen />;
    case 'suggestions':
      return <SuggestionsScreen />;
    case 'profile':
      return <ProfileScreen />;
  }
}

function Welcome() {
  const { profile, updateProfile, clearAll } = useApp();
  const nav = useNav();
  const close = () => updateProfile({ onboarded: true });
  return (
    <Sheet open={!profile.onboarded} onClose={close}>
      <div className="pt-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-white shadow-pop">
          <Sparkles size={36} />
        </div>
        <h2 className="mt-5 text-[22px] font-extrabold tracking-tight">Bem-vindo à Trilha</h2>
        <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted">
          Transforme objetivos em roadmaps com fases, tópicos e tarefas diárias. Carregamos dois roadmaps de exemplo para você explorar.
        </p>
      </div>
      <div className="mt-6 space-y-2">
        <Button variant="primary" size="lg" block onClick={close}>
          Explorar exemplo
        </Button>
        <Button
          variant="ghost"
          block
          onClick={async () => {
            await clearAll();
            nav.reset('roadmaps', [{ name: 'generator' }]);
          }}
        >
          Começar do zero
        </Button>
      </div>
    </Sheet>
  );
}

function Shell() {
  const { ready } = useApp();
  const { stack } = useNav();
  const immersive = stack.at(-1)?.name === 'generator';

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-safe" style={{ paddingBottom: immersive ? 16 : 96 }}>
      <main key={stack.length} className="animate-fade-in">
        <CurrentScreen />
      </main>
      {!immersive && <BottomTabBar />}
      <Welcome />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppStoreProvider>
        <NavigationProvider>
          <Shell />
        </NavigationProvider>
      </AppStoreProvider>
    </ToastProvider>
  );
}
