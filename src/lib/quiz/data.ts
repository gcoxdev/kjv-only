import type { QuizBank, QuizQuestion } from "./types";
import { QUIZ_BANK_URL, QUIZ_KINDS, QUIZ_SKILLS } from "./engine";
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === "string");
export function parseQuizBank(value: unknown): QuizBank {
  if (!record(value) || value.version !== "pilot-1" || !strings(value.books) || value.books.length !== 66 || !Array.isArray(value.featured) || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > 10_000) throw new Error("Invalid quiz question pack.");
  const books = value.books;
  const ids = new Set<string>();
  for (const q of value.questions) {
    if (!record(q) || typeof q.id !== "string" || ids.has(q.id) || q.objective !== q.id || q.version !== 1 || !books.includes(String(q.book)) || !Number.isInteger(q.chapter) || typeof q.prompt !== "string" || !q.prompt || typeof q.explanation !== "string" || !Object.hasOwn(QUIZ_KINDS, String(q.kind)) || !Object.hasOwn(QUIZ_SKILLS, String(q.skill)) || !["Easy", "Medium", "Hard"].includes(String(q.difficulty)) || !["OT", "NT"].includes(String(q.testament)) || !["chapter", "testament", "bible"].includes(String(q.scopeLevel)) || !strings(q.choices) || !strings(q.conflicts) || !Array.isArray(q.refs) || !Array.isArray(q.contexts)) throw new Error("Invalid quiz question.");
    ids.add(q.id);
    for (const r of q.refs) if (!record(r) || !books.includes(String(r.book)) || !Number.isInteger(r.chapter) || typeof r.label !== "string" || !Array.isArray(r.verses) || !r.verses.length || !r.verses.every(v => record(v) && Number.isInteger(v.number) && typeof v.text === "string")) throw new Error("Invalid quiz evidence.");
    for (const c of q.contexts) if (!record(c) || !books.includes(String(c.book)) || !Number.isInteger(c.chapter)) throw new Error("Invalid quiz context.");
    if (q.kind === "choice" || q.kind === "map") { if (typeof q.answer !== "string" || !q.choices.includes(q.answer)) throw new Error("Invalid quiz choices."); }
    else if (!strings(q.answer) || !q.answer.length) throw new Error("Invalid quiz answer.");
    if (["family", "match"].includes(String(q.kind)) && (!strings(q.slots) || !strings(q.answer) || q.slots.length !== q.answer.length || !q.answer.every(a => (q.choices as string[]).includes(a)))) throw new Error("Invalid quiz placement.");
    if (q.kind === "map" && (!strings(q.mapLabels) || q.mapLabels.length !== q.choices.length || !Array.isArray(q.places) || q.places.length !== 3 || !q.places.every(p => record(p) && typeof p.lon === "number" && Number.isFinite(p.lon) && typeof p.lat === "number" && Number.isFinite(p.lat)))) throw new Error("Invalid quiz map.");
  }
  if (!(value.questions as QuizQuestion[]).every(q => q.conflicts.every(id => ids.has(id)))) throw new Error("Invalid quiz overlap definitions.");
  return value as QuizBank;
}
let bankPromise: Promise<QuizBank> | undefined;
export function loadQuizBank() {
  return bankPromise ??= fetch(QUIZ_BANK_URL).then(async r => { if (!r.ok) throw new Error("Quiz questions are unavailable. Download Bible & tools while online, then try again."); return parseQuizBank(await r.json()); }).catch(e => { bankPromise = undefined; throw e; });
}
