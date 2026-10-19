import { readLocalStorageValue, reportLocalStorageIssue, writeLocalStorageValue } from "@/lib/local-storage";

export type StorageCodec<T> = { parse: (raw: string | null) => T; stringify: (value: T) => string };
export type StorageMerge<T> = (latest: T, before: T, after: T) => T;

// Reconcile only this window's changes, not its entire (possibly stale) snapshot.
export function mergeStoredItems<T extends { id: string; updatedAt: number }>(latest: T[], before: T[], after: T[]): T[] {
  const old = new Map(before.map(item => [item.id, item]));
  const next = new Map(after.map(item => [item.id, item]));
  const merged = new Map(latest.map(item => [item.id, item]));
  for (const id of old.keys()) if (!next.has(id)) merged.delete(id);
  for (const item of after) {
    const previous = old.get(item.id);
    if (JSON.stringify(previous) === JSON.stringify(item)) continue;
    const current = merged.get(item.id);
    // A stale edit must not resurrect an item deleted in another window.
    if (previous && !current) continue;
    if (current && current.updatedAt > item.updatedAt && JSON.stringify(current) !== JSON.stringify(previous)) continue;
    merged.set(item.id, previous && current ? mergeStoredFields(current, previous, item) : item);
  }
  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function mergeStoredFields<T extends object>(latest: T, before: T, after: T): T {
  const merged = { ...latest };
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) merged[key] = after[key];
  }
  return merged;
}

export function mergeStoredSet(latest: Set<string>, before: Set<string>, after: Set<string>) {
  const result = new Set(latest);
  for (const key of before) if (!after.has(key)) result.delete(key);
  for (const key of after) if (!before.has(key)) result.add(key);
  return result;
}

export function recoveryCodec<T>(key: string, parse: (raw: string) => { entries: T[]; skippedInvalidCount: number }): StorageCodec<T[]> {
  return {
    stringify: JSON.stringify,
    parse(raw) {
      if (raw === null) return [];
      let result;
      try { result = parse(raw); } catch { /* Preserve malformed JSON too. */ }
      if (!result || result.skippedInvalidCount > 0) {
        reportLocalStorageIssue(key);
        const backupKey = `${key}.recovered`;
        if (readLocalStorageValue(backupKey) === null && !writeLocalStorageValue(backupKey, raw)) {
          throw new Error("Could not preserve unreadable saved data");
        }
      }
      return result?.entries ?? [];
    },
  };
}

export function createSyncedStorage<T>(key: string, codec: StorageCodec<T>, merge: StorageMerge<T>, fallback: T) {
  const listeners = new Set<() => void>();
  const pending: ((latest: T) => T)[] = [];
  const read = () => codec.parse(readLocalStorageValue(key));
  let snapshot: T;
  try { snapshot = read(); } catch { snapshot = fallback; }
  const emit = (next: T) => {
    if (codec.stringify(snapshot) === codec.stringify(next)) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const refresh = () => {
    try { emit(pending.reduce((value, apply) => apply(value), read())); }
    catch { reportLocalStorageIssue(key); }
  };
  const storageChanged = (event: StorageEvent) => {
    if ((event.key === key || event.key === null) && event.storageArea === window.localStorage) refresh();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        window.addEventListener("storage", storageChanged);
        window.addEventListener("focus", refresh);
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          window.removeEventListener("storage", storageChanged);
          window.removeEventListener("focus", refresh);
        }
      };
    },
    update(action: T | ((current: T) => T)) {
      // Refresh before calculating the edit, even if a storage event is queued.
      refresh();
      const before = snapshot;
      const after = typeof action === "function" ? (action as (current: T) => T)(before) : action;
      if (codec.stringify(before) === codec.stringify(after)) return;
      const apply = (latest: T) => merge(latest, before, after);
      pending.push(apply);
      emit(after);
      const commit = () => {
        try {
          const next = apply(read());
          if (!writeLocalStorageValue(key, codec.stringify(next))) return;
          pending.splice(pending.indexOf(apply), 1);
          refresh();
        } catch { reportLocalStorageIssue(key); }
      };
      // Serialize read/modify/write across tabs where Web Locks are available.
      // The fallback remains synchronous and rereads storage immediately before writing.
      if (typeof navigator !== "undefined" && navigator.locks) {
        void navigator.locks.request(`kjv-storage:${key}`, commit).catch(() => reportLocalStorageIssue(key));
      } else commit();
    },
  };
}
