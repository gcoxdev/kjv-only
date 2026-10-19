#!/usr/bin/env node

import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

const DATA_DIRECTORY = path.resolve("public/data")
const FULL_PATH = path.join(DATA_DIRECTORY, "kjv.json")
const COMPACT_PATH = path.join(DATA_DIRECTORY, "kjv-compact-v1.json")
const BOOTSTRAP_PATH = path.join(DATA_DIRECTORY, "kjv-bootstrap.json")
const MANIFEST_PATH = path.join(DATA_DIRECTORY, "kjv-manifest.json")

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function summarize(books) {
  return books.reduce(
    (summary, book) => {
      summary.bookCount += 1
      summary.chapterCount += book.chapters.length
      summary.verseCount += book.chapters.reduce(
        (total, chapter) => total + chapter.verses.length,
        0,
      )
      return summary
    },
    { bookCount: 0, chapterCount: 0, verseCount: 0 },
  )
}

async function writeAtomically(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  try {
    await fs.writeFile(temporaryPath, contents)
    await fs.rename(temporaryPath, filePath)
  } catch (error) {
    await fs.rm(temporaryPath, { force: true })
    throw error
  }
}

const fullPayload = JSON.parse(await fs.readFile(FULL_PATH, "utf8"))
const fullBuffer = Buffer.from(JSON.stringify(fullPayload))
const books = Array.isArray(fullPayload) ? fullPayload : fullPayload?.books
if (!Array.isArray(books) || books.length !== 66) {
  throw new Error("public/data/kjv.json must contain the canonical 66 books")
}
const genesis = books[0]
if (
  !genesis ||
  genesis.name !== "Genesis" ||
  !Array.isArray(genesis.chapters) ||
  genesis.chapters[0]?.chapter !== 1 ||
  !Array.isArray(genesis.chapters[0]?.verses) ||
  genesis.chapters[0].verses.length !== 31
) {
  throw new Error("public/data/kjv.json must begin with canonical Genesis 1")
}

const fullSummary = summarize(books)
if (
  fullSummary.bookCount !== 66 ||
  fullSummary.chapterCount !== 1189 ||
  fullSummary.verseCount !== 31102
) {
  throw new Error("public/data/kjv.json must contain the complete KJV corpus")
}

const bootstrapBooks = [
  {
    ...genesis,
    chapters: [genesis.chapters[0]],
  },
]
const bootstrapSummary = summarize(bootstrapBooks)
// Exact token objects are dictionary keys: no annotation is dropped or inferred.
const tokenTable = []
const tokenIds = new Map()
const compactBooks = books.map(book => ({
  ...book,
  chapters: book.chapters.map(chapter => ({
    ...chapter,
    verses: chapter.verses.map(verse => ({
      ...verse,
      tokens: verse.tokens.map(token => {
        const key = JSON.stringify(token)
        let id = tokenIds.get(key)
        if (id === undefined) {
          id = tokenTable.length
          tokenIds.set(key, id)
          tokenTable.push(token)
        }
        return id
      }),
    })),
  })),
}))
const compactBuffer = Buffer.from(JSON.stringify({
  format: "kjv-token-dictionary",
  schemaVersion: 1,
  metadata: fullPayload.metadata,
  books: compactBooks,
  tokenTable,
}))
const bootstrapBuffer = Buffer.from(
  JSON.stringify({
    metadata: {
      source: "KJV runtime bootstrap",
      ...bootstrapSummary,
    },
    books: bootstrapBooks,
  }),
)
const fullHash = sha256(fullBuffer)
const bootstrapHash = sha256(bootstrapBuffer)
const manifest = {
  schemaVersion: 1,
  corpusVersion: `sha256-${fullHash.slice(0, 16)}`,
  bootstrap: {
    url: "/data/kjv-bootstrap.json",
    sha256: bootstrapHash,
    bytes: bootstrapBuffer.byteLength,
    ...bootstrapSummary,
  },
  full: {
    url: "/data/kjv.json",
    sha256: fullHash,
    bytes: fullBuffer.byteLength,
    ...fullSummary,
  },
  compact: {
    url: "/data/kjv-compact-v1.json",
    sha256: sha256(compactBuffer),
    bytes: compactBuffer.byteLength,
    ...fullSummary,
  },
}

await writeAtomically(FULL_PATH, fullBuffer)
await writeAtomically(COMPACT_PATH, compactBuffer)
await writeAtomically(BOOTSTRAP_PATH, bootstrapBuffer)
await writeAtomically(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(
  JSON.stringify(
    {
      corpusVersion: manifest.corpusVersion,
      bootstrapBytes: manifest.bootstrap.bytes,
      fullBytes: manifest.full.bytes,
      compactBytes: manifest.compact.bytes,
      uniqueTokens: tokenTable.length,
    },
    null,
    2,
  ),
)
