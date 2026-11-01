import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditQuizChoices } from "./quiz-quality.mjs";

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
  it("does not worsen the current bank's aggregate cue counts", () => {
    const bank = JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8"));
    const { summary, flagged } = auditQuizChoices(bank.questions);
    // Reviewed 2026-10-31 starting point, NOT a quality target or an item-level
    // approval. Tighten these ceilings as editorial batches land. Any increase
    // requires review; never pad wording merely to pass this guard.
    const ceilings = { uniqueLongest: 5033, uniqueShortest: 1281, lengthOver1_5: 1279, lengthOver1_8: 0, distractorsWithAbsolutes: 6603, allDistractorsAbsolute: 371, answerInPrompt: 1 };
    for (const [key, ceiling] of Object.entries(ceilings)) expect(summary[key], key).toBeLessThanOrEqual(ceiling);
    for (const id of ["43-15-1", "04-31-9", "05-29-4", "40-4-5"]) expect(flagged.some(q => q.id === id), `${id} should no longer trigger these signals`).toBe(false);
  });
});
