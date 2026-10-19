import { useState, useSyncExternalStore } from "react";
import { createSyncedStorage, type StorageCodec, type StorageMerge } from "@/lib/synced-storage";

export function useSyncedStorage<T>(key: string, codec: StorageCodec<T>, merge: StorageMerge<T>, fallback: T) {
  const [store] = useState(() => createSyncedStorage(key, codec, merge, fallback));
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return [value, store.update] as const;
}
