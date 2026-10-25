import { defaultHighlightColor, normalizeHighlightColor } from "@/lib/highlight-color"
import {
  MAX_CONTEXT_VERSE_COUNT,
  MIN_CONTEXT_VERSE_COUNT,
} from "@/lib/context-verses"
import type {
  VisualToolOpenTarget,
  BookmarkOpenTarget,
  NotesLinkOpenTarget,
  ReaderColorTheme,
  ReferenceLinkOpenTarget,
  SearchResultOpenTarget,
  TabsOrientation,
  ToolReferenceDisplayMode,
  WordVerseSelectionTarget,
} from "@/types/reader"

const READER_COLOR_THEMES = new Set<ReaderColorTheme>([
  "brown",
  "contrast",
  "slate",
  "crimson",
  "amber",
  "forest",
  "navy",
  "indigo",
  "violet",
])
const WORD_TARGETS = new Set<WordVerseSelectionTarget>([
  "sidebar",
  "new-tab",
  "new-panel",
  "targeted-panel",
])
const PANEL_TARGETS = new Set<
  NotesLinkOpenTarget | SearchResultOpenTarget | BookmarkOpenTarget
>(["new-tab", "new-panel", "targeted-panel"])
const VISUAL_TOOL_TARGETS = new Set<VisualToolOpenTarget>(["dialog", "new-tab", "new-panel", "targeted-panel"])
const REFERENCE_TARGETS = new Set<ReferenceLinkOpenTarget>([
  "new-tab",
  "new-panel",
  "targeted-panel",
])
const TOOL_REFERENCE_DISPLAY_MODES = new Set<ToolReferenceDisplayMode>([
  "buttons",
  "dialog",
  "table",
])

export type ReaderDisplaySettings = {
  readerColorTheme: ReaderColorTheme
  fontSize: number
  lightHighlightColor: string
  darkHighlightColor: string
  verseSpacing: number
  contextVerseCount: number
  toolReferenceDisplayMode: ToolReferenceDisplayMode
  hideReadModeVerseNumbers: boolean
  readModeParagraphIndent: boolean
  flowVersesByParagraph: boolean
  showWelcomeHomeAtStartup: boolean
  tabsOrientation: TabsOrientation | null
  wordVerseSelectionTarget: WordVerseSelectionTarget
  notesLinkOpenTarget: NotesLinkOpenTarget
  searchResultOpenTarget: SearchResultOpenTarget
  bookmarkOpenTarget: BookmarkOpenTarget
  genealogyOpenTarget: VisualToolOpenTarget
  mapsOpenTarget: VisualToolOpenTarget
  timelineOpenTarget: VisualToolOpenTarget
  referenceLinkOpenTarget: ReferenceLinkOpenTarget
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isReaderDisplaySettingsPayload(
  value: unknown,
): value is Record<string, unknown> {
  return isRecord(value)
}

export function isReadChaptersPayload(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= 2_000
}

function finiteClampedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.round(value)))
    : fallback
}

function isOneOf<T extends string>(value: unknown, values: Set<T>): value is T {
  return typeof value === "string" && values.has(value as T)
}

export function defaultReaderDisplaySettings(): ReaderDisplaySettings {
  const highlightColor = defaultHighlightColor()
  return {
    readerColorTheme: "brown",
    fontSize: 16,
    lightHighlightColor: highlightColor,
    darkHighlightColor: highlightColor,
    verseSpacing: 0,
    contextVerseCount: 1,
    toolReferenceDisplayMode: "buttons",
    hideReadModeVerseNumbers: false,
    readModeParagraphIndent: false,
    flowVersesByParagraph: false,
    showWelcomeHomeAtStartup: true,
    tabsOrientation: null,
    wordVerseSelectionTarget: "sidebar",
    notesLinkOpenTarget: "new-panel",
    searchResultOpenTarget: "new-panel",
    bookmarkOpenTarget: "new-panel",
    genealogyOpenTarget: "dialog",
    mapsOpenTarget: "dialog",
    timelineOpenTarget: "dialog",
    referenceLinkOpenTarget: "new-tab",
  }
}

export function parseReaderDisplaySettings(
  value: unknown,
): ReaderDisplaySettings {
  const defaults = defaultReaderDisplaySettings()
  if (!isRecord(value)) {
    return defaults
  }

  const legacyHighlight =
    typeof value.highlightColor === "string" ? value.highlightColor : null
  const legacyStudyTarget =
    value.studyToolOpenTarget === "sidebar"
      ? "sidebar"
      : value.studyToolOpenTarget === "panel"
        ? "new-panel"
        : value.studyToolOpenTarget === "tab"
          ? "new-tab"
          : null

  return {
    readerColorTheme: isOneOf(value.readerColorTheme, READER_COLOR_THEMES)
      ? value.readerColorTheme
      : defaults.readerColorTheme,
    fontSize: finiteClampedInteger(value.fontSize, defaults.fontSize, 8, 96),
    lightHighlightColor: normalizeHighlightColor(
      typeof value.lightHighlightColor === "string"
        ? value.lightHighlightColor
        : legacyHighlight ?? defaults.lightHighlightColor,
    ),
    darkHighlightColor: normalizeHighlightColor(
      typeof value.darkHighlightColor === "string"
        ? value.darkHighlightColor
        : legacyHighlight ?? defaults.darkHighlightColor,
    ),
    verseSpacing: finiteClampedInteger(
      value.verseSpacing,
      defaults.verseSpacing,
      0,
      24,
    ),
    contextVerseCount: finiteClampedInteger(
      value.contextVerseCount,
      defaults.contextVerseCount,
      MIN_CONTEXT_VERSE_COUNT,
      MAX_CONTEXT_VERSE_COUNT,
    ),
    toolReferenceDisplayMode: isOneOf(
      value.toolReferenceDisplayMode,
      TOOL_REFERENCE_DISPLAY_MODES,
    )
      ? value.toolReferenceDisplayMode
      : defaults.toolReferenceDisplayMode,
    hideReadModeVerseNumbers:
      typeof value.hideReadModeVerseNumbers === "boolean"
        ? value.hideReadModeVerseNumbers
        : defaults.hideReadModeVerseNumbers,
    readModeParagraphIndent:
      typeof value.readModeParagraphIndent === "boolean"
        ? value.readModeParagraphIndent
        : defaults.readModeParagraphIndent,
    flowVersesByParagraph:
      typeof value.flowVersesByParagraph === "boolean"
        ? value.flowVersesByParagraph
        : defaults.flowVersesByParagraph,
    showWelcomeHomeAtStartup:
      typeof value.showWelcomeHomeAtStartup === "boolean"
        ? value.showWelcomeHomeAtStartup
        : defaults.showWelcomeHomeAtStartup,
    tabsOrientation:
      value.tabsOrientation === "horizontal" || value.tabsOrientation === "vertical"
        ? value.tabsOrientation
        : defaults.tabsOrientation,
    wordVerseSelectionTarget: isOneOf(value.wordVerseSelectionTarget, WORD_TARGETS)
      ? value.wordVerseSelectionTarget
      : legacyStudyTarget ?? defaults.wordVerseSelectionTarget,
    notesLinkOpenTarget: isOneOf(value.notesLinkOpenTarget, PANEL_TARGETS)
      ? value.notesLinkOpenTarget
      : defaults.notesLinkOpenTarget,
    searchResultOpenTarget: isOneOf(value.searchResultOpenTarget, PANEL_TARGETS)
      ? value.searchResultOpenTarget
      : defaults.searchResultOpenTarget,
    bookmarkOpenTarget: isOneOf(value.bookmarkOpenTarget, PANEL_TARGETS)
      ? value.bookmarkOpenTarget
      : defaults.bookmarkOpenTarget,
    genealogyOpenTarget: isOneOf(value.genealogyOpenTarget, VISUAL_TOOL_TARGETS)
      ? value.genealogyOpenTarget
      : defaults.genealogyOpenTarget,
    mapsOpenTarget: isOneOf(value.mapsOpenTarget, VISUAL_TOOL_TARGETS)
      ? value.mapsOpenTarget
      : defaults.mapsOpenTarget,
    timelineOpenTarget: isOneOf(value.timelineOpenTarget, VISUAL_TOOL_TARGETS)
      ? value.timelineOpenTarget
      : defaults.timelineOpenTarget,
    referenceLinkOpenTarget: isOneOf(value.referenceLinkOpenTarget, REFERENCE_TARGETS)
      ? value.referenceLinkOpenTarget
      : defaults.referenceLinkOpenTarget,
  }
}

export function parseReadChapters(value: unknown) {
  if (!Array.isArray(value) || value.length > 2_000) {
    return new Set<string>()
  }
  return new Set(
    value.filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.length > 0 && entry.length <= 64,
    ),
  )
}
