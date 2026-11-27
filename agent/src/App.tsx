import { Menu, PanelLeftOpen, PanelRight, SquarePen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { INTENTS } from '~/agent/intents';
import { useChat } from '~/agent/useChat';
import { CanvasPanel } from '~/canvases/CanvasPanel';
import { Composer } from '~/components/Composer';
import { Home } from '~/components/Home';
import { Sidebar } from '~/components/Sidebar';
import { Thread } from '~/components/Thread';
import { cn } from '~/lib/cn';
import { useMedia } from '~/lib/useMedia';

type Theme = 'dark' | 'light';

export default function App() {
  const chat = useChat();
  const desktop = useMedia('(min-width: 1024px)');
  const [sidebar, setSidebar] = useState(desktop);
  const [panelMsgId, setPanelMsgId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('mentor:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const messages = chat.active?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  // The page morphs: as soon as the agent knows the intent, open the generated panel (desktop).
  useEffect(() => {
    if (desktop && lastAssistant?.pending && lastAssistant.intent && lastAssistant.intent !== 'chat') setPanelMsgId(lastAssistant.id);
  }, [desktop, lastAssistant?.id, lastAssistant?.pending, lastAssistant?.intent]);

  // When switching conversations, show that conversation's latest panel.
  useEffect(() => {
    const latest = [...(chat.active?.messages ?? [])].reverse().find((m) => m.canvas);
    setPanelMsgId(desktop && latest ? latest.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.activeId]);

  const panelMsg = messages.find((m) => m.id === panelMsgId);
  const panelOpen = !!panelMsg && (!!panelMsg.canvas || (!!panelMsg.pending && !!panelMsg.intent && panelMsg.intent !== 'chat'));
  const latestCanvasMsg = [...messages].reverse().find((m) => m.canvas);

  const ask = (t: string) => {
    if (!desktop) setPanelMsgId(null);
    void chat.send(t);
  };

  const closeSidebarOnMobile = () => !desktop && setSidebar(false);

  const topBar = (
    <header className={cn('z-20 flex h-14 shrink-0 items-center gap-1 px-2 pt-safe', chat.active ? 'border-b border-line bg-bg/80 backdrop-blur-xl' : 'absolute inset-x-0 top-0')}>
      {(!sidebar || !desktop) && (
        <button onClick={() => setSidebar(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-fg focus-ring" aria-label="Abrir barra lateral">
          {desktop ? <PanelLeftOpen size={18} /> : <Menu size={20} />}
        </button>
      )}
      {chat.active ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          {(() => {
            const it = INTENTS[chat.active.intent];
            return <it.icon size={15} className="shrink-0" style={{ color: it.color }} />;
          })()}
          <span className="truncate text-[14px] font-medium">{chat.active.title}</span>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {chat.active && latestCanvasMsg && !panelOpen && (
        <button onClick={() => setPanelMsgId(latestCanvasMsg.id)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted hover:bg-raised hover:text-fg focus-ring">
          <PanelRight size={16} /> <span className="hidden sm:inline">Painel</span>
        </button>
      )}
      {chat.active && (
        <button onClick={chat.newChat} className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-fg focus-ring" aria-label="Nova conversa">
          <SquarePen size={17} />
        </button>
      )}
    </header>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: inline on desktop, drawer on mobile */}
      {desktop ? (
        <div className={cn('shrink-0 overflow-hidden transition-[width] duration-300', sidebar ? 'w-[272px]' : 'w-0')}>
          <Sidebar
            conversations={chat.conversations}
            activeId={chat.activeId}
            onSelect={chat.select}
            onNew={chat.newChat}
            onDelete={chat.remove}
            onClose={() => setSidebar(false)}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          />
        </div>
      ) : (
        sidebar && (
          <div className="fixed inset-0 z-40 flex">
            <div className="absolute inset-0 animate-fade bg-black/50 backdrop-blur-sm" onClick={() => setSidebar(false)} />
            <div className="relative animate-rise">
              <Sidebar
                mobile
                conversations={chat.conversations}
                activeId={chat.activeId}
                onSelect={(id) => {
                  chat.select(id);
                  closeSidebarOnMobile();
                }}
                onNew={() => {
                  chat.newChat();
                  closeSidebarOnMobile();
                }}
                onDelete={chat.remove}
                onClose={() => setSidebar(false)}
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              />
            </div>
          </div>
        )
      )}

      {/* Main */}
      <main className="relative flex min-w-0 flex-1 flex-col">

        {!chat.active ? (
          <div className="thin-scroll h-full overflow-y-auto">
            {topBar}
            <Home onSend={ask} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 animate-fade flex-col">
              {topBar}
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                <Thread
                  messages={messages}
                  onSuggestion={ask}
                  openCanvasId={panelOpen ? panelMsgId : null}
                  onOpenCanvas={setPanelMsgId}
                  onRetry={(t) => t && ask(t)}
                />
              </div>
              <div className="mx-auto w-full max-w-[720px] px-4 pb-4 pb-safe">
                <Composer onSend={ask} onStop={chat.stop} busy={chat.busy} />
                <p className="mt-2 text-center text-[11px] text-subtle">Respostas simuladas (modo demo). Confira informações importantes.</p>
              </div>
            </div>

            {panelOpen &&
              (desktop ? (
                <div className="w-[min(48%,680px)] shrink-0 animate-fade border-l border-line pt-0">
                  <CanvasPanel canvas={panelMsg!.canvas ?? null} pendingIntent={panelMsg!.intent} onClose={() => setPanelMsgId(null)} onAsk={ask} />
                </div>
              ) : (
                <div className="fixed inset-0 z-30 animate-rise">
                  <CanvasPanel canvas={panelMsg!.canvas ?? null} pendingIntent={panelMsg!.intent} onClose={() => setPanelMsgId(null)} onAsk={ask} />
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
