import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"
import { expect, it } from "vitest"
import { decodeCompactBooks } from "../src/lib/compact-bible"

it("the shipped compact corpus preserves every KJV token and annotation", () => {
  const full = JSON.parse(readFileSync("public/data/kjv.json", "utf8"))
  const bytes = readFileSync("public/data/kjv-compact-v1.json")
  const compact = JSON.parse(bytes.toString("utf8"))
  const manifest = JSON.parse(readFileSync("public/data/kjv-manifest.json", "utf8"))
  const books = decodeCompactBooks(compact)!
  expect(isDeepStrictEqual(books, full.books)).toBe(true)
  expect(compact.metadata).toEqual(full.metadata)
  expect(manifest.compact.bytes).toBe(bytes.length)
  expect(manifest.compact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"))
  const uniqueTokens = new Set(books.flatMap(book => book.chapters.flatMap(chapter => chapter.verses.flatMap(verse => verse.tokens))))
  expect(uniqueTokens.size).toBe(compact.tokenTable.length)
  expect(uniqueTokens.size).toBeLessThan(250_000)
}, 30_000)
