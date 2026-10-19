import { describe, expect, it } from "vitest"

import {
  matchesKjvCorpusAsset,
  parseKjvCorpusManifest,
} from "@/lib/kjv-corpus-manifest"
import type { Book } from "@/types/bible"

const HASH = "a".repeat(64)

function validManifest() {
  return {
    schemaVersion: 1,
    corpusVersion: `sha256-${HASH.slice(0, 16)}`,
    bootstrap: {
      url: "/data/kjv-bootstrap.json",
      sha256: HASH,
      bytes: 10,
      bookCount: 1,
      chapterCount: 1,
      verseCount: 31,
    },
    full: {
      url: "/data/kjv.json",
      sha256: HASH,
      bytes: 100,
      bookCount: 66,
      chapterCount: 1189,
      verseCount: 31102,
    },
  }
}

describe("parseKjvCorpusManifest", () => {
  it("accepts the fixed local corpus contract", () => {
    expect(parseKjvCorpusManifest(validManifest())).toEqual(validManifest())
  })

  it("accepts an optional versioned compact asset without changing legacy URLs", () => {
    const manifest = { ...validManifest(), compact: { ...validManifest().full, url: "/data/kjv-compact-v1.json" } }
    expect(parseKjvCorpusManifest(manifest)).toEqual(manifest)
    expect(parseKjvCorpusManifest({ ...manifest, compact: { ...manifest.compact, url: "https://example.com/data.json" } })).toBeNull()
    expect(parseKjvCorpusManifest({ ...manifest, compact: { ...manifest.compact, verseCount: 1 } })).toBeNull()
  })

  it("matches parsed book, chapter, and verse counts to an asset", () => {
    const books: Book[] = [{
      name: "Genesis",
      chapters: [{
        chapter: 1,
        verses: Array.from({ length: 31 }, (_, index) => ({
          verse: index + 1,
          tokens: [],
        })),
      }],
    }]

    expect(matchesKjvCorpusAsset(books, validManifest().bootstrap)).toBe(true)
    expect(
      matchesKjvCorpusAsset(books, {
        ...validManifest().bootstrap,
        verseCount: 30,
      }),
    ).toBe(false)
  })

  it.each([
    ["remote URL", { full: { ...validManifest().full, url: "https://example.com/kjv.json" } }],
    ["invalid hash", { full: { ...validManifest().full, sha256: "nope" } }],
    ["wrong bootstrap counts", { bootstrap: { ...validManifest().bootstrap, verseCount: 30 } }],
    ["wrong canonical counts", { full: { ...validManifest().full, bookCount: 65 } }],
  ])("rejects an invalid %s", (_label, patch) => {
    expect(parseKjvCorpusManifest({ ...validManifest(), ...patch })).toBeNull()
  })
})
