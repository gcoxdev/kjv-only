import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuizBank } from "@/lib/quiz/data";
import { applyQuizAction, createQuizSession, DAY, filterQuizQuestions, gradeQuizAnswer, quizFamilyRoot, quizObjectives, quizReferenceCode, quizScopeLabel, quizStats, rebuildQuizAttempts, selectQuizQuestions, validQuizAnswer } from "@/lib/quiz/engine";
import { parseQuizBackup, validSnapshot } from "@/lib/quiz/storage";
import { parseLayoutHash, serializeLayoutHash } from "@/lib/layout-hash";
import { createInitialTab } from "@/lib/reader-layout";
import { normalizeStudyWorkspaceTab } from "@/hooks/use-study-workspace-state";
import { parseBibleReference } from "@/lib/references";
import { CORE_OFFLINE_URLS } from "@/lib/offline-downloads";
import { QUIZ_MAP_REGIONS, quizMapPoint } from "@/lib/quiz/map-regions";
import type { QuizAttempt, QuizBank, QuizFilters, QuizQuestion, QuizSnapshot } from "@/lib/quiz/types";
const bank = parseQuizBank(JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8")));
const q = bank.questions.find(q => q.id === "psalm-recall")!;
const now = 1_790_000_000_000;
function session(mode: "practice" | "assessment" = "practice") { return createQuizSession(bank, [q], "Psalm recall", mode, "test-owner", now); }
function submit(s = session(), attempts: QuizAttempt[] = [], time = now, answer = "soul") { return applyQuizAction(bank, s, attempts, { type: "submit", qid: q.id, answer }, time); }
describe("quiz question bank and grading", () => {
  it("checks the actual bank and every embedded KJV verse", () => {
    const corpus = JSON.parse(readFileSync("public/data/kjv.json", "utf8")) as { books: { name: string; chapters: { chapter: number; verses: { verse: number; tokens: { text: string }[] }[] }[] }[] };
    const verses = new Map(corpus.books.flatMap(b => b.chapters.flatMap(c => c.verses.map(v => [`${b.name}:${c.chapter}:${v.verse}`, v.tokens.map(t => t.text).join(" ").replace(/\s+([,.;:?!])/g, "$1")] as const))));
    expect(bank.questions).toHaveLength(8986);
    expect(bank.featured).toHaveLength(1189);
    expect(quizObjectives(bank.questions)).toHaveLength(8980);
    for (const book of bank.books) expect(bank.questions.some(q => q.book === book && q.scopeLevel === "book"), `${book} has dedicated connections`).toBe(true);
    const chapterKeys = corpus.books.flatMap(b => b.chapters.map(c => `${b.name}:${c.chapter}`));
    expect(bank.featured.map(c => `${c.book}:${c.chapter}`).sort()).toEqual([...chapterKeys].sort());
    for (const book of corpus.books) {
      for (const chapter of book.chapters) {
        const available = filterQuizQuestions(bank, { scope: "chapter", book: book.name, chapter: chapter.chapter, skill: "all", difficulty: "all", readOnly: false }, new Set());
        expect(available.length, `${book.name} ${chapter.chapter} has playable questions`).toBeGreaterThan(0);
      }
    }
    for (const question of bank.questions) {
      const canonical = (question.kind === "text" || question.kind === "memory") ? question.answer[0] : question.answer;
      expect(gradeQuizAnswer(question, canonical), question.id).toBe(true);
      expect(gradeQuizAnswer(question, "not an answer"), question.id).toBe(false);
      for (const r of question.refs) {
        expect(parseBibleReference(quizReferenceCode(r)), r.label).toMatchObject({ bookIndex: bank.books.indexOf(r.book), startChapterIndex: r.chapter - 1, endChapterIndex: r.chapter - 1, startVerse: r.verses[0].number, endVerse: r.verses.at(-1)!.number });
        for (const v of r.verses) expect(v.text, `${r.label}:${v.number}`).toBe(verses.get(`${r.book}:${r.chapter}:${v.number}`));
      }
    }
  // Full-corpus validation is a content audit, not an interaction latency test.
  }, 30_000);
  it("normalizes short recall without accepting different words", () => {
    expect(gradeQuizAnswer(q, "  SOUL! ")).toBe(true);
    expect(gradeQuizAnswer(q, "souls")).toBe(false);
    const age = bank.questions.find(q => q.id === "genesis-age-recall")!;
    expect(gradeQuizAnswer(age, "nine hundred and twelve years")).toBe(true);
    expect(gradeQuizAnswer(age, "930")).toBe(false);
  });
  it("uses the stated ancestor for each family line instead of a fixed example", () => {
    const roots = {"genealogy-tree":"Jared", "08-4-8":"Boaz", "connections-levi-priestly-line":"Levi", "connections-adam-seth-line":"Adam", "connections-cain-descendant-line":"Cain", "connections-shem-descendant-line":"Shem", "connections-abraham-judah-line":"Abraham", "connections-david-judah-kings-line":"David"};
    for (const [id, root] of Object.entries(roots)) expect(quizFamilyRoot(bank.questions.find(q => q.id === id)!), id).toBe(root);
    expect(quizFamilyRoot(q)).toBeUndefined();
  });
  it("keeps regional map points tied to local geography and preserves the original projection", () => {
    for (const question of bank.questions.filter(q => q.kind === "map")) {
      for (const place of question.places!) {
        const { x, y } = quizMapPoint(question, place);
        expect(Number.isFinite(x) && Number.isFinite(y), question.id).toBe(true);
        if (!question.mapRegion) {
          expect(x).toBeCloseTo(60 + (place.lon - 24.4) / 1.8 * 410);
          expect(y).toBeCloseTo(245 - (place.lat - 39.7) / 1.3 * 200);
        } else {
          const source = JSON.parse(readFileSync(`public/maps/geometry/${place.sourceId}`, "utf8")) as { features: { geometry: { type: string; coordinates: number[] } }[] };
          expect(source.features.some(f => f.geometry.type === "Point" && f.geometry.coordinates[0] === place.lon && f.geometry.coordinates[1] === place.lat), `${question.id}: ${place.name}`).toBe(true);
        }
      }
    }
    for (const [mapRegion, region] of Object.entries(QUIZ_MAP_REGIONS)) {
      if (mapRegion === "north-aegean") continue;
      const [west, south, east, north] = region.bounds;
      const horizontal = (east - west) * Math.cos((south + north) / 2 * Math.PI / 180);
      expect(horizontal / (north - south)).toBeCloseTo(region.width / region.height);
      expect(region.shapes.length).toBeGreaterThan(0);
    }
  });
  it("rejects unknown map frames, malformed labels, off-map coordinates and colliding markers", () => {
    const map = { ...bank.questions.find(q => q.id === "acts-map")!, conflicts: [] };
    const check = (change: object) => () => parseQuizBank({ ...bank, questions: [{ ...map, ...change }] });
    for (const mapRegion of ["missing", "toString", null, 5]) expect(check({ mapRegion })).toThrow(/map region/);
    expect(check({ choices: ["B", "A", "C"] })).toThrow(/map/);
    expect(check({ mapLabels: ["A", "B", "C"] })).toThrow(/map/);
    expect(check({ places: map.places!.slice(1) })).toThrow(/map/);
    for (const change of [{ lon: NaN }, { lat: 91 }, { name: "" }, { sourceId: "" }]) expect(check({ places: [{ ...map.places![0], ...change }, ...map.places!.slice(1)] })).toThrow(/map/);
    expect(check({ places: [{ ...map.places![0], lon: 0 }, ...map.places!.slice(1)] })).toThrow(/fit without overlap/);
    expect(check({ places: [map.places![1], ...map.places!.slice(1)] })).toThrow(/fit without overlap/);
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
  const alternate: QuizQuestion = { ...q, id: "test-soul-choice", kind: "choice", answer: "soul", choices: ["soul", "house", "flock"], prompt: "What does the shepherd restore?" };
  const withAlternate = { ...bank, questions: [...bank.questions, alternate] };
  it("shares alternate-form credit without inflating objectives or losing old backups", () => {
    expect(parseQuizBank(withAlternate)).toEqual(withAlternate);
    expect(quizObjectives(withAlternate.questions)).toHaveLength(quizObjectives(bank.questions).length);
    const first = submit();
    expect(validSnapshot({ sessions: [first.session], attempts: first.attempts }, withAlternate)).toBe(true);
    const next = createQuizSession(withAlternate, [alternate], "Alternate", "practice", "owner", now + 10_000);
    const result = applyQuizAction(withAlternate, next, first.attempts, { type: "submit", qid: alternate.id, answer: "soul" }, now + 10_000);
    expect(result.attempts.at(-1)).toMatchObject({ objective: q.objective, qid: alternate.id, points: 0 });
    expect(quizStats(withAlternate, result.attempts, now + 10_000).get(q.objective)).toMatchObject({ learned: true, mastered: false });
    const later = createQuizSession(withAlternate, [alternate], "Delayed alternate", "practice", "owner", now + 8 * DAY);
    const reviewed = applyQuizAction(withAlternate, later, result.attempts, { type: "submit", qid: alternate.id, answer: "soul" }, now + 8 * DAY);
    expect(reviewed.attempts.at(-1)?.points).toBe(5);
    expect(quizStats(withAlternate, reviewed.attempts, now + 8 * DAY).get(q.objective)?.mastered).toBe(true);
    expect(quizStats(withAlternate, reviewed.attempts).size).toBe(quizObjectives(bank.questions).length);
    const backup = { type: "kjv-only-quiz", schema: 1, bank: bank.version, sessions: [first.session, result.session, reviewed.session], attempts: reviewed.attempts };
    expect(parseQuizBackup(backup, withAlternate).attempts).toEqual(reviewed.attempts);
  });
  it("selects only one form and prefers a different form on the next review", () => {
    const first = submit();
    expect(selectQuizQuestions(withAlternate, [q, alternate], first.attempts, 2, () => 0.99).map(q => q.id)).toEqual([alternate.id]);
    expect(() => createQuizSession(withAlternate, [q, alternate], "Repeated objective", "practice", "owner")).toThrow("each objective only once");
    const one = createQuizSession(withAlternate, [q], "Invalid duplicate", "practice", "owner");
    const two = createQuizSession(withAlternate, [alternate], "Other", "practice", "owner");
    expect(validSnapshot({ sessions: [{ ...one, entries: [...one.entries, ...two.entries] }], attempts: [] }, withAlternate)).toBe(false);
  });
  it("applies conflicts to every form, including links declared only by an alternate", () => {
    const other: QuizQuestion = { ...q, id: "test-related", objective: "test-related", conflicts: [] };
    const variant = { ...alternate, conflicts: [other.id] };
    const testBank = { ...bank, questions: [...bank.questions, variant, other] };
    expect(parseQuizBank(testBank)).toEqual(testBank);
    for (const pair of [[q, other], [other, q], [variant, other], [other, variant]]) {
      expect(selectQuizQuestions(testBank, pair, [], 2, () => 0.99)).toHaveLength(1);
    }
  });
  it("rejects orphaned, cyclic, differently rewarded, or differently scoped forms", () => {
    for (const change of [{ objective: "missing" }, { difficulty: "Hard" }, { scopeLevel: "book" }, { contexts: [] }, { version: 2 }]) {
      expect(() => parseQuizBank({ ...bank, questions: [...bank.questions, { ...alternate, ...change }] })).toThrow();
    }
    expect(() => parseQuizBank({ ...bank, questions: [...bank.questions, { ...alternate, objective: "test-cycle" }, { ...alternate, id: "test-cycle", objective: alternate.id }] })).toThrow("Invalid quiz alternate form");
  });
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
    expect(rebuildQuizAttempts(bank, { sessions: [finished.session], attempts: finished.attempts })).toEqual(finished.attempts);
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
  const bookQuestion: QuizQuestion = {
    ...bank.questions.find(q => q.id === "creation-order")!,
    id: "test-book-connection", objective: "test-book-connection", scopeLevel: "book", conflicts: [],
    contexts: [{ book: "Genesis", chapter: 1 }, { book: "Genesis", chapter: 2 }],
  };
  const withBookQuestion = { ...bank, questions: [...bank.questions, bookQuestion] };
  it("supports dedicated book connections without leaking them into chapter sets", () => {
    expect(parseQuizBank(withBookQuestion).questions.at(-1)).toEqual(bookQuestion);
    expect(quizScopeLabel(bookQuestion)).toBe("Genesis · book connections");
    expect(quizScopeLabel(bank.questions.find(q => q.id === "gospel-order")!)).toBe("New Testament");
    expect(quizScopeLabel(bank.questions.find(q => q.id === "bible-order")!)).toBe("Whole Bible");
    for (const scope of ["book", "OT", "bible"] as const) {
      expect(filterQuizQuestions(withBookQuestion, { ...filters, scope }, new Set())).toContain(bookQuestion);
    }
    for (const scope of ["chapter", "NT"] as const) {
      expect(filterQuizQuestions(withBookQuestion, { ...filters, scope }, new Set())).not.toContain(bookQuestion);
    }
    expect(filterQuizQuestions(withBookQuestion, { ...filters, scope: "book", book: "Exodus" }, new Set())).not.toContain(bookQuestion);
    expect(filterQuizQuestions(withBookQuestion, { ...filters, scope: "book", readOnly: true }, new Set(["0:0"]))).not.toContain(bookQuestion);
    expect(filterQuizQuestions(withBookQuestion, { ...filters, scope: "book", readOnly: true }, new Set(["0:0", "0:1"]))).toContain(bookQuestion);
    const selected = createQuizSession(withBookQuestion, [bookQuestion], "Book connections", "practice", "owner", now);
    const result = applyQuizAction(withBookQuestion, selected, [], { type: "submit", qid: bookQuestion.id, answer: bookQuestion.answer }, now);
    expect(validSnapshot({ sessions: [result.session], attempts: result.attempts }, withBookQuestion)).toBe(true);
  });
  it("requires every cited chapter before offering the cross-chapter Abraham tree in read-only practice", () => {
    const tree = bank.questions.find(q => q.id === "connections-abraham-judah-line")!;
    const settings: QuizFilters = { ...filters, scope: "book", content: "connections", skill: "Family", readOnly: true };
    const read = new Set(["0:20", "0:24", "0:34"]);
    expect(filterQuizQuestions(bank, settings, read)).not.toContain(tree);
    read.add("0:45");
    expect(filterQuizQuestions(bank, settings, read)).toContain(tree);
    expect(filterQuizQuestions(bank, { ...settings, scope: "chapter", chapter: 21 }, read)).not.toContain(tree);
  });
  it("filters dedicated connections without changing chapter practice or existing progress", () => {
    expect(filterQuizQuestions(withBookQuestion, { ...filters, scope: "book", content: "connections" }, new Set()).map(q => q.id).sort()).toEqual(["connections-abraham-judah-line", "connections-genesis-creation-flood-instructions", "connections-genesis-jacob-return-assurances", "connections-genesis-joseph-reassurance", "connections-genesis-repeated-promises", "connections-genesis-wives", "connections-joseph", "test-book-connection"]);
    const broad = filterQuizQuestions(withBookQuestion, { ...filters, scope: "bible", content: "connections" }, new Set());
    expect(broad).toHaveLength(415);
    expect(broad.every(q => q.scopeLevel !== "chapter")).toBe(true);
    expect(filterQuizQuestions(bank, { ...filters, content: "connections" }, new Set())).toEqual(filterQuizQuestions(bank, filters, new Set()));
    const old = submit();
    expect(validSnapshot({ sessions: [old.session], attempts: old.attempts }, withBookQuestion)).toBe(true);
    expect(quizStats(withBookQuestion, old.attempts, now).get(q.objective)).toEqual(quizStats(bank, old.attempts, now).get(q.objective));
  });
  it("rejects book connections with evidence outside their declared book or missing context", () => {
    const invalid = (change: Partial<QuizQuestion>) => ({ ...bank, questions: [{ ...bookQuestion, ...change }] });
    expect(() => parseQuizBank(invalid({ contexts: [] }))).toThrow("Invalid book-wide quiz context");
    expect(() => parseQuizBank(invalid({ refs: [] }))).toThrow("Invalid book-wide quiz context");
    expect(() => parseQuizBank(invalid({ contexts: [{ book: "Genesis", chapter: 2 }] }))).toThrow("Invalid book-wide quiz context");
    expect(() => parseQuizBank(invalid({ contexts: [{ book: "Exodus", chapter: 1 }] }))).toThrow("Invalid book-wide quiz context");
    expect(() => parseQuizBank(invalid({ refs: [{ ...bookQuestion.refs[0], book: "Exodus" }] }))).toThrow("Invalid book-wide quiz context");
  });
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
  it("combines question format with scope, skill, difficulty and read chapters", () => {
    const creation = bank.questions.find(q => q.id === "creation-order")!;
    const settings: QuizFilters = { ...filters, format: "order", skill: creation.skill, difficulty: creation.difficulty, readOnly: true };
    const read = new Set(["0:0"]);
    const selected = filterQuizQuestions(bank, settings, read);
    expect(selected).toContain(creation);
    expect(selected.every(q => q.kind === "order" && q.skill === creation.skill && q.difficulty === creation.difficulty && q.contexts.every(c => c.book === "Genesis" && c.chapter === 1))).toBe(true);
    expect(filterQuizQuestions(bank, settings, new Set())).toEqual([]);
    expect(filterQuizQuestions(bank, { ...settings, book: "Exodus" }, read)).toEqual([]);
    expect(filterQuizQuestions(bank, { ...settings, skill: "Geography" }, read)).not.toContain(creation);
    expect(filterQuizQuestions(bank, { ...settings, difficulty: creation.difficulty === "Easy" ? "Hard" : "Easy" }, read)).not.toContain(creation);
    expect(filterQuizQuestions(bank, { ...settings, format: "choice" }, read)).not.toContain(creation);
    expect(filterQuizQuestions(bank, { ...filters, format: "all" }, read)).toEqual(filterQuizQuestions(bank, filters, read));
    expect(filterQuizQuestions(bank, { ...filters, scope: "bible", format: "memory" }, read)).toEqual([]);
  });
  it("keeps new semantic overlaps apart even when their cited verses differ", () => {
    const pairs = [
      ["connections-joseph", "connections-egypt-accounts"],
      ["connections-jonah", "connections-faith-examples"],
      ["connections-john-places", "connections-explained-terms"],
      ["connections-ezra-return", "14-36-8"],
      ["connections-samuel-family", "08-4-8"],
      ["connections-matthew-ministry", "42-3-6"],
      ["connections-chronicles-david", "10-5-1"],
      ["connections-first-john-tests", "connections-second-john-instructions"],
      ["connections-laver", "02-40-6"],
    ];
    for (const ids of pairs) {
      const pair = ids.map(id => bank.questions.find(q => q.id === id)!);
      expect(pair.every(Boolean), ids.join(" / ")).toBe(true);
      expect(selectQuizQuestions(bank, pair, [], 2, () => 0.5), ids.join(" / ")).toHaveLength(1);
      expect(selectQuizQuestions(bank, [...pair].reverse(), [], 2, () => 0.5), ids.join(" / ")).toHaveLength(1);
    }
  });
  it("requires every chapter of a real book sequence and preserves its graded backup", () => {
    const filters: QuizFilters = { scope: "book", book: "Ruth", chapter: 1, skill: "Sequence", difficulty: "all", content: "connections", readOnly: true };
    expect(filterQuizQuestions(bank, filters, new Set(["7:0", "7:1", "7:2"]))).toEqual([]);
    const pool = filterQuizQuestions(bank, filters, new Set(["7:0", "7:1", "7:2", "7:3"]));
    expect(pool.map(q => q.id)).toEqual(["connections-ruth"]);
    const question = pool[0];
    expect(gradeQuizAnswer(question, [...question.answer as string[]].reverse())).toBe(false);
    const active = createQuizSession(bank, pool, "Ruth connections", "practice", "owner", now);
    const result = applyQuizAction(bank, active, [], { type: "submit", qid: question.id, answer: question.answer }, now);
    const backup = { sessions: [result.session], attempts: result.attempts, schema: 1, type: "kjv-only-quiz", bank: bank.version, exported: new Date(now).toISOString() };
    expect(parseQuizBackup(backup, bank)).toEqual(backup);
    expect(result.attempts[0]).toMatchObject({ correct: true, objective: question.id });
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

describe("reviewed difficulty corrections preserve historical rewards", () => {
  function earned(pack: QuizBank, id: string, time: number, variant: "correct" | "wrong" | "assisted" | "skipped" = "correct"): QuizSnapshot {
    const question = pack.questions.find(q => q.id === id)!;
    let active = createQuizSession(pack, [question], "Calibration", "practice", "calibration-owner", time);
    if (variant === "assisted") active = applyQuizAction(pack, active, [], { type: "help", qid: id, help: "passage" }, time).session;
    const answer = variant === "wrong" ? question.choices.find(choice => choice !== question.answer)! : question.answer;
    const result = applyQuizAction(pack, active, [], { type: "submit", qid: id, answer, skip: variant === "skipped" }, time);
    const finished = applyQuizAction(pack, result.session, result.attempts, { type: "finish" }, time);
    return { sessions: [finished.session], attempts: finished.attempts };
  }
  for (const id of ["03-19-5", "66-21-7"]) it(`${id} keeps former awards, new difficulty, mastery, and merged-backup deduplication`, () => {
    const question = bank.questions.find(q => q.id === id)!;
    expect(question).toMatchObject({ difficulty: "Easy", previousLearningPoints: [30], version: 1 });
    const oldBank: QuizBank = { ...bank, questions: bank.questions.map(q => q.id === id ? { ...q, difficulty: "Hard", previousLearningPoints: undefined } : q) };
    const old = earned(oldBank, id, now);
    const recent = earned(bank, id, now + 8 * DAY);
    expect(old.attempts[0].points).toBe(30);
    expect(recent.attempts[0].points).toBe(10);
    expect(validSnapshot(old, bank)).toBe(true);
    expect(rebuildQuizAttempts(bank, old)).toEqual(old.attempts);
    const merged = { sessions: [...recent.sessions, ...old.sessions], attempts: [...recent.attempts, ...old.attempts] };
    const original = structuredClone(merged);
    const replayed = rebuildQuizAttempts(bank, merged);
    expect(replayed.map(a => a.points)).toEqual([30, 5]);
    expect(rebuildQuizAttempts(bank, { ...merged, attempts: replayed })).toEqual(replayed);
    expect(quizStats(bank, replayed, now + 8 * DAY).get(id)).toMatchObject({ learned: true, mastered: true });
    expect(merged).toEqual(original);
    expect(validSnapshot({ ...merged, attempts: replayed }, bank)).toBe(true);
    // An old offline release may still award Hard points after a new release.
    const laterOld = earned(oldBank, id, now + 9 * DAY);
    const firstNew = earned(bank, id, now);
    expect(rebuildQuizAttempts(bank, { sessions: [...laterOld.sessions, ...firstNew.sessions], attempts: [...laterOld.attempts, ...firstNew.attempts] }).map(a => a.points)).toEqual([10, 5]);
    const simultaneous = earned(oldBank, id, now + 1000);
    expect(rebuildQuizAttempts(bank, { sessions: [...old.sessions, ...simultaneous.sessions], attempts: [...old.attempts, ...simultaneous.attempts] }).map(a => a.points)).toEqual([30, 0]);
  });
  it("does not preserve historic rewards for wrong, assisted, skipped, or unrelated answers", () => {
    for (const variant of ["wrong", "assisted", "skipped"] as const) {
      const snapshot = earned(bank, "03-19-5", now, variant);
      snapshot.attempts[0].points = 30;
      expect(rebuildQuizAttempts(bank, snapshot)[0].points).toBe(0);
    }
    const ordinary = earned(bank, "08-1-4", now);
    ordinary.attempts[0].points = 30;
    expect(rebuildQuizAttempts(bank, ordinary)[0].points).toBe(10);
    const incomplete = earned(bank, "03-19-5", now);
    incomplete.sessions[0].entries[0].answer = "";
    incomplete.attempts[0].answer = "";
    incomplete.attempts[0].correct = false;
    expect(() => rebuildQuizAttempts(bank, incomplete)).toThrow("Incomplete submitted answer");
  });
  it("validates reward history and requires equivalent forms to share it", () => {
    for (const points of [[5], [999], ["30"], [30, 30], null]) {
      const invalid = { ...bank, questions: bank.questions.map(q => q.id === "03-19-5" ? { ...q, previousLearningPoints: points } : q) };
      expect(() => parseQuizBank(invalid)).toThrow("Invalid quiz reward history");
    }
    const mismatch = { ...bank, questions: bank.questions.map(q => q.id === "08-1-4" ? { ...q, previousLearningPoints: [30] } : q) };
    expect(() => parseQuizBank(mismatch)).toThrow("Invalid quiz alternate reward history");
    const aligned = { ...bank, questions: bank.questions.map(q => q.objective === "08-1-4" ? { ...q, previousLearningPoints: [30] } : q) };
    expect(() => parseQuizBank(aligned)).not.toThrow();
  });
});
