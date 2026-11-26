import { Bot, Download, KeyRound, Moon, RotateCcw, Sun, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ScreenHeader } from '@/components/layout/Header';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Chip';
import { Input, Label } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { useToast } from '@/components/ui/Toast';
import { progressOf, roadmapTasks } from '@/domain/roadmap';
import { levelFor } from '@/domain/stats';
import { cn } from '@/lib/cn';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes, fromISODate, weekdayShort } from '@/lib/date';
import { resolveProvider } from '@/services/ai';
import { useApp } from '@/store/AppStore';
import { useNav } from '@/store/navigation';
import type { AIProviderId } from '@/types';
import { ConfirmSheet } from '../roadmaps/NodeSheets';

export function ProfileScreen() {
  const { profile, stats, roadmaps, updateProfile, resetToDemo, clearAll, exportData, importData } = useApp();
  const nav = useNav();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<null | 'reset' | 'clear'>(null);
  const lvl = levelFor(stats.xp);
  const maxDay = Math.max(profile.dailyGoalMinutes, ...stats.week.map((d) => d.minutes));
  const provider = resolveProvider(profile.ai);

  const download = async () => {
    const blob = new Blob([await exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trilha-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="pb-6">
      <ScreenHeader title="Perfil & Metas" />

      {/* Identity + level */}
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#1cb0f6] text-2xl font-extrabold text-white">
            {profile.name.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={profile.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              className="w-full bg-transparent text-[19px] font-bold outline-none"
              aria-label="Nome"
            />
            <input
              value={profile.headline}
              onChange={(e) => updateProfile({ headline: e.target.value })}
              className="w-full bg-transparent text-[13px] text-muted outline-none"
              aria-label="Meta principal"
              placeholder="Sua meta principal"
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[12px]">
            <span className="font-semibold">Nível {lvl.level}</span>
            <span className="text-subtle">{lvl.toNext} XP para o próximo</span>
          </div>
          <ProgressBar value={lvl.progress} color="rgb(var(--warning))" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={`🔥 ${stats.streak}`} label="dias seguidos" />
          <Stat value={`⚡ ${stats.xp}`} label="XP total" />
          <Stat value={`✅ ${stats.completedTotal}`} label="concluídas" />
        </div>
      </Card>

      {/* Weekly chart */}
      <SectionTitle>Últimos 7 dias · {formatMinutes(stats.minutesThisWeek)}</SectionTitle>
      <Card className="p-4">
        <div className="relative flex h-32 items-end gap-2">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-success/50"
            style={{ bottom: `${(profile.dailyGoalMinutes / maxDay) * 100}%` }}
          />
          {stats.week.map((d, i) => {
            const h = d.minutes ? Math.max(6, (d.minutes / maxDay) * 100) : 3;
            const hit = d.minutes >= profile.dailyGoalMinutes;
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className={cn('w-full rounded-lg transition-all duration-500', hit ? 'bg-success' : d.minutes ? 'bg-accent/70' : 'bg-surface-2')}
                  style={{ height: `${h}%` }}
                  title={`${d.minutes} min`}
                />
                <span className={cn('text-[11px]', i === 6 ? 'font-bold text-fg' : 'text-subtle')}>{weekdayShort(fromISODate(d.date).getDay())}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-subtle">Linha tracejada = meta diária ({profile.dailyGoalMinutes} min)</div>
      </Card>

      {/* Goals */}
      <SectionTitle>Metas</SectionTitle>
      <Card className="space-y-4 p-4">
        <div>
          <Label hint={formatMinutes(profile.dailyGoalMinutes)}>Meta diária</Label>
          <input
            type="range"
            min={15}
            max={240}
            step={15}
            value={profile.dailyGoalMinutes}
            onChange={(e) => updateProfile({ dailyGoalMinutes: Number(e.target.value) })}
            className="w-full accent-[rgb(var(--success))]"
            aria-label="Meta diária em minutos"
          />
        </div>
        <div>
          <Label hint="usado no agendamento">Dias de estudo</Label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = profile.studyDays.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => {
                    const next = on ? profile.studyDays.filter((x) => x !== d) : [...profile.studyDays, d];
                    if (next.length) updateProfile({ studyDays: next.sort() });
                  }}
                  className={cn('tap h-10 flex-1 rounded-xl text-[12px] font-semibold capitalize', on ? 'bg-accent text-white' : 'bg-surface-2 text-subtle')}
                >
                  {weekdayShort(d)}
                </button>
              );
            })}
          </div>
        </div>
        {roadmaps.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {roadmaps.map((r) => {
              const p = progressOf(roadmapTasks(r));
              return (
                <button key={r.id} className="flex w-full items-center gap-3 text-left" onClick={() => nav.reset('roadmaps', [{ name: 'roadmap', id: r.id }])}>
                  <span className="text-lg">{r.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate font-medium">{r.title}</span>
                      <span className="text-subtle">{r.hoursPerWeek}h/sem</span>
                    </div>
                    <ProgressBar value={p.ratio} color={ROADMAP_HEX[r.color]} height="h-1.5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Appearance */}
      <SectionTitle>Aparência</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateProfile({ theme: t })}
              className={cn('tap flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold', profile.theme === t ? 'border-accent bg-accent/10' : 'border-line text-muted')}
            >
              {t === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              {t === 'dark' ? 'Escuro' : 'Claro'}
            </button>
          ))}
        </div>
      </Card>

      {/* AI */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1">
          <Bot size={12} /> Integração de IA
        </span>
      </SectionTitle>
      <Card className="space-y-4 p-4">
        <Segmented<AIProviderId>
          value={profile.ai.provider}
          onChange={(v) => updateProfile({ ai: { provider: v, apiKey: v === profile.ai.provider ? profile.ai.apiKey : '', model: '' } })}
          options={[
            { value: 'mock', label: 'Mock' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ]}
        />
        {profile.ai.provider !== 'mock' && (
          <>
            <div>
              <Label hint="fica só neste dispositivo">Chave de API</Label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <Input
                  type="password"
                  autoComplete="off"
                  className="pl-9"
                  placeholder={profile.ai.provider === 'openai' ? 'sk-…' : 'AIza…'}
                  value={profile.ai.apiKey ?? ''}
                  onChange={(e) => updateProfile({ ai: { ...profile.ai, apiKey: e.target.value } })}
                />
              </div>
            </div>
            <div>
              <Label hint="opcional">Modelo</Label>
              <Input
                placeholder={profile.ai.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
                value={profile.ai.model ?? ''}
                onChange={(e) => updateProfile({ ai: { ...profile.ai, model: e.target.value } })}
              />
            </div>
          </>
        )}
        <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          Em uso: <b className="text-fg">{provider.label}</b>.{' '}
          {provider.id === 'mock'
            ? 'Sem chave configurada, o Mock Inteligente gera roadmaps adaptados ao seu objetivo, nível e prazo.'
            : 'Se a chamada falhar, o app volta automaticamente para o Mock Inteligente.'}
        </div>
      </Card>

      {/* Data */}
      <SectionTitle>Dados</SectionTitle>
      <Card className="divide-y divide-line">
        <Row icon={<Download size={17} />} label="Exportar backup (JSON)" onClick={download} />
        <Row icon={<Upload size={17} />} label="Importar backup" onClick={() => fileRef.current?.click()} />
        <Row icon={<RotateCcw size={17} />} label="Restaurar dados de exemplo" onClick={() => setConfirm('reset')} />
        <Row icon={<Trash2 size={17} />} label="Apagar tudo" danger onClick={() => setConfirm('clear')} />
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await importData(await f.text());
            toast({ message: 'Backup importado' });
          } catch {
            toast({ message: 'Arquivo inválido' });
          }
          e.target.value = '';
        }}
      />
      <p className="mt-6 text-center text-[11px] text-subtle">Trilha v0.1 · dados salvos localmente</p>

      <ConfirmSheet
        open={confirm === 'reset'}
        title="Restaurar dados de exemplo?"
        body="Seus roadmaps atuais serão substituídos pelos exemplos."
        confirmLabel="Restaurar"
        onConfirm={() => resetToDemo().then(() => toast({ message: 'Dados de exemplo restaurados' }))}
        onClose={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === 'clear'}
        title="Apagar todos os dados?"
        body="Roadmaps, tarefas e progresso serão removidos deste dispositivo."
        confirmLabel="Apagar tudo"
        onConfirm={() => clearAll()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2.5">
      <div className="text-[16px] font-bold">{value}</div>
      <div className="text-[11px] text-subtle">{label}</div>
    </div>
  );
}

function Row({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] font-medium transition-colors hover:bg-surface-2/60', danger && 'text-danger')}>
      <span className={danger ? 'text-danger' : 'text-subtle'}>{icon}</span>
      {label}
    </button>
  );
}
