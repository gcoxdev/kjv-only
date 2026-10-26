import { QUIZ_SKILLS, quizObjectives, quizStats } from "./engine";
import type { QuizAttempt, QuizBank, QuizQuestion, QuizSession } from "./types";

const DAY = 86_400_000;
// Compare calendar days, not elapsed hours: DST days can be 23 or 25 hours long.
function localDay(time: number) {
  const date = new Date(time);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}
export function quizPracticeStreak(attempts: readonly QuizAttempt[], now = Date.now()) {
  const today = localDay(now);
  const days = [...new Set(attempts.filter(a => !a.skipped && a.time <= now && Number.isFinite(a.time) &&
    (typeof a.answer === "string" ? !!a.answer.trim() : a.answer.length > 0 && a.answer.every(part => !!part.trim())))
    .map(a => localDay(a.time)).filter(Number.isFinite))].sort((a, b) => a - b);
  let best = 0, run = 0;
  days.forEach((day, i) => { run = i > 0 && day === days[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
  const last = days.at(-1);
  return { current: last !== undefined && last >= today - 1 ? run : 0, best, totalDays: days.length, practicedToday: last === today };
}

export const QUIZ_MILESTONE_TARGETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
export function quizRewardMilestones(questions: readonly QuizQuestion[], stats: ReturnType<typeof quizStats>) {
  const objectives = quizObjectives(questions);
  return [...Object.entries(QUIZ_SKILLS), ["Memory", "Verse memory"]].map(([id, label]) => {
    const group = objectives.filter(q => id === "Memory" ? q.kind === "memory" : q.skill === id);
    const learned = group.filter(q => stats.get(q.objective)?.learned).length;
    const mastered = group.filter(q => stats.get(q.objective)?.mastered).length;
    const targets = QUIZ_MILESTONE_TARGETS.filter(n => n <= group.length);
    return { id, label, total: group.length, learned, mastered,
      learnedTarget: targets.filter(n => n <= learned).at(-1) ?? 0,
      masteredTarget: targets.filter(n => n <= mastered).at(-1) ?? 0,
      nextLearned: targets.find(n => n > learned), nextMastered: targets.find(n => n > mastered) };
  }).filter(group => group.total > 0);
}

export type QuizCompletionReward = { sessionId: string; learned: number; mastered: number; recalled: number };
export function quizCompletionReward(bank: QuizBank, session: QuizSession, attempts: QuizAttempt[], now = Date.now()): QuizCompletionReward | null {
  if (!session.done) return null;
  const successful = new Set(attempts.filter(a => a.session === session.id && a.correct && !a.assisted && !a.skipped).map(a => a.objective));
  if (!successful.size) return null;
  const after = quizStats(bank, attempts, now);
  const objectives = [...successful].filter(id => after.has(id));
  if (!objectives.length) return null;
  // Attribute each achievement to the attempt that actually earned it. Another
  // panel may have practiced the same objective while this session stayed open.
  let learned = 0, mastered = 0;
  for (const id of objectives) {
    const successes = after.get(id)!.attempts.filter(a => a.correct && !a.assisted && !a.skipped);
    const first = successes[0];
    if (!first) continue;
    learned += Number(first.session === session.id);
    const mastery = successes.find(a => a.session !== first.session && a.time - first.time >= 7 * DAY);
    mastered += Number(mastery?.session === session.id);
  }
  return { sessionId: session.id, recalled: objectives.length,
    learned, mastered };
}
