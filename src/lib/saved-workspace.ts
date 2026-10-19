import { parseLayoutHash, type ParsedLayoutHash } from "@/lib/layout-hash"
import {
  readLocalStorageJson,
  removeLocalStorageValue,
  reportLocalStorageIssue,
  writeLocalStorageJson,
} from "@/lib/local-storage"

export const WORKSPACE_STORAGE_KEY = "kjv-workspace-v1"
export const FRESH_WORKSPACE_HASH = "#fresh"

export function readStartupWorkspace(hash: string): ParsedLayoutHash | null {
  // An explicit link always wins, even if malformed. Never silently substitute
  // an unrelated saved workspace for a link the reader chose to open.
  if (hash === FRESH_WORKSPACE_HASH) {
    removeLocalStorageValue(WORKSPACE_STORAGE_KEY)
    return null
  }
  if (hash && hash !== "#") return parseLayoutHash(hash)
  const saved = readLocalStorageJson<unknown>(WORKSPACE_STORAGE_KEY)
  if (saved === null) return null
  if (typeof saved === "object" && !Array.isArray(saved) &&
      "version" in saved && saved.version === 1 &&
      "layoutHash" in saved && typeof saved.layoutHash === "string") {
    const parsed = parseLayoutHash(saved.layoutHash)
    if (parsed) return parsed
  }
  reportLocalStorageIssue(WORKSPACE_STORAGE_KEY)
  return null
}

export function saveWorkspace(layoutHash: string) {
  // Do not replace a recoverable session with an oversized/unreadable layout.
  if (!parseLayoutHash(layoutHash)) {
    reportLocalStorageIssue(WORKSPACE_STORAGE_KEY)
    return false
  }
  return writeLocalStorageJson(WORKSPACE_STORAGE_KEY, { version: 1, layoutHash })
}

export function startFreshWorkspace() {
  removeLocalStorageValue(WORKSPACE_STORAGE_KEY)
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${FRESH_WORKSPACE_HASH}`)
  window.location.reload()
}
