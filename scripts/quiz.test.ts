import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuizBank } from "@/lib/quiz/data";
import { applyQuizAction, createQuizSession, DAY, filterQuizQuestions, gradeQuizAnswer, quizStats, selectQuizQuestions, validQuizAnswer } from "@/lib/quiz/engine";
import { parseQuizBackup, validSnapshot } from "@/lib/quiz/storage";
import { parseLayoutHash, serializeLayoutHash } from "@/lib/layout-hash";
import { createInitialTab } from "@/lib/reader-layout";
import { normalizeStudyWorkspaceTab } from "@/hooks/use-study-workspace-state";
import { CORE_OFFLINE_URLS } from "@/lib/offline-downloads";
import type { QuizAttempt, QuizFilters, QuizSnapshot } from "@/lib/quiz/types";
const bank = parseQuizBank(JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8")));
const q = bank.questions.find(q => q.id === "psalm-recall")!;
const now = 1_790_000_000_000;
function session(mode: "practice" | "assessment" = "practice") { return createQuizSession(bank, [q], "Psalm recall", mode, "test-owner", now); }
function submit(s = session(), attempts: QuizAttempt[] = [], time = now, answer = "soul") { return applyQuizAction(bank, s, attempts, { type: "submit", qid: q.id, answer }, time); }
describe("quiz question bank and grading", () => {
  it("checks the actual bank and every embedded KJV verse", () => {
    const corpus = JSON.parse(readFileSync("public/data/kjv.json", "utf8")) as { books: { name: string; chapters: { chapter: number; verses: { verse: number; tokens: { text: string }[] }[] }[] }[] };
    const verses = new Map(corpus.books.flatMap(b => b.chapters.flatMap(c => c.verses.map(v => [`${b.name}:${c.chapter}:${v.verse}`, v.tokens.map(t => t.text).join(" ").replace(/\s+([,.;:?!])/g, "$1")] as const))));
    expect(bank.questions).toHaveLength(116);
    for (const question of bank.questions) {
      const canonical = question.kind === "text" ? question.answer[0] : question.answer;
      expect(gradeQuizAnswer(question, canonical), question.id).toBe(true);
      expect(gradeQuizAnswer(question, "not an answer"), question.id).toBe(false);
      for (const r of question.refs) for (const v of r.verses) expect(v.text, `${r.label}:${v.number}`).toBe(verses.get(`${r.book}:${r.chapter}:${v.number}`));
    }
  });
  it("normalizes short recall without accepting different words", () => {
    expect(gradeQuizAnswer(q, "  SOUL! ")).toBe(true);
    expect(gradeQuizAnswer(q, "souls")).toBe(false);
    const age = bank.questions.find(q => q.id === "genesis-age-recall")!;
    expect(gradeQuizAnswer(age, "nine hundred and twelve years")).toBe(true);
    expect(gradeQuizAnswer(age, "930")).toBe(false);
  });
  it("rejects malformed orders and incomplete submissions", () => {
    const order = bank.questions.find(q => q.id === "creation-order")!;
    expect(validQuizAnswer(order, ["Light and darkness"])).toBe(false);
    expect(validQuizAnswer(order, Array(6).fill("Light and darkness"))).toBe(false);
    expect(() => applyQuizAction(bank, session(), [], { type: "submit", qid: q.id, answer: "" })).toThrow();
    const tree = bank.questions.find(q => q.kind === "family")!;
    expect(() => applyQuizAction(bank, createQuizSession(bank, [tree], "Tree", "practice", "owner"), [], { type: "submit", qid: tree.id, answer: ["Enoch", "", ""] })).toThrow();
  });
});
describe("quiz credit and session lifecycle", () => {
  it("awards first learning once and locks first submissions", () => {
    const first = submit();
    expect(first.attempts[0].points).toBe(10);
    const repeated = submit(first.session, first.attempts);
    expect(repeated.attempts).toHaveLength(1);
    const next = submit(session(), first.attempts, now + 10_000);
    expect(next.attempts[1].points).toBe(0);
    const change = applyQuizAction(bank, first.session, first.attempts, { type: "answer", qid: q.id, answer: "wrong" });
    expect(change.session.entries[0].answer).toBe("soul");
  });
  it("keeps assisted and skipped work out of unassisted mastery", () => {
    const helped = applyQuizAction(bank, session(), [], { type: "help", qid: q.id, help: "passage" });
    const result = submit(helped.session);
    expect(result.attempts[0].points).toBe(0);
    expect(quizStats(bank, result.attempts, now).get(q.id)?.learned).toBe(false);
    const skip = applyQuizAction(bank, session(), [], { type: "submit", qid: q.id, answer: "soul", skip: true });
    expect(skip.attempts[0].correct).toBe(false);
  });
  it("defers assessment credit until finishing and rejects hints", () => {
    const test = session("assessment");
    expect(() => applyQuizAction(bank, test, [], { type: "help", qid: q.id, help: "answer" })).toThrow();
    expect(() => applyQuizAction(bank, test, [], { type: "finish" })).toThrow();
    const answered = submit(test);
    expect(answered.attempts).toHaveLength(0);
    const finished = applyQuizAction(bank, answered.session, [], { type: "finish" }, now);
    expect(finished.session.done).toBe(true); expect(finished.attempts).toHaveLength(1);
    expect(() => applyQuizAction(bank, finished.session, finished.attempts, { type: "finish" })).toThrow();
  });
  it("requires separate sessions seven days apart and retains earned mastery", () => {
    const first = submit(), early = submit(session(), first.attempts, now + DAY);
    expect(quizStats(bank, early.attempts, now + DAY).get(q.id)?.mastered).toBe(false);
    const delayed = submit(session(), early.attempts, now + 8 * DAY);
    expect(quizStats(bank, delayed.attempts, now + 8 * DAY).get(q.id)?.mastered).toBe(true);
    const wrong = submit(session(), delayed.attempts, now + 9 * DAY, "wrong");
    expect(quizStats(bank, wrong.attempts, now + 9 * DAY).get(q.id)).toMatchObject({ mastered: true, due: true, missed: true });
  });
});
describe("quiz selection and recovery", () => {
  const filters: QuizFilters = { scope: "chapter", book: "Genesis", chapter: 1, skill: "all", difficulty: "all", readOnly: false };
  it("keeps scopes, skills and composite conflicts separate", () => {
    const pool = filterQuizQuestions(bank, filters, new Set());
    expect(pool.every(q => q.contexts.every(c => c.book === "Genesis" && c.chapter === 1))).toBe(true);
    for (let i = 0; i < 20; i++) {
      const selected = selectQuizQuestions(bank, bank.questions, [], 30);
      expect(selected.some(a => selected.some(b => a !== b && (a.conflicts.includes(b.id) || b.conflicts.includes(a.id))))).toBe(false);
    }
    expect(filterQuizQuestions(bank, { ...filters, scope: "bible", skill: "Vocabulary" }, new Set()).every(q => q.skill === "Vocabulary")).toBe(true);
  });
  it("requires all cross-chapter contexts to be read", () => {
    const f = { ...filters, scope: "bible" as const, skill: "Vocabulary" as const, readOnly: true };
    expect(filterQuizQuestions(bank, f, new Set(["2:18"])).some(q => q.id === "ephah")).toBe(false);
    expect(filterQuizQuestions(bank, f, new Set(["2:18", "8:16"])).some(q => q.id === "ephah")).toBe(true);
  });
  it("validates backups and never trusts forged correctness or arrangements", () => {
    const result = submit(); const snapshot: QuizSnapshot = { sessions: [result.session], attempts: result.attempts };
    const backup = { ...snapshot, schema: 1, type: "kjv-only-quiz", bank: bank.version, exported: new Date(now).toISOString() };
    expect(parseQuizBackup(backup, bank)).toEqual(backup);
    expect(validSnapshot({ ...snapshot, attempts: [{ ...result.attempts[0], correct: false }] }, bank)).toBe(false);
    expect(() => parseQuizBackup({ ...backup, sessions: [{ ...result.session, index: 99 }] }, bank)).toThrow();
    expect(() => parseQuizBackup({ ...backup, schema: 2 }, bank)).toThrow();
  });
  it("restores unsaved drafts without awarding credit or replacing submitted answers", () => {
    const active = session();
    const backup = { sessions: [active], attempts: [], schema: 1, type: "kjv-only-quiz", bank: bank.version, unsavedDrafts: [{key: `${active.id}:${q.id}`, answer: "soul"}] };
    const restored = parseQuizBackup(backup, bank);
    expect(restored.sessions[0].entries[0]).toMatchObject({ answer: "soul", submitted: false });
    expect(restored.attempts).toHaveLength(0);
    expect(active.entries[0].answer).toBe("");
    const answered = submit(active);
    const locked = parseQuizBackup({ ...backup, sessions: [answered.session], attempts: answered.attempts, unsavedDrafts: [{key: `${active.id}:${q.id}`, answer: "wrong"}] }, bank);
    expect(locked.sessions[0].entries[0].answer).toBe("soul");
  });
  it("restores quiz layout destinations and includes its offline pack", () => {
    const tab = createInitialTab(0, "quiz");
    const hash = serializeLayoutHash({ tabs: [tab], activeTabId: tab.id, tabsOrientation: "horizontal" });
    expect(parseLayoutHash(hash)?.tabs[0].root).toMatchObject({ view: "quiz" });
    expect(normalizeStudyWorkspaceTab("quiz")).toBe("quiz");
    expect(CORE_OFFLINE_URLS).toContain("/data/quiz-pilot-v1.json");
  });
});
