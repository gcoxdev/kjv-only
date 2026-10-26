import { describe, expect, it } from "vitest";
import { applyQuizAction, createQuizSession, DAY, quizStats, rebuildQuizAttempts } from "@/lib/quiz/engine";
import { quizReviewSchedule } from "@/lib/quiz/review";
import { parseQuizBackup, validSnapshot } from "@/lib/quiz/storage";
import type { QuizBank, QuizSnapshot } from "@/lib/quiz/types";

// A small synthetic bank isolates scheduling from the separately audited corpus.
const bank: QuizBank = { version: "schedule-test", books: ["Genesis"], featured: [{ book: "Genesis", chapter: 1 }], questions: [{
  id: "recall", objective: "recall", version: 1, book: "Genesis", chapter: 1, testament: "OT", scopeLevel: "chapter",
  prompt: "Recall fixture", answer: ["answer"], kind: "text", difficulty: "Easy", skill: "Comprehension",
  refs: [], contexts: [{ book: "Genesis", chapter: 1 }], choices: [], explanation: "Fixture", conflicts: [],
}] };
const origin = 1_790_000_000_000;
function add(state: QuizSnapshot, days: number, result: "correct" | "wrong" | "assisted" | "skipped" = "correct") {
  const time = origin + days * DAY;
  let session = createQuizSession(bank, bank.questions, "Recall", "practice", "test", time);
  if (result === "assisted") session = applyQuizAction(bank, session, state.attempts, { type: "help", qid: "recall", help: "answer" }, time).session;
  const next = applyQuizAction(bank, session, state.attempts, { type: "submit", qid: "recall", answer: result === "wrong" ? "wrong" : "answer", skip: result === "skipped" }, time);
  return { sessions: [...state.sessions, next.session], attempts: next.attempts };
}
const empty = (): QuizSnapshot => ({ sessions: [], attempts: [] });
const stats = (state: QuizSnapshot, days: number) => quizStats(bank, state.attempts, origin + days * DAY).get("recall")!;

describe("spaced quiz review", () => {
  it("starts with one day and ignores early repeat successes", () => {
    expect(stats(empty(), 0)).toMatchObject({ due: false, dueAt: null, reviewIntervalDays: null });
    let state = add(empty(), 0);
    expect(stats(state, 0)).toMatchObject({ learned: true, mastered: false, due: false, dueAt: origin + DAY, reviewIntervalDays: 1 });
    state = add(state, 0.5);
    expect(stats(state, 0.99).due).toBe(false);
    expect(stats(state, 1)).toMatchObject({ due: true, dueAt: origin + DAY, reviewIntervalDays: 1 });
    expect(state.attempts.map(a => a.points)).toEqual([10, 0]);
  });

  it("advances only due recalls through seven and thirty days, capped at thirty", () => {
    let state = add(add(empty(), 0), 1);
    expect(stats(state, 1)).toMatchObject({ mastered: false, dueAt: origin + 8 * DAY, reviewIntervalDays: 7 });
    state = add(state, 2);
    expect(stats(state, 8).due).toBe(true);
    state = add(state, 8);
    expect(stats(state, 8)).toMatchObject({ mastered: true, dueAt: origin + 38 * DAY, reviewIntervalDays: 30 });
    state = add(state, 38);
    expect(stats(state, 38).dueAt).toBe(origin + 68 * DAY);
    expect(state.attempts.map(a => a.points)).toEqual([10, 5, 0, 5, 5]);
    expect(rebuildQuizAttempts(bank, state)).toEqual(state.attempts);
  });

  it("keeps earned mastery distinct from the review interval", () => {
    const state = add(add(empty(), 0), 8);
    expect(stats(state, 8)).toMatchObject({ mastered: true, reviewIntervalDays: 7, dueAt: origin + 15 * DAY });
  });

  for (const result of ["wrong", "assisted", "skipped"] as const) it(`restarts after ${result} without revoking mastery`, () => {
    let state = add(add(add(empty(), 0), 1), 8);
    state = add(state, 9, result);
    expect(stats(state, 9)).toMatchObject({ learned: true, mastered: true, due: true, reviewIntervalDays: null, reviewReason: result === "wrong" ? "mistake" : result });
    expect(state.attempts.at(-1)?.points).toBe(0);
    state = add(state, 9.1);
    expect(stats(state, 9.1)).toMatchObject({ mastered: true, due: false, reviewIntervalDays: 1, dueAt: origin + 10.1 * DAY });
    // Immediate extra practice neither postpones the schedule nor earns points.
    const dueAt = stats(state, 9.1).dueAt;
    state = add(state, 9.2);
    expect(stats(state, 9.2).dueAt).toBe(dueAt);
    expect(state.attempts.at(-1)?.points).toBe(0);
  });

  it("requires a later session and excludes other content versions", () => {
    const state = add(empty(), 0), first = state.attempts[0];
    const sameSession = { ...first, id: "second-form", time: origin + DAY };
    expect(quizReviewSchedule([first, sameSession], origin + DAY)).toMatchObject({ due: true, reviewIntervalDays: 1 });
    const oldVersion = { ...first, version: 0 };
    expect(quizStats(bank, [oldVersion], origin).get("recall")).toMatchObject({ learned: false, dueAt: null });
  });

  it("shares one schedule across alternate forms and replays unordered evidence deterministically", () => {
    const variant = { ...bank.questions[0], id: "alternate" };
    const expanded = { ...bank, questions: [...bank.questions, variant] };
    const first = add(empty(), 0);
    const session = createQuizSession(expanded, [variant], "Alternate", "practice", "test", origin + DAY);
    const next = applyQuizAction(expanded, session, first.attempts, { type: "submit", qid: variant.id, answer: "answer" }, origin + DAY);
    const current = quizStats(expanded, next.attempts, origin + DAY);
    expect(current.size).toBe(1);
    expect(current.get("recall")).toMatchObject({ dueAt: origin + 8 * DAY, reviewIntervalDays: 7 });
    expect(quizStats(expanded, [...next.attempts].reverse(), origin + DAY)).toEqual(current);
  });

  it("does not rewrite legacy rewards using the new schedule when importing backups", () => {
    let state = add(add(add(add(empty(), 0), 1), 2), 8);
    expect(state.attempts.map(a => a.points)).toEqual([10, 5, 0, 5]);
    // The old scheduler postponed the next review when early practice occurred
    // on day 2, so a historical answer on day 8 earned no review bonus.
    state = structuredClone(state);
    for (const a of state.attempts) delete a.reviewScheduleVersion;
    state.attempts.at(-1)!.points = 0;
    const backup = parseQuizBackup({ type: "kjv-only-quiz", schema: 1, bank: bank.version, ...state }, bank);
    expect(rebuildQuizAttempts(bank, backup)).toEqual(state.attempts);
    state = add(state, 38);
    expect(state.attempts.at(-1)).toMatchObject({ points: 5, reviewScheduleVersion: 2 });
    expect(rebuildQuizAttempts(bank, state)).toEqual(state.attempts);
    const duplicated = { ...state, sessions: [...state.sessions, state.sessions[0]] };
    expect(validSnapshot(duplicated, bank)).toBe(false);
    for (const version of [null, 1, 3, "2"]) {
      const invalid = structuredClone(state) as unknown as { attempts: { reviewScheduleVersion: unknown }[] };
      invalid.attempts[0].reviewScheduleVersion = version;
      expect(validSnapshot(invalid, bank)).toBe(false);
    }
    for (const time of [NaN, Infinity, 0, -1, 8_640_000_000_000_000, 1e100]) {
      const invalid = structuredClone(state);
      invalid.attempts[0].time = time;
      expect(validSnapshot(invalid, bank)).toBe(false);
    }
  });

  it("caps review rewards at one per objective per local day after repeated lapses", () => {
    let state = add(add(empty(), 0), 1);
    state = add(add(state, 1.01, "wrong"), 1.02);
    expect(state.attempts.map(a => a.points)).toEqual([10, 5, 0, 0]);
    expect(stats(state, 1.02).reviewIntervalDays).toBe(1);
  });
});
