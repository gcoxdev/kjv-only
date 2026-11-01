import { applyQuizAction, DAY, gradeQuizEntry, rebuildQuizAttempts, validQuizAnswer, validQuizEntryAnswer } from "./engine";
import { record, strings } from "./data";
import { enqueueReadingQuiz, nextReadingQuizStep, prepareReadingQuizStep, skipReadingQuizStep, validReadingFlows } from "./reading";
import type { QuizAction, QuizAttempt, QuizBackup, QuizBank, QuizPracticeOptions, QuizReadingFlow, QuizReadingRequest, QuizSession, QuizSnapshot } from "./types";
const DATABASE = "kjv-only-quiz-v1";
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => { for (const name of ["sessions", "attempts", "readingFlows"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" }); };
    request.onerror = () => reject(new Error("Quiz storage is unavailable. Your existing data has not been changed."));
    request.onblocked = () => reject(new Error("Close other app windows and retry opening quiz storage."));
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); database = undefined; }; resolve(db); };
  }).catch(error => { database = undefined; throw error; });
}
const listeners = new Set<() => void>();
const channel = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(DATABASE) : null;
function notify() { for (const listener of listeners) listener(); }
channel?.addEventListener("message", notify);
export function subscribeQuiz(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function readStore<T>(store: IDBObjectStore): Promise<T[]> { return new Promise((resolve, reject) => { const request = store.getAll(); request.onsuccess = () => resolve(request.result as T[]); request.onerror = () => reject(request.error); }); }
export async function readQuizSnapshot(bank: QuizBank): Promise<QuizSnapshot> {
  const db = await openDatabase(), tx = db.transaction(["sessions", "attempts", "readingFlows"], "readonly");
  const [sessions, attempts, readingFlows] = await Promise.all([readStore<QuizSession>(tx.objectStore("sessions")), readStore<QuizAttempt>(tx.objectStore("attempts")), readStore<QuizReadingFlow>(tx.objectStore("readingFlows"))]);
  if (!validSnapshot({ sessions, attempts, readingFlows }, bank)) throw new Error("Saved quiz data is incompatible or damaged. It has not been overwritten. Export a backup before resetting.");
  return { sessions, attempts, readingFlows };
}
// Read, validate, grade, and commit within one transaction. Two tabs cannot double-award an attempt.
async function change(bank: QuizBank, mutation: (state: QuizSnapshot) => void): Promise<QuizSnapshot> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "attempts", "readingFlows"], "readwrite"), sr = tx.objectStore("sessions").getAll(), ar = tx.objectStore("attempts").getAll(), fr = tx.objectStore("readingFlows").getAll();
    let next: QuizSnapshot, failure: unknown, completed = 0;
    function ready() {
      if (++completed !== 3) return;
      try {
        next = { sessions: sr.result, attempts: ar.result, readingFlows: fr.result };
        if (!validSnapshot(next, bank)) throw new Error("Saved quiz data is incompatible. Nothing was changed.");
        mutation(next);
        if (!validSnapshot(next, bank)) throw new Error("Quiz update failed validation. Nothing was changed.");
        for (const session of next.sessions) tx.objectStore("sessions").put(session);
        for (const attempt of next.attempts) tx.objectStore("attempts").put(attempt);
        for (const flow of next.readingFlows ?? []) tx.objectStore("readingFlows").put(flow);
      } catch (error) { failure = error; tx.abort(); }
    }
    sr.onsuccess = ready; ar.onsuccess = ready; fr.onsuccess = ready;
    tx.oncomplete = () => { notify(); channel?.postMessage("changed"); resolve(next); };
    tx.onabort = () => reject(failure ?? new Error("Could not save quiz progress. Keep this page open and retry or export a backup."));
    tx.onerror = () => { /* onabort reports the failed atomic transaction. */ };
  });
}
export function addQuizSession(bank: QuizBank, session: QuizSession) { return change(bank, state => { if (state.sessions.some(s => s.id === session.id)) throw new Error("Session already exists."); state.sessions.push(session); }); }
export function claimQuizSession(bank: QuizBank, id: string, owner: string, takeover = false) { return change(bank, state => {
  const session = state.sessions.find(s => s.id === id); if (!session) throw new Error("Session no longer exists.");
  if (session.owner && session.owner !== owner && session.leaseUntil > Date.now() && !takeover) throw new Error("This session is open elsewhere. Choose Take over to continue here.");
  if (!session.done) { session.owner = owner; session.leaseUntil = Date.now() + 60_000; }
}); }
export function releaseQuizSession(bank: QuizBank, id: string, owner: string) { return change(bank, state => { const s = state.sessions.find(s => s.id === id); if (s?.owner === owner) { s.owner = null; s.leaseUntil = 0; } }); }
export function renewQuizSession(bank: QuizBank, id: string, owner: string) { return change(bank, state => { const s = state.sessions.find(s => s.id === id); if (s?.owner === owner && !s.done) s.leaseUntil = Date.now() + 60_000; }); }
export function updateQuizSession(bank: QuizBank, id: string, owner: string, action: QuizAction) { return change(bank, state => {
  const index = state.sessions.findIndex(s => s.id === id), current = state.sessions[index];
  if (!current || current.owner !== owner) throw new Error("This quiz is being edited in another view. Resume or take over the session to continue.");
  const result = applyQuizAction(bank, current, state.attempts, action);
  state.sessions[index] = result.session; state.attempts = result.attempts;
}); }
export function validSnapshot(value: unknown, bank: QuizBank): value is QuizSnapshot {
  if (!record(value) || !Array.isArray(value.sessions) || !Array.isArray(value.attempts) || value.sessions.length > 20_000 || value.attempts.length > 500_000) return false;
  const questions = new Map(bank.questions.map(q => [q.id, q]));
  if (!value.sessions.every(s => {
    if (!record(s) || typeof s.id !== "string" || s.bank !== bank.version || typeof s.label !== "string" || s.label.length > 200 || !["practice", "assessment"].includes(String(s.mode)) || typeof s.done !== "boolean" || !Number.isFinite(s.created) || !Number.isFinite(s.updated) || !Number.isFinite(s.leaseUntil) || (s.owner !== null && typeof s.owner !== "string") || !Array.isArray(s.entries) || !s.entries.length || s.entries.length > 30 || !Number.isInteger(s.index) || (s.index as number) < 0 || (s.index as number) >= s.entries.length) return false;
    return new Set(s.entries.map(e => record(e) ? questions.get(String(e.id))?.objective : null)).size === s.entries.length && s.entries.every(e => {
      if (!record(e) || typeof e.id !== "string") return false;
      const q = questions.get(e.id);
      return !!q && e.version === q.version && strings(e.choices) && validQuizEntryAnswer(q, e.choices, e.answer) && validQuizEntryAnswer(q, e.choices, e.initial) && typeof e.submitted === "boolean" && typeof e.assisted === "boolean" && typeof e.skipped === "boolean" && ["none", "passage", "answer"].includes(String(e.help)) && (!s.done || e.submitted);
    });
  })) return false;
  if (new Set(value.sessions.map(s => s.id)).size !== value.sessions.length || new Set(value.attempts.map(a => record(a) ? a.id : null)).size !== value.attempts.length) return false;
  if (!validReadingFlows(value.readingFlows, value.sessions as QuizSession[])) return false;
  const sessions = new Map((value.sessions as QuizSession[]).map(s => [s.id, s]));
  return value.attempts.every(a => {
    if (!record(a) || typeof a.qid !== "string" || typeof a.session !== "string") return false;
    const q = questions.get(a.qid), s = sessions.get(a.session), e = s?.entries.find(e => e.id === a.qid);
    // Leave room for the longest review interval within JavaScript's Date range.
    if (typeof a.time !== "number" || !Number.isFinite(a.time) || a.time <= 0 || a.time > 8_640_000_000_000_000 - 30 * DAY) return false;
    return !!q && !!s && !!e?.submitted && (s.mode === "practice" || s.done) && a.id === `${s.id}:${q.id}` && a.objective === q.objective && a.version === q.version && validQuizAnswer(q, a.answer) && JSON.stringify(a.answer) === JSON.stringify(e.answer) && a.assisted === e.assisted && a.skipped === e.skipped && a.correct === gradeQuizEntry(q, e) && typeof a.time === "number" && Number.isFinite(a.time) && a.time > 0 && (a.reviewScheduleVersion === undefined || a.reviewScheduleVersion === 2) && typeof a.points === "number" && [0, 5, 10, 20, 30].includes(a.points);
  });
}
export function parseQuizBackup(value: unknown, bank: QuizBank): QuizBackup {
  const unsavedDrafts: unknown = record(value) ? value.unsavedDrafts : undefined;
  if (!record(value) || value.type !== "kjv-only-quiz" || value.schema !== 1 || value.bank !== bank.version || !validSnapshot(value, bank)) throw new Error("Not a compatible quiz backup. No progress was changed.");
  const backup = structuredClone(value) as QuizBackup;
  // Recover exported input without turning a draft into a submitted or credited answer.
  if (unsavedDrafts !== undefined) {
    if (!Array.isArray(unsavedDrafts)) throw new Error("Invalid draft backup. No progress was changed.");
    const entries = new Map<string, QuizSession["entries"][number]>(backup.sessions.flatMap(s => s.entries.map(e => [`${s.id}:${e.id}`, e] as const)));
    for (const draft of unsavedDrafts) {
      if (!record(draft) || typeof draft.key !== "string") throw new Error("Invalid draft backup. No progress was changed.");
      const entry = entries.get(draft.key);
      if (!entry || entry.submitted) continue;
      const q = bank.questions.find(q => q.id === entry.id)!;
      if (!validQuizEntryAnswer(q, entry.choices, draft.answer)) throw new Error("Invalid draft answer. No progress was changed.");
      entry.answer = structuredClone(draft.answer);
    }
  }
  return backup;
}
export function importQuizBackup(bank: QuizBank, backup: QuizBackup) { return change(bank, state => {
  // Existing sessions win. Importing the same file twice is idempotent; never replace active work.
  const existing = new Set(state.sessions.map(s => s.id));
  state.sessions.push(...backup.sessions.filter(s => !existing.has(s.id)).map(s => ({ ...s, owner: null, leaseUntil: 0 })));
  const ids = new Set(state.attempts.map(a => a.id));
  state.attempts.push(...backup.attempts.filter(a => !ids.has(a.id) && !existing.has(a.session)));
  const flowIds = new Set(state.readingFlows?.map(f => f.id));
  const linked = new Set(state.readingFlows?.flatMap(f => f.steps.map(step => step.sessionId).filter(Boolean)));
  state.readingFlows ??= [];
  for (const flow of backup.readingFlows ?? []) {
    if (flowIds.has(flow.id) || flow.steps.some(step => step.sessionId && linked.has(step.sessionId))) continue;
    state.readingFlows.push(structuredClone(flow));
    flow.steps.forEach(step => { if (step.sessionId) linked.add(step.sessionId); });
    flowIds.add(flow.id);
  }
  // Recompute points over the merged evidence so two devices' first-learning rewards cannot stack.
  state.attempts = rebuildQuizAttempts(bank, state);
}); }
export async function exportQuizData(): Promise<QuizSnapshot> { const db = await openDatabase(), tx = db.transaction(["sessions", "attempts", "readingFlows"], "readonly"); const [sessions, attempts, readingFlows] = await Promise.all([readStore<QuizSession>(tx.objectStore("sessions")), readStore<QuizAttempt>(tx.objectStore("attempts")), readStore<QuizReadingFlow>(tx.objectStore("readingFlows"))]); return { sessions, attempts, readingFlows }; }
export async function resetQuizData() { const db = await openDatabase(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(["sessions", "attempts", "readingFlows"], "readwrite"); tx.objectStore("sessions").clear(); tx.objectStore("attempts").clear(); tx.objectStore("readingFlows").clear(); tx.oncomplete = () => { notify(); channel?.postMessage("changed"); resolve(); }; tx.onabort = () => reject(tx.error); }); }

export async function offerReadingQuiz(bank: QuizBank, request: QuizReadingRequest, options: QuizPracticeOptions, owner: string, readChapters: ReadonlySet<string>) {
  let flowId = "", sessionId: string | null = null;
  const snapshot = await change(bank, state => {
    const { flow, created } = enqueueReadingQuiz(state, request, options);
    flowId = flow.id;
    if (created && !state.sessions.some(s => !s.done)) sessionId = prepareReadingQuizStep(bank, state, flow, 0, owner, readChapters);
  });
  return { snapshot, flowId, sessionId };
}
export async function beginReadingQuiz(bank: QuizBank, id: string, expectedStep: number, owner: string, readChapters: ReadonlySet<string>) {
  let sessionId: string | null = null;
  const snapshot = await change(bank, state => {
    const flow = state.readingFlows?.find(f => f.id === id);
    if (!flow) throw new Error("Reading quiz sequence no longer exists.");
    sessionId = prepareReadingQuizStep(bank, state, flow, expectedStep, owner, readChapters);
  });
  return { snapshot, sessionId };
}
export function skipReadingQuiz(bank: QuizBank, id: string, expectedStep: number, owner: string) { return change(bank, state => {
  const flow = state.readingFlows?.find(f => f.id === id);
  if (!flow) throw new Error("Reading quiz sequence no longer exists.");
  skipReadingQuizStep(state, flow, expectedStep, owner);
}); }
export function dismissReadingQuiz(bank: QuizBank, id: string) { return change(bank, state => {
  const flow = state.readingFlows?.find(f => f.id === id);
  if (flow && nextReadingQuizStep(flow, state.sessions) >= 0) flow.closed = true;
}); }
