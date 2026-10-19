import type { Book } from "@/types/bible"

export const KJV_CORPUS_MANIFEST_URL = "/data/kjv-manifest.json"

export type KjvCorpusAsset = {
  url: string
  sha256: string
  bytes: number
  bookCount: number
  chapterCount: number
  verseCount: number
}

export type KjvCorpusManifest = {
  schemaVersion: 1
  corpusVersion: string
  bootstrap: KjvCorpusAsset
  full: KjvCorpusAsset
  compact?: KjvCorpusAsset
}

export function matchesKjvCorpusAsset(
  books: Book[],
  asset: KjvCorpusAsset,
) {
  let chapterCount = 0
  let verseCount = 0
  for (const book of books) {
    chapterCount += book.chapters.length
    for (const chapter of book.chapters) {
      verseCount += chapter.verses.length
    }
  }
  return (
    books.length === asset.bookCount &&
    chapterCount === asset.chapterCount &&
    verseCount === asset.verseCount
  )
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function parseAsset(
  value: unknown,
  expectedUrl: "/data/kjv-bootstrap.json" | "/data/kjv.json" | "/data/kjv-compact-v1.json",
): KjvCorpusAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    candidate.url !== expectedUrl ||
    typeof candidate.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.sha256) ||
    !isPositiveSafeInteger(candidate.bytes) ||
    !isPositiveSafeInteger(candidate.bookCount) ||
    !isPositiveSafeInteger(candidate.chapterCount) ||
    !isPositiveSafeInteger(candidate.verseCount)
  ) {
    return null
  }

  return {
    url: expectedUrl,
    sha256: candidate.sha256,
    bytes: candidate.bytes,
    bookCount: candidate.bookCount,
    chapterCount: candidate.chapterCount,
    verseCount: candidate.verseCount,
  }
}

export function parseKjvCorpusManifest(
  value: unknown,
): KjvCorpusManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const bootstrap = parseAsset(
    candidate.bootstrap,
    "/data/kjv-bootstrap.json",
  )
  const full = parseAsset(candidate.full, "/data/kjv.json")
  const compact = candidate.compact === undefined ? undefined :
    parseAsset(candidate.compact, "/data/kjv-compact-v1.json")
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.corpusVersion !== "string" ||
    !/^sha256-[a-f0-9]{16}$/.test(candidate.corpusVersion) ||
    !bootstrap ||
    !full || compact === null ||
    (compact && (compact.bookCount !== 66 || compact.chapterCount !== 1189 || compact.verseCount !== 31102)) ||
    bootstrap.bookCount !== 1 ||
    bootstrap.chapterCount !== 1 ||
    bootstrap.verseCount !== 31 ||
    full.bookCount !== 66 ||
    full.chapterCount !== 1189 ||
    full.verseCount !== 31102
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    corpusVersion: candidate.corpusVersion,
    bootstrap,
    full,
    ...(compact ? { compact } : {}),
  }
}
