import type { Book, Chapter, Verse, VerseToken } from "../types/bible"

export const COMPACT_BIBLE_FORMAT = "kjv-token-dictionary"

export function isCompactBiblePayload(input: unknown): input is Record<string, unknown> {
  return isRecord(input) && input.format === COMPACT_BIBLE_FORMAT
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function isToken(input: unknown): input is VerseToken {
  if (!isRecord(input) || typeof input.text !== "string") return false
  for (const key of ["strong", "lemma", "morph"]) {
    if (input[key] !== undefined && typeof input[key] !== "string") return false
  }
  for (const key of ["added", "divineName"]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean") return false
  }
  return input.strongs === undefined || (
    Array.isArray(input.strongs) && input.strongs.every(code => typeof code === "string")
  )
}

/** Keep the existing Book[] interface, sharing immutable dictionary tokens. */
export function decodeCompactBooks(input: unknown): Book[] | null {
  if (!isCompactBiblePayload(input) || input.schemaVersion !== 1 ||
      !Array.isArray(input.tokenTable) || !Array.isArray(input.books)) return null
  const tokens: VerseToken[] = []
  for (const token of input.tokenTable) {
    if (!isToken(token)) return null
    if (token.strongs) Object.freeze(token.strongs)
    tokens.push(Object.freeze(token))
  }
  const books: Book[] = []
  for (const book of input.books) {
    if (!isRecord(book) || typeof book.name !== "string" || !Array.isArray(book.chapters)) return null
    const chapters: Chapter[] = []
    for (const chapter of book.chapters) {
      if (!isRecord(chapter) || !Number.isSafeInteger(chapter.chapter) ||
          Number(chapter.chapter) < 1 || !Array.isArray(chapter.verses)) return null
      const verses: Verse[] = []
      for (const verse of chapter.verses) {
        if (!isRecord(verse) || !Number.isSafeInteger(verse.verse) ||
            Number(verse.verse) < 1 || !Array.isArray(verse.tokens)) return null
        const verseTokens: VerseToken[] = []
        for (const id of verse.tokens) {
          if (!Number.isSafeInteger(id) || id < 0 || id >= tokens.length) return null
          verseTokens.push(tokens[id])
        }
        verses.push({ ...verse, verse: Number(verse.verse), tokens: verseTokens })
      }
      chapters.push({ ...chapter, chapter: Number(chapter.chapter), verses })
    }
    books.push({ ...book, name: book.name, chapters })
  }
  return books
}
