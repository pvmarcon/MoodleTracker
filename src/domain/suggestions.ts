import { addDays, diffDays, isoDay, today as todayISO } from '@/lib/date';
import { detectDomain } from '@/services/ai/knowledge';
import type { Profile, Roadmap, Suggestion } from '@/types';
import { currentPhaseIndex, flattenRoadmap, isPhaseComplete, phaseTasks, progressOf } from './roadmap';
import { observedPace, minutesPerStudyDay } from './schedule';

/**
 * Rule-based proactive engine ("Próximos Passos Sugeridos"). Deterministic ids
 * let the user dismiss a suggestion without it coming back until the context
 * changes (e.g. a new phase starts).
 */
export const buildSuggestions = (roadmaps: Roadmap[], profile: Profile, ref = todayISO()): Suggestion[] => {
  const out: Suggestion[] = [];
  const active = roadmaps.filter((r) => r.status === 'active');

  for (const r of active) {
    const flat = flattenRoadmap(r);
    const pending = flat.filter((x) => !x.task.completedAt);
    if (!pending.length) continue;

    const ci = currentPhaseIndex(r);
    const phase = r.phases[ci];
    const domain = detectDomain(r.goal);

    // 1. Behind schedule -> recalibrate.
    const overdue = pending.filter((x) => x.task.dueDate && x.task.dueDate < ref);
    if (overdue.length) {
      out.push({
        id: `recalibrate:${r.id}:${ref}`,
        kind: 'recalibrate',
        roadmapId: r.id,
        title: `${overdue.length} ${overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} em ${r.title}`,
        body: 'Recalibre o roadmap para redistribuir as tarefas a partir de hoje sem sobrecarregar seus dias.',
        score: 90 + overdue.length,
      });
    }

    // 2. Pace check against plan.
    const planned = minutesPerStudyDay(r.hoursPerWeek, profile.studyDays);
    const observed = observedPace(r, profile.studyDays, 14, ref);
    const ageDays = diffDays(isoDay(r.createdAt) ?? ref, ref);
    if (ageDays >= 7 && observed > 0 && observed < planned * 0.6) {
      out.push({
        id: `pace-slow:${r.id}:${phase?.id}`,
        kind: 'pace',
        roadmapId: r.id,
        title: 'Seu ritmo está abaixo do planejado',
        body: `Média de ${Math.round(observed)} min por dia de estudo vs ${planned} planejados. Ajuste a carga semanal ou foque em tarefas de baixa energia.`,
        score: 70,
      });
    } else if (observed > planned * 1.3) {
      out.push({
        id: `pace-fast:${r.id}:${phase?.id}`,
        kind: 'pace',
        roadmapId: r.id,
        title: 'Você está adiantado! 🚀',
        body: 'Seu ritmo está acima do plano. Recalibre para antecipar o prazo ou adicione um desafio extra.',
        score: 55,
      });
    }

    if (!phase) continue;
    const prog = progressOf(phaseTasks(phase));
    const hasPendingProject = phaseTasks(phase).some((t) => t.kind === 'project' && !t.completedAt);

    // 3. Phase almost done -> practical project to cement it.
    if (prog.ratio >= 0.5 && !hasPendingProject) {
      const idea = domain.projectIdeas[ci % domain.projectIdeas.length];
      out.push({
        id: `project:${r.id}:${phase.id}`,
        kind: 'project',
        roadmapId: r.id,
        phaseId: phase.id,
        title: `Projeto prático: ${idea}`,
        body: `Você já concluiu ${Math.round(prog.ratio * 100)}% de "${phase.title}". Um projeto curto transforma teoria em portfólio.`,
        task: { title: `Mini projeto: ${idea}`, kind: 'project', priority: 'high', energy: 'high', estimatedMinutes: 120 },
        score: 75,
      });
    }

    // 4. Recently finished phase -> spaced review.
    const prev = r.phases[ci - 1];
    if (prev && isPhaseComplete(prev)) {
      const last = phaseTasks(prev)
        .map((t) => isoDay(t.completedAt)!)
        .sort()
        .at(-1)!;
      if (last >= addDays(ref, -10)) {
        out.push({
          id: `review:${r.id}:${prev.id}`,
          kind: 'review',
          roadmapId: r.id,
          phaseId: phase.id,
          title: `Revisão espaçada: ${prev.title}`,
          body: 'Revisar 3–7 dias depois de concluir uma fase aumenta muito a retenção. 25 minutos bastam.',
          task: { title: `Revisão ativa: ${prev.title}`, kind: 'review', priority: 'medium', energy: 'low', estimatedMinutes: 25 },
          score: 65,
        });
      }
    }

    // 5. Next correlated topic once the roadmap is well underway.
    const overall = progressOf(flat.map((x) => x.task));
    if (overall.ratio >= 0.25) {
      const rel = domain.related[Math.floor(overall.ratio * 10) % domain.related.length];
      out.push({
        id: `related:${r.id}:${rel}`,
        kind: 'next-topic',
        roadmapId: r.id,
        phaseId: r.phases.at(-1)?.id,
        title: `Tema correlato: ${rel}`,
        body: `Combina com "${r.title}" e costuma aparecer em vagas e projetos. Adicione uma introdução ao final da trilha.`,
        task: { title: `Explorar ${rel} (introdução)`, kind: 'study', priority: 'low', energy: 'medium', estimatedMinutes: 45 },
        score: 40 + Math.round(overall.ratio * 10),
      });
    }

    // 6. Get ahead: next task when nothing is due today.
    const dueToday = pending.some((x) => x.task.dueDate && x.task.dueDate <= ref && x.phaseIndex <= ci);
    if (!dueToday) {
      const n = pending[0];
      out.push({
        id: `ahead:${r.id}:${n.task.id}`,
        kind: 'next-topic',
        roadmapId: r.id,
        title: `Adiante: ${n.task.title}`,
        body: `Nada pendente hoje em ${r.title}. Que tal começar o próximo passo de "${n.topic.title}"?`,
        score: 50,
      });
    }
  }

  // Habit nudge: nothing done today yet.
  const doneToday = active.some((r) => flattenRoadmap(r).some((x) => isoDay(x.task.completedAt) === ref));
  if (!doneToday && active.length) {
    out.push({
      id: `habit:${ref}`,
      kind: 'habit',
      title: 'Comece pequeno',
      body: 'Uma tarefa de baixa energia já mantém sua sequência viva. Filtre por energia baixa na aba Hoje.',
      score: 60,
    });
  }

  return out.sort((a, b) => b.score - a.score);
};
