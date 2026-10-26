import { BIBLE_BOOKS } from "@/lib/bible-books";
import { DAY, quizObjectives, type quizStats } from "./engine";
import type { QuizAttempt, QuizBank, QuizQuestion } from "./types";

export type MasteryScope<T> = {
  id: string; label: string; level: "chapter" | "book" | "testament" | "bible";
  own: T[]; objectives: T[]; children: MasteryScope<T>[];
  coveredChapters: number; totalChapters: number;
};
export type QuizCoverageRelease = {
  id: string; label: string;
  // Immutable, direct scope membership. Parents also require every descendant.
  groups: Record<string, [objective: string, version: number][]>;
};
export type QuizCompletionBadge = {
  id: string; release: string; releaseLabel: string; scope: string; label: string;
  level: MasteryScope<unknown>["level"]; kind: "Learned" | "Mastered";
  earnedAt: number; objectiveCount: number;
};
export function quizMasteryScope(q: QuizQuestion) {
  const book = BIBLE_BOOKS.findIndex(b => b.name === q.book);
  const ownBook = q.contexts.every(c => c.book === q.book);
  if (q.scopeLevel === "chapter" && ownBook && q.contexts.every(c => c.chapter === q.chapter)) return `chapter:${book}:${q.chapter}`;
  if (["chapter", "book"].includes(q.scopeLevel) && ownBook) return `book:${book}`;
  const testament = book < 39 ? "OT" : "NT";
  if (q.scopeLevel !== "bible" && q.contexts.every(c => (BIBLE_BOOKS.findIndex(b => b.name === c.book) < 39 ? "OT" : "NT") === testament)) return testament;
  return "bible";
}
export function masteryScopeTree<T>(groups: ReadonlyMap<string, T[]>): MasteryScope<T> {
  const node = (id: string, label: string, level: MasteryScope<T>["level"], children: MasteryScope<T>[]): MasteryScope<T> => {
    const own = groups.get(id) ?? [];
    return { id, label, level, own, children, objectives: [...own, ...children.flatMap(c => c.objectives)],
      coveredChapters: level === "chapter" ? Number(own.length > 0) : children.reduce((n, c) => n + c.coveredChapters, 0),
      totalChapters: level === "chapter" ? 1 : children.reduce((n, c) => n + c.totalChapters, 0) };
  };
  const books = BIBLE_BOOKS.map((book, i) => node(`book:${i}`, book.name, "book", Array.from({ length: book.chapterCount }, (_, c) => node(`chapter:${i}:${c + 1}`, `${book.name} ${c + 1}`, "chapter", []))));
  return node("bible", "Whole Bible", "bible", [node("OT", "Old Testament", "testament", books.slice(0, 39)), node("NT", "New Testament", "testament", books.slice(39))]);
}
export function quizMasteryTree(bank: QuizBank) {
  const groups = new Map<string, QuizQuestion[]>();
  for (const q of quizObjectives(bank.questions)) {
    const key = quizMasteryScope(q), group = groups.get(key) ?? [];
    group.push(q); groups.set(key, group);
  }
  return masteryScopeTree(groups);
}
export function masteryCounts(questions: readonly QuizQuestion[], stats: ReturnType<typeof quizStats>) {
  let learned = 0, mastered = 0, due = 0, started = 0;
  for (const q of questions) {
    const s = stats.get(q.objective);
    learned += Number(!!s?.learned); mastered += Number(!!s?.mastered);
    due += Number(!!s?.due); started += Number(!!s?.attempts.length);
  }
  return { total: questions.length, learned, mastered, due, notStarted: questions.length - started };
}
// Awards are replayed from the same backed-up attempts as mastery. The frozen
// release membership keeps old awards intact as the current bank grows. No
// independent badge claims, new database store, or duplicate points are needed.
export function quizCompletionBadges(releases: readonly QuizCoverageRelease[], attempts: readonly QuizAttempt[]): QuizCompletionBadge[] {
  const histories = new Map<string, QuizAttempt[]>();
  for (const a of attempts) {
    if (!a.correct || a.assisted || a.skipped) continue;
    const key = `${a.objective}\0${a.version}`, history = histories.get(key) ?? [];
    history.push(a); histories.set(key, history);
  }
  const earned = new Map<string, { learned: number; mastered?: number }>();
  for (const [key, history] of histories) {
    history.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const first = history[0];
    earned.set(key, { learned: first.time, mastered: history.find(a => a.session !== first.session && a.time - first.time >= 7 * DAY)?.time });
  }
  const badges: QuizCompletionBadge[] = [];
  for (const release of releases) {
    const visit = (scope: MasteryScope<[string, number]>) => {
      if (scope.objectives.length && scope.coveredChapters === scope.totalChapters) {
        let learned = 0, mastered = 0, learnedAt = 0, masteredAt = 0;
        for (const [id, version] of scope.objectives) {
          const value = earned.get(`${id}\0${version}`);
          if (value) { learned++; learnedAt = Math.max(learnedAt, value.learned); }
          if (value?.mastered !== undefined) { mastered++; masteredAt = Math.max(masteredAt, value.mastered); }
        }
        for (const [kind, count, earnedAt] of [["Learned", learned, learnedAt], ["Mastered", mastered, masteredAt]] as const) {
          if (count === scope.objectives.length) badges.push({ id: `${release.id}:${scope.id}:${kind}`, release: release.id, releaseLabel: release.label, scope: scope.id, label: scope.label, level: scope.level, kind, earnedAt, objectiveCount: count });
        }
      }
      scope.children.forEach(visit);
    };
    visit(masteryScopeTree(new Map(Object.entries(release.groups))));
  }
  return badges.sort((a, b) => b.earnedAt - a.earnedAt || a.id.localeCompare(b.id));
}
