import { router } from 'expo-router';
import { AlertTriangle, ArrowRight, Check, Clock, Layers, ListChecks, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { progressOf, roadmapTasks } from '@/domain/roadmap';
import { minutesPerStudyDay, projectedEnd } from '@/domain/schedule';
import { addDays, formatMinutes, formatShort, today } from '@/lib/date';
import { useApp, type CreateResult } from '@/store/AppStore';
import type { RoadmapInput } from '@/types';
import { alpha, useTheme } from '~/theme';
import { Button, IconButton } from '~/ui/Button';
import { Card, Divider } from '~/ui/Card';
import { OptionTile } from '~/ui/Chip';
import { DateStepper, Input, Label } from '~/ui/Field';
import { ProgressBar } from '~/ui/Progress';
import { Text } from '~/ui/Text';

const GOALS = ['Vaga de Back-end Java Pleno', 'Inglês fluente para entrevistas', 'Migrar para Ciência de Dados', 'Dominar React e TypeScript', 'Portfólio de Product Design'];
const LEVELS = [
  { id: 'zero', emoji: '🌱', title: 'Começando do zero', text: 'Iniciante, começando do zero.' },
  { id: 'basic', emoji: '📘', title: 'Tenho o básico', text: 'Tenho noções básicas, mas sem prática real.' },
  { id: 'mid', emoji: '🛠️', title: 'Intermediário', text: 'Nível intermediário, já pratiquei em projetos.' },
  { id: 'adv', emoji: '🚀', title: 'Avançado', text: 'Avançado, já trabalho com isso e quero aprofundar.' },
];
const DEADLINES = [
  { label: '1 mês', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 ano', days: 365 },
];
const LOADING = ['Analisando seu objetivo', 'Mapeando o que você já sabe', 'Estruturando fases e tópicos', 'Distribuindo tarefas no calendário'];

type Step = 0 | 1 | 2 | 3 | 'loading' | 'done';

export default function GeneratorScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { generateRoadmap, deleteRoadmap, profile } = useApp();
  const [step, setStep] = useState<Step>(0);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [levelDetail, setLevelDetail] = useState('');
  const [input, setInput] = useState<RoadmapInput>({ goal: '', currentLevel: '', hoursPerWeek: 6, deadline: addDays(today(), 90) });
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [li, setLi] = useState(0);

  useEffect(() => {
    if (step !== 'loading') return;
    const id = setInterval(() => setLi((i) => Math.min(LOADING.length - 1, i + 1)), 450);
    return () => clearInterval(id);
  }, [step]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const currentLevel = [LEVELS.find((l) => l.id === levelId)?.text, levelDetail.trim()].filter(Boolean).join(' ');

  const run = async () => {
    setLi(0);
    setStep('loading');
    setError(null);
    try {
      if (result) deleteRoadmap(result.roadmap.id);
      setResult(await generateRoadmap({ ...input, goal: input.goal.trim(), currentLevel }));
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar roadmap');
      setStep(3);
    }
  };

  const canNext = step === 0 ? input.goal.trim().length >= 3 : step === 1 ? !!levelId || levelDetail.trim().length > 2 : step === 3 ? input.deadline > today() : true;
  const idx = typeof step === 'number' ? step : 4;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, height: 52 }}>
        <IconButton label="Fechar" onPress={close}>
          <X size={22} color={c.muted} />
        </IconButton>
        <ProgressBar value={idx / 4} color={c.accent} />
        <View style={{ width: 16 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 }}>
        {step === 0 && (
          <StepShell title="Qual é o seu objetivo principal?" subtitle="Seja específico: cargo, certificação, habilidade ou resultado.">
            <Input
              autoFocus
              multiline
              maxLength={160}
              value={input.goal}
              onChangeText={(v) => setInput({ ...input, goal: v })}
              placeholder="Ex.: Conseguir minha primeira vaga como dev back-end Java"
              style={{ minHeight: 110, fontSize: 17 }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {GOALS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setInput({ ...input, goal: g })}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: input.goal === g ? c.accent : c.line, backgroundColor: input.goal === g ? alpha(c.accent, 0.15) : 'transparent' }}
                >
                  <Text variant="small" tone={input.goal === g ? 'fg' : 'muted'}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="Qual é a sua base atual?" subtitle="A IA pula o que você já domina.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LEVELS.map((l) => (
                <View key={l.id} style={{ width: '48.5%' }}>
                  <OptionTile selected={levelId === l.id} onPress={() => setLevelId(l.id)}>
                    <Text style={{ fontSize: 26, lineHeight: 32 }}>{l.emoji}</Text>
                    <Text style={{ fontWeight: '700', marginTop: 6 }}>{l.title}</Text>
                  </OptionTile>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 16 }}>
              <Label hint="opcional">O que você já sabe?</Label>
              <Input multiline value={levelDetail} onChangeText={setLevelDetail} placeholder="Ex.: Sei Java e SQL básicos, nunca usei Spring." />
            </View>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Quanto tempo você tem?" subtitle="Seja realista — consistência vence intensidade.">
            <Card style={{ padding: 20, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <IconButton label="Menos" size={48} disabled={input.hoursPerWeek <= 1} onPress={() => setInput({ ...input, hoursPerWeek: input.hoursPerWeek - 1 })}>
                  <Text style={{ fontSize: 28, fontWeight: '700' }}>−</Text>
                </IconButton>
                <Text style={{ fontSize: 48, fontWeight: '800', letterSpacing: -1, minWidth: 70, textAlign: 'center' }}>{input.hoursPerWeek}</Text>
                <IconButton label="Mais" size={48} disabled={input.hoursPerWeek >= 40} onPress={() => setInput({ ...input, hoursPerWeek: input.hoursPerWeek + 1 })}>
                  <Text style={{ fontSize: 28, fontWeight: '700' }}>+</Text>
                </IconButton>
              </View>
              <Text tone="muted" style={{ fontWeight: '600' }}>horas por semana</Text>
              <Text variant="small" tone="subtle" style={{ marginTop: 8 }}>
                ≈ {formatMinutes(minutesPerStudyDay(input.hoursPerWeek, profile.studyDays))} por dia em {profile.studyDays.length} dias de estudo
              </Text>
            </Card>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[3, 5, 8, 12].map((h) => (
                <View key={h} style={{ flex: 1 }}>
                  <OptionTile selected={input.hoursPerWeek === h} onPress={() => setInput({ ...input, hoursPerWeek: h })}>
                    <Text style={{ fontWeight: '700', textAlign: 'center' }}>{h}h</Text>
                  </OptionTile>
                </View>
              ))}
            </View>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Até quando?" subtitle="O prazo define o ritmo e a profundidade do roadmap.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DEADLINES.map((d) => {
                const date = addDays(today(), d.days);
                return (
                  <View key={d.label} style={{ width: '48.5%' }}>
                    <OptionTile selected={input.deadline === date} onPress={() => setInput({ ...input, deadline: date })}>
                      <Text style={{ fontWeight: '700' }}>{d.label}</Text>
                      <Text variant="caption" tone="muted">{formatShort(date)}</Text>
                    </OptionTile>
                  </View>
                );
              })}
            </View>
            <View style={{ marginTop: 16 }}>
              <Label hint="±1 semana">Ajustar data</Label>
              <DateStepper value={input.deadline} step={7} min={addDays(today(), 7)} onChange={(v) => setInput({ ...input, deadline: v })} />
            </View>
            {error && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: alpha(c.danger, 0.1) }}>
                <AlertTriangle size={16} color={c.danger} />
                <Text variant="small" tone="danger" style={{ flex: 1 }}>{error}</Text>
              </View>
            )}
          </StepShell>
        )}

        {step === 'loading' && <Loading index={li} />}
        {step === 'done' && result && <Preview result={result} />}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16), paddingTop: 8, gap: 4 }}>
        {typeof step === 'number' && (
          <>
            <Button variant="primary" size="lg" block disabled={!canNext} onPress={() => (step === 3 ? run() : setStep((step + 1) as Step))} icon={step === 3 ? <Sparkles size={18} color="#fff" /> : undefined}>
              {step === 3 ? 'Gerar roadmap' : 'Continuar'}
            </Button>
            {step > 0 && <Button variant="ghost" block onPress={() => setStep((step - 1) as Step)}>Voltar</Button>}
          </>
        )}
        {step === 'done' && result && (
          <>
            <Button variant="success" size="lg" block onPress={() => router.replace(`/roadmap/${result.roadmap.id}`)} icon={<ArrowRight size={18} color="#fff" />}>
              Começar trilha
            </Button>
            <Button variant="ghost" block icon={<RotateCcw size={16} color={c.muted} />} onPress={run}>Gerar novamente</Button>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View style={{ paddingTop: 16, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <Text variant="h2" style={{ fontSize: 24, lineHeight: 30 }}>{title}</Text>
      {subtitle && <Text variant="small" tone="muted" style={{ marginTop: 6 }}>{subtitle}</Text>}
      <View style={{ marginTop: 24 }}>{children}</View>
    </Animated.View>
  );
}

function Loading({ index }: { index: number }) {
  const { c } = useTheme();
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
      <View style={{ width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: alpha(c.accent, 0.25),
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) }],
          }}
        />
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={34} color="#fff" />
        </View>
      </View>
      <Text variant="h2" style={{ fontSize: 20 }}>Montando sua trilha…</Text>
      <View style={{ marginTop: 20, gap: 10 }}>
        {LOADING.map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: i <= index ? 1 : 0.3 }}>
            {i < index ? <Check size={16} color={c.success} /> : i === index ? <ActivityIndicator size="small" color={c.accent} /> : <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.line }} />}
            <Text variant="small">{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Preview({ result }: { result: CreateResult }) {
  const { c } = useTheme();
  const r = result.roadmap;
  const prog = progressOf(roadmapTasks(r));
  const end = projectedEnd(r);
  return (
    <View style={{ paddingTop: 16 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44, lineHeight: 52 }}>{r.emoji}</Text>
        </View>
        <Text variant="h2" style={{ marginTop: 16, textAlign: 'center' }}>{r.title}</Text>
        <Text variant="small" tone="muted" style={{ marginTop: 4 }}>Gerado por {result.providerLabel}</Text>
      </View>
      {result.fallbackReason && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: alpha(c.warning, 0.12) }}>
          <AlertTriangle size={15} color={c.warning} />
          <Text variant="caption" style={{ color: c.warning, flex: 1 }}>O provedor de IA falhou ({result.fallbackReason.slice(0, 90)}). Usamos o Mock Inteligente.</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
        <Metric icon={<Layers size={16} color={c.accent} />} value={String(r.phases.length)} label="fases" />
        <Metric icon={<ListChecks size={16} color={c.accent} />} value={String(prog.total)} label="tarefas" />
        <Metric icon={<Clock size={16} color={c.accent} />} value={formatMinutes(prog.minutesTotal)} label="no total" />
      </View>
      <Card style={{ marginTop: 16 }}>
        {r.phases.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="caption" tone="muted" style={{ fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{p.title}</Text>
                <Text variant="caption" tone="subtle" numberOfLines={1}>{p.topics.map((t) => t.title).join(' · ')}</Text>
              </View>
            </View>
          </Fragment>
        ))}
      </Card>
      {end && (
        <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          Término previsto em {formatShort(end)} · prazo {formatShort(r.deadline)}
        </Text>
      )}
    </View>
  );
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
      {icon}
      <Text style={{ fontSize: 17, fontWeight: '800', marginTop: 4 }}>{value}</Text>
      <Text variant="caption" tone="subtle">{label}</Text>
    </View>
  );
}
