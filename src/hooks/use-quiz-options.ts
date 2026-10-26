import { useSyncedStorage } from "@/hooks/use-synced-storage";
import { mergeStoredFields } from "@/lib/synced-storage";
import { DEFAULT_QUIZ_OPTIONS, parseQuizPracticeOptions } from "@/lib/quiz/reading";
import type { QuizPracticeOptions } from "@/lib/quiz/types";

export function useQuizOptions() {
  return useSyncedStorage("kjv-quiz-options-v1", {
    parse: raw => parseQuizPracticeOptions(raw === null ? null : JSON.parse(raw)),
    stringify: JSON.stringify,
  }, mergeStoredFields<QuizPracticeOptions>, DEFAULT_QUIZ_OPTIONS);
}
