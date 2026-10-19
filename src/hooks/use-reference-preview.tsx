import { type ReactNode, useCallback, useEffect, useRef } from "react";

import type { Book } from "@/types/bible";
import { normalizeConcordanceWord, parseBibleReference } from "@/lib/references";
import { renderHighlightedText } from "@/lib/reader-view";
import {
  formatDisplayTokenText,
  isPunctuationToken,
} from "@/components/reader/chapter-text-content";
import { clampContextVerseCount } from "@/lib/context-verses";
import { cn } from "@/lib/utils";

type ReferencePreviewData = {
  citation: string;
  verseLines: Array<{ label: string; text: string; isContext: boolean }>;
};

type UseReferencePreviewParams = {
  books: Book[];
  openChapterReference: (
    bookIndex: number,
    chapterIndex: number,
    startVerse: number,
    endVerse: number,
  ) => void;
  contextVerseCount: number;
};

const MAX_REFERENCE_PREVIEW_VERSES = 24;

function verseText(verse: Book["chapters"][number]["verses"][number]) {
  return verse.tokens
    .map((token, index) => {
      const leadingSpace = index > 0 && !isPunctuationToken(token.text);
      return `${leadingSpace ? " " : ""}${formatDisplayTokenText(token)}`;
    })
    .join("");
}

export function formatReferenceCitation(
  bookName: string,
  startChapterIndex: number,
  startVerse: number,
  endChapterIndex: number,
  endVerse: number,
) {
  const citationVerse =
    startChapterIndex === endChapterIndex
      ? startVerse === endVerse
        ? `${startChapterIndex + 1}:${startVerse}`
        : `${startChapterIndex + 1}:${startVerse}-${endVerse}`
      : `${startChapterIndex + 1}:${startVerse}-${endChapterIndex + 1}:${endVerse}`;

  return `${bookName === "Psalms" && startChapterIndex === endChapterIndex ? "Psalm" : bookName} ${citationVerse}`;
}

export function useReferencePreview({
  books,
  openChapterReference,
  contextVerseCount,
}: UseReferencePreviewParams) {
  const referencePreviewCacheRef = useRef<Map<string, ReferencePreviewData>>(
    new Map(),
  );

  useEffect(() => {
    referencePreviewCacheRef.current.clear();
  }, [books, contextVerseCount]);

  const openReference = useCallback(
    (reference: string) => {
      const parsed = parseBibleReference(reference);
      if (!parsed) {
        return;
      }
      const startChapter =
        books[parsed.bookIndex]?.chapters[parsed.startChapterIndex] ?? null;
      const highlightEnd =
        parsed.startChapterIndex === parsed.endChapterIndex
          ? parsed.endVerse
          : (startChapter?.verses[startChapter.verses.length - 1]?.verse ??
            parsed.startVerse);
      openChapterReference(
        parsed.bookIndex,
        parsed.startChapterIndex,
        parsed.startVerse,
        highlightEnd,
      );
    },
    [books, openChapterReference],
  );

  const referencePreviewData = useCallback(
    (reference: string, includeContext: boolean) => {
      const cacheKey = `${includeContext ? "context" : "reference"}:${reference}`;
      const cached = referencePreviewCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const parsed = parseBibleReference(reference);
      if (!parsed) {
        const fallback = {
          citation: reference,
          verseLines: [] as ReferencePreviewData["verseLines"],
        };
        referencePreviewCacheRef.current.set(cacheKey, fallback);
        return fallback;
      }

      const book = books[parsed.bookIndex];
      const chapters = book?.chapters ?? [];
      if (
        !book ||
        !chapters[parsed.startChapterIndex] ||
        !chapters[parsed.endChapterIndex]
      ) {
        const fallback = {
          citation: reference,
          verseLines: [] as ReferencePreviewData["verseLines"],
        };
        referencePreviewCacheRef.current.set(cacheKey, fallback);
        return fallback;
      }

      const verseLines: ReferencePreviewData["verseLines"] = [];
      const addVerseLine = (
        chapter: Book["chapters"][number],
        verse: Book["chapters"][number]["verses"][number],
        isContext: boolean,
      ) => {
        verseLines.push({
          label: `${chapter.chapter}:${verse.verse}`,
          text: verseText(verse),
          isContext,
        });
      };

      const perSideCount = clampContextVerseCount(contextVerseCount);
      if (includeContext) {
        const startChapter = chapters[parsed.startChapterIndex];
        const precedingVerses = startChapter.verses
          .filter((verse) => verse.verse < parsed.startVerse)
          .slice(-perSideCount);
        for (const verse of precedingVerses) {
          addVerseLine(startChapter, verse, true);
        }
      }

      let referenceVerseCount = 0;
      for (
        let chapterIndex = parsed.startChapterIndex;
        chapterIndex <= parsed.endChapterIndex;
        chapterIndex += 1
      ) {
        const chapter = chapters[chapterIndex];
        if (!chapter) {
          continue;
        }

        const start =
          chapterIndex === parsed.startChapterIndex ? parsed.startVerse : 1;
        const end =
          chapterIndex === parsed.endChapterIndex
            ? parsed.endVerse
            : (chapter.verses[chapter.verses.length - 1]?.verse ?? 0);
        const verses = chapter.verses.filter(
          (candidate) => candidate.verse >= start && candidate.verse <= end,
        );

        for (const verse of verses) {
          addVerseLine(chapter, verse, false);
          referenceVerseCount += 1;
          if (referenceVerseCount >= MAX_REFERENCE_PREVIEW_VERSES) {
            break;
          }
        }

        if (referenceVerseCount >= MAX_REFERENCE_PREVIEW_VERSES) {
          break;
        }
      }

      if (includeContext) {
        const endChapter = chapters[parsed.endChapterIndex];
        const followingVerses = endChapter.verses
          .filter((verse) => verse.verse > parsed.endVerse)
          .slice(0, perSideCount);
        for (const verse of followingVerses) {
          addVerseLine(endChapter, verse, true);
        }
      }

      const computed = {
        citation: formatReferenceCitation(
          book.name,
          parsed.startChapterIndex,
          parsed.startVerse,
          parsed.endChapterIndex,
          parsed.endVerse,
        ),
        verseLines,
      };
      referencePreviewCacheRef.current.set(cacheKey, computed);
      return computed;
    },
    [books, contextVerseCount],
  );

  const renderPreview = useCallback(
    (
      reference: string,
      highlightWord: string,
      options?: {
        includeContext?: boolean;
        citationActions?: ReactNode;
        contextId?: string;
      },
    ): ReactNode => {
      const includeContext = options?.includeContext === true;
      const citationActions = options?.citationActions;
      const { citation, verseLines } = referencePreviewData(
        reference,
        includeContext,
      );
      const needle = normalizeConcordanceWord(highlightWord);
      const citationHeading = (
        <div
          data-reference-heading
          className="flex min-w-0 items-start justify-between gap-2"
        >
          <p className="min-w-0 break-words font-semibold">{citation}</p>
          {citationActions}
        </div>
      );

      if (verseLines.length === 0) {
        return (
          <div className="flex flex-col gap-1">
            {citationHeading}
            <p id={options?.contextId}>{reference}</p>
          </div>
        );
      }

      const foundFirstReferencedIndex = includeContext
        ? verseLines.findIndex((line) => !line.isContext)
        : 0;
      const hasReferencedLines = foundFirstReferencedIndex >= 0;
      const firstReferencedIndex = hasReferencedLines
        ? foundFirstReferencedIndex
        : verseLines.length;
      let lastReferencedIndex = hasReferencedLines
        ? firstReferencedIndex
        : verseLines.length - 1;
      if (includeContext && hasReferencedLines) {
        for (let index = verseLines.length - 1; index >= 0; index -= 1) {
          if (!verseLines[index].isContext) {
            lastReferencedIndex = index;
            break;
          }
        }
      }
      const beforeLines = includeContext
        ? verseLines.slice(0, firstReferencedIndex)
        : [];
      const referencedLines = includeContext
        ? hasReferencedLines
          ? verseLines.slice(firstReferencedIndex, lastReferencedIndex + 1)
          : []
        : verseLines;
      const afterLines = includeContext && hasReferencedLines
        ? verseLines.slice(lastReferencedIndex + 1)
        : [];

      const renderVerseLine = (
        line: ReferencePreviewData["verseLines"][number],
      ) => (
        <p
          key={`${reference}-line-${line.label}`}
          data-context-primary={!line.isContext ? "true" : undefined}
          data-context-line={line.isContext ? "surrounding" : "referenced"}
          data-context-verse={line.label}
          className={cn(
            line.isContext && "font-normal text-muted-foreground",
            includeContext &&
              !line.isContext &&
              "font-semibold text-foreground",
          )}
        >
          <span
            className={cn(
              "mr-1 text-xs text-muted-foreground",
              line.isContext ? "font-normal" : "font-semibold",
            )}
          >
            {line.label}
          </span>
          <span>
            {renderHighlightedText(
              line.text,
              needle,
              `${reference}-${line.label}`,
            )}
          </span>
        </p>
      );

      const renderContextSection = (
        lines: ReferencePreviewData["verseLines"],
        position: "before" | "after",
      ) =>
        lines.length > 0 ? (
          <div
            data-context-section={position}
            className="flex flex-col gap-1 border-l-2 border-subtle-divider pl-2"
          >
            {lines.map(renderVerseLine)}
          </div>
        ) : null;

      return (
        <div className="flex flex-col gap-1">
          {citationHeading}
          <div
            id={options?.contextId}
            data-verse-context={includeContext ? "true" : undefined}
            className="flex flex-col gap-1 leading-relaxed"
          >
            {renderContextSection(beforeLines, "before")}
            {referencedLines.map(renderVerseLine)}
            {renderContextSection(afterLines, "after")}
          </div>
        </div>
      );
    },
    [referencePreviewData],
  );

  return { openReference, renderPreview };
}
