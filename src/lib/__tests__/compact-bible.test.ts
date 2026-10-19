import { describe, expect, it } from "vitest"
import { parseBooks } from "@/lib/bible-payload"

function payload() {
  return {
    format: "kjv-token-dictionary", schemaVersion: 1,
    tokenTable: [
      { text: "created", strong: "H853", strongs: ["H853", "H1254"], lemma: "strong:H0853 strong:H01254", morph: "strongMorph:TH8804" },
      { text: "LORD", divineName: true }, { text: "was", added: true }, { text: "." },
    ],
    books: [{ name: "Genesis", chapters: [{ chapter: 1, verses: [
      { verse: 1, tokens: [0, 1, 2, 3], redLetter: false, paragraphStart: true, paragraphMarker: "¶", notes: [{ type: "alternative", text: "or", readings: [{ type: "reading", text: "a reading" }] }] },
      { verse: 2, tokens: [0, 3], redLetter: true },
    ] }] }],
  }
}

describe("compact Bible payload", () => {
  it("preserves verse annotations and shares only immutable dictionary tokens", () => {
    const input = payload()
    const books = parseBooks(input)!
    const verses = books[0].chapters[0].verses
    expect(verses[0]).toEqual({ ...input.books[0].chapters[0].verses[0], tokens: input.tokenTable })
    expect(verses[1].redLetter).toBe(true)
    expect(verses[0].tokens[0]).toBe(verses[1].tokens[0])
    expect(verses[0].tokens).not.toBe(verses[1].tokens)
    expect(() => { verses[0].tokens[0].text = "changed" }).toThrow()
    expect(() => { verses[0].tokens[0].strongs!.push("H1") }).toThrow()
    expect(verses[1].tokens[0].text).toBe("created")
  })

  it.each([-1, 4, 0.5, "0", null])("rejects invalid dictionary reference %s", id => {
    const input = payload()
    Object.assign(input.books[0].chapters[0].verses[0], { tokens: [id] })
    expect(parseBooks(input)).toBeNull()
  })

  it("rejects unknown encodings and malformed tokens instead of treating IDs as words", () => {
    expect(parseBooks({ ...payload(), schemaVersion: 2 })).toBeNull()
    expect(parseBooks({ ...payload(), format: "unknown" })).toBeNull()
    expect(parseBooks({ ...payload(), tokenTable: [{ text: "test", strongs: [123] }] })).toBeNull()
    expect(parseBooks({ ...payload(), tokenTable: [{ text: 123 }] })).toBeNull()
  })

  it("continues accepting legacy payloads and book arrays", () => {
    const books = [{ name: "Genesis", chapters: [{ chapter: 1, verses: [{ verse: 1, tokens: [{ text: "In" }] }] }] }]
    expect(parseBooks({ books })).toBe(books)
    expect(parseBooks(books)).toBe(books)
  })
})
