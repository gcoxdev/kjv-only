import { useCallback, useState } from "react";

import { isBookmarkScopeAvailable, bookmarkCanonicalKey, bookmarkScopeLabel, normalizeRangePoints } from "@/lib/bookmarks";
import { READER_STORAGE_KEYS } from "@/lib/local-storage";
import { useSyncedStorage } from "@/hooks/use-synced-storage";
import { mergeStoredItems, recoveryCodec } from "@/lib/synced-storage";
import { filterRecordEntries, swapRecordEntries } from "@/lib/leaf-state";
import { createId } from "@/lib/reader-layout";
import { parseStoredBookmarksPayloadDetailed } from "@/lib/reader-transfer";
import type { Book } from "@/types/bible";
import type {
  BookmarkScope,
  ReaderBookmark,
} from "@/types/bookmarks";

type UseReaderBookmarksArgs = {
  books: Book[];
};

export function useReaderBookmarks({ books }: UseReaderBookmarksArgs) {
  const [readerBookmarks, setReaderBookmarks] = useSyncedStorage(
    READER_STORAGE_KEYS.bookmarks, recoveryCodec<ReaderBookmark>(READER_STORAGE_KEYS.bookmarks, parseStoredBookmarksPayloadDetailed),
    mergeStoredItems<ReaderBookmark>, [],
  );
  const [highlightModeEnabledByLeafId, setHighlightModeEnabledByLeafId] =
    useState<Record<string, boolean>>({});
  const [selectedHighlightScope, setSelectedHighlightScope] =
    useState<BookmarkScope | null>(null);

  const upsertBookmark = useCallback(
    (
      scope: BookmarkScope,
      patch?: Partial<Pick<ReaderBookmark, "label" | "note">>,
    ) => {
      const normalizedScope =
        scope.type === "range"
          ? {
              ...scope,
              ...normalizeRangePoints(scope.start, scope.end),
            }
          : scope;
      const scopeKey = bookmarkCanonicalKey(normalizedScope);
      const now = Date.now();
      const defaultLabel = bookmarkScopeLabel(normalizedScope, books);
      const nextLabel = patch?.label?.trim() || defaultLabel;
      const nextNote = patch?.note?.trim() ?? "";
      let nextBookmarkId = createId();

      setReaderBookmarks((current) => {
        const existingIndex = current.findIndex(
          (bookmark) => bookmarkCanonicalKey(bookmark.scope) === scopeKey,
        );

        if (existingIndex < 0) {
          return [
            {
              id: nextBookmarkId,
              type: normalizedScope.type,
              scope: normalizedScope,
              label: nextLabel,
              note: nextNote,
              createdAt: now,
              updatedAt: now,
            },
            ...current,
          ];
        }

        const existing = current[existingIndex];
        nextBookmarkId = existing.id;
        const updated: ReaderBookmark = {
          ...existing,
          type: normalizedScope.type,
          scope: normalizedScope,
          label:
            patch?.label !== undefined
              ? nextLabel
              : existing.label || defaultLabel,
          note: patch?.note !== undefined ? nextNote : existing.note,
          updatedAt: now,
        };

        const next = [...current];
        next.splice(existingIndex, 1);
        return [updated, ...next];
      });

      return nextBookmarkId;
    },
    [books, setReaderBookmarks],
  );

  const updateBookmark = useCallback(
    (
      bookmarkId: string,
      patch: Partial<Pick<ReaderBookmark, "label" | "note" | "folder" | "tags" | "scope">>,
    ) => {
      if (patch.scope && !isBookmarkScopeAvailable(patch.scope, books)) return;
      const now = Date.now();
      setReaderBookmarks((current) =>
        current.map((bookmark) =>
          bookmark.id === bookmarkId
            ? {
                ...bookmark,
                ...(patch.scope ? { scope: patch.scope, type: patch.scope.type } : null),
                ...(patch.folder !== undefined ? { folder: patch.folder.trim() } : null),
                ...(patch.tags !== undefined ? { tags: patch.tags } : null),
                ...(patch.label !== undefined
                  ? { label: patch.label.trim() }
                  : null),
                ...(patch.note !== undefined ? { note: patch.note.trim() } : null),
                updatedAt: now,
              }
            : bookmark,
        ),
      );
    },
    [books, setReaderBookmarks],
  );

  const deleteBookmark = useCallback((bookmarkId: string) => {
    setReaderBookmarks((current) =>
      current.filter((bookmark) => bookmark.id !== bookmarkId),
    );
  }, [setReaderBookmarks]);

  const importBookmarks = useCallback((importedBookmarks: ReaderBookmark[]) => {
    setReaderBookmarks((current) => {
      const merged = new Map<string, ReaderBookmark>();
      for (const bookmark of current) {
        merged.set(bookmark.id, bookmark);
      }
      for (const bookmark of importedBookmarks) {
        merged.set(bookmark.id, bookmark);
      }
      return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, [setReaderBookmarks]);

  const toggleHighlightModeForLeaf = useCallback((leafId: string) => {
    setHighlightModeEnabledByLeafId((current) => {
      const nextValue = !current[leafId];
      const next = {
        ...current,
        [leafId]: nextValue,
      };
      if (!nextValue) {
        delete next[leafId];
      }
      return next;
    });
  }, []);

  const disableHighlightModeForLeaf = useCallback((leafId: string) => {
    setHighlightModeEnabledByLeafId((current) => {
      if (!current[leafId]) {
        return current;
      }
      const next = { ...current };
      delete next[leafId];
      return next;
    });
  }, []);

  const swapHighlightModeForLeaves = useCallback(
    (sourceLeafId: string, targetLeafId: string) => {
      setHighlightModeEnabledByLeafId((current) =>
        swapRecordEntries(current, sourceLeafId, targetLeafId),
      );
    },
    [],
  );

  const pruneHighlightModeForLeaves = useCallback(
    (validLeafIds: ReadonlySet<string>) => {
      setHighlightModeEnabledByLeafId((current) =>
        filterRecordEntries(current, validLeafIds),
      );
    },
    [],
  );

  const createChapterBookmark = useCallback(
    (bookIndex: number, chapterIndex: number) => {
      upsertBookmark({
        type: "chapter",
        bookIndex,
        chapterIndex,
      });
    },
    [upsertBookmark],
  );

  return {
    readerBookmarks,
    highlightModeEnabledByLeafId,
    selectedHighlightScope,
    setSelectedHighlightScope,
    upsertBookmark,
    updateBookmark,
    deleteBookmark,
    importBookmarks,
    toggleHighlightModeForLeaf,
    disableHighlightModeForLeaf,
    swapHighlightModeForLeaves,
    pruneHighlightModeForLeaves,
    createChapterBookmark,
  };
}
