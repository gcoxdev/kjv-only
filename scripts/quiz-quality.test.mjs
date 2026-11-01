import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditQuizChoices, quizQualityFingerprint, reviewedQuizQuality } from "./quiz-quality.mjs";

const question = (change = {}) => ({ id: "sample", book: "Genesis", chapter: 1, scopeLevel: "chapter", difficulty: "Easy", kind: "choice", answer: "Light", choices: ["Light", "Darkness", "Waters", "Earth"], prompt: "What is called Day?", ...change });
describe("quiz authoring signals", () => {
  it("excludes ties and old option sets from answer-length signals", () => {
    const tied = question({ answer: "Earth", choices: ["Earth", "Light", "Cloud", "Night"], previousChoices: [["Earth", "A", "B", "C"]] });
    expect(auditQuizChoices([tied]).summary.uniqueLongest).toBe(0);
    expect(auditQuizChoices([tied]).summary.uniqueShortest).toBe(0);
    expect(auditQuizChoices([question({ answer: "A", choices: ["A", "Long", "Longer", "Longest"] })]).summary.uniqueShortest).toBe(1);
    const long = question({ answer: "Light and darkness", choices: ["Light and darkness", "Sea", "Sun", "Moon"] });
    expect(auditQuizChoices([long]).flagged[0]).toMatchObject({ severeLength: true, flags: ["answer-length-over-1.5x"] });
  });
  it("uses word boundaries for absolutes and whole normalized phrases for prompt hints", () => {
    const absoluteChoices = question({ choices: ["Light", "Only water", "No one", "All people"] });
    expect(auditQuizChoices([absoluteChoices]).summary.allDistractorsAbsolute).toBe(1);
    expect(auditQuizChoices([question({ choices: ["Light", "Small", "Everything", "Stonework"] })]).summary.distractorsWithAbsolutes).toBe(0);
    expect(auditQuizChoices([question({ prompt: "Which light is called Day?" })]).summary.answerInPrompt).toBe(1);
    expect(auditQuizChoices([question({ prompt: "Which delight is described?" })]).summary.answerInPrompt).toBe(0);
    // A flag can be legitimate: the prompt names all three alternatives.
    expect(auditQuizChoices([question({ answer: "Charity", choices: ["Charity", "Faith", "Hope"], prompt: "Which is greatest among faith, hope, and charity?" })]).summary.answerInPrompt).toBe(1);
  });
  it("does not evaluate non-choice exercises as multiple-choice questions", () => {
    const result = auditQuizChoices([question({ kind: "memory", answer: ["In the beginning"], choices: [] })]);
    expect(result.summary.choices).toBe(0);
    expect(result.flagged).toEqual([]);
  });
  it("keeps approved flags visible and invalidates changed wording or evidence", () => {
    const q = question({ prompt: "Which is greatest among faith, hope, and charity?", answer: "Charity", choices: ["Charity", "Faith", "Hope", "They are not compared"], refs: [{ label: "1 Corinthians 13:13" }] });
    const review = { id: q.id, fingerprint: quizQualityFingerprint(q), flags: ["answer-in-prompt"], rationale: "Names all three compared virtues without identifying the greatest.", evidence: "1 Corinthians 13:13" };
    const approved = reviewedQuizQuality([q], [review]);
    expect(approved.summary.answerInPrompt).toBe(1);
    expect(approved.flagged).toHaveLength(1);
    expect(approved.reviewed).toHaveLength(1);
    expect(approved.needsReview).toEqual([]);
    expect(approved.invalidReviews).toEqual([]);
    expect(reviewedQuizQuality([{ ...q, choices: [...q.choices].reverse(), previousChoices: [["A", "B", "C", "D"]] }], [review]).needsReview).toEqual([]);
    for (const change of [{ prompt: "Charity is greatest. What is greatest?" }, { choices: ["Charity", "Only faith", "Only hope", "Nothing"] }, { refs: [{ label: "Another passage" }] }, { explanation: "A changed explanation" }]) {
      const result = reviewedQuizQuality([{ ...q, ...change }], [review]);
      expect(result.invalidReviews).toEqual([q.id]);
      expect(result.needsReview).toHaveLength(1);
    }
    expect(reviewedQuizQuality([q, { ...q, id: "new-question" }], [review]).needsReview.map(row => row.id)).toEqual(["new-question"]);
    expect(reviewedQuizQuality([q], [{ ...review, flags: ["absolutes-in-every-distractor"] }]).invalidReviews).toEqual([q.id]);
    expect(() => reviewedQuizQuality([q], [review, review])).toThrow(/duplicate/);
    expect(() => reviewedQuizQuality([q], [{ ...review, rationale: "" }])).toThrow(/Invalid/);
  });
  it("does not worsen the current bank's aggregate cue counts", () => {
    const bank = JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8"));
    const { summary, flagged } = auditQuizChoices(bank.questions);
    // Reviewed 2026-10-31 closeout, NOT a quality target or item-level approval.
    // Natural alternatives reduced longest answers from 5,033 to 3,686; shortest
    // answers rose from 1,281 to 1,433. Track both without padding to meet a quota.
    // Any increase requires review; the following test also checks individual flags.
    const ceilings = { uniqueLongest: 3686, uniqueShortest: 1433, lengthOver1_5: 2, lengthOver1_8: 0, distractorsWithAbsolutes: 4453, allDistractorsAbsolute: 0, answerInPrompt: 1 };
    for (const [key, ceiling] of Object.entries(ceilings)) expect(summary[key], key).toBeLessThanOrEqual(ceiling);
    for (const id of ["43-15-1", "04-31-9", "05-29-4", "40-4-5"]) expect(flagged.some(q => q.id === id), `${id} should no longer trigger these signals`).toBe(false);
  });
  it("requires a current documented review for every remaining editorial signal", () => {
    const bank = JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8"));
    const reviews = JSON.parse(readFileSync("scripts/quiz-quality-reviews.json", "utf8"));
    const report = reviewedQuizQuality(bank.questions, reviews);
    expect(report.invalidReviews, "Changed wording or evidence needs a fresh review").toEqual([]);
    expect(report.needsReview.map(row => ({ id: row.id, flags: row.flags })), "Review new signals; do not merely add exceptions to pass CI").toEqual([]);
  });
});
