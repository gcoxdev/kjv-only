import { chapterLabel } from "@/lib/bible-books";
import { bcv_parser } from "bible-passage-reference-parser/esm/bcv_parser.js";
import * as bibleReferenceLanguage from "bible-passage-reference-parser/esm/lang/en.js";

import { isBookmarkScopeAvailable, normalizeBookmarkRanges } from "@/lib/bookmarks";
import { createId, createLeaf } from "@/lib/reader-layout";
import { BOOK_ICON_CODES } from "@/lib/references";
import type { BookmarkScope } from "@/types/bookmarks";
import type { Book } from "@/types/bible";
import type { PanelNode, ReaderNavigationTarget } from "@/types/reader";

const OSIS_BOOK_CODES = [
  "Gen",
  "Exod",
  "Lev",
  "Num",
  "Deut",
  "Josh",
  "Judg",
  "Ruth",
  "1Sam",
  "2Sam",
  "1Kgs",
  "2Kgs",
  "1Chr",
  "2Chr",
  "Ezra",
  "Neh",
  "Esth",
  "Job",
  "Ps",
  "Prov",
  "Eccl",
  "Song",
  "Isa",
  "Jer",
  "Lam",
  "Ezek",
  "Dan",
  "Hos",
  "Joel",
  "Amos",
  "Obad",
  "Jonah",
  "Mic",
  "Nah",
  "Hab",
  "Zeph",
  "Hag",
  "Zech",
  "Mal",
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev",
] as const;

type ParsedEntity = {
  type: string;
  absolute_indices?: [number, number];
  valid?: { valid: boolean; messages: Record<string, unknown> };
  entities?: ParsedEntity[];
  start?: {
    b?: string;
    c?: number;
    v?: number;
  };
  end?: {
    b?: string;
    c?: number;
    v?: number;
  };
};

type OsisBookCode = (typeof OSIS_BOOK_CODES)[number];

type ReferenceUnit = {
  kind: "chapter" | "selection" | "range";
  bookIndex: number;
  chapterIndex: number;
  label: string;
  target: ReaderNavigationTarget;
};

export type ReferenceCommandTarget = {
  label: string;
  target: ReaderNavigationTarget;
};

export type ReferenceCommandAction = {
  id:
    | "single-new-tab"
    | "single-new-panel"
    | "multiple-new-tabs"
    | "multiple-single-tab"
    | "multiple-current-tab-panels";
  label: string;
  description: string;
};

const osisBookToIndex = new Map(
  OSIS_BOOK_CODES.map((code, index) => [code, index]),
);

function isOsisBookCode(value: string): value is OsisBookCode {
  return OSIS_BOOK_CODES.includes(value as OsisBookCode);
}

function createReferenceParser() {
  const parser = new bcv_parser(bibleReferenceLanguage);
  parser.set_options({
    consecutive_combination_strategy: "separate",
    // Parser v4 renamed the old "include" behavior. A bare book still opens
    // its first chapter, preserving the existing command behavior.
    book_alone_strategy: "first_chapter",
    book_sequence_strategy: "include",
  });
  return parser;
}

function verseCountForChapter(books: Book[], bookIndex: number, chapterIndex: number) {
  return books[bookIndex]?.chapters[chapterIndex]?.verses.length ?? 0;
}

function isFullSingleChapterReference(
  books: Book[],
  bookIndex: number,
  chapterIndex: number,
  startVerse: number,
  endVerse: number,
) {
  const verseCount = verseCountForChapter(books, bookIndex, chapterIndex);
  return verseCount > 0 && startVerse === 1 && endVerse === verseCount;
}

function formatReferenceRanges(
  bookName: string,
  chapterIndex: number,
  ranges: Array<{ start: number; end: number }>,
) {
  const rangeLabel = ranges
    .map((range) =>
      range.start === range.end
        ? `${range.start}`
        : `${range.start}-${range.end}`,
    )
    .join(", ");
  return `${chapterLabel(bookName, chapterIndex + 1)}:${rangeLabel}`;
}

function formatCrossChapterRangeLabel(
  books: Book[],
  target: Extract<ReaderNavigationTarget, { type: "range" }>,
) {
  const startBook = books[target.start.bookIndex]?.name ?? BOOK_ICON_CODES[target.start.bookIndex] ?? "GEN";
  const endBook = books[target.end.bookIndex]?.name ?? BOOK_ICON_CODES[target.end.bookIndex] ?? "GEN";
  const startLabel = `${startBook} ${target.start.chapterIndex + 1}:${target.start.verseNumber}`;
  if (target.start.bookIndex === target.end.bookIndex) {
    return `${startLabel}-${target.end.chapterIndex + 1}:${target.end.verseNumber}`;
  }
  return `${startLabel}-${endBook} ${target.end.chapterIndex + 1}:${target.end.verseNumber}`;
}

function flattenParsedEntities(entities: ParsedEntity[]): ParsedEntity[] {
  return entities.flatMap((entity): ParsedEntity[] => {
    if (Array.isArray(entity.entities) && entity.entities.length > 0) {
      return flattenParsedEntities(entity.entities);
    }
    return [entity];
  });
}

function normalizeBookLookupText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchBookOnlyInput(input: string, books: Book[]) {
  const normalizedInput = normalizeBookLookupText(input);
  if (!normalizedInput) {
    return null;
  }

  const exactMatch = books.findIndex(
    (book) => normalizeBookLookupText(book.name) === normalizedInput,
  );
  if (exactMatch >= 0) {
    return {
      label: `${books[exactMatch]?.name ?? "Book"} 1`,
      target: {
        type: "chapter" as const,
        bookIndex: exactMatch,
        chapterIndex: 0,
      },
    };
  }

  const prefixMatches = books
    .map((book, index) => ({ book, index }))
    .filter(({ book }) =>
      normalizeBookLookupText(book.name).startsWith(normalizedInput),
    );
  if (prefixMatches.length === 1) {
    return {
      label: `${prefixMatches[0].book.name} 1`,
      target: {
        type: "chapter" as const,
        bookIndex: prefixMatches[0].index,
        chapterIndex: 0,
      },
    };
  }

  return null;
}

function normalizeParsedEntity(
  entity: ParsedEntity,
  books: Book[],
): ReferenceUnit | null {
  const startBookCode = entity.start?.b;
  const endBookCode = entity.end?.b ?? startBookCode;
  const startChapterNumber = entity.start?.c;
  const endChapterNumber = entity.end?.c ?? startChapterNumber;
  const startVerseNumber = entity.start?.v;
  const endVerseNumber = entity.end?.v ?? startVerseNumber;
  if (
    !startBookCode ||
    !endBookCode ||
    !startChapterNumber ||
    !endChapterNumber ||
    !startVerseNumber ||
    !endVerseNumber
  ) {
    return null;
  }

  if (!isOsisBookCode(startBookCode) || !isOsisBookCode(endBookCode)) {
    return null;
  }

  const startBookIndex = osisBookToIndex.get(startBookCode);
  const endBookIndex = osisBookToIndex.get(endBookCode);
  if (
    startBookIndex === undefined ||
    endBookIndex === undefined ||
    startBookIndex >= books.length ||
    endBookIndex >= books.length
  ) {
    return null;
  }

  const startChapterIndex = startChapterNumber - 1;
  const endChapterIndex = endChapterNumber - 1;
  const startVerse = Math.max(1, Math.min(startVerseNumber, endVerseNumber));
  const endVerse = Math.max(startVerseNumber, endVerseNumber);
  const sameBook = startBookIndex === endBookIndex;
  const sameChapter = sameBook && startChapterIndex === endChapterIndex;
  const bookName = books[startBookIndex]?.name ?? BOOK_ICON_CODES[startBookIndex] ?? "GEN";

  if (entity.type === "b") {
    return {
      kind: "chapter" as const,
      bookIndex: startBookIndex,
      chapterIndex: 0,
      label: `${bookName} 1`,
      target: {
        type: "chapter" as const,
        bookIndex: startBookIndex,
        chapterIndex: 0,
      },
    };
  }

  if (
    sameChapter &&
    isFullSingleChapterReference(
      books,
      startBookIndex,
      startChapterIndex,
      startVerse,
      endVerse,
    )
  ) {
    return {
      kind: "chapter" as const,
      bookIndex: startBookIndex,
      chapterIndex: startChapterIndex,
      label: `${chapterLabel(bookName, startChapterIndex + 1)}`,
      target: {
        type: "chapter" as const,
        bookIndex: startBookIndex,
        chapterIndex: startChapterIndex,
      },
    };
  }

  if (sameChapter) {
    if (startVerse === endVerse) {
      return {
        kind: "selection" as const,
        bookIndex: startBookIndex,
        chapterIndex: startChapterIndex,
        label: `${chapterLabel(bookName, startChapterIndex + 1)}:${startVerse}`,
        target: {
          type: "verse" as const,
          bookIndex: startBookIndex,
          chapterIndex: startChapterIndex,
          verseNumber: startVerse,
        },
      };
    }

    const ranges = normalizeBookmarkRanges([{ start: startVerse, end: endVerse }]);
    return {
      kind: "selection" as const,
      bookIndex: startBookIndex,
      chapterIndex: startChapterIndex,
      label: formatReferenceRanges(bookName, startChapterIndex, ranges),
      target: {
        type: "selection" as const,
        bookIndex: startBookIndex,
        chapterIndex: startChapterIndex,
        ranges,
      },
    };
  }

  const target: ReaderNavigationTarget = {
    type: "range",
    start: {
      bookIndex: startBookIndex,
      chapterIndex: startChapterIndex,
      verseNumber: startVerseNumber,
    },
    end: {
      bookIndex: endBookIndex,
      chapterIndex: endChapterIndex,
      verseNumber: endVerseNumber,
    },
  };

  return {
    kind: "range" as const,
    bookIndex: startBookIndex,
    chapterIndex: startChapterIndex,
    label: formatCrossChapterRangeLabel(books, target),
    target,
  };
}

function mergeReferenceUnits(units: ReferenceUnit[], books: Book[]) {
  const merged: ReferenceCommandTarget[] = [];
  const groupedSelections = new Map<string, ReferenceUnit[]>();

  for (const unit of units) {
    if (
      unit.kind !== "selection" ||
      (unit.target.type !== "selection" && unit.target.type !== "verse")
    ) {
      merged.push({
        label: unit.label,
        target: unit.target,
      });
      continue;
    }

    const key = `${unit.bookIndex}:${unit.chapterIndex}`;
    const group = groupedSelections.get(key) ?? [];
    group.push(unit);
    groupedSelections.set(key, group);
  }

  for (const group of groupedSelections.values()) {
    const first = group[0];
    if (group.length === 1 && first?.target.type === "verse") {
      merged.push({
        label: first.label,
        target: first.target,
      });
      continue;
    }

    const ranges = normalizeBookmarkRanges(
      group.flatMap((unit) =>
        unit.target.type === "selection"
          ? unit.target.ranges
          : unit.target.type === "verse"
            ? [{ start: unit.target.verseNumber, end: unit.target.verseNumber }]
            : [],
      ),
    );
    const bookName =
      books[first.bookIndex]?.name ?? BOOK_ICON_CODES[first.bookIndex] ?? "GEN";

    merged.push({
      label: formatReferenceRanges(bookName, first.chapterIndex, ranges),
      target: {
        type: "selection",
        bookIndex: first.bookIndex,
        chapterIndex: first.chapterIndex,
        ranges,
      },
    });
  }

  return merged.sort((left, right) => {
    const leftStart =
      left.target.type === "range"
        ? [
            left.target.start.bookIndex,
            left.target.start.chapterIndex,
            left.target.start.verseNumber,
          ]
        : [
            left.target.bookIndex,
            left.target.chapterIndex,
            left.target.type === "chapter"
              ? 0
              : left.target.type === "verse"
                ? left.target.verseNumber
                : (left.target.ranges[0]?.start ?? 0),
          ];
    const rightStart =
      right.target.type === "range"
        ? [
            right.target.start.bookIndex,
            right.target.start.chapterIndex,
            right.target.start.verseNumber,
          ]
        : [
            right.target.bookIndex,
            right.target.chapterIndex,
            right.target.type === "chapter"
              ? 0
              : right.target.type === "verse"
                ? right.target.verseNumber
                : (right.target.ranges[0]?.start ?? 0),
          ];
    return (
      leftStart[0] - rightStart[0] ||
      leftStart[1] - rightStart[1] ||
      leftStart[2] - rightStart[2]
    );
  });
}

export function parseReferenceCommandInput(input: string, books: Book[]) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { targets: [] as ReferenceCommandTarget[] };
  }

  const parser = createReferenceParser();
  const parsed = parser.parse(trimmed).parsed_entities() as ParsedEntity[];
  const entities = flattenParsedEntities(parsed);
  // The passage extractor can ignore an invalid book number ("4 John" → John).
  // Commands must not silently navigate elsewhere. Valid numbered books include
  // the numeral in their parsed span; verse lists end in punctuation instead.
  if (entities.some((entity) => {
    const start = entity.absolute_indices?.[0];
    if (start === undefined || !/[a-z]/i.test(trimmed[start] ?? "")) return false;
    const beforeBook = trimmed.slice(0, start);
    return /(?:^|[;,])\s*(?:\d+|[ivx]+)\.?\s*$/i.test(beforeBook);
  })) {
    return { targets: [] as ReferenceCommandTarget[] };
  }
  const units = entities
    .map((entity: ParsedEntity) => normalizeParsedEntity(entity, books))
    .filter((value): value is ReferenceUnit => value !== null);

  if (units.length === 0) {
    const fallbackBookTarget = matchBookOnlyInput(trimmed, books);
    return {
      targets: fallbackBookTarget ? [fallbackBookTarget] : [],
    };
  }

  return {
    targets: mergeReferenceUnits(units, books),
  };
}

export function buildReferenceCommandActions(targets: ReferenceCommandTarget[]) {
  if (targets.length === 0) {
    return [] as ReferenceCommandAction[];
  }

  if (targets.length === 1) {
    const actions: ReferenceCommandAction[] = [
      {
        id: "single-new-tab",
        label: "Open in New Tab",
        description: targets[0].label,
      },
      {
        id: "single-new-panel",
        label: "Open as New Panel in Current Tab",
        description: targets[0].label,
      },
    ];
    return actions;
  }

  const actions: ReferenceCommandAction[] = [
    {
      id: "multiple-new-tabs",
      label: "Open Each in Its Own New Tab",
      description: `${targets.length} references`,
    },
    {
      id: "multiple-single-tab",
      label: "Open All in One New Tab",
      description: `${targets.length} panels in one new tab`,
    },
    {
      id: "multiple-current-tab-panels",
      label: "Open All as New Panels in Current Tab",
      description: `${targets.length} panels in the current tab`,
    },
  ];
  return actions;
}

function locationFromTarget(target: ReaderNavigationTarget) {
  if (target.type === "range") {
    return {
      bookIndex: target.start.bookIndex,
      chapterIndex: target.start.chapterIndex,
    };
  }

  return {
    bookIndex: target.bookIndex,
    chapterIndex: target.chapterIndex,
  };
}

export function buildReaderTabFromTargets(targets: ReaderNavigationTarget[]) {
  const firstTarget = targets[0] ?? {
    type: "chapter" as const,
    bookIndex: 0,
    chapterIndex: 0,
  };
  const firstLocation = locationFromTarget(firstTarget);
  const firstLeaf = createLeaf(
    firstLocation.bookIndex,
    firstLocation.chapterIndex,
    "reader",
  );
  const leafIds = [firstLeaf.id];
  let root: PanelNode = firstLeaf;
  let currentItemCount = 1;

  for (const target of targets.slice(1)) {
    const location = locationFromTarget(target);
    const nextLeaf = createLeaf(
      location.bookIndex,
      location.chapterIndex,
      "reader",
    );
    leafIds.push(nextLeaf.id);
    const nextItemCount = currentItemCount + 1;
    root = {
      id: createId(),
      type: "split",
      orientation: "horizontal",
      ratio: Math.round((currentItemCount / nextItemCount) * 100),
      first: root,
      second: nextLeaf,
    };
    currentItemCount = nextItemCount;
  }

  return {
    root,
    leafIds,
  };
}


/** Editing a saved destination must not silently discard or repair invalid input. */
export function parseBookmarkLocation(input: string, books: Book[]): BookmarkScope | null {
  const text = input.trim();
  if (!text || text.length > 500) return null;
  const parser = createReferenceParser();
  parser.set_options({
    versification_system: "kjv",
    invalid_passage_strategy: "include",
    invalid_sequence_strategy: "include",
  });
  const entities = flattenParsedEntities(parser.parse(text).parsed_entities() as ParsedEntity[]);
  if (!entities.length) return null;
  let end = 0;
  for (const entity of entities) {
    const span = entity.absolute_indices;
    if (!span || !entity.valid?.valid || Object.keys(entity.valid.messages).length ||
        !/^[\s,;]*$/.test(text.slice(end, span[0]))) return null;
    end = span[1];
  }
  if (text.slice(end).trim()) return null;
  const units = entities.map((entity) => normalizeParsedEntity(entity, books));
  if (units.some((unit) => unit === null)) return null;
  const targets = mergeReferenceUnits(units as ReferenceUnit[], books);
  const scope = targets.length === 1 ? targets[0].target : null;
  return scope && isBookmarkScopeAvailable(scope, books) ? scope : null;
}
