import { BIBLE_BOOKS, chapterLabel } from "@/lib/bible-books";
import { BOOK_ICON_CODES } from "@/lib/references";

export type SummaryPart = { start: number; end: number; text: string };
export type ChapterSummaries = {
  book: string;
  chapters: { chapter: number; title: string; parts: SummaryPart[] }[];
};
export type BookSummary = { book: string; title: string; parts: SummaryPart[] };
export type SummaryReference = { book: string; chapter: number; start: number; end: number };
export type BibleSummary = {
  title: string;
  intro: string;
  testaments: {
    id: string;
    name: string;
    subtitle: string;
    parts: { text: string; references: SummaryReference[] }[];
  }[];
};

// Each book is a separate build asset: only the requested chapter collection is
// loaded. The generated app-shell manifest includes every collection for offline downloads.
const chapterLoaders = Object.entries(
  import.meta.glob<{ default: ChapterSummaries }>("../data/summaries/chapters/*.json"),
).sort(([left], [right]) => left.localeCompare(right)).map(([, load]) => load);

export async function loadChapterSummaries(bookIndex: number): Promise<ChapterSummaries> {
  const load = Number.isInteger(bookIndex) ? chapterLoaders[bookIndex] : undefined;
  if (!load) throw new Error("Unknown summary book");
  return (await load()).default;
}

export async function loadSummaryOverview(): Promise<{ books: BookSummary[]; bible: BibleSummary }> {
  const [books, bible] = await Promise.all([
    import("@/data/summaries/book-summaries.json"),
    import("@/data/summaries/bible-summary.json"),
  ]);
  return { books: books.default, bible: bible.default };
}

export function summaryChapterLabel(book: string, chapter: number) {
  return chapterLabel(book, chapter);
}

export function summaryReferenceLabel(reference: SummaryReference) {
  const { book, chapter, start, end } = reference;
  return `${summaryChapterLabel(book, chapter)}:${start}${end === start ? "" : `-${end}`}`;
}

export function summaryReferenceCode(reference: SummaryReference) {
  const code = BOOK_ICON_CODES[BIBLE_BOOKS.findIndex(book => book.name === reference.book)];
  if (!code) throw new Error(`Unknown summary reference book: ${reference.book}`);
  return `${code}.${reference.chapter}.${reference.start}${reference.end === reference.start ? "" : `-${reference.end}`}`;
}
