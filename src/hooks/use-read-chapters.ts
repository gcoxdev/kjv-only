import { useSyncedStorage } from "@/hooks/use-synced-storage";
import { READER_STORAGE_KEYS, reportLocalStorageIssue } from "@/lib/local-storage";
import { isReadChaptersPayload, parseReadChapters } from "@/lib/reader-persistence";
import { mergeStoredSet } from "@/lib/synced-storage";

export function useReadChapters() {
  const [readChapters, setReadChapters] = useSyncedStorage(READER_STORAGE_KEYS.readChapters, {
    parse(raw) {
      const value: unknown = raw === null ? null : JSON.parse(raw);
      if (value !== null && !isReadChaptersPayload(value)) reportLocalStorageIssue(READER_STORAGE_KEYS.readChapters);
      return parseReadChapters(value);
    },
    stringify: value => JSON.stringify([...value]),
  }, mergeStoredSet, new Set<string>());
  return { readChapters, setReadChapters };
}
