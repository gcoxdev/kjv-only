import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// Editorial signals, not correctness tests. Biblical absolutes and answers in
// quoted prompts can be appropriate; review the passage before rewriting.
const absolute = /\b(?:only|never|every|all|always|forever|permanently|immediately|no\s+one|nothing)\b/i;
const words = text => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Bind an editorial exception to its actual wording and evidence. A later edit
// must be reviewed again; old saved options and runtime shuffling are irrelevant.
export function quizQualityFingerprint(q) {
  return createHash("sha256").update(JSON.stringify({ id: q.id, prompt: q.prompt, answer: q.answer, choices: [...q.choices].sort(), refs: q.refs ?? [], explanation: q.explanation ?? "" })).digest("hex");
}
export function auditQuizChoices(questions) {
  const rows = questions.filter(q => q.kind === "choice").map(q => {
    const distractors = q.choices.filter(choice => choice !== q.answer);
    const longestDistractor = Math.max(0, ...distractors.map(choice => choice.length));
    const shortestDistractor = Math.min(Infinity, ...distractors.map(choice => choice.length));
    const answerAbsolute = absolute.test(q.answer);
    const distractorAbsolutes = distractors.filter(choice => absolute.test(choice)).length;
    const answerWords = words(q.answer);
    const promptContainsAnswer = !!answerWords && ` ${words(q.prompt)} `.includes(` ${answerWords} `);
    const flags = [];
    if (q.answer.length > 1.5 * longestDistractor) flags.push("answer-length-over-1.5x");
    if (!answerAbsolute && distractorAbsolutes === distractors.length && distractors.length) flags.push("absolutes-in-every-distractor");
    if (promptContainsAnswer) flags.push("answer-in-prompt");
    return {
      id: q.id, book: q.book, chapter: q.chapter, scope: q.scopeLevel, difficulty: q.difficulty,
      uniqueLongest: q.answer.length > longestDistractor,
      uniqueShortest: distractors.length > 0 && q.answer.length < shortestDistractor,
      severeLength: q.answer.length > 1.8 * longestDistractor,
      lengthRatio: longestDistractor ? Math.round(q.answer.length / longestDistractor * 1000) / 1000 : null,
      answerAbsolute, distractorAbsolutes, distractorCount: distractors.length, promptContainsAnswer, flags,
    };
  });
  const summarize = items => ({
    choices: items.length,
    uniqueLongest: items.filter(row => row.uniqueLongest).length,
    // Monitor the reverse cue too: making every distractor longer is not a fix.
    uniqueShortest: items.filter(row => row.uniqueShortest).length,
    lengthOver1_5: items.filter(row => row.flags.includes("answer-length-over-1.5x")).length,
    lengthOver1_8: items.filter(row => row.severeLength).length,
    answersWithAbsolutes: items.filter(row => row.answerAbsolute).length,
    distractorsWithAbsolutes: items.reduce((sum, row) => sum + row.distractorAbsolutes, 0),
    distractors: items.reduce((sum, row) => sum + row.distractorCount, 0),
    allDistractorsAbsolute: items.filter(row => row.flags.includes("absolutes-in-every-distractor")).length,
    answerInPrompt: items.filter(row => row.promptContainsAnswer).length,
  });
  const group = key => Object.fromEntries([...new Set(rows.map(row => row[key]))].sort().map(value => [value, summarize(rows.filter(row => row[key] === value))]));
  return {
    note: "Flags require KJV-based editorial review. Length balance is not proof of quality; do not pad choices or remove scriptural absolutes to meet a quota. Historical choices are excluded.",
    summary: summarize(rows), byScope: group("scope"), byDifficulty: group("difficulty"),
    // Severe length imbalances first, then the other review signals.
    flagged: rows.filter(row => row.flags.length).sort((a, b) => Number(b.severeLength) - Number(a.severeLength) || b.flags.length - a.flags.length || (b.lengthRatio ?? 0) - (a.lengthRatio ?? 0) || a.id.localeCompare(b.id)),
  };
}

export function reviewedQuizQuality(questions, reviews) {
  const report = auditQuizChoices(questions);
  if (!Array.isArray(reviews)) throw new Error("Quiz editorial reviews must be an array.");
  const questionsById = new Map(questions.map(q => [q.id, q]));
  const flagsById = new Map(report.flagged.map(row => [row.id, row]));
  const seen = new Set(), reviewedIds = new Set(), invalidReviews = [];
  for (const review of reviews) {
    if (!review || typeof review.id !== "string" || seen.has(review.id) || !Array.isArray(review.flags) || !review.flags.length || !review.flags.every(flag => typeof flag === "string") || new Set(review.flags).size !== review.flags.length || typeof review.fingerprint !== "string" || typeof review.rationale !== "string" || !review.rationale.trim() || typeof review.evidence !== "string" || !review.evidence.trim()) throw new Error("Invalid or duplicate quiz editorial review.");
    seen.add(review.id);
    const q = questionsById.get(review.id), row = flagsById.get(review.id);
    if (!q || !row || quizQualityFingerprint(q) !== review.fingerprint || JSON.stringify([...row.flags].sort()) !== JSON.stringify([...review.flags].sort())) invalidReviews.push(review.id);
    else reviewedIds.add(review.id);
  }
  return { ...report, reviewed: report.flagged.filter(row => reviewedIds.has(row.id)), needsReview: report.flagged.filter(row => !reviewedIds.has(row.id)), invalidReviews };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL("../", import.meta.url);
  const bank = JSON.parse(readFileSync(new URL("public/data/quiz-pilot-v1.json", root), "utf8"));
  const reviews = JSON.parse(readFileSync(new URL("scripts/quiz-quality-reviews.json", root), "utf8"));
  const report = reviewedQuizQuality(bank.questions, reviews);
  mkdirSync(new URL("reports/", root), { recursive: true });
  writeFileSync(new URL("reports/quiz-quality-current.json", root), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Editorial queue: ${report.needsReview.length} unreviewed, ${report.reviewed.length} reviewed exceptions; ${report.flagged.length} raw flags in reports/quiz-quality-current.json`);
  if (report.invalidReviews.length) { console.error(`Stale editorial reviews: ${report.invalidReviews.join(", ")}`); process.exitCode = 1; }
}
