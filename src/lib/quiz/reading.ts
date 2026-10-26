import { BIBLE_BOOKS } from "@/lib/bible-books";
import { createQuizSession, filterQuizQuestions, selectQuizQuestions } from "./engine";
import type { QuizAfterReadingMode, QuizBank, QuizFilters, QuizPracticeOptions, QuizReadingFlow, QuizReadingRequest, QuizSession, QuizSnapshot } from "./types";

export const DEFAULT_QUIZ_OPTIONS: QuizPracticeOptions = { skill: "all", difficulty: "all", readOnly: false, length: 10, mode: "practice" };
export function parseQuizPracticeOptions(value: unknown): QuizPracticeOptions {
  const v = value && typeof value === "object" ? value as Partial<QuizPracticeOptions> : {};
  return {
    skill: ["all", "Comprehension", "Vocabulary", "Structure", "Sequence", "Family", "Geography"].includes(v.skill ?? "") ? v.skill! : "all",
    difficulty: ["all", "Easy", "Medium", "Hard"].includes(v.difficulty ?? "") ? v.difficulty! : "all",
    readOnly: v.readOnly === true,
    length: [5, 10, 20, 30].includes(v.length ?? 0) ? v.length! : 10,
    mode: v.mode === "assessment" ? "assessment" : "practice",
  };
}
export function readingQuizScopes(bookIndex: number, chapterIndex: number, mode: QuizAfterReadingMode): QuizFilters["scope"][] {
  const book = BIBLE_BOOKS[bookIndex];
  if (!Number.isInteger(bookIndex) || !Number.isInteger(chapterIndex) || !book || chapterIndex < 0 || chapterIndex >= book.chapterCount) throw new Error("Invalid reading quiz chapter.");
  if (mode === "off") return [];
  const scopes: QuizFilters["scope"][] = ["chapter"];
  if (mode === "milestones" && chapterIndex === book.chapterCount - 1) {
    scopes.push("book");
    if (bookIndex === 38) scopes.push("OT");
    if (bookIndex === 65) scopes.push("NT", "bible");
  }
  return scopes;
}
export function newReadingQuizFlow(request: QuizReadingRequest, options: QuizPracticeOptions, now = Date.now()): QuizReadingFlow {
  return { ...request, options: { ...options }, created: now, closed: false, steps: readingQuizScopes(request.bookIndex, request.chapterIndex, request.mode).map(scope => ({ scope, sessionId: null, skipped: false })) };
}
export function readingQuizFilters(flow: QuizReadingFlow, scope: QuizFilters["scope"]): QuizFilters {
  return { ...flow.options, scope, book: BIBLE_BOOKS[flow.bookIndex].name, chapter: flow.chapterIndex + 1 };
}
export function readingQuizStepLabel(flow: QuizReadingFlow, scope: QuizFilters["scope"]) {
  const book = BIBLE_BOOKS[flow.bookIndex].name;
  return scope === "chapter" ? `${book} ${flow.chapterIndex + 1}` : scope === "book" ? book : scope === "OT" ? "Old Testament" : scope === "NT" ? "New Testament" : "Whole Bible";
}
export function nextReadingQuizStep(flow: QuizReadingFlow, sessions: readonly QuizSession[]) {
  if (flow.closed) return -1;
  const done = new Set(sessions.filter(s => s.done).map(s => s.id));
  return flow.steps.findIndex(step => !step.skipped && (!step.sessionId || !done.has(step.sessionId)));
}
export function enqueueReadingQuiz(state: QuizSnapshot, request: QuizReadingRequest, options: QuizPracticeOptions, now = Date.now()) {
  state.readingFlows ??= [];
  // The ID handles a repeated request; the origin handles simultaneous requests
  // from different windows. A completed/dismissed sequence can be offered again.
  const existing = state.readingFlows.find(f => f.id === request.id) ?? state.readingFlows.find(f => f.bookIndex === request.bookIndex && f.chapterIndex === request.chapterIndex && nextReadingQuizStep(f, state.sessions) >= 0);
  if (existing) return { flow: existing, created: false };
  const flow = newReadingQuizFlow(request, options, now);
  state.readingFlows.push(flow);
  return { flow, created: true };
}
export function prepareReadingQuizStep(bank: QuizBank, state: QuizSnapshot, flow: QuizReadingFlow, expectedStep: number, owner: string, readChapters: ReadonlySet<string>) {
  let index = nextReadingQuizStep(flow, state.sessions);
  if (index < 0 || index !== expectedStep) throw new Error("This reading sequence changed in another view. Reopen it to continue.");
  while (index >= 0) {
    const step = flow.steps[index];
    if (step.sessionId) return step.sessionId;
    const pool = filterQuizQuestions(bank, readingQuizFilters(flow, step.scope), readChapters);
    const picked = selectQuizQuestions(bank, pool, state.attempts, flow.options.length);
    if (picked.length) {
      const session = createQuizSession(bank, picked, `${readingQuizStepLabel(flow, step.scope)} · reading quiz`, flow.options.mode, owner);
      step.sessionId = session.id;
      state.sessions.push(session);
      return session.id;
    }
    step.skipped = "empty";
    index = nextReadingQuizStep(flow, state.sessions);
  }
  return null;
}
export function skipReadingQuizStep(state: QuizSnapshot, flow: QuizReadingFlow, expectedStep: number, owner: string, now = Date.now()) {
  const index = nextReadingQuizStep(flow, state.sessions);
  if (index < 0 || index !== expectedStep) throw new Error("This reading sequence changed in another view. Reopen it to continue.");
  const session = state.sessions.find(s => s.id === flow.steps[index].sessionId);
  if (session?.owner && session.owner !== owner && session.leaseUntil > now) throw new Error("This quiz is open elsewhere. Resume or take over before skipping it.");
  if (session) { session.owner = null; session.leaseUntil = 0; }
  // Keep partial work independently resumable, without inventing wrong attempts.
  flow.steps[index].skipped = "reader";
}
export function validReadingFlows(value: unknown, sessions: readonly QuizSession[]): value is QuizReadingFlow[] | undefined {
  if (value === undefined) return true; // Existing schema-1 exports have no queues.
  if (!Array.isArray(value) || value.length > 20_000) return false;
  const ids = new Set<string>(), linked = new Set<string>(), sessionIds = new Set(sessions.map(s => s.id));
  const done = new Set(sessions.filter(s => s.done).map(s => s.id));
  return value.every(flow => {
    if (!flow || typeof flow !== "object" || typeof flow.id !== "string" || !flow.id || flow.id.length > 200 || ids.has(flow.id) || !["chapter", "milestones"].includes(flow.mode) || typeof flow.closed !== "boolean" || !Number.isFinite(flow.created) || flow.created <= 0) return false;
    ids.add(flow.id);
    let scopes;
    try { scopes = readingQuizScopes(flow.bookIndex, flow.chapterIndex, flow.mode); } catch { return false; }
    const options = parseQuizPracticeOptions(flow.options);
    if (!flow.options || Object.entries(options).some(([key, v]) => flow.options[key] !== v) || !Array.isArray(flow.steps) || flow.steps.length !== scopes.length) return false;
    let blocked = false;
    return flow.steps.every((step: QuizReadingFlow["steps"][number], i: number) => {
      if (!step || step.scope !== scopes[i] || ![false, "reader", "empty"].includes(step.skipped) || (step.sessionId !== null && (typeof step.sessionId !== "string" || !sessionIds.has(step.sessionId) || linked.has(step.sessionId))) || (step.skipped === "empty" && step.sessionId !== null)) return false;
      if (blocked && (step.sessionId || step.skipped)) return false;
      if (!step.skipped && (!step.sessionId || !done.has(step.sessionId))) blocked = true;
      if (step.sessionId) linked.add(step.sessionId);
      return true;
    });
  });
}
