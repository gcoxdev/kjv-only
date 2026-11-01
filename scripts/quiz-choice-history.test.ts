import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuizBank } from "@/lib/quiz/data";
import { applyQuizAction, createQuizSession, quizStats, rebuildQuizAttempts } from "@/lib/quiz/engine";
import { parseQuizBackup, validSnapshot } from "@/lib/quiz/storage";
import type { QuizSnapshot } from "@/lib/quiz/types";

const bank = parseQuizBank(JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8")));
const now = 1_790_000_000_000;
const revised = bank.questions.filter(q => q.previousChoices?.length);
const backup = (snapshot: QuizSnapshot) => ({ type: "kjv-only-quiz", schema: 1, bank: bank.version, exported: new Date(now).toISOString(), ...snapshot });

describe("revised quiz distractors and saved progress", () => {
  it("keeps reviewed legacy sets with their original correct answers", () => {
    expect(revised.map(q => q.id)).toEqual(expect.arrayContaining(["04-31-9", "05-29-4", "40-4-5"]));
    for (const q of revised) {
      for (const choices of q.previousChoices!) {
        expect(choices).toContain(q.answer);
        expect([...choices].sort()).not.toEqual([...q.choices].sort());
      }
    }
  });

  for (const mode of ["practice", "assessment"] as const) {
    it(`restores old correct, incorrect and unfinished ${mode} sessions without changing credit`, () => {
      for (const q of revised) {
        // Validate every edited question without rebuilding 8,980 unrelated
        // objective histories on each action. Full-bank parsing occurs above.
        const currentBank = { ...bank, questions: [q] };
        for (const choices of q.previousChoices!) {
          const oldQ = { ...q, choices, previousChoices: undefined };
          const oldBank = { ...bank, questions: [oldQ] };
          for (const answer of choices) {
            const oldSession = createQuizSession(oldBank, [oldQ], "Before revision", mode, "owner", now);
            const draft = applyQuizAction(oldBank, oldSession, [], { type: "answer", qid: q.id, answer }, now);
            expect(validSnapshot({ sessions: [draft.session], attempts: [] }, currentBank)).toBe(true);
            const expected = applyQuizAction(oldBank, draft.session, [], { type: "submit", qid: q.id, answer }, now);
            const resumed = applyQuizAction(currentBank, draft.session, [], { type: "submit", qid: q.id, answer }, now);
            expect(resumed).toEqual(expected);
            const done = applyQuizAction(currentBank, resumed.session, resumed.attempts, { type: "finish" }, now);
            const restored = parseQuizBackup(backup({ sessions: [done.session], attempts: done.attempts }), currentBank);
            expect(restored.sessions[0].entries[0].choices).toEqual(oldSession.entries[0].choices);
            expect(rebuildQuizAttempts(currentBank, restored)).toEqual(done.attempts);
            expect(quizStats(currentBank, restored.attempts, now).get(q.objective)?.learned).toBe(answer === q.answer);
            expect(parseQuizBackup(restored, currentBank)).toEqual(restored);
          }
        }
      }
    }, 30_000);
  }

  it("uses new choices in new sessions and rejects answers mixed between editions", () => {
    for (const q of revised) {
      const currentBank = { ...bank, questions: [q] };
      const fresh = createQuizSession(currentBank, [q], "After revision", "practice", "owner", now);
      expect([...fresh.entries[0].choices].sort()).toEqual([...q.choices].sort());
      const old = structuredClone(fresh);
      old.entries[0].choices = [...q.previousChoices![0]].reverse();
      const oldWrong = old.entries[0].choices.find(choice => !q.choices.includes(choice))!;
      const newWrong = q.choices.find(choice => !old.entries[0].choices.includes(choice))!;
      for (const [session, answer] of [[fresh, oldWrong], [old, newWrong]] as const) {
        expect(() => applyQuizAction(currentBank, session, [], { type: "submit", qid: q.id, answer }, now)).toThrow(/Invalid answer/);
        const mixedAnswer = structuredClone(session);
        mixedAnswer.entries[0].answer = answer;
        expect(validSnapshot({ sessions: [mixedAnswer], attempts: [] }, currentBank)).toBe(false);
      }
      // With a single changed distractor, substituting its predecessor can
      // recreate a valid old set. Reject only genuinely mixed/unrecognized sets.
      for (const choice of fresh.entries[0].choices.filter(c => c !== q.answer)) {
        const mixedChoices = structuredClone(fresh);
        mixedChoices.entries[0].choices[mixedChoices.entries[0].choices.indexOf(choice)] = oldWrong;
        const key = [...mixedChoices.entries[0].choices].sort().join("\0");
        const approved = [q.choices, ...q.previousChoices!].some(set => [...set].sort().join("\0") === key);
        expect(validSnapshot({ sessions: [mixedChoices], attempts: [] }, currentBank)).toBe(approved);
      }
      const unknownChoices = structuredClone(old);
      unknownChoices.entries[0].choices[0] = "Unrecognized distractor";
      expect(validSnapshot({ sessions: [unknownChoices], attempts: [] }, currentBank)).toBe(false);

      const payload = { ...backup({ sessions: [old], attempts: [] }), unsavedDrafts: [{ key: `${old.id}:${q.id}`, answer: oldWrong }] };
      expect(parseQuizBackup(payload, currentBank).sessions[0].entries[0].answer).toBe(oldWrong);
      payload.unsavedDrafts[0].answer = newWrong;
      expect(() => parseQuizBackup(payload, currentBank)).toThrow(/Invalid draft/);
    }
  }, 30_000);

  it("rejects malformed historical option sets and histories without the current answer", () => {
    const q = revised[0];
    const check = (change: object) => () => parseQuizBank({ ...bank, questions: [{ ...q, conflicts: [], ...change }] });
    for (const previousChoices of [null, ["wrong shape"], [["wrong", "wrong", "wrong", q.answer]], [[...q.choices.slice(1), "Replacement answer"]], [q.choices.slice(1)], [[q.answer, "", "other", "another"]]]) {
      expect(check({ previousChoices })).toThrow(/choice history/);
    }
    const text = bank.questions.find(q => q.kind === "text")!;
    expect(() => parseQuizBank({ ...bank, questions: [{ ...text, conflicts: [], previousChoices: [q.choices] }] })).toThrow(/choice history/);
  });
});
