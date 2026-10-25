import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Generated inventory only: question counts do not certify editorial completeness.
// The output stays in the ignored design folder alongside the delivery plan.
const bankText = await readFile(new URL("../public/data/quiz-pilot-v1.json", import.meta.url), "utf8");
const bank = JSON.parse(bankText);
const corpus = JSON.parse(await readFile(new URL("../public/data/kjv.json", import.meta.url), "utf8"));
const key = (book, chapter) => JSON.stringify([book, chapter]);
const chapters = corpus.books.flatMap(book => book.chapters.map(chapter => ({
  book: book.name,
  chapter: chapter.chapter,
  verseCount: chapter.verses.length,
  featured: false,
  questionIds: [],
  skills: [],
})));
const index = new Map(chapters.map(chapter => [key(chapter.book, chapter.chapter), chapter]));
const ids = new Set();
for (const question of bank.questions) {
  if (ids.has(question.id)) throw new Error(`Duplicate question: ${question.id}`);
  ids.add(question.id);
  if (question.scopeLevel !== "chapter") continue;
  const chapter = index.get(key(question.book, question.chapter));
  if (!chapter) throw new Error(`Unknown chapter for ${question.id}`);
  chapter.questionIds.push(question.id);
  if (!chapter.skills.includes(question.skill)) chapter.skills.push(question.skill);
}
for (const featured of bank.featured) {
  const chapter = index.get(key(featured.book, featured.chapter));
  if (!chapter || chapter.featured || !chapter.questionIds.length) {
    throw new Error(`Invalid, duplicate, or empty featured chapter: ${key(featured.book, featured.chapter)}`);
  }
  chapter.featured = true;
}
const books = corpus.books.map(book => {
  const rows = chapters.filter(chapter => chapter.book === book.name);
  return {
    book: book.name,
    chapters: rows.length,
    featuredChapters: rows.filter(chapter => chapter.featured).length,
    chaptersWithQuestions: rows.filter(chapter => chapter.questionIds.length).length,
    chapterQuestions: rows.reduce((sum, chapter) => sum + chapter.questionIds.length, 0),
    chaptersNeedingSets: rows.filter(chapter => !chapter.featured).map(chapter => chapter.chapter),
  };
});
const summary = {
  books: books.length,
  chapters: chapters.length,
  questions: bank.questions.length,
  booksWithFeaturedChapters: books.filter(book => book.featuredChapters).length,
  featuredChapters: chapters.filter(chapter => chapter.featured).length,
  chaptersWithQuestions: chapters.filter(chapter => chapter.questionIds.length).length,
  chaptersWithoutQuestions: chapters.filter(chapter => !chapter.questionIds.length).length,
  chaptersNeedingSets: chapters.filter(chapter => !chapter.featured).length,
};
const report = {
  schema: 1,
  bankVersion: bank.version,
  bankSha256: createHash("sha256").update(bankText).digest("hex"),
  note: "Generated authoring inventory. A featured set is a sample, not certification of comprehensive coverage or independent editorial review. Counts exclude broader-scope questions from chapter coverage and do not measure learner mastery.",
  summary,
  books,
  chapters: chapters.map(chapter => ({
    ...chapter,
    authoringStatus: chapter.featured ? "sample" : chapter.questionIds.length ? "isolated-objectives" : "not-started",
  })),
};
const directory = new URL("../design/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("quiz-stage3-coverage.json", directory), JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# Quiz Stage 3 coverage inventory",
  "",
  `Generated from the question bank (${summary.questions} questions). Counts describe authored samples, not completed editorial review or learner mastery.`,
  "",
  `- Books with a featured sample: ${summary.booksWithFeaturedChapters}/${summary.books}.`,
  `- Chapters with a featured set: ${summary.featuredChapters}/${summary.chapters}.`,
  `- Chapters still needing a featured set: ${summary.chaptersNeedingSets}.`,
  `- Chapters with no chapter-level questions at all: ${summary.chaptersWithoutQuestions}.`,
  "",
  "Authored coverage alone does not certify Stage 3 completion. Independent editorial and breadth review is tracked separately in quiz-stage3-review-queue.json. See quiz-stage3-coverage.json for all chapter IDs and question IDs. Regenerating this inventory does not change the question bank.",
  "",
  "| Book | Chapter sets | Chapter questions | Chapters needing sets |",
  "|---|---:|---:|---|",
  ...books.map(book => `| ${book.book} | ${book.featuredChapters}/${book.chapters} | ${book.chapterQuestions} | ${book.chaptersNeedingSets.join(", ") || "None"} |`),
  "",
];
await writeFile(new URL("quiz-stage3-coverage.md", directory), lines.join("\n"));
console.log(JSON.stringify(summary, null, 2));
