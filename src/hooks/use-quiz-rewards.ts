import { useSyncExternalStore } from "react";
import { createSyncedStorage, mergeStoredFields } from "@/lib/synced-storage";
import { DEFAULT_QUIZ_REWARDS, parseQuizRewardPreferences, type QuizRewardPreferences } from "@/lib/quiz/reward-preferences";

// One store per window keeps Settings, panels, and reward controls in sync even
// though browsers send native storage events only to other windows.
const store = createSyncedStorage("kjv-quiz-rewards-v1", {
  parse: raw => parseQuizRewardPreferences(raw === null ? null : JSON.parse(raw)),
  stringify: JSON.stringify,
}, mergeStoredFields<QuizRewardPreferences>, DEFAULT_QUIZ_REWARDS);

export function useQuizRewards() {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, () => DEFAULT_QUIZ_REWARDS);
  return [value, store.update] as const;
}
