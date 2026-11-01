import type { QuizBank, QuizQuestion } from "./types";
import { QUIZ_BANK_URL, QUIZ_KINDS, QUIZ_SKILLS } from "./engine";
import { QUIZ_MAP_REGIONS, quizMapPoint, quizMapRegion, type QuizMapRegion } from "./map-regions";
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === "string");
export function parseQuizBank(value: unknown): QuizBank {
  if (!record(value) || value.version !== "pilot-1" || !strings(value.books) || value.books.length !== 66 || !Array.isArray(value.featured) || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > 10_000) throw new Error("Invalid quiz question pack.");
  const books = value.books;
  const ids = new Set<string>();
  for (const q of value.questions) {
    if (!record(q) || typeof q.id !== "string" || !q.id || ids.has(q.id) || typeof q.objective !== "string" || !q.objective || q.version !== 1 || !books.includes(String(q.book)) || !Number.isInteger(q.chapter) || typeof q.prompt !== "string" || !q.prompt || typeof q.explanation !== "string" || !Object.hasOwn(QUIZ_KINDS, String(q.kind)) || !Object.hasOwn(QUIZ_SKILLS, String(q.skill)) || !["Easy", "Medium", "Hard"].includes(String(q.difficulty)) || !["OT", "NT"].includes(String(q.testament)) || !["chapter", "book", "testament", "bible"].includes(String(q.scopeLevel)) || !strings(q.choices) || !strings(q.conflicts) || !Array.isArray(q.refs) || !Array.isArray(q.contexts)) throw new Error("Invalid quiz question.");
    ids.add(q.id);
    if (q.practiceSet !== undefined && !["memory", "book-order"].includes(String(q.practiceSet))) throw new Error("Invalid optional quiz set.");
    if (q.kind === "memory" || q.practiceSet === "memory") {
      if (q.kind !== "memory" || q.practiceSet !== "memory" || !strings(q.answer) || q.answer.length !== 1 || !q.answer[0].trim() || q.answer[0].length > 500 || q.choices.length || q.refs.length !== 1) throw new Error("Invalid memory exercise.");
    }
    if (q.practiceSet === "book-order" && (q.kind !== "order" || !["testament", "bible"].includes(String(q.scopeLevel)) || !strings(q.answer) || q.answer.join("|") !== (q.scopeLevel === "bible" ? books : q.testament === "OT" ? books.slice(0, 39) : books.slice(39)).join("|"))) throw new Error("Invalid book-order challenge.");
    if (q.previousLearningPoints !== undefined && (!Array.isArray(q.previousLearningPoints) || !q.previousLearningPoints.every(points => [10, 20, 30].includes(points)) || new Set(q.previousLearningPoints).size !== q.previousLearningPoints.length)) throw new Error("Invalid quiz reward history.");
    for (const r of q.refs) if (!record(r) || !books.includes(String(r.book)) || !Number.isInteger(r.chapter) || typeof r.label !== "string" || !Array.isArray(r.verses) || !r.verses.length || !r.verses.every(v => record(v) && Number.isInteger(v.number) && typeof v.text === "string")) throw new Error("Invalid quiz evidence.");
    for (const c of q.contexts) if (!record(c) || !books.includes(String(c.book)) || !Number.isInteger(c.chapter)) throw new Error("Invalid quiz context.");
    const contexts = q.contexts;
    if (q.scopeLevel === "book" && (!q.refs.length || !q.contexts.length || q.refs.some(r => r.book !== q.book) || q.contexts.some(c => c.book !== q.book) || q.refs.some(r => !contexts.some(c => c.book === r.book && c.chapter === r.chapter)))) throw new Error("Invalid book-wide quiz context.");
    if (q.kind === "choice" || q.kind === "map") { if (typeof q.answer !== "string" || !q.choices.includes(q.answer)) throw new Error("Invalid quiz choices."); }
    else if (!strings(q.answer) || !q.answer.length) throw new Error("Invalid quiz answer.");
    if (q.previousChoices !== undefined) {
      const choiceCount = q.choices.length, answer = q.answer;
      if (q.kind !== "choice" || typeof answer !== "string" || !Array.isArray(q.previousChoices) || !q.previousChoices.every(choices => strings(choices) && choices.length === choiceCount && new Set(choices).size === choices.length && choices.every(c => c.trim() && c.length <= 500) && choices.includes(answer))) throw new Error("Invalid quiz choice history.");
    }
    if (q.previousChoiceEditions !== undefined) {
      const choiceCount = q.choices.length;
      const validEdition = (edition: unknown) => record(edition) && strings(edition.choices) && edition.choices.length === choiceCount && new Set(edition.choices).size === choiceCount && edition.choices.every(c => c.trim() && c.length <= 500) && typeof edition.answer === "string" && edition.answer !== q.answer && edition.choices.includes(edition.answer) && typeof edition.correction === "string" && !!edition.correction.trim();
      if (q.kind !== "choice" || !Array.isArray(q.previousChoiceEditions) || !q.previousChoiceEditions.every(validEdition)) throw new Error("Invalid quiz answer history.");
      const sets = [q.choices, ...(q.previousChoices as string[][] | undefined ?? []), ...q.previousChoiceEditions.map(edition => (edition as { choices: string[] }).choices)];
      if (new Set(sets.map(choices => JSON.stringify([...choices].sort()))).size !== sets.length) throw new Error("Ambiguous quiz answer history.");
    }
    if (["family", "match"].includes(String(q.kind)) && (!strings(q.slots) || !strings(q.answer) || q.slots.length !== q.answer.length || !q.answer.every(a => (q.choices as string[]).includes(a)))) throw new Error("Invalid quiz placement.");
    if (q.kind === "map") {
      const choices = q.choices;
      if (q.mapRegion !== undefined && (typeof q.mapRegion !== "string" || !Object.hasOwn(QUIZ_MAP_REGIONS, q.mapRegion))) throw new Error("Invalid quiz map region.");
      if (choices.join("|") !== "A|B|C" || !strings(q.mapLabels) || q.mapLabels.length !== 3 || !q.mapLabels.every((label, i) => label.startsWith(`${choices[i]} · `) && label.length > 4) || !Array.isArray(q.places) || q.places.length !== 3 || !q.places.every(p => record(p) && typeof p.name === "string" && p.name && typeof p.sourceId === "string" && p.sourceId && typeof p.lon === "number" && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 && typeof p.lat === "number" && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90)) throw new Error("Invalid quiz map.");
      const frame = { mapRegion: q.mapRegion as QuizMapRegion | undefined };
      const { width, height } = quizMapRegion(frame);
      const radius = !q.mapRegion || q.mapRegion === "north-aegean" ? 24 : 27;
      const points = (q.places as { lon: number; lat: number }[]).map(p => quizMapPoint(frame, p));
      if (points.some((p, i) => p.x < radius || p.x > width - radius || p.y < radius || p.y > height - radius || points.slice(i + 1).some(other => Math.hypot(p.x - other.x, p.y - other.y) < radius * 2 + 6))) throw new Error("Quiz map markers must fit without overlap.");
    }
  }
  if (!(value.questions as QuizQuestion[]).every(q => q.conflicts.every(id => ids.has(id)))) throw new Error("Invalid quiz overlap definitions.");
  const questions = value.questions as QuizQuestion[];
  const byId = new Map(questions.map(q => [q.id, q]));
  const contextKey = (q: QuizQuestion) => q.contexts.map(c => `${c.book}:${c.chapter}`).sort().join("|");
  const rewardHistoryKey = (q: QuizQuestion) => [...(q.previousLearningPoints ?? [])].sort().join("|");
  for (const q of questions) {
    const primary = byId.get(q.objective);
    // Keep a stable, playable primary form. Alternate forms cannot move an objective
    // between scopes, versions, difficulty rewards, or reading-progress requirements.
    if (!primary || primary.objective !== primary.id || ["version", "book", "chapter", "testament", "scopeLevel", "skill", "difficulty", "practiceSet"].some(key => q[key as keyof QuizQuestion] !== primary[key as keyof QuizQuestion]) || contextKey(q) !== contextKey(primary)) throw new Error("Invalid quiz alternate form.");
    if (rewardHistoryKey(q) !== rewardHistoryKey(primary)) throw new Error("Invalid quiz alternate reward history.");
  }
  return value as QuizBank;
}
let bankPromise: Promise<QuizBank> | undefined;
export function loadQuizBank() {
  return bankPromise ??= fetch(QUIZ_BANK_URL).then(async r => { if (!r.ok) throw new Error("Quiz questions are unavailable. Download Bible & tools while online, then try again."); return parseQuizBank(await r.json()); }).catch(e => { bankPromise = undefined; throw e; });
}
