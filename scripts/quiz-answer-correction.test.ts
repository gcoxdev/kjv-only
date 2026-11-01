import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuizBank } from "@/lib/quiz/data";
import { applyQuizAction, createQuizSession, DAY, gradeQuizAnswer, gradeQuizEntry, quizStats, rebuildQuizAttempts } from "@/lib/quiz/engine";
import { parseQuizBackup, validSnapshot } from "@/lib/quiz/storage";
import { quizCompletionBadges } from "@/lib/quiz/mastery";
import type { QuizSnapshot } from "@/lib/quiz/types";

const fullBank = parseQuizBank(JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8")));
const q = fullBank.questions.find(q => q.id === "24-20-2")!;
const edition = q.previousChoiceEditions![0];
const bank = { ...fullBank, questions: [q] };
const oldQ = { ...q, answer: edition.answer, choices: edition.choices, previousChoiceEditions: undefined };
const oldBank = { ...bank, questions: [oldQ] };
const now = 1_790_000_000_000;
const backup = (snapshot: QuizSnapshot) => ({ type: "kjv-only-quiz", schema: 1, bank: bank.version, exported: new Date(now).toISOString(), ...snapshot });

describe("corrected quiz answers and historical editions", () => {
  it("separates household captivity from the named Babylonian death sentence", () => {
    expect(q.answer).toBe("Terror, friends slain before his eyes, captivity for him and his household, and his own death and burial in Babylon");
    expect(q.explanation).toContain("it does not explicitly extend that statement to every member of his household");
    expect(q.refs[0].verses.find(v => v.number === 6)?.text).toContain("all that dwell in thine house shall go into captivity");
    expect(q.choices).not.toContain(edition.answer);
    expect(gradeQuizAnswer(q, edition.answer)).toBe(false);
    expect(gradeQuizAnswer(q, q.answer)).toBe(true);
  });

  for (const mode of ["practice", "assessment"] as const) {
    it(`retains old ${mode} grades, drafts, assistance and skipped answers`, () => {
      for (const answer of edition.choices) for (const variant of ["plain", "assisted", "skipped"] as const) {
        let session = createQuizSession(oldBank, [oldQ], "Old wording", mode, "owner", now);
        // An old assessment cannot acquire hints, but already-assisted practice can.
        if (variant === "assisted" && mode === "practice") session = applyQuizAction(oldBank, session, [], { type: "help", qid: q.id, help: "answer" }, now).session;
        const draft = applyQuizAction(oldBank, session, [], { type: "answer", qid: q.id, answer }, now);
        expect(validSnapshot({ sessions: [draft.session], attempts: [] }, bank)).toBe(true);
        const action = { type: "submit" as const, qid: q.id, answer, skip: variant === "skipped" };
        const expected = applyQuizAction(oldBank, draft.session, [], action, now);
        const actual = applyQuizAction(bank, draft.session, [], action, now);
        expect(actual).toEqual(expected);
        const done = applyQuizAction(bank, actual.session, actual.attempts, { type: "finish" }, now);
        expect(done).toEqual(applyQuizAction(oldBank, expected.session, expected.attempts, { type: "finish" }, now));
        const restored = parseQuizBackup(backup({ sessions: [done.session], attempts: done.attempts }), bank);
        expect(rebuildQuizAttempts(bank, restored)).toEqual(done.attempts);
        expect(parseQuizBackup(restored, bank)).toEqual(restored);
        expect(gradeQuizEntry(q, done.session.entries[0])).toBe(variant !== "skipped" && answer === edition.answer);
      }
      const session = createQuizSession(oldBank, [oldQ], "Unsaved answer", mode, "owner", now);
      const restored = parseQuizBackup({ ...backup({ sessions: [session], attempts: [] }), unsavedDrafts: [{ key: `${session.id}:${q.id}`, answer: edition.answer }] }, bank);
      expect(restored.sessions[0].entries[0].answer).toBe(edition.answer);
    });
  }

  it("keeps learning and mastery without awarding a second first-learning reward", () => {
    const old = createQuizSession(oldBank, [oldQ], "Earlier quiz", "practice", "owner", now);
    const first = applyQuizAction(oldBank, old, [], { type: "submit", qid: q.id, answer: edition.answer }, now);
    const fresh = createQuizSession(bank, [q], "Corrected quiz", "practice", "owner", now + 7 * DAY);
    const second = applyQuizAction(bank, fresh, first.attempts, { type: "submit", qid: q.id, answer: q.answer }, now + 7 * DAY);
    expect(second.attempts.map(a => a.points)).toEqual([20, 5]);
    expect(quizStats(bank, second.attempts, now + 7 * DAY).get(q.objective)).toMatchObject({ learned: true, mastered: true });
    const release = { id: "correction-test", label: "Same objective", groups: { "chapter:23:20": [[q.objective, q.version] as [string, number]] } };
    expect(quizCompletionBadges([release], second.attempts).map(b => b.kind).sort()).toEqual(["Learned", "Mastered"]);
    const snapshot = { sessions: [first.session, second.session], attempts: second.attempts };
    expect(rebuildQuizAttempts(bank, parseQuizBackup(backup(snapshot), bank))).toEqual(second.attempts);
  });

  it("rejects swapped answer sets and forged historical correctness", () => {
    const fresh = createQuizSession(bank, [q], "Current", "practice", "owner", now);
    expect(() => applyQuizAction(bank, fresh, [], { type: "submit", qid: q.id, answer: edition.answer }, now)).toThrow(/Invalid answer/);
    const old = createQuizSession(oldBank, [oldQ], "Old", "practice", "owner", now);
    expect(() => applyQuizAction(bank, old, [], { type: "submit", qid: q.id, answer: q.answer }, now)).toThrow(/Invalid answer/);
    const mixed = structuredClone(old);
    mixed.entries[0].choices[1] = q.choices[1];
    expect(validSnapshot({ sessions: [mixed], attempts: [] }, bank)).toBe(false);
    const wrong = applyQuizAction(oldBank, old, [], { type: "submit", qid: q.id, answer: edition.choices[1] }, now);
    wrong.attempts[0].correct = true;
    expect(() => parseQuizBackup(backup({ sessions: [wrong.session], attempts: wrong.attempts }), bank)).toThrow(/compatible quiz backup/);
    expect(() => parseQuizBackup({ ...backup({ sessions: [fresh], attempts: [] }), unsavedDrafts: [{ key: `${fresh.id}:${q.id}`, answer: edition.answer }] }, bank)).toThrow(/Invalid draft/);
  });

  it("rejects ambiguous or malformed historical keys", () => {
    const check = (previousChoiceEditions: unknown) => () => parseQuizBank({ ...bank, questions: [{ ...q, previousChoiceEditions }] });
    for (const invalid of [null, [null], [{ ...edition, answer: "Absent" }], [{ ...edition, correction: "" }], [{ ...edition, choices: [edition.answer, "same", "same", "same"] }], [{ ...edition, choices: edition.choices.slice(1) }], [{ ...edition, choices: [edition.answer, "a".repeat(501), "b", "c"] }]]) expect(check(invalid)).toThrow(/answer history/);
    expect(check([edition, { ...edition, choices: [...edition.choices].reverse() }])).toThrow(/Ambiguous/);
    expect(check([{ ...edition, choices: q.choices, answer: q.choices[1] }])).toThrow(/Ambiguous/);
    expect(() => parseQuizBank({ ...bank, questions: [{ ...q, kind: "map" }] })).toThrow(/answer history/);
  });
});
