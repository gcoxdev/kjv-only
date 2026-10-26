import type { QuizAttempt } from "./types";

export const DAY = 86_400_000;
const INTERVALS = [1, 7, 30] as const;
export type QuizReviewReason = "scheduled" | "mistake" | "assisted" | "skipped";

// Replay chronological evidence. Early practice must not advance or postpone a
// scheduled review; recovering after a lapse starts again at the one-day step.
// Earned mastery is calculated separately and is never revoked by this schedule.
export function quizReviewSchedule(history: readonly QuizAttempt[], now: number) {
  let dueAt: number | null = null;
  let step = 0;
  let reason: QuizReviewReason | null = null;
  let lastReviewSession: string | null = null;
  for (const attempt of history) {
    if (attempt.skipped || !attempt.correct || attempt.assisted) {
      dueAt = attempt.time;
      step = 0;
      reason = attempt.skipped ? "skipped" : !attempt.correct ? "mistake" : "assisted";
    } else if (dueAt === null || reason !== "scheduled") {
      dueAt = attempt.time + DAY;
      lastReviewSession = attempt.session;
      reason = "scheduled";
    } else if (attempt.time >= dueAt && attempt.session !== lastReviewSession) {
      step = Math.min(step + 1, INTERVALS.length - 1);
      dueAt = attempt.time + INTERVALS[step] * DAY;
      lastReviewSession = attempt.session;
    }
  }
  return { dueAt, due: dueAt !== null && dueAt <= now, reviewReason: reason, reviewIntervalDays: dueAt === null || reason !== "scheduled" ? null : INTERVALS[step] };
}

// Schema-1 backups predate the spaced-review scheduler. Only replay uses this
// policy, so importing an older valid award does not silently remove its points.
export function legacyQuizReviewDue(history: readonly QuizAttempt[], now: number) {
  const successes = history.filter(a => a.correct && !a.assisted);
  const first = successes[0], last = history.at(-1);
  const mastered = !!first && successes.some(a => a.session !== first.session && a.time - first.time >= 7 * DAY);
  return !!last && (!last.correct || last.assisted || now - last.time >= (mastered ? 30 : successes.length > 1 ? 7 : 1) * DAY);
}
