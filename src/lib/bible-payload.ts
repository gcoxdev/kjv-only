import type { Book } from "@/types/bible"
import type { ReaderPayload } from "@/types/reader"
import { decodeCompactBooks, isCompactBiblePayload } from "@/lib/compact-bible"

export function parseBooks(input: unknown): Book[] | null {
  if (isCompactBiblePayload(input)) return decodeCompactBooks(input)
  if (Array.isArray(input)) {
    return input as Book[]
  }

  if (typeof input === "object" && input !== null) {
    if ("format" in input || "tokenTable" in input) return null
    const payload = input as ReaderPayload
    if (Array.isArray(payload.books)) {
      return payload.books
    }
  }

  return null
}
