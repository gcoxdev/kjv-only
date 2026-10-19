import { chapterLabel } from "@/lib/bible-books";
import type { Book } from "@/types/bible";
import type {
  BookmarkPoint,
  BookmarkRange,
  BookmarkScope,
  BookmarkType,
  ReaderBookmark,
} from "@/types/bookmarks";

const BOOKMARK_TYPE_ORDER: Record<BookmarkType, number> = {
  chapter: 0,
  verse: 1,
  range: 2,
  selection: 3,
};

function comparePoint(a: BookmarkPoint, b: BookmarkPoint) {
  if (a.bookIndex !== b.bookIndex) return a.bookIndex - b.bookIndex;
  if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
  return a.verseNumber - b.verseNumber;
}

export function normalizeRangePoints(start: BookmarkPoint, end: BookmarkPoint) {
  return comparePoint(start, end) <= 0 ? { start, end } : { start: end, end: start };
}

export function normalizeBookmarkRanges(ranges: BookmarkRange[]) {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges]
    .map((range) => ({
      start: Math.max(1, Math.min(range.start, range.end)),
      end: Math.max(1, Math.max(range.start, range.end)),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: BookmarkRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end + 1) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

function scopeType(scope: BookmarkScope): BookmarkType {
  return scope.type;
}

function refLabel(point: BookmarkPoint, books: Book[]) {
  const bookName = books[point.bookIndex]?.name ?? `Book ${point.bookIndex + 1}`;
  return `${chapterLabel(bookName, point.chapterIndex + 1)}:${point.verseNumber}`;
}

export function bookmarkScopeLabel(scope: BookmarkScope, books: Book[]) {
  if (scope.type === "chapter") {
    const bookName = books[scope.bookIndex]?.name ?? `Book ${scope.bookIndex + 1}`;
    return `${chapterLabel(bookName, scope.chapterIndex + 1)}`;
  }
  if (scope.type === "verse") {
    return refLabel(scope, books);
  }
  if (scope.type === "selection") {
    const bookName = books[scope.bookIndex]?.name ?? `Book ${scope.bookIndex + 1}`;
    const rangeLabel = normalizeBookmarkRanges(scope.ranges)
      .map((range) =>
        range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`,
      )
      .join(",");
    return `${chapterLabel(bookName, scope.chapterIndex + 1)}:${rangeLabel}`;
  }
  const normalized = normalizeRangePoints(scope.start, scope.end);
  const sameChapter =
    normalized.start.bookIndex === normalized.end.bookIndex &&
    normalized.start.chapterIndex === normalized.end.chapterIndex;
  if (sameChapter) {
    const bookName =
      books[normalized.start.bookIndex]?.name ??
      `Book ${normalized.start.bookIndex + 1}`;
    return `${chapterLabel(bookName, normalized.start.chapterIndex + 1)}:${normalized.start.verseNumber}-${normalized.end.verseNumber}`;
  }
  return `${refLabel(normalized.start, books)}-${refLabel(normalized.end, books)}`;
}

export function bookmarkScopeSummary(scope: BookmarkScope, books: Book[]) {
  if (scope.type === "chapter") {
    return `Chapter • ${bookmarkScopeLabel(scope, books)}`;
  }
  if (scope.type === "verse") {
    return `Verse • ${bookmarkScopeLabel(scope, books)}`;
  }
  if (scope.type === "selection") {
    return `Selection • ${bookmarkScopeLabel(scope, books)}`;
  }
  const normalized = normalizeRangePoints(scope.start, scope.end);
  const sameChapter =
    normalized.start.bookIndex === normalized.end.bookIndex &&
    normalized.start.chapterIndex === normalized.end.chapterIndex;
  if (sameChapter) {
    const bookName =
      books[normalized.start.bookIndex]?.name ??
      `Book ${normalized.start.bookIndex + 1}`;
    return `Range • ${chapterLabel(bookName, normalized.start.chapterIndex + 1)}:${normalized.start.verseNumber}-${normalized.end.verseNumber}`;
  }
  return `Range • ${bookmarkScopeLabel(scope, books)}`;
}

export function bookmarkCanonicalKey(scope: BookmarkScope) {
  if (scope.type === "chapter") {
    return `chapter:${scope.bookIndex}:${scope.chapterIndex}`;
  }
  if (scope.type === "verse") {
    return `verse:${scope.bookIndex}:${scope.chapterIndex}:${scope.verseNumber}`;
  }
  if (scope.type === "selection") {
    const normalizedRanges = normalizeBookmarkRanges(scope.ranges)
      .map((range) => `${range.start}-${range.end}`)
      .join(",");
    return `selection:${scope.bookIndex}:${scope.chapterIndex}:${normalizedRanges}`;
  }
  const normalized = normalizeRangePoints(scope.start, scope.end);
  return `range:${normalized.start.bookIndex}:${normalized.start.chapterIndex}:${normalized.start.verseNumber}:${normalized.end.bookIndex}:${normalized.end.chapterIndex}:${normalized.end.verseNumber}`;
}

export function compareBookmarkCanonical(a: ReaderBookmark, b: ReaderBookmark) {
  const typeOrderDelta = BOOKMARK_TYPE_ORDER[scopeType(a.scope)] - BOOKMARK_TYPE_ORDER[scopeType(b.scope)];
  if (typeOrderDelta !== 0) {
    return typeOrderDelta;
  }

  if (a.scope.type === "chapter" && b.scope.type === "chapter") {
    if (a.scope.bookIndex !== b.scope.bookIndex) return a.scope.bookIndex - b.scope.bookIndex;
    return a.scope.chapterIndex - b.scope.chapterIndex;
  }

  if (a.scope.type === "verse" && b.scope.type === "verse") {
    return comparePoint(a.scope, b.scope);
  }

  if (a.scope.type === "range" && b.scope.type === "range") {
    const aRange = normalizeRangePoints(a.scope.start, a.scope.end);
    const bRange = normalizeRangePoints(b.scope.start, b.scope.end);
    const startDelta = comparePoint(aRange.start, bRange.start);
    if (startDelta !== 0) return startDelta;
    return comparePoint(aRange.end, bRange.end);
  }

  if (a.scope.type === "selection" && b.scope.type === "selection") {
    if (a.scope.bookIndex !== b.scope.bookIndex) {
      return a.scope.bookIndex - b.scope.bookIndex;
    }
    if (a.scope.chapterIndex !== b.scope.chapterIndex) {
      return a.scope.chapterIndex - b.scope.chapterIndex;
    }
    const aRanges = normalizeBookmarkRanges(a.scope.ranges);
    const bRanges = normalizeBookmarkRanges(b.scope.ranges);
    const maxLength = Math.max(aRanges.length, bRanges.length);
    for (let index = 0; index < maxLength; index += 1) {
      const aRange = aRanges[index];
      const bRange = bRanges[index];
      if (!aRange) return -1;
      if (!bRange) return 1;
      if (aRange.start !== bRange.start) return aRange.start - bRange.start;
      if (aRange.end !== bRange.end) return aRange.end - bRange.end;
    }
    return 0;
  }

  return 0;
}

export function sortBookmarksCanonical(bookmarks: ReaderBookmark[]) {
  return [...bookmarks].sort(compareBookmarkCanonical);
}

export function bookmarkBookIndex(scope: BookmarkScope) {
  if (scope.type === "chapter" || scope.type === "verse" || scope.type === "selection") {
    return scope.bookIndex;
  }
  const normalized = normalizeRangePoints(scope.start, scope.end);
  return normalized.start.bookIndex;
}


export function isBookmarkScopeAvailable(scope: BookmarkScope, books: Book[]) {
  const hasChapter = (bookIndex: number, chapterIndex: number) =>
    Number.isInteger(bookIndex) && bookIndex >= 0 && Number.isInteger(chapterIndex) &&
    chapterIndex >= 0 && Boolean(books[bookIndex]?.chapters[chapterIndex]);
  const hasVerse = (point: BookmarkPoint) =>
    hasChapter(point.bookIndex, point.chapterIndex) && Number.isInteger(point.verseNumber) &&
    point.verseNumber > 0 && point.verseNumber <= books[point.bookIndex].chapters[point.chapterIndex].verses.length;
  if (scope.type === "chapter") return hasChapter(scope.bookIndex, scope.chapterIndex);
  if (scope.type === "verse") return hasVerse(scope);
  if (scope.type === "range") return hasVerse(scope.start) && hasVerse(scope.end) && comparePoint(scope.start, scope.end) <= 0;
  return scope.ranges.length > 0 && scope.ranges.every((range) =>
    range.start <= range.end && hasVerse({ ...scope, verseNumber: range.start }) && hasVerse({ ...scope, verseNumber: range.end }));
}
