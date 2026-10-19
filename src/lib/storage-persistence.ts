export type StorageProtection = "protected" | "unprotected" | "unsupported" | "declined" | "error"

export async function checkStorageProtection(): Promise<StorageProtection> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported"
    if (await navigator.storage.persisted()) return "protected"
    return typeof navigator.storage.persist === "function" ? "unprotected" : "unsupported"
  } catch { return "error" }
}

/** Only call from an explicit user action; some browsers display a prompt. */
export async function requestStorageProtection(): Promise<StorageProtection> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported"
    return await navigator.storage.persist() ? "protected" : "declined"
  } catch { return "error" }
}
