import { chapterLabel } from "@/lib/bible-books";
import {
  memo,
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircleHelpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  MinusSquareIcon,
  PlusSquareIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import type { Book } from "@/types/bible";
import type {
  SearchDefinition,
  SearchMatch,
  SearchMode,
  SearchPageState,
} from "@/types/reader";
import { bookCodeForIndex, iconPath, renderHighlightedTerms, renderHighlightedText } from "@/lib/reader-view";
import type {
  RunSearchResultAnalysis,
  RunSmartVerseSearch,
} from "@/lib/smart-search-worker";
import {
  buildSearchFacets,
  createSearchDefinition,
  searchDefinitionToStatePatch,
  searchMatchKey,
  type SearchResultContext,
} from "@/lib/search-features";
import {
  buildRegexMatcher,
  getSmartPhoneticCode,
  getSmartHighlightWords,
  isSmartSearchCandidate,
  isSmartSearchStopWord,
  matchPreparedSelectedWords,
  prepareSmartSearch,
  prepareSelectedWordSearch,
  scorePreparedSmartSearch,
  suggestConcordanceWords,
  suggestSmartCorrections,
  type VerseSearchIndexEntry,
} from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchLibraryControls } from "@/components/reader/search-library-controls";
import { SearchResultTools } from "@/components/reader/search-result-tools";
import { useSearchLibrary } from "@/hooks/use-search-library";
import { useSearchResultPresentation } from "@/hooks/use-search-result-presentation";
import { cn } from "@/lib/utils";

type SearchPageProps = {
  autoFocusInput?: boolean;
  books: Book[];
  concordanceWords: string[];
  verseIndex: VerseSearchIndexEntry[];
  isVerseIndexBuilding: boolean;
  isVerseIndexReady: boolean;
  verseIndexError: string | null;
  runSmartSearch: RunSmartVerseSearch;
  runSearchResultAnalysis: RunSearchResultAnalysis;
  ensureConcordanceWordsLoaded: () => Promise<unknown>;
  contextVerseCount: number;
  state: SearchPageState;
  onStateChange: (patch: Partial<SearchPageState>) => void;
  onOpenResult: (
    bookIndex: number,
    chapterIndex: number,
    verseStart: number,
    verseEnd?: number,
  ) => void;
};

type BookGroup = {
  id: string;
  label: string;
  iconCode: string;
  indices: number[];
};

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  smart: "Smart",
  "contains-any": "Contains any",
  "contains-all": "Contains all",
  regex: "Regular expression",
};
const SEARCH_HELP_ITEMS: Array<{
  mode: string;
  description: string;
  example: string;
  links?: Array<{
    label: string;
    href: string;
  }>;
}> = [
  {
    mode: "Smart",
    description:
      "Best for remembered fragments, misspellings, Bible names, and loose phrases. Use quotes inside Smart for an exact phrase.",
    example: `Example: God loved world or "loved the world"`,
  },
  {
    mode: "Contains Any",
    description:
      "Find verses containing any selected word chip.",
    example: "Example: faith + grace",
  },
  {
    mode: "Contains All",
    description:
      "Find verses containing every selected word chip, in any order.",
    example: "Example: faith + hope + charity",
  },
  {
    mode: "Regular Expression",
    description:
      "Use a regex when you need precise pattern matching.",
    example: String.raw`Example: \bfaith\w*\b`,
    links: [
      {
        label: "RegexOne",
        href: "https://www.regexone.com/",
      },
      {
        label: "regular-expressions.info",
        href: "https://www.regular-expressions.info/",
      },
    ],
  },
];
const MAX_CONCORDANCE_SUGGESTIONS = 40;
const SEARCH_RESULTS_PAGE_SIZE = 50;
const SEARCH_RESULTS_CAP = 500;
const SEARCH_PROGRESS_INTERVAL_MS = 100;
const pendingSearchTasks: Array<() => void> = [];
let searchTaskChannel: MessageChannel | null = null;

function scheduleSearchTask(task: () => void) {
  if (typeof MessageChannel === "undefined") {
    window.setTimeout(task, 0);
    return;
  }

  pendingSearchTasks.push(task);
  if (!searchTaskChannel) {
    searchTaskChannel = new MessageChannel();
    searchTaskChannel.port1.addEventListener("message", () => {
      pendingSearchTasks.shift()?.();
    });
    searchTaskChannel.port1.start();
  }
  searchTaskChannel.port2.postMessage(undefined);
}

type SmartVocabulary = {
  words: string[];
  wordSet: Set<string>;
  prefix3Buckets: Map<string, string[]>;
  prefix5Buckets: Map<string, string[]>;
  phoneticBuckets: Map<string, string[]>;
  initialBuckets: Map<string, string[]>;
};

type SearchResultHighlight = {
  mode: SearchMode | null;
  phrase: string;
  selectedWords: string[];
};

const smartVocabularyCache = new WeakMap<
  VerseSearchIndexEntry[],
  SmartVocabulary
>();

function getSmartVocabulary(verseIndex: VerseSearchIndexEntry[]) {
  const cached = smartVocabularyCache.get(verseIndex);
  if (cached) {
    return cached;
  }

  const values = new Set<string>();
  const prefix3Buckets = new Map<string, string[]>();
  const prefix5Buckets = new Map<string, string[]>();
  const phoneticBuckets = new Map<string, string[]>();
  const initialBuckets = new Map<string, string[]>();

  const addToBucket = (map: Map<string, string[]>, key: string, word: string) => {
    if (!key) {
      return;
    }
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(word);
    } else {
      map.set(key, [word]);
    }
  };

  for (const entry of verseIndex) {
    for (const word of entry.searchWordsLower) {
      if (values.has(word)) {
        continue;
      }
      values.add(word);
      addToBucket(prefix3Buckets, word.slice(0, 3), word);
      addToBucket(prefix5Buckets, word.slice(0, 5), word);
      addToBucket(phoneticBuckets, getSmartPhoneticCode(word), word);
      addToBucket(initialBuckets, word.slice(0, 1), word);
    }
  }

  const vocabulary = {
    words: Array.from(values),
    wordSet: values,
    prefix3Buckets,
    prefix5Buckets,
    phoneticBuckets,
    initialBuckets,
  } satisfies SmartVocabulary;
  smartVocabularyCache.set(verseIndex, vocabulary);
  return vocabulary;
}

function renderSearchResultText(
  match: SearchMatch,
  highlight: SearchResultHighlight,
) {
  const keyPrefix = `${match.bookIndex}-${match.chapterIndex}-${match.verseNumber}`;
  if (highlight.mode === "smart") {
    const words = match.text.split(/\s+/);
    const smartTerms = getSmartHighlightWords(
      {
        searchWords: words,
        searchWordsLower: words
          .map((word) =>
            word.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, ""),
          )
          .filter(Boolean),
      },
      highlight.phrase.trim(),
      false,
    );
    return renderHighlightedTerms(match.text, smartTerms, keyPrefix);
  }

  if (highlight.mode === "contains-any" || highlight.mode === "contains-all") {
    return renderHighlightedTerms(match.text, highlight.selectedWords, keyPrefix);
  }

  if (highlight.mode === "regex") {
    return renderHighlightedText(match.text, highlight.phrase.trim(), keyPrefix);
  }

  return match.text;
}

const SearchResultRow = memo(
  function SearchResultRow({
    match,
    context,
    highlight,
    onOpenResult,
  }: {
    match: SearchMatch;
    context: SearchResultContext | null;
    highlight: SearchResultHighlight;
    onOpenResult: SearchPageProps["onOpenResult"];
  }) {
    return (
      <button
        type="button"
        className={cn(
          "group block w-full px-3 py-2 text-left [content-visibility:auto] hover:bg-reference-tint/60",
          context
            ? "[contain-intrinsic-size:0_148px]"
            : "[contain-intrinsic-size:0_76px]",
        )}
        onClick={() =>
          onOpenResult(
            match.bookIndex,
            match.chapterIndex,
            match.verseNumber,
            match.verseNumber,
          )
        }
      >
        <p className="tabular-data text-sm font-medium text-foreground">
          {`${chapterLabel(match.bookName, match.chapterIndex + 1)}:${match.verseNumber}`}
        </p>
        {context ? (
          <div
            data-verse-context="true"
            className="mt-1 flex flex-col gap-1 leading-relaxed"
          >
            {context.before.length > 0 ? (
              <div
                data-context-section="before"
                className="flex flex-col gap-1 border-l-2 border-subtle-divider pl-2"
              >
                {context.before.map((before) => (
                  <p
                    key={`before-${before.verseNumber}`}
                    data-context-line="surrounding"
                    data-context-verse={before.verseNumber}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    <span className="mr-1 font-medium text-foreground/75">
                      {before.verseNumber}
                    </span>
                    {before.text}
                  </p>
                ))}
              </div>
            ) : null}
            <p
              data-context-primary="true"
              data-context-line="referenced"
              data-context-verse={match.verseNumber}
              className="text-sm font-semibold text-foreground"
            >
              <span className="sr-only">Matched verse: </span>
              <span className="mr-1">{match.verseNumber}</span>
              {renderSearchResultText(match, highlight)}
            </p>
            {context.after.length > 0 ? (
              <div
                data-context-section="after"
                className="flex flex-col gap-1 border-l-2 border-subtle-divider pl-2"
              >
                {context.after.map((after) => (
                  <p
                    key={`after-${after.verseNumber}`}
                    data-context-line="surrounding"
                    data-context-verse={after.verseNumber}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    <span className="mr-1 font-medium text-foreground/75">
                      {after.verseNumber}
                    </span>
                    {after.text}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground group-hover:text-foreground/90">
            {renderSearchResultText(match, highlight)}
          </p>
        )}
      </button>
    );
  },
  (previous, next) =>
    previous.highlight === next.highlight &&
    previous.context === next.context &&
    previous.onOpenResult === next.onOpenResult &&
    previous.match.bookIndex === next.match.bookIndex &&
    previous.match.chapterIndex === next.match.chapterIndex &&
    previous.match.verseNumber === next.match.verseNumber &&
    previous.match.bookName === next.match.bookName &&
    previous.match.text === next.match.text,
);

function clampGroupIndices(indices: number[], max: number) {
  return indices.filter((value) => value >= 0 && value < max);
}

function sameSet(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

function isChecked(value: boolean | "indeterminate") {
  return value === true;
}

function normalizeSearchMode(mode: SearchMode | string | null | undefined): SearchMode {
  if (mode === "contains-any" || mode === "contains-all" || mode === "regex") {
    return mode;
  }
  return "smart";
}

export function SearchPage({
  autoFocusInput = false,
  books,
  concordanceWords,
  verseIndex,
  isVerseIndexBuilding,
  isVerseIndexReady,
  verseIndexError,
  runSmartSearch,
  runSearchResultAnalysis,
  ensureConcordanceWordsLoaded,
  contextVerseCount,
  state,
  onStateChange,
  onOpenResult,
}: SearchPageProps) {
  const inputId = useId();
  const [isBookFilterOpen, setIsBookFilterOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const searchRunIdRef = useRef(0);
  const regexWorkerRef = useRef<Worker | null>(null);
  const smartSearchCancelRef = useRef<(() => void) | null>(null);
  const resultAnalysisCancelRef = useRef<(() => void) | null>(null);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const {
    library: searchLibrary,
    recordRecent,
    save: saveSearch,
    removeSaved: removeSavedSearch,
    clearRecent: clearRecentSearches,
  } = useSearchLibrary();

  useEffect(() => {
    return () => {
      regexWorkerRef.current?.terminate();
      smartSearchCancelRef.current?.();
      resultAnalysisCancelRef.current?.();
    };
  }, []);

  const {
    searchMode: rawSearchMode,
    caseSensitive,
    chipInput,
    phraseInput,
    lastSearchMode: rawLastSearchMode,
    lastSearchCaseSensitive,
    lastSearchPhraseInput,
    lastSearchSelectedWords,
    isControlsCollapsed,
    selectedWords,
    resultSort,
    showResultContext,
    resultFacets,
    currentPage,
    results,
    error,
  } = state;
  const searchMode = normalizeSearchMode(rawSearchMode);
  const lastSearchMode = rawLastSearchMode
    ? normalizeSearchMode(rawLastSearchMode)
    : null;
  const [chipInputDraft, setChipInputDraft] = useState(chipInput);
  const [phraseInputDraft, setPhraseInputDraft] = useState(phraseInput);
  const deferredChipInput = useDeferredValue(chipInputDraft);
  const deferredPhraseInput = useDeferredValue(phraseInputDraft);
  const currentSearchDefinition = useMemo(
    () =>
      createSearchDefinition({
        searchMode,
        caseSensitive,
        phraseInput: phraseInputDraft,
        selectedWords,
        selectedBookIndexes: state.selectedBookIndexes,
        resultSort,
        showResultContext,
      }),
    [
      caseSensitive,
      phraseInputDraft,
      resultSort,
      searchMode,
      selectedWords,
      showResultContext,
      state.selectedBookIndexes,
    ],
  );

  useEffect(() => {
    setChipInputDraft(chipInput);
  }, [chipInput]);

  useEffect(() => {
    setPhraseInputDraft(phraseInput);
  }, [phraseInput]);

  const expandedBookTree = useMemo(
    () => new Set(state.expandedBookTree),
    [state.expandedBookTree],
  );
  const selectedBookIndexes = useMemo(
    () => new Set(state.selectedBookIndexes),
    [state.selectedBookIndexes],
  );

  const openBookFilterDialog = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    window.requestAnimationFrame(() => {
      setIsBookFilterOpen(true);
    });
  };

  useEffect(() => {
    const nextAll = new Set(books.map((_, index) => index));
    if (
      (!isVerseIndexReady && selectedBookIndexes.size !== books.length) ||
      state.selectedBookIndexes.length === 0 ||
      selectedBookIndexes.size === 0 ||
      selectedBookIndexes.size > books.length
    ) {
      onStateChange({ selectedBookIndexes: Array.from(nextAll) });
      return;
    }
    for (const selected of selectedBookIndexes) {
      if (selected >= books.length) {
        onStateChange({ selectedBookIndexes: Array.from(nextAll) });
        return;
      }
    }
  }, [
    books,
    isVerseIndexReady,
    onStateChange,
    selectedBookIndexes,
    state.selectedBookIndexes.length,
  ]);

  useEffect(() => {
    if (searchMode === "contains-any" || searchMode === "contains-all") {
      void ensureConcordanceWordsLoaded();
    }
  }, [ensureConcordanceWordsLoaded, searchMode]);

  const concordanceSuggestions = useMemo(() => {
    return suggestConcordanceWords(
      concordanceWords,
      deferredChipInput,
      selectedWords,
      MAX_CONCORDANCE_SUGGESTIONS,
    );
  }, [concordanceWords, deferredChipInput, selectedWords]);

  const smartVocabulary = useMemo(
    () => getSmartVocabulary(verseIndex),
    [verseIndex],
  );

  const smartSuggestions = useMemo(() => {
    if (searchMode !== "smart") {
      return [] as string[];
    }

    const query = deferredPhraseInput.trim().toLowerCase();
    if (query.length < 3) {
      return [] as string[];
    }

    const words = query.split(/\s+/).filter(Boolean);
    const replacementOptions = words.map((word) => {
      if (isSmartSearchStopWord(word) || smartVocabulary.wordSet.has(word)) {
        return [] as Array<{ word: string; score: number }>;
      }

      const candidates = new Set<string>();
      const prefix3 = word.slice(0, 3);
      const prefix5 = word.slice(0, 5);
      const phonetic = getSmartPhoneticCode(word);
      const initial = word.slice(0, 1);

      for (const candidate of smartVocabulary.prefix5Buckets.get(prefix5) ?? []) {
        candidates.add(candidate);
      }
      for (const candidate of smartVocabulary.prefix3Buckets.get(prefix3) ?? []) {
        candidates.add(candidate);
      }
      for (const candidate of smartVocabulary.phoneticBuckets.get(phonetic) ?? []) {
        candidates.add(candidate);
      }

      if (candidates.size < 12) {
        for (const candidate of smartVocabulary.initialBuckets.get(initial) ?? []) {
          candidates.add(candidate);
          if (candidates.size >= 80) {
            break;
          }
        }
      }

      return suggestSmartCorrections(
        word,
        candidates.size > 0 ? candidates : smartVocabulary.words,
        3,
      );
    });

    const suggestions: Array<{ value: string; score: number }> = [];
    replacementOptions.forEach((options, wordIndex) => {
      options.forEach((option) => {
        const nextWords = [...words];
        nextWords[wordIndex] = option.word;
        suggestions.push({
          value: nextWords.join(" "),
          score: option.score,
        });
      });
    });

    return Array.from(
      new Map(
        suggestions
          .sort((left, right) => right.score - left.score)
          .map((suggestion) => [suggestion.value, suggestion.value]),
      ).values(),
    ).slice(0, 3);
  }, [deferredPhraseInput, searchMode, smartVocabulary]);

  const allBookIndexes = useMemo(
    () => new Set(books.map((_, index) => index)),
    [books],
  );

  const oldTestament = useMemo(
    () => clampGroupIndices(Array.from({ length: 39 }, (_, index) => index), books.length),
    [books.length],
  );
  const newTestament = useMemo(
    () => clampGroupIndices(
      Array.from({ length: Math.max(books.length - 39, 0) }, (_, index) => index + 39),
      books.length,
    ),
    [books.length],
  );

  const groupedBooks = useMemo(() => {
    const otGroups: BookGroup[] = [
      { id: "ot-pent", label: "Books of Moses", iconCode: "BM", indices: clampGroupIndices([0, 1, 2, 3, 4], books.length) },
      { id: "ot-hist", label: "History Books", iconCode: "HB", indices: clampGroupIndices([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], books.length) },
      { id: "ot-poet", label: "Poetic Books", iconCode: "PB", indices: clampGroupIndices([17, 18, 19, 20, 21], books.length) },
      { id: "ot-major", label: "Major Prophets", iconCode: "MJ", indices: clampGroupIndices([22, 23, 24, 25, 26], books.length) },
      { id: "ot-minor", label: "Minor Prophets", iconCode: "MN", indices: clampGroupIndices([27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38], books.length) },
    ].filter((group) => group.indices.length > 0);

    const ntGroups: BookGroup[] = [
      { id: "nt-gos-acts", label: "Gospels and Acts", iconCode: "GA", indices: clampGroupIndices([39, 40, 41, 42, 43], books.length) },
      { id: "nt-paul", label: "Pauline Epistles", iconCode: "PE", indices: clampGroupIndices([44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57], books.length) },
      { id: "nt-general", label: "General Epistles", iconCode: "GE", indices: clampGroupIndices([58, 59, 60, 61, 62, 63, 64], books.length) },
      { id: "nt-rev", label: "Prophecy", iconCode: "REV", indices: clampGroupIndices([65], books.length) },
    ].filter((group) => group.indices.length > 0);

    return { otGroups, ntGroups };
  }, [books.length]);

  const selectedBookCount = selectedBookIndexes.size;

  const toggleTreeNode = (nodeId: string) => {
    const next = (() => {
      const current = new Set(state.expandedBookTree);
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    })();
    onStateChange({ expandedBookTree: Array.from(next) });
  };

  const addWordChip = (word: string) => {
    const clean = word.trim();
    if (!clean) {
      return;
    }
    const lowerClean = clean.toLowerCase();
    const next = (() => {
      const current = state.selectedWords;
      if (current.some((item) => item.toLowerCase() === lowerClean)) {
        return current;
      }
      return [...current, clean];
    })();
    setChipInputDraft("");
    onStateChange({ selectedWords: next, chipInput: "" });
  };

  const removeWordChip = (word: string) => {
    const lowerWord = word.toLowerCase();
    onStateChange({
      selectedWords: state.selectedWords.filter(
        (item) => item.toLowerCase() !== lowerWord,
      ),
    });
  };

  const toggleBookSelection = (bookIndex: number, nextChecked: boolean) => {
    const next = (() => {
      const current = new Set(state.selectedBookIndexes);
      const next = new Set(current);
      if (nextChecked) {
        next.add(bookIndex);
      } else {
        next.delete(bookIndex);
      }
      return next;
    })();
    onStateChange({ selectedBookIndexes: Array.from(next) });
  };

  const setIndicesSelection = (indices: number[], nextChecked: boolean) => {
    const next = (() => {
      const current = new Set(state.selectedBookIndexes);
      const next = new Set(current);
      indices.forEach((index) => {
        if (nextChecked) {
          next.add(index);
        } else {
          next.delete(index);
        }
      });
      return next;
    })();
    onStateChange({ selectedBookIndexes: Array.from(next) });
  };

  const search = () => {
    if (!isVerseIndexReady) {
      return;
    }
    onStateChange({ error: null, resultFacets: null });
    regexWorkerRef.current?.terminate();
    regexWorkerRef.current = null;
    smartSearchCancelRef.current?.();
    smartSearchCancelRef.current = null;
    resultAnalysisCancelRef.current?.();
    resultAnalysisCancelRef.current = null;
    let selectedWordSearch: ReturnType<
      typeof prepareSelectedWordSearch
    > = null;
    let smartQuery: string | null = null;
    let regexPattern: string | null = null;
    const nextSearchRunId = searchRunIdRef.current + 1;
    searchRunIdRef.current = nextSearchRunId;

    if (searchMode === "smart") {
      const query = phraseInputDraft.trim();
      if (!query) {
        onStateChange({ error: "Enter a word or phrase to search.", results: [] });
        return;
      }
      smartQuery = query;
    }

    if (searchMode === "contains-any" || searchMode === "contains-all") {
      if (selectedWords.length === 0) {
        onStateChange({
          error: "Select at least one word for this search mode.",
          results: [],
        });
        return;
      }
      selectedWordSearch = prepareSelectedWordSearch(
        selectedWords,
        searchMode,
        caseSensitive,
      );
      if (!selectedWordSearch) {
        onStateChange({
          error: "Select at least one word for this search mode.",
          results: [],
        });
        return;
      }
    }

    if (searchMode === "regex") {
      const pattern = phraseInputDraft.trim();
      if (!pattern) {
        onStateChange({ error: "Enter a regular expression.", results: [] });
        return;
      }
      try {
        const { regex, error: regexError } = buildRegexMatcher(
          pattern,
          caseSensitive,
        );
        if (!regex) {
          onStateChange({
            error: regexError,
            results: [],
          });
          return;
        }
        regexPattern = pattern;
      } catch {
        onStateChange({ error: "Invalid regular expression.", results: [] });
        return;
      }
    }

    if (!selectedWordSearch && !smartQuery && !regexPattern) {
      onStateChange({ results: [] });
      return;
    }

    setIsSearching(true);
    setSearchProgress(null);
    const completedSearchState = {
      chipInput: chipInputDraft,
      phraseInput: phraseInputDraft,
      currentPage: 1,
      isControlsCollapsed: true,
      lastSearchMode: searchMode,
      lastSearchCaseSensitive: caseSensitive,
      lastSearchPhraseInput: phraseInputDraft.trim(),
      lastSearchSelectedWords: [...selectedWords],
      resultFacets: null,
    } satisfies Partial<SearchPageState>;
    const completedSearchDefinition = createSearchDefinition({
      searchMode,
      caseSensitive,
      phraseInput: phraseInputDraft,
      selectedWords,
      selectedBookIndexes: Array.from(selectedBookIndexes),
      resultSort,
      showResultContext,
    });
    let lastProgressUpdate = 0;

    const publishProgress = (
      processed: number,
      total: number,
      force = false,
    ) => {
      const now = performance.now();
      if (!force && now - lastProgressUpdate < SEARCH_PROGRESS_INTERVAL_MS) {
        return;
      }
      lastProgressUpdate = now;
      startTransition(() => {
        if (searchRunIdRef.current === nextSearchRunId) {
          setSearchProgress({ processed, total });
        }
      });
    };

    const finishSearch = (
      matches: SearchMatch[],
      facets: SearchPageState["resultFacets"],
    ) => {
      if (searchRunIdRef.current !== nextSearchRunId) {
        return;
      }
      resultAnalysisCancelRef.current = null;
      onStateChange({
        ...completedSearchState,
        results: matches,
        resultFacets: facets,
      });
      if (completedSearchDefinition) {
        recordRecent(completedSearchDefinition);
      }
      setIsSearching(false);
      setSearchProgress(null);
    };

    const commitSearch = (matches: SearchMatch[]) => {
      if (searchRunIdRef.current !== nextSearchRunId) {
        return;
      }
      const cancelAnalysis = runSearchResultAnalysis(matches, {
        onResult: (facets) => finishSearch(matches, facets),
        onError: () => finishSearch(matches, buildSearchFacets(matches)),
      });
      if (cancelAnalysis) {
        resultAnalysisCancelRef.current = cancelAnalysis;
        return;
      }
      finishSearch(matches, buildSearchFacets(matches));
    };

    const cancelSearch = () => {
      if (searchRunIdRef.current === nextSearchRunId) {
        setIsSearching(false);
        setSearchProgress(null);
      }
    };

    if (smartQuery) {
      const selected = selectedBookIndexes;
      const preparedSmartSearch = prepareSmartSearch(smartQuery, caseSensitive);
      if (!preparedSmartSearch) {
        onStateChange({ error: "Enter a word or phrase to search.", results: [] });
        setIsSearching(false);
        return;
      }
      let receivedWorkerUpdate = false;
      const cancelWorkerSearch = runSmartSearch(
        {
          query: smartQuery,
          caseSensitive,
          selectedBookIndexes: Array.from(selectedBookIndexes),
          resultLimit: SEARCH_RESULTS_CAP,
        },
        {
          onUpdate: (update) => {
            if (searchRunIdRef.current !== nextSearchRunId) {
              return;
            }
            publishProgress(update.processed, update.total, update.isComplete);
            if (update.isComplete) {
              smartSearchCancelRef.current = null;
              commitSearch(update.matches);
              return;
            }
            if (update.matches.length === 0) {
              return;
            }
            const patch = {
              ...completedSearchState,
              results: update.matches,
              resultFacets: null,
            };
            if (!receivedWorkerUpdate) {
              receivedWorkerUpdate = true;
              onStateChange(patch);
              return;
            }
            startTransition(() => {
              if (searchRunIdRef.current === nextSearchRunId) {
                onStateChange(patch);
              }
            });
          },
          onError: (message) => {
            if (searchRunIdRef.current !== nextSearchRunId) {
              return;
            }
            smartSearchCancelRef.current = null;
            onStateChange({ error: message, results: [] });
            cancelSearch();
          },
        },
      );
      if (cancelWorkerSearch) {
        smartSearchCancelRef.current = cancelWorkerSearch;
        return;
      }

      const scored: Array<{
        entry: VerseSearchIndexEntry;
        index: number;
        score: number;
      }> = [];
      const similarityCache = new Map<string, number>();
      let batchSize = 250;
      let startIndex = 0;
      let batchesSincePublish = 0;
      let publishedInitialPage = false;

      const compareScores = (
        left: (typeof scored)[number],
        right: (typeof scored)[number],
      ) => right.score - left.score || left.index - right.index;

      const pruneScores = () => {
        if (scored.length < SEARCH_RESULTS_CAP * 2) {
          return;
        }
        scored.sort(compareScores);
        scored.length = SEARCH_RESULTS_CAP;
      };

      const buildMatches = () =>
        scored
          .slice()
          .sort(compareScores)
          .slice(0, SEARCH_RESULTS_CAP)
          .map(({ entry }) => ({
            bookIndex: entry.bookIndex,
            chapterIndex: entry.chapterIndex,
            verseNumber: entry.verseNumber,
            bookName: entry.bookName,
            text: entry.text,
          }));

      const publishPartial = (isInitialPage: boolean) => {
        if (searchRunIdRef.current !== nextSearchRunId || scored.length === 0) {
          return;
        }
        const matches = buildMatches();
        const patch = {
          ...completedSearchState,
          results: matches,
          resultFacets: null,
        };
        if (isInitialPage) {
          onStateChange(patch);
          return;
        }
        startTransition(() => {
          if (searchRunIdRef.current !== nextSearchRunId) {
            return;
          }
          onStateChange(patch);
        });
      };

      const processBatch = () => {
        if (searchRunIdRef.current !== nextSearchRunId) {
          return;
        }

        const endIndex = Math.min(startIndex + batchSize, verseIndex.length);
        for (let index = startIndex; index < endIndex; index += 1) {
          const entry = verseIndex[index];
          if (
            !selected.has(entry.bookIndex) ||
            !isSmartSearchCandidate(entry, preparedSmartSearch)
          ) {
            continue;
          }
          const score = scorePreparedSmartSearch(
            entry,
            preparedSmartSearch,
            similarityCache,
          );
          if (score !== null) {
            scored.push({ entry, index, score });
          }
        }
        pruneScores();

        startIndex = endIndex;
        batchesSincePublish += 1;
        publishProgress(startIndex, verseIndex.length);
        const shouldPublishInitialPage =
          !publishedInitialPage &&
          (scored.length >= SEARCH_RESULTS_PAGE_SIZE ||
            startIndex >= verseIndex.length ||
            startIndex >= Math.min(verseIndex.length, batchSize * 2));
        if (
          shouldPublishInitialPage ||
          (publishedInitialPage && batchesSincePublish >= 8)
        ) {
          publishPartial(shouldPublishInitialPage);
          publishedInitialPage = true;
          batchSize = 500;
          batchesSincePublish = 0;
        }
        if (startIndex < verseIndex.length) {
          if (shouldPublishInitialPage) {
            window.requestAnimationFrame(() => scheduleSearchTask(processBatch));
          } else {
            scheduleSearchTask(processBatch);
          }
          return;
        }

        publishProgress(verseIndex.length, verseIndex.length, true);
        commitSearch(buildMatches());
      };

      scheduleSearchTask(processBatch);
      return;
    }

    if (regexPattern) {
      const worker = new Worker(
        new URL("../../workers/regex-search.worker.ts", import.meta.url),
        { type: "module" },
      );
      regexWorkerRef.current = worker;
      worker.addEventListener(
        "message",
        (event: MessageEvent<{ matches: SearchMatch[]; error: string | null }>) => {
          worker.terminate();
          if (regexWorkerRef.current === worker) {
            regexWorkerRef.current = null;
          }
          if (searchRunIdRef.current !== nextSearchRunId) {
            return;
          }
          if (event.data.error) {
            onStateChange({ error: event.data.error, results: [] });
            cancelSearch();
            return;
          }
          commitSearch(event.data.matches);
        },
        { once: true },
      );
      worker.addEventListener(
        "error",
        () => {
          worker.terminate();
          if (regexWorkerRef.current === worker) {
            regexWorkerRef.current = null;
          }
          if (searchRunIdRef.current === nextSearchRunId) {
            onStateChange({
              error: "The regular-expression search worker failed.",
              results: [],
            });
            cancelSearch();
          }
        },
        { once: true },
      );
      worker.postMessage({
        entries: verseIndex,
        selectedBookIndexes: Array.from(selectedBookIndexes),
        pattern: regexPattern,
        caseSensitive,
        resultLimit: SEARCH_RESULTS_CAP,
      });
      return;
    }

    const preparedSelectedWordSearch = selectedWordSearch;
    if (!preparedSelectedWordSearch) {
      commitSearch([]);
      return;
    }

    const matches: SearchMatch[] = [];
    const batchSize = 1_000;
    let startIndex = 0;
    const processMatchBatch = () => {
      if (searchRunIdRef.current !== nextSearchRunId) {
        return;
      }
      const selected = selectedBookIndexes;
      const endIndex = Math.min(startIndex + batchSize, verseIndex.length);
      for (let index = startIndex; index < endIndex; index += 1) {
        const entry = verseIndex[index];
        if (
          !selected.has(entry.bookIndex) ||
          !matchPreparedSelectedWords(entry, preparedSelectedWordSearch)
        ) {
          continue;
        }
        const { bookIndex, chapterIndex, verseNumber, bookName, text } = entry;
        matches.push({
          bookIndex,
          chapterIndex,
          verseNumber,
          bookName,
          text,
        });
        if (matches.length >= SEARCH_RESULTS_CAP) {
          break;
        }
      }
      startIndex = endIndex;
      publishProgress(startIndex, verseIndex.length);
      if (
        startIndex < verseIndex.length &&
        matches.length < SEARCH_RESULTS_CAP
      ) {
        scheduleSearchTask(processMatchBatch);
        return;
      }
      publishProgress(verseIndex.length, verseIndex.length, true);
      commitSearch(matches);
    };
    scheduleSearchTask(processMatchBatch);
  };

  const stopSearch = () => {
    searchRunIdRef.current += 1;
    regexWorkerRef.current?.terminate();
    regexWorkerRef.current = null;
    smartSearchCancelRef.current?.();
    smartSearchCancelRef.current = null;
    resultAnalysisCancelRef.current?.();
    resultAnalysisCancelRef.current = null;
    setIsSearching(false);
    setSearchProgress(null);
  };

  const allBooksSelected = sameSet(selectedBookIndexes, allBookIndexes);
  const hasSearchOutput = results.length > 0 || Boolean(error);

  const clearResults = () => {
    onStateChange({
      results: [],
      currentPage: 1,
      error: null,
      resultFacets: null,
    });
  };

  const loadSearchDefinition = (definition: SearchDefinition) => {
    const selectedBookIndexes = definition.selectedBookIndexes.filter(
      (bookIndex) => bookIndex >= 0 && bookIndex < books.length,
    );
    const normalizedDefinition = {
      ...definition,
      selectedBookIndexes:
        selectedBookIndexes.length > 0
          ? selectedBookIndexes
          : books.map((_, index) => index),
    };
    setChipInputDraft("");
    setPhraseInputDraft(normalizedDefinition.phraseInput);
    onStateChange(searchDefinitionToStatePatch(normalizedDefinition));
  };

  const searchSummary = useMemo(() => {
    const summaryMode = lastSearchMode ?? searchMode;
    const summaryCaseSensitive =
      lastSearchMode === null ? caseSensitive : lastSearchCaseSensitive;
    const modeLabel = SEARCH_MODE_LABELS[summaryMode];
    const scopeLabel = `${selectedBookCount}/${books.length} books`;
    if (summaryMode === "smart") {
      const phrase =
        (lastSearchMode === null ? phraseInputDraft : lastSearchPhraseInput).trim() ||
        "no query";
      return `${modeLabel} • ${phrase} • ${scopeLabel}${summaryCaseSensitive ? " • case-sensitive" : ""}`;
    }
    if (summaryMode === "contains-any" || summaryMode === "contains-all") {
      const terms =
        (lastSearchMode === null ? selectedWords : lastSearchSelectedWords).length > 0
          ? (lastSearchMode === null ? selectedWords : lastSearchSelectedWords).join(", ")
          : "no words selected";
      return `${modeLabel} • ${terms} • ${scopeLabel}${summaryCaseSensitive ? " • case-sensitive" : ""}`;
    }

    const phrase =
      (lastSearchMode === null ? phraseInputDraft : lastSearchPhraseInput).trim() ||
      (summaryMode === "regex" ? "no pattern" : "no phrase");
    return `${modeLabel} • ${phrase} • ${scopeLabel}${summaryCaseSensitive ? " • case-sensitive" : ""}`;
  }, [
    books.length,
    caseSensitive,
    lastSearchCaseSensitive,
    lastSearchMode,
    lastSearchPhraseInput,
    lastSearchSelectedWords,
    phraseInputDraft,
    searchMode,
    selectedBookCount,
    selectedWords,
  ]);

  const {
    orderedResults,
    contextByMatchKey,
    copyResults,
    exportResults,
  } = useSearchResultPresentation({
    results,
    resultSort,
    showResultContext,
    contextVerseCount,
    verseIndex,
    searchSummary,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(orderedResults.length / SEARCH_RESULTS_PAGE_SIZE),
  );
  const activePage = Math.min(Math.max(currentPage, 1), totalPages);
  const visibleResults = useMemo(() => {
    const startIndex = (activePage - 1) * SEARCH_RESULTS_PAGE_SIZE;
    return orderedResults.slice(
      startIndex,
      startIndex + SEARCH_RESULTS_PAGE_SIZE,
    );
  }, [activePage, orderedResults]);
  const resultHighlight = useMemo(
    () => ({
      mode: lastSearchMode,
      phrase: lastSearchPhraseInput,
      selectedWords: lastSearchSelectedWords,
    }),
    [lastSearchMode, lastSearchPhraseInput, lastSearchSelectedWords],
  );
  const pagedRenderedResults = useMemo(
    () =>
      visibleResults.map((match) => (
        <SearchResultRow
          key={`${match.bookIndex}-${match.chapterIndex}-${match.verseNumber}`}
          match={match}
          context={contextByMatchKey.get(searchMatchKey(match)) ?? null}
          highlight={resultHighlight}
          onOpenResult={onOpenResult}
        />
      )),
    [contextByMatchKey, onOpenResult, resultHighlight, visibleResults],
  );

  useEffect(() => {
    const viewport = resultsScrollRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    viewport?.scrollTo({ top: 0, behavior: "auto" });
  }, [activePage, results]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-2">
      <div className="workspace-panel-elevated flex flex-col gap-2 rounded-2xl border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-[1_1_9rem] flex-col gap-1 break-words">
            <div className="flex items-center gap-2">
              <h2 className="workspace-heading text-xl font-semibold">Search</h2>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 rounded-full text-muted-foreground"
                      aria-label="Search tips"
                    >
                      <CircleHelpIcon className="size-4" />
                    </Button>
                  }
                />
                <PopoverContent
                  side="bottom"
                  align="start"
                  className="w-[min(26rem,calc(100vw-2rem))] p-3 text-sm"
                >
                    <div className="flex flex-col gap-2.5">
                      <p className="font-medium text-foreground">Search Tips</p>
                      <div className="grid gap-2">
                        {SEARCH_HELP_ITEMS.map((item) => (
                          <div
                            key={item.mode}
                            className="rounded-xl border border-subtle-divider/70 bg-background/70 px-3 py-2"
                          >
                            <p className="font-medium text-foreground">
                              {item.mode}
                            </p>
                            <p className="mt-0.5 text-muted-foreground">
                              {item.description}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.example}
                            </p>
                            {item.links?.length ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium">Learn more:</span>
                                {item.links.map((link) => (
                                  <a
                                    key={link.href}
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                                  >
                                    {link.label}
                                    <ExternalLinkIcon className="size-3" />
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                </PopoverContent>
              </Popover>
            </div>
            {isControlsCollapsed ? (
              <p className="text-sm text-muted-foreground">{searchSummary}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchLibraryControls
              currentDefinition={currentSearchDefinition}
              saved={searchLibrary.saved}
              recent={searchLibrary.recent}
              onLoad={loadSearchDefinition}
              onSave={saveSearch}
              onRemoveSaved={removeSavedSearch}
              onClearRecent={clearRecentSearches}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onStateChange({ isControlsCollapsed: !isControlsCollapsed })
              }
            >
              {isControlsCollapsed ? (
                <>
                  <ChevronRightIcon data-icon="inline-start" />
                  Show
                </>
              ) : (
                <>
                  <ChevronDownIcon data-icon="inline-start" />
                  Hide
                </>
              )}
            </Button>
          </div>
        </div>

        {!isControlsCollapsed ? (
          <>
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Search Mode
              </Label>
              <ToggleGroup
                value={[searchMode]}
                onValueChange={(value) => {
                  const nextValue = value[0];
                  if (nextValue) {
                    onStateChange({ searchMode: nextValue as SearchMode });
                  }
                }}
                variant="outline"
                spacing={0}
                className="grid w-full [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))] gap-0"
              >
                <ToggleGroupItem
                  value="smart"
                  className="h-auto min-w-0 w-full overflow-hidden px-2 py-2 text-center leading-tight text-ellipsis whitespace-nowrap data-[pressed]:border-primary! data-[pressed]:bg-primary/92! data-[pressed]:text-primary-foreground! hover:data-[pressed]:bg-primary/90! hover:data-[pressed]:text-primary-foreground!"
                >
                  {SEARCH_MODE_LABELS.smart}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="contains-any"
                  className="h-auto min-w-0 w-full overflow-hidden px-2 py-2 text-center leading-tight text-ellipsis whitespace-nowrap data-[pressed]:border-primary! data-[pressed]:bg-primary/92! data-[pressed]:text-primary-foreground! hover:data-[pressed]:bg-primary/90! hover:data-[pressed]:text-primary-foreground!"
                >
                  {SEARCH_MODE_LABELS["contains-any"]}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="contains-all"
                  className="h-auto min-w-0 w-full overflow-hidden px-2 py-2 text-center leading-tight text-ellipsis whitespace-nowrap data-[pressed]:border-primary! data-[pressed]:bg-primary/92! data-[pressed]:text-primary-foreground! hover:data-[pressed]:bg-primary/90! hover:data-[pressed]:text-primary-foreground!"
                >
                  {SEARCH_MODE_LABELS["contains-all"]}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="regex"
                  className="h-auto min-w-0 w-full overflow-hidden px-2 py-2 text-center leading-tight text-ellipsis whitespace-nowrap data-[pressed]:border-primary! data-[pressed]:bg-primary/92! data-[pressed]:text-primary-foreground! hover:data-[pressed]:bg-primary/90! hover:data-[pressed]:text-primary-foreground!"
                >
                  {SEARCH_MODE_LABELS.regex}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-subtle-divider/80 bg-workspace-panel px-3 py-1.5 text-sm">
                <Checkbox
                  checked={caseSensitive}
                  onCheckedChange={(value) =>
                    onStateChange({ caseSensitive: isChecked(value) })
                  }
                />
                Case-sensitive
              </label>

              <Button
                type="button"
                variant="outline"
                className="border-subtle-divider bg-workspace-panel"
                onClick={openBookFilterDialog}
              >
                {`Scope • ${selectedBookCount}/${books.length} books`}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {!isControlsCollapsed ? (
        <>
          {searchMode === "contains-any" || searchMode === "contains-all" ? (
            <div className="workspace-panel flex flex-col gap-2 rounded-2xl border p-3">
              <Label htmlFor={`${inputId}-words`}>Words</Label>
              <div className="rounded-2xl border border-subtle-divider/80 bg-workspace-panel-elevated p-2">
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedWords.map((word) => (
                    <button
                      key={word}
                      type="button"
                      className="study-accent-chip inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                      onClick={() => removeWordChip(word)}
                    >
                      {word}
                      <span aria-hidden="true" className="text-muted-foreground">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
                <Input
                  autoFocus={autoFocusInput}
                  id={`${inputId}-words`}
                  value={chipInputDraft}
                  onChange={(event) =>
                    setChipInputDraft(event.currentTarget.value)
                  }
                  onBlur={() => onStateChange({ chipInput: chipInputDraft })}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    const topSuggestion = concordanceSuggestions[0];
                    if (topSuggestion) {
                      addWordChip(topSuggestion);
                    }
                  }}
                  placeholder="Type to find concordance words..."
                />
                {chipInputDraft.trim() ? (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-subtle-divider/80 bg-background/60">
                    <div className="p-1">
                      {chipInputDraft.trim().length < 2 ? (
                        <p className="px-2 py-1 text-sm text-muted-foreground">
                          Type at least 2 characters for suggestions.
                        </p>
                      ) : concordanceSuggestions.length > 0 ? (
                        concordanceSuggestions.map((word) => (
                          <button
                            key={word}
                            type="button"
                            className="block w-full rounded px-2 py-1 text-left text-sm text-foreground hover:bg-muted/50 hover:text-foreground"
                            onClick={() => addWordChip(word)}
                          >
                            {word}
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-1 text-sm text-muted-foreground">
                          No matching concordance words.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="workspace-panel flex flex-col gap-2 rounded-2xl border p-3">
              <Label htmlFor={`${inputId}-phrase`}>
                {searchMode === "regex"
                  ? "Regular expression"
                  : searchMode === "smart"
                    ? "Word or phrase"
                    : "Phrase"}
              </Label>
              <Input
                autoFocus={autoFocusInput}
                id={`${inputId}-phrase`}
                value={phraseInputDraft}
                onChange={(event) =>
                  setPhraseInputDraft(event.currentTarget.value)
                }
                onBlur={() => onStateChange({ phraseInput: phraseInputDraft })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search();
                  }
                }}
                placeholder={
                  searchMode === "regex"
                    ? "Example: \\bfaith\\b"
                    : searchMode === "smart"
                      ? 'Enter any word or phrase... Use "quotes" for exact phrases.'
                      : "Enter phrase..."
                }
              />
              {searchMode === "smart" && smartSuggestions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Did you mean</span>
                  {smartSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border border-subtle-divider/80 px-2 py-0.5 text-foreground hover:bg-muted/50"
                      onClick={() => setPhraseInputDraft(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={search}
              disabled={isSearching || !isVerseIndexReady}
              aria-label={isVerseIndexBuilding ? "Preparing search..." : "Run Bible search"}
            >
              <SearchIcon />
              {isVerseIndexBuilding ? "Preparing search..." : "Search"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-subtle-divider"
              onClick={clearResults}
              disabled={!hasSearchOutput}
            >
              Clear Results
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {verseIndexError ? (
              <p className="text-sm text-destructive">{verseIndexError}</p>
            ) : isVerseIndexBuilding ? (
              <p className="text-sm text-muted-foreground" role="status">
                Preparing the Bible search index in the background...
              </p>
            ) : null}
          </div>
        </>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Separator />

      <div className="workspace-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Results Summary
            </p>
            <p className="text-sm font-medium text-foreground">
              {isSearching
                ? "Searching verses..."
                : results.length === 0
                ? "No verses loaded yet"
                : `${results.length} matching verses loaded`}
            </p>
            {isSearching && searchProgress ? (
              <p className="text-xs text-muted-foreground">
                {`${searchProgress.processed.toLocaleString()} / ${searchProgress.total.toLocaleString()} candidates`}
              </p>
            ) : results.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {`Page ${activePage} of ${totalPages}`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {results.length > 0 && !isSearching ? (
              <SearchResultTools
                facets={resultFacets}
                resultSort={resultSort}
                showContext={showResultContext}
                onSortChange={(nextSort) =>
                  onStateChange({ resultSort: nextSort, currentPage: 1 })
                }
                onShowContextChange={(show) =>
                  onStateChange({ showResultContext: show })
                }
                onCopy={() => void copyResults()}
                onExport={exportResults}
              />
            ) : null}
            {results.length > SEARCH_RESULTS_PAGE_SIZE ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activePage <= 1}
                  onClick={() => onStateChange({ currentPage: activePage - 1 })}
                >
                  <ChevronLeftIcon />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activePage >= totalPages}
                  onClick={() => onStateChange({ currentPage: activePage + 1 })}
                >
                  Next
                  <ChevronRightIcon />
                </Button>
              </>
            ) : null}
            {isSearching ? (
              <>
                <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Working
                </p>
                <Button type="button" variant="outline" size="sm" onClick={stopSearch}>
                  <XIcon />
                  Stop
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {!isSearching && results.length >= SEARCH_RESULTS_CAP ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground" role="status">
              {`Search limit reached: ${SEARCH_RESULTS_CAP} verses loaded. More matches may exist. Narrow the book scope or make your search more specific.`}
            </p>
            {isControlsCollapsed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onStateChange({ isControlsCollapsed: false })}
              >
                Refine search
              </Button>
            ) : null}
          </div>
        ) : null}
        <ScrollArea
          ref={resultsScrollRef}
          className="min-h-0 flex-1 rounded-2xl border border-subtle-divider/80 bg-workspace-panel-elevated"
        >
          <div className="divide-y divide-subtle-divider/70 pb-1">
            {results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Run a search to review matching verses in book order.
              </p>
            ) : (
              pagedRenderedResults
            )}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={isBookFilterOpen} onOpenChange={setIsBookFilterOpen}>
        <AlertDialogContent className="max-h-[calc(100vh-2rem)] w-[min(95vw,48rem)] max-w-lg! overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Book Selector</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[60vh] pr-2">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      onClick={() => toggleTreeNode("entire")}
                    >
                      {expandedBookTree.has("entire") ? (
                        <ChevronDownIcon />
                      ) : (
                        <ChevronRightIcon />
                      )}
                    </Button>
                    <Checkbox
                      checked={allBooksSelected}
                      onCheckedChange={(value) =>
                        setIndicesSelection(
                          Array.from(allBookIndexes),
                          isChecked(value),
                        )
                      }
                    />
                    <img
                      src="/icons/app-logo.png"
                      alt="Entire Bible icon"
                      width={15}
                      height={20}
                      className="h-5 w-auto rounded-sm"
                    />
                    <span className="font-medium">Entire Bible</span>
                  </div>

                  {expandedBookTree.has("entire") ? (
                    <div className="ml-7 flex flex-col gap-1 border-l pl-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-6"
                            onClick={() => toggleTreeNode("old")}
                          >
                            {expandedBookTree.has("old") ? (
                              <ChevronDownIcon />
                            ) : (
                              <ChevronRightIcon />
                            )}
                          </Button>
                          <Checkbox
                            checked={
                              oldTestament.length > 0 &&
                              oldTestament.every((index) =>
                                selectedBookIndexes.has(index),
                              )
                            }
                            onCheckedChange={(value) =>
                              setIndicesSelection(
                                oldTestament,
                                isChecked(value),
                              )
                            }
                          />
                          <img
                            src={iconPath("color", "OT")}
                            alt="Old Testament icon"
                            width={20}
                            height={20}
                            className="size-5 shrink-0"
                          />
                          <span className="font-medium">Old Testament</span>
                        </div>
                        {expandedBookTree.has("old") ? (
                          <div className="ml-7 flex flex-col gap-1 border-l pl-3">
                            {groupedBooks.otGroups.map((group) => {
                              const groupNodeId = `group-${group.id}`;
                              const groupExpanded = expandedBookTree.has(groupNodeId);
                              return (
                                <div key={group.id} className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="size-6"
                                      onClick={() => toggleTreeNode(groupNodeId)}
                                    >
                                      {groupExpanded ? (
                                        <MinusSquareIcon />
                                      ) : (
                                        <PlusSquareIcon />
                                      )}
                                    </Button>
                                    <Checkbox
                                      checked={group.indices.every((index) =>
                                        selectedBookIndexes.has(index),
                                      )}
                                      onCheckedChange={(value) =>
                                        setIndicesSelection(
                                          group.indices,
                                          isChecked(value),
                                        )
                                      }
                                    />
                                    <img
                                      src={iconPath("color", group.iconCode)}
                                      alt={`${group.label} icon`}
                                      className="size-5 shrink-0"
                                    />
                                    <span>{group.label}</span>
                                  </div>
                                  {groupExpanded ? (
                                    <div className="ml-7 grid grid-cols-1 gap-1 border-l pl-3 md:grid-cols-2">
                                      {group.indices.map((bookIndex) => (
                                        <label
                                          key={`book-${bookIndex}`}
                                          className="flex min-w-0 items-center gap-2"
                                        >
                                          <Checkbox
                                            checked={selectedBookIndexes.has(bookIndex)}
                                            onCheckedChange={(value) =>
                                              toggleBookSelection(
                                                bookIndex,
                                                isChecked(value),
                                              )
                                            }
                                          />
                                          <img
                                            src={iconPath("color", bookCodeForIndex(bookIndex))}
                                            alt={`${books[bookIndex]?.name ?? `Book ${bookIndex + 1}`} icon`}
                                            className="size-5 shrink-0"
                                          />
                                          <span className="min-w-0 break-words whitespace-normal">
                                            {books[bookIndex]?.name ?? `Book ${bookIndex + 1}`}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-6"
                            onClick={() => toggleTreeNode("new")}
                          >
                            {expandedBookTree.has("new") ? (
                              <ChevronDownIcon />
                            ) : (
                              <ChevronRightIcon />
                            )}
                          </Button>
                          <Checkbox
                            checked={
                              newTestament.length > 0 &&
                              newTestament.every((index) =>
                                selectedBookIndexes.has(index),
                              )
                            }
                            onCheckedChange={(value) =>
                              setIndicesSelection(
                                newTestament,
                                isChecked(value),
                              )
                            }
                          />
                          <img
                            src={iconPath("color", "NT")}
                            alt="New Testament icon"
                            className="size-5 shrink-0"
                          />
                          <span className="font-medium">New Testament</span>
                        </div>
                        {expandedBookTree.has("new") ? (
                          <div className="ml-7 flex flex-col gap-1 border-l pl-3">
                            {groupedBooks.ntGroups.map((group) => {
                              const groupNodeId = `group-${group.id}`;
                              const groupExpanded = expandedBookTree.has(groupNodeId);
                              return (
                                <div key={group.id} className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="size-6"
                                      onClick={() => toggleTreeNode(groupNodeId)}
                                    >
                                      {groupExpanded ? (
                                        <MinusSquareIcon />
                                      ) : (
                                        <PlusSquareIcon />
                                      )}
                                    </Button>
                                    <Checkbox
                                      checked={group.indices.every((index) =>
                                        selectedBookIndexes.has(index),
                                      )}
                                      onCheckedChange={(value) =>
                                        setIndicesSelection(
                                          group.indices,
                                          isChecked(value),
                                        )
                                      }
                                    />
                                    <img
                                      src={iconPath("color", group.iconCode)}
                                      alt={`${group.label} icon`}
                                      className="size-5 shrink-0"
                                    />
                                    <span>{group.label}</span>
                                  </div>
                                  {groupExpanded ? (
                                    <div className="ml-7 grid grid-cols-1 gap-1 border-l pl-3 md:grid-cols-2">
                                      {group.indices.map((bookIndex) => (
                                        <label
                                          key={`book-${bookIndex}`}
                                          className="flex min-w-0 items-center gap-2"
                                        >
                                          <Checkbox
                                            checked={selectedBookIndexes.has(bookIndex)}
                                            onCheckedChange={(value) =>
                                              toggleBookSelection(
                                                bookIndex,
                                                isChecked(value),
                                              )
                                            }
                                          />
                                          <img
                                            src={iconPath("color", bookCodeForIndex(bookIndex))}
                                            alt={`${books[bookIndex]?.name ?? `Book ${bookIndex + 1}`} icon`}
                                            className="size-5 shrink-0"
                                          />
                                          <span className="min-w-0 break-words whitespace-normal">
                                            {books[bookIndex]?.name ?? `Book ${bookIndex + 1}`}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </ScrollArea>
          </div>
          <AlertDialogFooter className="flex-row justify-end px-3 py-2">
            <AlertDialogAction size="sm" onClick={() => setIsBookFilterOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
