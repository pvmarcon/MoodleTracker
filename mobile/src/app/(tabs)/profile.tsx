import { router } from 'expo-router';
import { Bot, KeyRound, Moon, RotateCcw, Share2, Sun, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Share, TextInput, View } from 'react-native';
import { progressOf, roadmapTasks } from '@/domain/roadmap';
import { levelFor } from '@/domain/stats';
import { ROADMAP_HEX } from '@/lib/colors';
import { formatMinutes, fromISODate, weekdayShort } from '@/lib/date';
import { resolveProvider } from '@/services/ai';
import { useApp } from '@/store/AppStore';
import type { AIProviderId } from '@/types';
import { ConfirmSheet } from '~/features/NodeSheets';
import { alpha, useTheme } from '~/theme';
import { Card, Divider, SectionTitle } from '~/ui/Card';
import { OptionTile, Segmented } from '~/ui/Chip';
import { Input, Label, Stepper } from '~/ui/Field';
import { ProgressBar } from '~/ui/Progress';
import { LargeHeader, Screen } from '~/ui/Screen';
import { Text } from '~/ui/Text';
import { useToast } from '~/ui/Toast';

export default function ProfileScreen() {
  const { c } = useTheme();
  const { profile, stats, roadmaps, updateProfile, resetToDemo, clearAll, exportData } = useApp();
  const toast = useToast();
  const [confirm, setConfirm] = useState<null | 'reset' | 'clear'>(null);
  const lvl = levelFor(stats.xp);
  const maxDay = Math.max(profile.dailyGoalMinutes, ...stats.week.map((d) => d.minutes));
  const provider = resolveProvider(profile.ai);
  const CHART_H = 120;

  return (
    <Screen>
      <LargeHeader title="Perfil & Metas" />

      <Card style={{ padding: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{profile.name.charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <TextInput value={profile.name} onChangeText={(v) => updateProfile({ name: v })} style={{ color: c.fg, fontSize: 19, fontWeight: '800', padding: 0 }} accessibilityLabel="Nome" />
            <TextInput value={profile.headline} onChangeText={(v) => updateProfile({ headline: v })} placeholder="Sua meta principal" placeholderTextColor={c.subtle} style={{ color: c.muted, fontSize: 13, padding: 0, marginTop: 2 }} accessibilityLabel="Meta principal" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 6 }}>
          <Text variant="caption" style={{ fontWeight: '700' }}>Nível {lvl.level}</Text>
          <Text variant="caption" tone="subtle">{lvl.toNext} XP para o próximo</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <ProgressBar value={lvl.progress} color={c.warning} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Stat value={`🔥 ${stats.streak}`} label="dias seguidos" />
          <Stat value={`⚡ ${stats.xp}`} label="XP total" />
          <Stat value={`✅ ${stats.completedTotal}`} label="concluídas" />
        </View>
      </Card>

      <SectionTitle>Últimos 7 dias · {formatMinutes(stats.minutesThisWeek)}</SectionTitle>
      <Card style={{ padding: 16 }}>
        <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: (profile.dailyGoalMinutes / maxDay) * CHART_H, borderTopWidth: 1, borderStyle: 'dashed', borderColor: alpha(c.success, 0.6) }} />
          {stats.week.map((d) => {
            const hit = d.minutes >= profile.dailyGoalMinutes;
            return <View key={d.date} style={{ flex: 1, height: d.minutes ? Math.max(6, (d.minutes / maxDay) * CHART_H) : 4, borderRadius: 8, backgroundColor: hit ? c.success : d.minutes ? alpha(c.accent, 0.75) : c.surface2 }} />;
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {stats.week.map((d, i) => (
            <Text key={d.date} variant="caption" tone={i === 6 ? 'fg' : 'subtle'} style={{ flex: 1, textAlign: 'center', fontWeight: i === 6 ? '800' : '400' }}>
              {weekdayShort(fromISODate(d.date).getDay())}
            </Text>
          ))}
        </View>
        <Text variant="caption" tone="subtle" style={{ marginTop: 8 }}>Linha tracejada = meta diária ({profile.dailyGoalMinutes} min)</Text>
      </Card>

      <SectionTitle>Metas</SectionTitle>
      <Card style={{ padding: 16, gap: 16 }}>
        <View>
          <Label>Meta diária</Label>
          <Stepper value={profile.dailyGoalMinutes} step={15} min={15} max={240} format={formatMinutes} onChange={(v) => updateProfile({ dailyGoalMinutes: v })} />
        </View>
        <View>
          <Label hint="usado no agendamento">Dias de estudo</Label>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = profile.studyDays.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    const next = on ? profile.studyDays.filter((x) => x !== d) : [...profile.studyDays, d];
                    if (next.length) updateProfile({ studyDays: next.sort() });
                  }}
                  style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : c.surface2 }}
                >
                  <Text variant="caption" style={{ fontWeight: '700', color: on ? '#fff' : c.subtle }}>{weekdayShort(d)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {roadmaps.map((r) => (
          <Pressable key={r.id} onPress={() => router.push(`/roadmap/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 18, lineHeight: 24 }}>{r.emoji}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{r.title}</Text>
                <Text variant="caption" tone="subtle">{r.hoursPerWeek}h/sem</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <ProgressBar value={progressOf(roadmapTasks(r)).ratio} color={ROADMAP_HEX[r.color]} height={6} />
              </View>
            </View>
          </Pressable>
        ))}
      </Card>

      <SectionTitle>Aparência</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['dark', 'light'] as const).map((t) => (
          <View key={t} style={{ flex: 1 }}>
            <OptionTile selected={profile.theme === t} onPress={() => updateProfile({ theme: t })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {t === 'dark' ? <Moon size={16} color={c.fg} /> : <Sun size={16} color={c.fg} />}
                <Text style={{ fontWeight: '700' }}>{t === 'dark' ? 'Escuro' : 'Claro'}</Text>
              </View>
            </OptionTile>
          </View>
        ))}
      </View>

      <SectionTitle>Integração de IA</SectionTitle>
      <Card style={{ padding: 16, gap: 16 }}>
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
            <View>
              <Label hint="fica só neste aparelho">Chave de API</Label>
              <View>
                <View style={{ position: 'absolute', left: 12, top: 15, zIndex: 1 }}>
                  <KeyRound size={16} color={c.subtle} />
                </View>
                <Input secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ paddingLeft: 36 }} placeholder={profile.ai.provider === 'openai' ? 'sk-…' : 'AIza…'} value={profile.ai.apiKey ?? ''} onChangeText={(v) => updateProfile({ ai: { ...profile.ai, apiKey: v } })} />
              </View>
            </View>
            <View>
              <Label hint="opcional">Modelo</Label>
              <Input autoCapitalize="none" autoCorrect={false} placeholder={profile.ai.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'} value={profile.ai.model ?? ''} onChangeText={(v) => updateProfile({ ai: { ...profile.ai, model: v } })} />
            </View>
          </>
        )}
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: c.surface2 }}>
          <Bot size={15} color={c.muted} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            Em uso: <Text variant="caption" style={{ fontWeight: '700' }}>{provider.label}</Text>.{' '}
            {provider.id === 'mock' ? 'Sem chave, o Mock Inteligente gera roadmaps adaptados ao seu objetivo, nível e prazo.' : 'Se a chamada falhar, o app volta automaticamente para o Mock Inteligente.'}
          </Text>
        </View>
      </Card>

      <SectionTitle>Dados</SectionTitle>
      <Card>
        <Row icon={<Share2 size={17} color={c.subtle} />} label="Exportar backup (JSON)" onPress={async () => Share.share({ message: await exportData() })} />
        <Divider />
        <Row icon={<RotateCcw size={17} color={c.subtle} />} label="Restaurar dados de exemplo" onPress={() => setConfirm('reset')} />
        <Divider />
        <Row icon={<Trash2 size={17} color={c.danger} />} label="Apagar tudo" danger onPress={() => setConfirm('clear')} />
      </Card>
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center', marginTop: 24 }}>Trilha v0.1 · dados salvos no aparelho</Text>

      <ConfirmSheet open={confirm === 'reset'} title="Restaurar dados de exemplo?" body="Seus roadmaps atuais serão substituídos pelos exemplos." confirmLabel="Restaurar" onConfirm={() => resetToDemo().then(() => toast({ title: 'Dados de exemplo restaurados' }))} onClose={() => setConfirm(null)} />
      <ConfirmSheet open={confirm === 'clear'} title="Apagar todos os dados?" body="Roadmaps, tarefas e progresso serão removidos deste aparelho." confirmLabel="Apagar tudo" onConfirm={() => clearAll()} onClose={() => setConfirm(null)} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: c.surface2 }}>
      <Text style={{ fontWeight: '800' }}>{value}</Text>
      <Text variant="caption" tone="subtle">{label}</Text>
    </View>
  );
}

function Row({ icon, label, onPress, danger }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
      {icon}
      <Text style={{ color: danger ? c.danger : c.fg }}>{label}</Text>
    </Pressable>
  );
}

