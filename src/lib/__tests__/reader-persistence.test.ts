import { describe, expect, it } from "vitest"

import {
  isReadChaptersPayload,
  isReaderDisplaySettingsPayload,
  parseReadChapters,
  parseReaderDisplaySettings,
} from "@/lib/reader-persistence"

describe("reader persistence schemas", () => {
  it("preserves valid settings and migrates the legacy study target", () => {
    const parsed = parseReaderDisplaySettings({
      readerColorTheme: "forest",
      fontSize: 24,
      highlightColor: "#abcdef",
      studyToolOpenTarget: "panel",
      tabsOrientation: "vertical",
      contextVerseCount: 4,
      toolReferenceDisplayMode: "table",
    })

    expect(parsed.readerColorTheme).toBe("forest")
    expect(parsed.fontSize).toBe(24)
    expect(parsed.lightHighlightColor).toBe("#abcdef")
    expect(parsed.darkHighlightColor).toBe("#abcdef")
    expect(parsed.wordVerseSelectionTarget).toBe("new-panel")
    expect(parsed.tabsOrientation).toBe("vertical")
    expect(parsed.contextVerseCount).toBe(4)
    expect(parsed.toolReferenceDisplayMode).toBe("table")
  })

  it("preserves the legacy popover choice and accepts dialog previews", () => {
    expect(parseReaderDisplaySettings({ toolReferenceDisplayMode: "buttons" }).toolReferenceDisplayMode).toBe("buttons")
    expect(parseReaderDisplaySettings({ toolReferenceDisplayMode: "dialog" }).toolReferenceDisplayMode).toBe("dialog")
  })

  it("bounds non-finite and extreme display values", () => {
    const parsed = parseReaderDisplaySettings({
      fontSize: Number.POSITIVE_INFINITY,
      verseSpacing: 10_000,
      readerColorTheme: "unknown",
      contextVerseCount: 10_000,
    })

    expect(parsed.fontSize).toBe(16)
    expect(parsed.verseSpacing).toBe(24)
    expect(parsed.readerColorTheme).toBe("brown")
    expect(parsed.contextVerseCount).toBe(10)

    expect(parseReaderDisplaySettings({ contextVerseCount: 0 }).contextVerseCount).toBe(1)
    expect(parseReaderDisplaySettings({}).contextVerseCount).toBe(1)
    expect(
      parseReaderDisplaySettings({ toolReferenceDisplayMode: "cards" })
        .toolReferenceDisplayMode,
    ).toBe("buttons")
    expect(parseReaderDisplaySettings({}).toolReferenceDisplayMode).toBe("buttons")
  })

  it("filters malformed progress without discarding valid entries", () => {
    expect(
      [...parseReadChapters(["GEN.1", "", 12, "A".repeat(65), "EXO.2"])],
    ).toEqual(["GEN.1", "EXO.2"])
    expect(parseReadChapters(new Array(2_001).fill("GEN.1")).size).toBe(0)
    expect(isReadChaptersPayload(["GEN.1"])).toBe(true)
    expect(isReadChaptersPayload({ chapter: "GEN.1" })).toBe(false)
    expect(isReaderDisplaySettingsPayload({ fontSize: 18 })).toBe(true)
    expect(isReaderDisplaySettingsPayload([])).toBe(false)
  })
})
