import { BIBLE_BOOKS } from "../src/lib/bible-books";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadChapterSummaries, loadSummaryOverview, summaryChapterLabel, summaryReferenceCode, summaryReferenceLabel } from "@/lib/summaries";
import { parseBibleReference } from "@/lib/references";
import type { Book } from "@/types/bible";

const { books } = JSON.parse(readFileSync("public/data/kjv.json", "utf8")) as { books: Book[] };

describe("reviewed summaries", () => {
  it("covers every KJV book, chapter, and verse exactly once with correctly routed references", async () => {
    const overview = await loadSummaryOverview();
    const chapters = await Promise.all(books.map((_, index) => loadChapterSummaries(index)));
    expect(chapters).toHaveLength(66);
    expect(overview.books.map(book => book.book)).toEqual(books.map(book => book.name));
    let chapterCount = 0;
    let verseCount = 0;
    for (const [bookIndex, source] of books.entries()) {
      const collection = chapters[bookIndex];
      expect(collection.book).toBe(source.name);
      expect(collection.chapters).toHaveLength(source.chapters.length);
      for (const [chapterIndex, chapter] of collection.chapters.entries()) {
        expect(chapter.chapter).toBe(chapterIndex + 1);
        expect(chapter.title.trim()).not.toBe("");
        const covered: number[] = [];
        expect(chapter.parts.length).toBeGreaterThan(0);
        for (const part of chapter.parts) {
          expect(part.text.trim()).not.toBe("");
          expect(Number.isInteger(part.start) && Number.isInteger(part.end) && part.end >= part.start).toBe(true);
          const reference = summaryReferenceCode({ book: source.name, chapter: chapter.chapter, ...part });
          expect(parseBibleReference(reference)).toMatchObject({ bookIndex, startChapterIndex: chapterIndex, startVerse: part.start, endVerse: part.end });
          covered.push(...Array.from({ length: part.end - part.start + 1 }, (_, i) => part.start + i));
        }
        expect(covered, `${source.name} ${chapter.chapter}`).toEqual(source.chapters[chapterIndex].verses.map(verse => verse.verse));
        chapterCount++;
        verseCount += covered.length;
      }
      const bookSummary = overview.books[bookIndex];
      expect(bookSummary.title.trim()).not.toBe("");
      const covered = bookSummary.parts.flatMap(part => {
        expect(part.text.trim()).not.toBe("");
        return Array.from({ length: part.end - part.start + 1 }, (_, i) => part.start + i);
      });
      expect(covered).toEqual(source.chapters.map(chapter => chapter.chapter));
    }
    expect(BIBLE_BOOKS).toEqual(books.map(book => ({ name: book.name, chapterCount: book.chapters.length })));
    expect(chapterCount).toBe(1189);
    expect(verseCount).toBe(31102);
  });

  it("links both testament overviews to valid KJV passages", async () => {
    const { bible } = await loadSummaryOverview();
    expect(bible.testaments.map(testament => testament.id)).toEqual(["old-testament", "new-testament"]);
    expect(bible.intro.trim()).not.toBe("");
    for (const testament of bible.testaments) {
      expect(testament.parts.length).toBeGreaterThan(0);
      for (const part of testament.parts) {
        expect(part.text.trim()).not.toBe("");
        expect(part.references.length).toBeGreaterThan(0);
        for (const reference of part.references) {
          const parsed = parseBibleReference(summaryReferenceCode(reference))!;
          const verses = books[parsed.bookIndex].chapters[parsed.startChapterIndex].verses;
          expect(reference.start).toBeGreaterThan(0);
          expect(reference.end).toBeGreaterThanOrEqual(reference.start);
          expect(reference.end).toBeLessThanOrEqual(verses.length);
        }
      }
    }
  });

  it("labels individual Psalms correctly and rejects invalid book indexes", async () => {
    expect(summaryChapterLabel("Psalms", 23)).toBe("Psalm 23");
    expect(summaryReferenceLabel({ book: "Psalms", chapter: 23, start: 1, end: 6 })).toBe("Psalm 23:1-6");
    expect(summaryReferenceLabel({ book: "John", chapter: 3, start: 16, end: 16 })).toBe("John 3:16");
    for (const index of [-1, 66, 0.5, NaN]) await expect(loadChapterSummaries(index)).rejects.toThrow("Unknown summary book");
  });
});
