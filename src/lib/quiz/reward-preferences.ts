export type QuizRewardPreferences = { showStreak: boolean; celebrations: boolean };
export const DEFAULT_QUIZ_REWARDS: QuizRewardPreferences = { showStreak: false, celebrations: false };
export function parseQuizRewardPreferences(value: unknown): QuizRewardPreferences {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { showStreak: record.showStreak === true, celebrations: record.celebrations === true };
}
