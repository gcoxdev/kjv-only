import type { QuizMapRegion } from "./map-regions";

export type QuizSkill = "Comprehension" | "Vocabulary" | "Structure" | "Sequence" | "Family" | "Geography";
export type QuizKind = "choice" | "text" | "order" | "timeline" | "family" | "match" | "map";
export type QuizDifficulty = "Easy" | "Medium" | "Hard";
export type QuizAnswer = string | string[];
export type QuizReference = { book: string; chapter: number; label: string; verses: { number: number; text: string }[] };
export type QuizQuestion = {
  id: string; objective: string; version: number; book: string; chapter: number;
  testament: "OT" | "NT"; scopeLevel: "chapter" | "book" | "testament" | "bible";
  prompt: string; answer: QuizAnswer; kind: QuizKind; difficulty: QuizDifficulty; skill: QuizSkill;
  refs: QuizReference[]; contexts: { book: string; chapter: number }[]; choices: string[];
  explanation: string; conflicts: string[]; slots?: string[]; evidence?: string; measure?: string;
  previousLearningPoints?: number[];
  places?: { name: string; lon: number; lat: number; sourceId: string }[]; mapLabels?: string[]; mapRegion?: QuizMapRegion;
};
export type QuizBank = { version: string; books: string[]; featured: { book: string; chapter: number }[]; questions: QuizQuestion[] };
export type QuizFilters = { scope: "chapter" | "book" | "OT" | "NT" | "bible"; book: string; chapter: number; skill: QuizSkill | "all"; difficulty: QuizDifficulty | "all"; readOnly: boolean; content?: "all" | "connections" };
export type QuizEntry = { id: string; version: number; answer: QuizAnswer; initial: QuizAnswer; choices: string[]; submitted: boolean; assisted: boolean; skipped: boolean; help: "none" | "passage" | "answer" };
export type QuizSession = {
  id: string; bank: string; label: string; mode: "practice" | "assessment"; index: number;
  entries: QuizEntry[]; done: boolean; created: number; updated: number;
  owner: string | null; leaseUntil: number;
};
export type QuizAttempt = { id: string; session: string; qid: string; objective: string; version: number; answer: QuizAnswer; correct: boolean; assisted: boolean; skipped: boolean; time: number; points: number; reviewScheduleVersion?: 2 };
export type QuizAfterReadingMode = "off" | "chapter" | "milestones";
export type QuizPracticeOptions = Pick<QuizFilters, "skill" | "difficulty" | "readOnly"> & { length: 5 | 10 | 20 | 30; mode: QuizSession["mode"] };
export type QuizReadingRequest = { id: string; bookIndex: number; chapterIndex: number; mode: Exclude<QuizAfterReadingMode, "off"> };
export type QuizReadingFlow = QuizReadingRequest & {
  options: QuizPracticeOptions; created: number; closed: boolean;
  steps: { scope: QuizFilters["scope"]; sessionId: string | null; skipped: false | "reader" | "empty" }[];
};
export type QuizSnapshot = { sessions: QuizSession[]; attempts: QuizAttempt[]; readingFlows?: QuizReadingFlow[] };
export type QuizBackup = QuizSnapshot & { type: "kjv-only-quiz"; schema: 1; bank: string; exported: string };
export type QuizAction =
  | { type: "answer"; qid: string; answer: QuizAnswer }
  | { type: "help"; qid: string; help: "passage" | "answer" }
  | { type: "submit"; qid: string; answer: QuizAnswer; skip?: boolean }
  | { type: "navigate"; index: number }
  | { type: "finish" };
