import { chapterLabel } from "@/lib/bible-books";
import type {
  SearchDefinition,
  SearchFacets,
  SearchMatch,
  SearchMode,
  SearchPageState,
  SearchResultSort,
} from "@/types/reader";

export const SEARCH_DEFINITION_LIMITS = {
  maxPhraseLength: 512,
  maxSelectedWords: 32,
  maxWordLength: 80,
  maxSelectedBooks: 66,
  maxBookIndex: 65,
} as const;

const SEARCH_MODES = new Set<SearchMode>([
  "smart",
  "contains-any",
  "contains-all",
  "regex",
]);
const SEARCH_RESULT_SORTS = new Set<SearchResultSort>([
  "relevance",
  "canonical",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWords(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length > SEARCH_DEFINITION_LIMITS.maxSelectedWords
  ) {
    return null;
  }

  const words: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    const word = item.trim();
    if (!word || word.length > SEARCH_DEFINITION_LIMITS.maxWordLength) {
      return null;
    }
    const key = word.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      words.push(word);
    }
  }
  return words;
}

function normalizeBookIndexes(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > SEARCH_DEFINITION_LIMITS.maxSelectedBooks
  ) {
    return null;
  }

  const indexes = new Set<number>();
  for (const item of value) {
    if (
      !Number.isSafeInteger(item) ||
      (item as number) < 0 ||
      (item as number) > SEARCH_DEFINITION_LIMITS.maxBookIndex
    ) {
      return null;
    }
    indexes.add(item as number);
  }
  return Array.from(indexes).sort((left, right) => left - right);
}

export function parseSearchDefinition(value: unknown): SearchDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const searchMode = value.searchMode;
  const resultSort = value.resultSort;
  const phraseInput = value.phraseInput;
  const selectedWords = normalizeWords(value.selectedWords);
  const selectedBookIndexes = normalizeBookIndexes(value.selectedBookIndexes);
  if (
    typeof searchMode !== "string" ||
    !SEARCH_MODES.has(searchMode as SearchMode) ||
    typeof value.caseSensitive !== "boolean" ||
    typeof phraseInput !== "string" ||
    phraseInput.length > SEARCH_DEFINITION_LIMITS.maxPhraseLength ||
    selectedWords === null ||
    selectedBookIndexes === null ||
    typeof resultSort !== "string" ||
    !SEARCH_RESULT_SORTS.has(resultSort as SearchResultSort) ||
    typeof value.showResultContext !== "boolean"
  ) {
    return null;
  }

  const normalizedPhrase = phraseInput.trim();
  if (
    (searchMode === "smart" || searchMode === "regex") &&
    !normalizedPhrase
  ) {
    return null;
  }
  if (
    (searchMode === "contains-any" || searchMode === "contains-all") &&
    selectedWords.length === 0
  ) {
    return null;
  }

  return {
    searchMode: searchMode as SearchMode,
    caseSensitive: value.caseSensitive,
    phraseInput:
      searchMode === "smart" || searchMode === "regex"
        ? normalizedPhrase
        : "",
    selectedWords:
      searchMode === "contains-any" || searchMode === "contains-all"
        ? selectedWords
        : [],
    selectedBookIndexes,
    resultSort: resultSort as SearchResultSort,
    showResultContext: value.showResultContext,
  };
}

export function createSearchDefinition(
  state: Pick<
    SearchPageState,
    | "searchMode"
    | "caseSensitive"
    | "phraseInput"
    | "selectedWords"
    | "selectedBookIndexes"
    | "resultSort"
    | "showResultContext"
  >,
): SearchDefinition | null {
  return parseSearchDefinition(state);
}

export function searchDefinitionToStatePatch(
  definition: SearchDefinition,
): Partial<SearchPageState> {
  return {
    ...definition,
    chipInput: "",
    lastSearchMode: null,
    lastSearchCaseSensitive: false,
    lastSearchPhraseInput: "",
    lastSearchSelectedWords: [],
    isControlsCollapsed: false,
    resultFacets: null,
    currentPage: 1,
    results: [],
    error: null,
  };
}

export function searchDefinitionKey(definition: SearchDefinition) {
  return JSON.stringify(definition);
}

export function searchDefinitionLabel(definition: SearchDefinition) {
  if (
    definition.searchMode === "contains-any" ||
    definition.searchMode === "contains-all"
  ) {
    return definition.selectedWords.join(", ");
  }
  return definition.phraseInput;
}

export function buildSearchFacets(matches: readonly SearchMatch[]): SearchFacets {
  const counts = new Map<
    number,
    { bookIndex: number; bookName: string; count: number }
  >();
  let oldTestament = 0;
  let newTestament = 0;

  for (const match of matches) {
    if (match.bookIndex < 39) {
      oldTestament += 1;
    } else {
      newTestament += 1;
    }
    const current = counts.get(match.bookIndex);
    if (current) {
      current.count += 1;
    } else {
      counts.set(match.bookIndex, {
        bookIndex: match.bookIndex,
        bookName: match.bookName,
        count: 1,
      });
    }
  }

  return {
    total: matches.length,
    oldTestament,
    newTestament,
    books: Array.from(counts.values()).sort(
      (left, right) => left.bookIndex - right.bookIndex,
    ),
  };
}

export function compareSearchMatchesCanonically(
  left: SearchMatch,
  right: SearchMatch,
) {
  return (
    left.bookIndex - right.bookIndex ||
    left.chapterIndex - right.chapterIndex ||
    left.verseNumber - right.verseNumber
  );
}

export function searchMatchKey(
  match: Pick<SearchMatch, "bookIndex" | "chapterIndex" | "verseNumber">,
) {
  return `${match.bookIndex}:${match.chapterIndex}:${match.verseNumber}`;
}

export type SearchResultContext = {
  before: SearchMatch[];
  after: SearchMatch[];
};

export function formatSearchResultsText(args: {
  summary: string;
  results: readonly SearchMatch[];
  contextByMatchKey?: ReadonlyMap<string, SearchResultContext>;
}) {
  const lines = [
    "KJV Only Search Results",
    args.summary,
    `${args.results.length} loaded result${args.results.length === 1 ? "" : "s"}`,
    "",
  ];
  for (const match of args.results) {
    const reference = `${chapterLabel(match.bookName, match.chapterIndex + 1)}:${match.verseNumber}`;
    const context = args.contextByMatchKey?.get(searchMatchKey(match));
    for (const before of context?.before ?? []) {
      lines.push(`  Before (${before.verseNumber}) ${before.text}`);
    }
    lines.push(`${reference} — ${match.text}`);
    for (const after of context?.after ?? []) {
      lines.push(`  After (${after.verseNumber}) ${after.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
