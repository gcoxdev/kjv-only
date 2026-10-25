import { createId } from "@/lib/reader-layout";
import type { QuizAction, QuizAnswer, QuizAttempt, QuizBank, QuizEntry, QuizFilters, QuizQuestion, QuizSession, QuizSkill } from "./types";
export const QUIZ_BANK_URL = "/data/quiz-pilot-v1.json";
export const DAY = 86_400_000;
export const QUIZ_SKILLS: Record<QuizSkill, string> = { Comprehension: "Passage comprehension", Vocabulary: "Vocabulary", Structure: "Bible structure", Sequence: "Event sequence", Family: "People and family", Geography: "Geography" };
export const QUIZ_KINDS = { choice: "Multiple choice", text: "Short answer", order: "Ordering", timeline: "Timeline", family: "Family tree", match: "Matching", map: "Map" };
export function normalizeQuizAnswer(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:"']/g, "").replace(/\s+/g, " ").trim(); }
export function isArrangement(q: QuizQuestion) { return ["order", "timeline", "family", "match"].includes(q.kind); }
export function gradeQuizAnswer(q: QuizQuestion, answer: QuizAnswer) {
  if (q.kind === "text") return typeof answer === "string" && Array.isArray(q.answer) && q.answer.some(a => normalizeQuizAnswer(a) === normalizeQuizAnswer(answer));
  if (isArrangement(q)) return Array.isArray(answer) && Array.isArray(q.answer) && answer.length === q.answer.length && q.answer.every((a, i) => a === answer[i]);
  return answer === q.answer;
}
export function quizAnswerLabel(q: QuizQuestion) { return q.kind === "text" ? q.answer[0] : Array.isArray(q.answer) ? q.answer.join(["match"].includes(q.kind) ? "; " : " → ") : q.answer; }
export function quizStats(bank: QuizBank, attempts: QuizAttempt[], now = Date.now()) {
  const groups = new Map<string, QuizAttempt[]>();
  for (const a of attempts) { const list = groups.get(a.objective) ?? []; list.push(a); groups.set(a.objective, list); }
  return new Map(bank.questions.map(q => {
    const history = (groups.get(q.objective) ?? []).filter(a => a.version === q.version).sort((a, b) => a.time - b.time);
    const successes = history.filter(a => a.correct && !a.assisted), first = successes[0], last = history.at(-1);
    const mastered = !!first && successes.some(a => a.session !== first.session && a.time - first.time >= 7 * DAY);
    const due = !!last && (!last.correct || last.assisted || now - last.time >= (mastered ? 30 : successes.length > 1 ? 7 : 1) * DAY);
    return [q.objective, { learned: !!first, mastered, due, missed: !!last && !last.correct, attempts: history, status: mastered ? "Mastered" : first ? "Learned" : last ? "Practicing" : "Not started" }];
  }));
}
export function filterQuizQuestions(bank: QuizBank, filters: QuizFilters, readChapters: ReadonlySet<string>) {
  return bank.questions.filter(q => {
    if (filters.skill !== "all" && q.skill !== filters.skill || filters.difficulty !== "all" && q.difficulty !== filters.difficulty) return false;
    if (filters.readOnly && (q.contexts.length === 0 || q.contexts.some(c => !readChapters.has(`${bank.books.indexOf(c.book)}:${c.chapter - 1}`)))) return false;
    if (filters.scope === "bible") return true;
    if (filters.scope === "OT" || filters.scope === "NT") return q.scopeLevel !== "bible" && q.testament === filters.scope && q.contexts.every(c => (bank.books.indexOf(c.book) < 39 ? "OT" : "NT") === filters.scope);
    return q.scopeLevel === "chapter" && q.book === filters.book && q.contexts.every(c => c.book === filters.book && (filters.scope === "book" || c.chapter === filters.chapter)) && (filters.scope === "book" || q.chapter === filters.chapter);
  });
}
export function shuffleQuiz<T>(values: readonly T[], random = Math.random) { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function selectQuizQuestions(bank: QuizBank, pool: QuizQuestion[], attempts: QuizAttempt[], count: number, random = Math.random) {
  const stats = quizStats(bank, attempts), rest = shuffleQuiz(pool, random), selected: QuizQuestion[] = [], books = new Map<string, number>();
  while (rest.length && selected.length < count) {
    rest.sort((a, b) => (books.get(a.book) ?? 0) - (books.get(b.book) ?? 0) || Number(!!stats.get(a.objective)?.learned && !stats.get(a.objective)?.due) - Number(!!stats.get(b.objective)?.learned && !stats.get(b.objective)?.due));
    const q = rest.shift()!;
    if (selected.some(p => p.objective === q.objective || p.conflicts.includes(q.id) || q.conflicts.includes(p.id))) continue;
    selected.push(q); books.set(q.book, (books.get(q.book) ?? 0) + 1);
  }
  return selected;
}
export function createQuizSession(bank: QuizBank, questions: QuizQuestion[], label: string, mode: QuizSession["mode"], owner: string, now = Date.now()): QuizSession {
  if (!questions.length) throw new Error("No questions match these filters.");
  return { id: createId(), bank: bank.version, label, mode, index: 0, done: false, created: now, updated: now, owner, leaseUntil: now + 60_000,
    entries: questions.map(q => {
      let answer: QuizAnswer = "";
      if (q.kind === "order" || q.kind === "timeline") { answer = shuffleQuiz(q.answer as string[]); if (gradeQuizAnswer(q, answer)) answer.push(answer.shift()!); }
      else if (q.kind === "family" || q.kind === "match") answer = q.slots!.map(() => "");
      return { id: q.id, version: q.version, answer, initial: structuredClone(answer), choices: shuffleQuiz(q.choices), submitted: false, assisted: false, skipped: false, help: "none" };
    }) };
}
export function validQuizAnswer(q: QuizQuestion, answer: unknown): answer is QuizAnswer {
  if (!isArrangement(q)) return typeof answer === "string" && answer.length <= 500 && (q.kind === "text" || answer === "" || q.choices.includes(answer));
  if (!Array.isArray(answer) || !Array.isArray(q.answer) || answer.length !== q.answer.length || !answer.every(a => typeof a === "string")) return false;
  if (q.kind === "order" || q.kind === "timeline") return new Set(answer).size === answer.length && answer.every(a => q.answer.includes(a));
  return answer.every(a => a === "" || q.choices.includes(a));
}
export function hasQuizAnswer(q: QuizQuestion, answer: QuizAnswer) { return validQuizAnswer(q, answer) && (Array.isArray(answer) ? answer.every(Boolean) : !!answer.trim()); }
function creditAttempt(bank: QuizBank, session: QuizSession, entry: QuizEntry, attempts: QuizAttempt[], now: number) {
  const id = `${session.id}:${entry.id}`;
  if (attempts.some(a => a.id === id)) return;
  const q = bank.questions.find(q => q.id === entry.id)!;
  const stats = quizStats(bank, attempts, now).get(q.objective)!;
  const correct = !entry.skipped && gradeQuizAnswer(q, entry.answer);
  let points = 0;
  if (correct && !entry.assisted) {
    if (!stats.learned) points = { Easy: 10, Medium: 20, Hard: 30 }[q.difficulty];
    else if (stats.due && !stats.attempts.some(a => a.points === 5 && new Date(a.time).toDateString() === new Date(now).toDateString())) points = 5;
  }
  attempts.push({ id, session: session.id, qid: q.id, objective: q.objective, version: q.version, answer: structuredClone(entry.answer), correct, assisted: entry.assisted, skipped: entry.skipped, time: now, points });
}
export function applyQuizAction(bank: QuizBank, original: QuizSession, originalAttempts: QuizAttempt[], action: QuizAction, now = Date.now()) {
  const session = structuredClone(original), attempts = [...originalAttempts];
  if (session.done) throw new Error("This quiz is already complete.");
  if (action.type === "navigate") {
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= session.entries.length) throw new Error("Invalid question position.");
    session.index = action.index;
  } else if (action.type === "finish") {
    if (session.entries.some(e => !e.submitted)) throw new Error("Answer or skip every question before finishing.");
    if (session.mode === "assessment") for (const e of session.entries) creditAttempt(bank, session, e, attempts, now);
    session.done = true; session.owner = null; session.leaseUntil = 0;
  } else {
    const entry = session.entries.find(e => e.id === action.qid), q = bank.questions.find(q => q.id === action.qid);
    if (!entry || !q) throw new Error("Question is not in this session.");
    if (entry.submitted) return { session: original, attempts: originalAttempts };
    if (action.type === "help") {
      if (session.mode !== "practice") throw new Error("Hints are unavailable during an assessment.");
      entry.assisted = true; entry.help = action.help;
    } else {
      if (!validQuizAnswer(q, action.answer)) throw new Error("Invalid answer arrangement.");
      if (action.type === "submit" && !action.skip && !hasQuizAnswer(q, action.answer)) throw new Error("Answer every part or skip this question.");
      entry.answer = structuredClone(action.answer);
      if (action.type === "submit") {
        entry.submitted = true; entry.skipped = !!action.skip;
        if (session.mode === "practice") creditAttempt(bank, session, entry, attempts, now);
      }
    }
  }
  session.updated = now; if (!session.done) session.leaseUntil = now + 60_000;
  return { session, attempts };
}
