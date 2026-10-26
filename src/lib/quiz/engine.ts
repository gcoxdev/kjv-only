import { BIBLE_BOOKS } from "@/lib/bible-books";
import { BOOK_ICON_CODES } from "@/lib/references";
import { createId } from "@/lib/reader-layout";
import { DAY, legacyQuizReviewDue, quizReviewSchedule } from "./review";
export { DAY } from "./review";
import type { QuizAction, QuizAnswer, QuizAttempt, QuizBank, QuizEntry, QuizFilters, QuizQuestion, QuizReference, QuizSession, QuizSkill, QuizSnapshot } from "./types";
export const QUIZ_BANK_URL = "/data/quiz-pilot-v1.json";
export function quizReferenceCode(reference: QuizReference) {
  const code = BOOK_ICON_CODES[BIBLE_BOOKS.findIndex(book => book.name === reference.book)];
  const start = reference.verses[0].number, end = reference.verses.at(-1)!.number;
  return `${code}.${reference.chapter}.${start}${end === start ? "" : `-${end}`}`;
}
export const QUIZ_SKILLS: Record<QuizSkill, string> = { Comprehension: "Passage comprehension", Vocabulary: "Vocabulary", Structure: "Bible structure", Sequence: "Event sequence", Family: "People and family", Geography: "Geography" };
export const QUIZ_KINDS = { choice: "Multiple choice", text: "Short answer", order: "Ordering", timeline: "Timeline", family: "Family tree", match: "Matching", map: "Map" };
export function quizScopeLabel(q: QuizQuestion) {
  if (q.scopeLevel === "chapter") return `${q.book} ${q.chapter}`;
  if (q.scopeLevel === "book") return `${q.book} · book connections`;
  return q.scopeLevel === "bible" ? "Whole Bible" : q.testament === "OT" ? "Old Testament" : "New Testament";
}
export function normalizeQuizAnswer(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:"']/g, "").replace(/\s+/g, " ").trim(); }
export function isArrangement(q: QuizQuestion) { return ["order", "timeline", "family", "match"].includes(q.kind); }
export function quizFamilyRoot(q: QuizQuestion) { return q.kind === "family" ? q.slots?.[0].match(/^Son of (.+)$/)?.[1] : undefined; }
export function gradeQuizAnswer(q: QuizQuestion, answer: QuizAnswer) {
  if (q.kind === "text") return typeof answer === "string" && Array.isArray(q.answer) && q.answer.some(a => normalizeQuizAnswer(a) === normalizeQuizAnswer(answer));
  if (isArrangement(q)) return Array.isArray(answer) && Array.isArray(q.answer) && answer.length === q.answer.length && q.answer.every((a, i) => a === answer[i]);
  return answer === q.answer;
}
export function quizAnswerLabel(q: QuizQuestion) { return q.kind === "text" ? q.answer[0] : Array.isArray(q.answer) ? q.answer.join(["match"].includes(q.kind) ? "; " : " → ") : q.answer; }
// A reviewed alternate form assesses the same objective and earns the same credit.
export function quizObjectives(questions: readonly QuizQuestion[]) {
  const seen = new Set<string>();
  return questions.filter(q => { if (seen.has(q.objective)) return false; seen.add(q.objective); return true; });
}
export function quizStats(bank: QuizBank, attempts: QuizAttempt[], now = Date.now()) {
  const groups = new Map<string, QuizAttempt[]>();
  for (const a of attempts) { const list = groups.get(a.objective) ?? []; list.push(a); groups.set(a.objective, list); }
  return new Map(quizObjectives(bank.questions).map(q => {
    const history = (groups.get(q.objective) ?? []).filter(a => a.version === q.version).sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const successes = history.filter(a => a.correct && !a.assisted), first = successes[0], last = history.at(-1);
    const mastered = !!first && successes.some(a => a.session !== first.session && a.time - first.time >= 7 * DAY);
    return [q.objective, { learned: !!first, mastered, ...quizReviewSchedule(history, now), missed: !!last && !last.correct, attempts: history, status: mastered ? "Mastered" : first ? "Learned" : last ? "Practicing" : "Not started" }];
  }));
}
export function filterQuizQuestions(bank: QuizBank, filters: QuizFilters, readChapters: ReadonlySet<string>) {
  return bank.questions.filter(q => {
    if (filters.skill !== "all" && q.skill !== filters.skill || filters.difficulty !== "all" && q.difficulty !== filters.difficulty) return false;
    if (filters.scope !== "chapter" && filters.content === "connections" && q.scopeLevel === "chapter") return false;
    if (filters.readOnly && (q.contexts.length === 0 || q.contexts.some(c => !readChapters.has(`${bank.books.indexOf(c.book)}:${c.chapter - 1}`)))) return false;
    if (filters.scope === "bible") return true;
    if (filters.scope === "OT" || filters.scope === "NT") return q.scopeLevel !== "bible" && q.testament === filters.scope && q.contexts.every(c => (bank.books.indexOf(c.book) < 39 ? "OT" : "NT") === filters.scope);
    if (filters.scope === "book") return ["chapter", "book"].includes(q.scopeLevel) && q.book === filters.book && q.contexts.every(c => c.book === filters.book);
    return q.scopeLevel === "chapter" && q.book === filters.book && q.chapter === filters.chapter && q.contexts.every(c => c.book === filters.book && c.chapter === filters.chapter);
  });
}
export function shuffleQuiz<T>(values: readonly T[], random = Math.random) { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function selectQuizQuestions(bank: QuizBank, pool: QuizQuestion[], attempts: QuizAttempt[], count: number, random = Math.random) {
  const stats = quizStats(bank, attempts), selected: QuizQuestion[] = [], books = new Map<string, number>();
  const candidates = shuffleQuiz(pool, random).map(q => {
    const progress = stats.get(q.objective);
    return { q, learnedNotDue: Number(!!progress?.learned && !progress.due), repeatedForm: Number(progress?.attempts.at(-1)?.qid === q.id) };
  });
  const objectives = new Map(bank.questions.map(q => [q.id, q.objective]));
  const conflicts = new Map<string, Set<string>>();
  for (const q of bank.questions) {
    const group = conflicts.get(q.objective) ?? new Set<string>();
    conflicts.set(q.objective, group);
    for (const id of q.conflicts) {
      const other = objectives.get(id)!;
      group.add(other);
      const reverse = conflicts.get(other) ?? new Set<string>();
      reverse.add(q.objective); conflicts.set(other, reverse);
    }
  }
  const excluded = new Set<string>();
  // Preserve shuffled tie order without repeatedly sorting the entire large bank.
  while (selected.length < count) {
    let best: typeof candidates[number] | undefined;
    let bestBookCount = Infinity;
    for (const candidate of candidates) {
      if (excluded.has(candidate.q.objective)) continue;
      const bookCount = books.get(candidate.q.book) ?? 0;
      if (!best || bookCount < bestBookCount || bookCount === bestBookCount && (candidate.learnedNotDue < best.learnedNotDue || candidate.learnedNotDue === best.learnedNotDue && candidate.repeatedForm < best.repeatedForm)) {
        best = candidate; bestBookCount = bookCount;
      }
    }
    if (!best) break;
    const q = best.q;
    selected.push(q); books.set(q.book, (books.get(q.book) ?? 0) + 1);
    excluded.add(q.objective);
    for (const other of conflicts.get(q.objective) ?? []) excluded.add(other);
  }
  return selected;
}
export function createQuizSession(bank: QuizBank, questions: QuizQuestion[], label: string, mode: QuizSession["mode"], owner: string, now = Date.now()): QuizSession {
  if (!questions.length) throw new Error("No questions match these filters.");
  if (quizObjectives(questions).length !== questions.length) throw new Error("A quiz can assess each objective only once.");
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
function creditAttempt(bank: QuizBank, session: QuizSession, entry: QuizEntry, attempts: QuizAttempt[], now: number, historical?: QuizAttempt) {
  const id = `${session.id}:${entry.id}`;
  if (attempts.some(a => a.id === id)) return;
  const q = bank.questions.find(q => q.id === entry.id)!;
  const stats = quizStats(bank, attempts, now).get(q.objective)!;
  const correct = !entry.skipped && gradeQuizAnswer(q, entry.answer);
  let points = 0;
  if (correct && !entry.assisted) {
    if (!stats.learned) {
      points = { Easy: 10, Medium: 20, Hard: 30 }[q.difficulty];
      // Older/offline releases may have awarded a former difficulty's value.
      // Preserve it only for the first qualifying reward in the merged history.
      if (historical && q.previousLearningPoints?.includes(historical.points)) points = historical.points;
    }
    else if ((historical && historical.reviewScheduleVersion === undefined ? legacyQuizReviewDue(stats.attempts, now) : stats.due) && !stats.attempts.some(a => a.points === 5 && new Date(a.time).toDateString() === new Date(now).toDateString())) points = 5;
  }
  attempts.push({ id, session: session.id, qid: q.id, objective: q.objective, version: q.version, answer: structuredClone(entry.answer), correct, assisted: entry.assisted, skipped: entry.skipped, time: now, points, ...(!historical || historical.reviewScheduleVersion === 2 ? { reviewScheduleVersion: 2 as const } : {}) });
}
// Replay validated evidence without trusting duplicate rewards or changing saved sessions.
export function rebuildQuizAttempts(bank: QuizBank, snapshot: QuizSnapshot) {
  const sessions = new Map(snapshot.sessions.map(session => [session.id, session]));
  const attempts: QuizAttempt[] = [];
  for (const attempt of [...snapshot.attempts].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))) {
    const session = sessions.get(attempt.session)!;
    const entry = session.entries.find(entry => entry.id === attempt.qid)!;
    const question = bank.questions.find(question => question.id === entry.id)!;
    if (!entry.skipped && !hasQuizAnswer(question, entry.answer)) throw new Error("Incomplete submitted answer in quiz history.");
    creditAttempt(bank, session, entry, attempts, attempt.time, attempt);
  }
  return attempts;
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
