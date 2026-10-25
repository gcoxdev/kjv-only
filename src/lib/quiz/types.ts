export type QuizSkill = "Comprehension" | "Vocabulary" | "Structure" | "Sequence" | "Family" | "Geography";
export type QuizKind = "choice" | "text" | "order" | "timeline" | "family" | "match" | "map";
export type QuizDifficulty = "Easy" | "Medium" | "Hard";
export type QuizAnswer = string | string[];
export type QuizReference = { book: string; chapter: number; label: string; verses: { number: number; text: string }[] };
export type QuizQuestion = {
  id: string; objective: string; version: number; book: string; chapter: number;
  testament: "OT" | "NT"; scopeLevel: "chapter" | "testament" | "bible";
  prompt: string; answer: QuizAnswer; kind: QuizKind; difficulty: QuizDifficulty; skill: QuizSkill;
  refs: QuizReference[]; contexts: { book: string; chapter: number }[]; choices: string[];
  explanation: string; conflicts: string[]; slots?: string[]; evidence?: string; measure?: string;
  places?: { name: string; lon: number; lat: number; sourceId: string }[]; mapLabels?: string[];
};
export type QuizBank = { version: string; books: string[]; featured: { book: string; chapter: number }[]; questions: QuizQuestion[] };
export type QuizFilters = { scope: "chapter" | "book" | "OT" | "NT" | "bible"; book: string; chapter: number; skill: QuizSkill | "all"; difficulty: QuizDifficulty | "all"; readOnly: boolean };
export type QuizEntry = { id: string; version: number; answer: QuizAnswer; initial: QuizAnswer; choices: string[]; submitted: boolean; assisted: boolean; skipped: boolean; help: "none" | "passage" | "answer" };
export type QuizSession = {
  id: string; bank: string; label: string; mode: "practice" | "assessment"; index: number;
  entries: QuizEntry[]; done: boolean; created: number; updated: number;
  owner: string | null; leaseUntil: number;
};
export type QuizAttempt = { id: string; session: string; qid: string; objective: string; version: number; answer: QuizAnswer; correct: boolean; assisted: boolean; skipped: boolean; time: number; points: number };
export type QuizSnapshot = { sessions: QuizSession[]; attempts: QuizAttempt[] };
export type QuizBackup = QuizSnapshot & { type: "kjv-only-quiz"; schema: 1; bank: string; exported: string };
export type QuizAction =
  | { type: "answer"; qid: string; answer: QuizAnswer }
  | { type: "help"; qid: string; help: "passage" | "answer" }
  | { type: "submit"; qid: string; answer: QuizAnswer; skip?: boolean }
  | { type: "navigate"; index: number }
  | { type: "finish" };
