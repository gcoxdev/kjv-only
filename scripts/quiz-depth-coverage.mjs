import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Current authoring inventory; never overwrite the historical Stage 3 certificates.
const bankText = await readFile(new URL("../public/data/quiz-pilot-v1.json", import.meta.url), "utf8");
const bank = JSON.parse(bankText);
const corpus = JSON.parse(await readFile(new URL("../public/data/kjv.json", import.meta.url), "utf8"));
const countBy = (questions, field) => Object.fromEntries([...new Set(questions.map(q => q[field]))].sort().map(value => [value, questions.filter(q => q[field] === value).length]));
const objectives = bank.questions.filter(q => q.id === q.objective);
const broader = objectives.filter(q => q.scopeLevel !== "chapter");
const books = bank.books.map(book => {
  const questions = objectives.filter(q => q.book === book);
  return {
    book,
    bookConnectionIds: questions.filter(q => q.scopeLevel === "book").map(q => q.id),
    vocabularyIds: objectives.filter(q => q.skill === "Vocabulary" && q.contexts.some(c => c.book === book)).map(q => q.id),
    formats: countBy(bank.questions.filter(q => q.book === book), "kind"),
  };
});
const chapters = corpus.books.flatMap(book => book.chapters.map(chapter => {
  const questions = objectives.filter(q => q.scopeLevel === "chapter" && q.book === book.name && q.chapter === chapter.chapter);
  return { book: book.name, chapter: chapter.chapter, verses: chapter.verses.length, objectives: questions.length, nonChoiceObjectives: new Set(bank.questions.filter(q => q.scopeLevel === "chapter" && q.book === book.name && q.chapter === chapter.chapter && q.kind !== "choice").map(q => q.objective)).size };
}));
const summary = {
  questions: bank.questions.length,
  objectives: objectives.length,
  alternateForms: bank.questions.length - objectives.length,
  objectivesWithAlternateForms: new Set(bank.questions.filter(q => q.id !== q.objective).map(q => q.objective)).size,
  chapterSets: bank.featured.length,
  bookConnections: broader.filter(q => q.scopeLevel === "book").length,
  booksWithConnections: books.filter(b => b.bookConnectionIds.length).length,
  booksStillNeedingConnections: books.filter(b => !b.bookConnectionIds.length).length,
  oldTestamentConnections: broader.filter(q => q.scopeLevel === "testament" && q.testament === "OT").length,
  newTestamentConnections: broader.filter(q => q.scopeLevel === "testament" && q.testament === "NT").length,
  wholeBibleConnections: broader.filter(q => q.scopeLevel === "bible").length,
  vocabulary: objectives.filter(q => q.skill === "Vocabulary").length,
  skills: countBy(objectives, "skill"),
  formats: countBy(bank.questions, "kind"),
};
const report = {
  schema: 1,
  bankSha256: createHash("sha256").update(bankText).digest("hex"),
  note: "Published content inventory, not a claim of exhaustive coverage or learner mastery. The 66-book connection checkpoint measures initial breadth only; Stage 4 also includes depth, vocabulary, format variety, and calibration.",
  summary, books,
  // Length is a review priority, not a measure of theological importance or difficulty.
  denseChapterReviewQueue: [...chapters].sort((a, b) => b.verses - a.verses || bank.books.indexOf(a.book) - bank.books.indexOf(b.book) || a.chapter - b.chapter).slice(0, 50),
};
const directory = new URL("../design/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("quiz-stage4-coverage.json", directory), JSON.stringify(report, null, 2) + "\n");
await writeFile(new URL("quiz-stage4-coverage.md", directory), [
  "# Quiz Stage 4 authoring inventory", "",
  `${summary.objectives} published objectives in ${summary.questions} question forms (${summary.alternateForms} alternates); all ${summary.chapterSets} initial chapter sets retained.`, "",
  `Initial book-connections checkpoint: **${summary.booksWithConnections}/66 books**; **${summary.booksStillNeedingConnections} remaining**. This is not an overall Stage 4 completion percentage.`, "",
  `Dedicated exercises: ${summary.bookConnections} book, ${summary.oldTestamentConnections} Old Testament, ${summary.newTestamentConnections} New Testament, ${summary.wholeBibleConnections} whole Bible. Vocabulary objectives: ${summary.vocabulary}.`, "",
  "Counts describe authored samples, not exhaustive knowledge coverage. Review the JSON inventory for formats, vocabulary contexts, and the fifty longest chapters as candidates for deeper coverage. The historical Stage 3 review records are preserved separately.", "",
  "| Book | Dedicated book exercises | Vocabulary with this book in context |", "|---|---:|---:|",
  ...books.map(b => `| ${b.book} | ${b.bookConnectionIds.length} | ${b.vocabularyIds.length} |`), "",
].join("\n"));
console.log(JSON.stringify(summary, null, 2));
