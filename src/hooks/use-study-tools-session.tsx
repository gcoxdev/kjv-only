import { useVisualToolTarget } from "@/hooks/use-visual-tool-target";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { TimelineReaderContext } from "@/hooks/use-timeline-reader-context";
import { GenealogyPersonDetails } from "@/components/reader/genealogy-person-details";
import type { ReaderStudyToolsContentProps } from "@/components/reader/reader-study-tools-content";
import { useConcordanceCrossRefsTool } from "@/hooks/use-concordance-crossrefs-tool";
import { useDictionarySearchTool } from "@/hooks/use-dictionary-search-tool";
import { useGenealogySearchTool } from "@/hooks/use-genealogy-search-tool";
import { useMapsSearchTool } from "@/hooks/use-maps-search-tool";
import { useStrongsSearchTool } from "@/hooks/use-strongs-search-tool";
import { deriveStudySidebarState } from "@/hooks/use-study-sidebar-state";
import { useWordStudyCoordinator } from "@/hooks/use-word-study-coordinator";
import type { AncientMapEntry } from "@/lib/maps";
import {
  loadAIDictionary,
  loadBibleWordBook,
  loadHitchcocks,
  loadOldEnglish,
  loadPhrases,
  loadUnits,
  loadWebsters,
} from "@/lib/reader-data";
import { chapterVerseKey, resolveAIDictionaryKey } from "@/lib/references";
import type { Book } from "@/types/bible";
import type { NotesContext } from "@/types/notes";
import type {
  AIDictionaryEntry,
  AIDictionaryPayload,
  BibleWordBookEntry,
  BibleWordBookPayload,
  GenealogyPerson,
  HitchcocksPayload,
  OldEnglishPayload,
  PhraseEntry,
  PhrasesPayload,
  StudyToolsSelectionCommand,
  StudyWorkspaceTool,
  StrongsPayload,
  UnitsEntry,
  UnitsPayload,
  WebstersEntry,
  WebstersPayload,
} from "@/types/reader";

const mapWebstersResult = (key: string, entry: WebstersEntry) => ({ key, entry });
const mapAIDictionaryResult = (key: string, entry: AIDictionaryEntry) => ({
  key,
  entry,
});
const mapHitchcocksResult = (key: string, definition: string) => ({
  key,
  definition,
});
const mapOldEnglishResult = (key: string, definitions: string[]) => ({
  key,
  definitions,
});
const mapBibleWordBookResult = (key: string, entry: BibleWordBookEntry) => ({
  key,
  entry,
});
const mapPhraseResult = (key: string, entry: PhraseEntry) => ({ key, entry });
const mapUnitsResult = (key: string, entry: UnitsEntry) => ({ key, entry });

const aiDictionarySearchStrings = (
  key: string,
  entry: AIDictionaryEntry,
) => [
  key,
  ...(entry.aliases ?? []),
  ...entry.definitions,
  entry.note ?? "",
];

const bibleWordBookSearchStrings = (
  key: string,
  entry: BibleWordBookEntry,
) => [
  key,
  ...(entry.aliases ?? []),
  entry.partOfSpeech ?? "",
  entry.partOfSpeechLabel ?? "",
  entry.meaning,
  entry.body,
  ...(entry.sourceReferences ?? []),
];

const phraseSearchStrings = (key: string, entry: PhraseEntry) => [
  key,
  ...(entry.aliases ?? []),
];

const unitsSearchStrings = (key: string, entry: UnitsEntry) => [
  key,
  ...(entry.aliases ?? []),
];

type UseStudyToolsSessionParams = {
  accordionValue: string[];
  setAccordionValue: Dispatch<SetStateAction<string[]>>;
  books: Book[];
  timelineContext: TimelineReaderContext | null;
  selectionCommand?: StudyToolsSelectionCommand;
  renderPreview: (reference: string, highlightWord: string) => ReactNode;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
  onOpenMapDialog: (entry: AncientMapEntry) => void;
  onSetNotesContext: (context: NotesContext | null) => void;
};

export function useStudyToolsSession({
  accordionValue,
  setAccordionValue,
  books,
  timelineContext,
  selectionCommand,
  renderPreview,
  onOpenReference,
  onCloseSidebar,
  onOpenMapDialog,
  onSetNotesContext,
}: UseStudyToolsSessionParams) {
  const [concordanceWordAccordionValue, setConcordanceWordAccordionValue] =
    useState<string[]>([]);
  const [webstersWordAccordionValue, setWebstersWordAccordionValue] = useState<
    string[]
  >([]);
  const [aiDictionaryWordAccordionValue, setAIDictionaryWordAccordionValue] =
    useState<string[]>([]);
  const [bibleWordBookWordAccordionValue, setBibleWordBookWordAccordionValue] =
    useState<string[]>([]);
  const [strongsWordAccordionValue, setStrongsWordAccordionValue] = useState<
    string[]
  >([]);
  const openVisualTool = useVisualToolTarget();
  const openGenealogyTree = useCallback((personId: string) => {
    if (!openVisualTool({ kind: "genealogy", personId })) setGenealogyTreePersonId(personId);
  }, [openVisualTool]);
  const [genealogyTreePersonId, setGenealogyTreePersonId] = useState<
    string | null
  >(null);
  const strongsSearchInputRef = useRef<HTMLInputElement | null>(null);
  const crossRefsRequestIdRef = useRef(0);

  const {
    concordance,
    crossRefs,
    selectedCrossReferences,
    isCrossRefsLoading,
    crossRefsError,
    concordanceSearchTerm,
    isConcordanceSearching,
    isConcordanceLoading,
    concordanceError,
    concordanceSearchResults,
    setSelectedCrossReferences,
    setIsCrossRefsLoading,
    setCrossRefsError,
    setSelectedConcordanceWord,
    setConcordanceSearchTerm,
    setIsConcordanceLoading,
    setConcordanceError,
    ensureConcordanceLoaded,
    ensureCrossRefsLoaded,
    applyConcordanceSearch: applyConcordanceSearchRaw,
  } = useConcordanceCrossRefsTool();

  const {
    payload: websters,
    searchTerm: webstersSearchTerm,
    isSearching: isWebstersSearching,
    isLoading: isWebstersLoading,
    error: webstersError,
    results: webstersSearchResults,
    setSearchTerm: setWebstersSearchTerm,
    setSelectedResult: setSelectedWebstersEntry,
    ensureLoaded: ensureWebstersLoaded,
    applySearch: applyWebstersSearchRaw,
  } = useDictionarySearchTool<
    WebstersPayload,
    WebstersEntry,
    { key: string; entry: WebstersEntry }
  >({
    load: loadWebsters,
    errorMessage: "Failed to load Webster's data",
    mapResult: mapWebstersResult,
  });

  const {
    payload: aiDictionary,
    searchTerm: aiDictionarySearchTerm,
    isSearching: isAIDictionarySearching,
    isLoading: isAIDictionaryLoading,
    error: aiDictionaryError,
    results: aiDictionarySearchResults,
    setSearchTerm: setAIDictionarySearchTerm,
    setSelectedResult: setSelectedAIDictionaryEntry,
    ensureLoaded: ensureAIDictionaryLoaded,
    applySearch: applyAIDictionarySearchRaw,
  } = useDictionarySearchTool<
    AIDictionaryPayload,
    AIDictionaryEntry,
    { key: string; entry: AIDictionaryEntry }
  >({
    load: loadAIDictionary,
    errorMessage: "Failed to load AI Dictionary data",
    mapResult: mapAIDictionaryResult,
    getSearchStrings: aiDictionarySearchStrings,
  });

  const {
    payload: hitchcocks,
    searchTerm: hitchcocksSearchTerm,
    isSearching: isHitchcocksSearching,
    isLoading: isHitchcocksLoading,
    error: hitchcocksError,
    results: hitchcocksSearchResults,
    setSearchTerm: setHitchcocksSearchTerm,
    setSelectedResult: setSelectedHitchcocksEntry,
    ensureLoaded: ensureHitchcocksLoaded,
    applySearch: applyHitchcocksSearch,
  } = useDictionarySearchTool<
    HitchcocksPayload,
    string,
    { key: string; definition: string }
  >({
    load: loadHitchcocks,
    errorMessage: "Failed to load Hitchcock's data",
    mapResult: mapHitchcocksResult,
  });

  const {
    payload: oldEnglish,
    searchTerm: oldEnglishSearchTerm,
    isSearching: isOldEnglishSearching,
    isLoading: isOldEnglishLoading,
    error: oldEnglishError,
    results: oldEnglishSearchResults,
    setSearchTerm: setOldEnglishSearchTerm,
    setSelectedResult: setSelectedOldEnglishEntry,
    ensureLoaded: ensureOldEnglishLoaded,
    applySearch: applyOldEnglishSearch,
  } = useDictionarySearchTool<
    OldEnglishPayload,
    string[],
    { key: string; definitions: string[] }
  >({
    load: loadOldEnglish,
    errorMessage: "Failed to load Old English data",
    mapResult: mapOldEnglishResult,
  });

  const {
    payload: bibleWordBook,
    searchTerm: bibleWordBookSearchTerm,
    isSearching: isBibleWordBookSearching,
    isLoading: isBibleWordBookLoading,
    error: bibleWordBookError,
    results: bibleWordBookSearchResults,
    setSearchTerm: setBibleWordBookSearchTerm,
    setSelectedResult: setSelectedBibleWordBookEntry,
    ensureLoaded: ensureBibleWordBookLoaded,
    applySearch: applyBibleWordBookSearchRaw,
  } = useDictionarySearchTool<
    BibleWordBookPayload,
    BibleWordBookEntry,
    { key: string; entry: BibleWordBookEntry }
  >({
    load: loadBibleWordBook,
    errorMessage: "Failed to load Bible Word-Book data",
    mapResult: mapBibleWordBookResult,
    getSearchStrings: bibleWordBookSearchStrings,
  });

  const {
    payload: phrases,
    searchTerm: phrasesSearchTerm,
    isSearching: isPhrasesSearching,
    isLoading: isPhrasesLoading,
    error: phrasesError,
    results: phrasesSearchResults,
    setSearchTerm: setPhrasesSearchTerm,
    setSelectedResult: setSelectedPhrasesEntry,
    ensureLoaded: ensurePhrasesLoaded,
    applySearch: applyPhrasesSearch,
  } = useDictionarySearchTool<
    PhrasesPayload,
    PhraseEntry,
    { key: string; entry: PhraseEntry }
  >({
    load: loadPhrases,
    errorMessage: "Failed to load phrases data",
    mapResult: mapPhraseResult,
    getSearchStrings: phraseSearchStrings,
  });

  const {
    payload: units,
    searchTerm: unitsSearchTerm,
    isSearching: isUnitsSearching,
    isLoading: isUnitsLoading,
    error: unitsError,
    results: unitsSearchResults,
    setSearchTerm: setUnitsSearchTerm,
    setSelectedResult: setSelectedUnitsEntry,
    ensureLoaded: ensureUnitsLoaded,
    applySearch: applyUnitsSearch,
  } = useDictionarySearchTool<
    UnitsPayload,
    UnitsEntry,
    { key: string; entry: UnitsEntry }
  >({
    load: loadUnits,
    errorMessage: "Failed to load units data",
    mapResult: mapUnitsResult,
    getSearchStrings: unitsSearchStrings,
  });

  const {
    strongsGreek,
    strongsHebrew,
    strongsSearchTerm,
    isStrongsSearching,
    isStrongsLoading,
    strongsError,
    strongsSearchResults,
    setStrongsSearchTerm,
    setIsStrongsSearching,
    setIsStrongsLoading,
    setStrongsError,
    setSelectedStrongsEntries,
    ensureStrongsLoaded,
    applyStrongsSearch: applyStrongsSearchRaw,
  } = useStrongsSearchTool();

  const {
    genealogy,
    genealogySearchTerm,
    isGenealogySearching,
    isGenealogyLoading,
    genealogyError,
    genealogyById,
    genealogySearchResults,
    setGenealogySearchTerm,
    setSelectedGenealogyIds,
    ensureGenealogyLoaded,
    applyGenealogySearch,
  } = useGenealogySearchTool();

  const {
    ancientMaps,
    mapsSearchTerm,
    isMapsSearching,
    isMapsLoading,
    mapsError,
    mapsSearchResults,
    mapsDisplayEntries,
    setMapsSearchTerm,
    setSelectedMapsEntries,
    ensureAncientMapsLoaded,
    applyMapsSearch,
  } = useMapsSearchTool();

  const openStudyTool = useCallback(
    (tool: StudyWorkspaceTool) => {
      setAccordionValue((current) =>
        current.includes(tool) ? current : [...current, tool],
      );
    },
    [setAccordionValue],
  );

  const applyConcordanceSearch = useCallback(
    (rawValue?: string) => {
      setConcordanceWordAccordionValue([]);
      applyConcordanceSearchRaw(rawValue);
    },
    [applyConcordanceSearchRaw],
  );
  const applyWebstersSearch = useCallback(
    (rawValue?: string) => {
      setWebstersWordAccordionValue([]);
      applyWebstersSearchRaw(rawValue);
    },
    [applyWebstersSearchRaw],
  );
  const applyAIDictionarySearch = useCallback(
    (rawValue?: string) => {
      setAIDictionaryWordAccordionValue([]);
      applyAIDictionarySearchRaw(rawValue);
    },
    [applyAIDictionarySearchRaw],
  );
  const applyBibleWordBookSearch = useCallback(
    (rawValue?: string) => {
      setBibleWordBookWordAccordionValue([]);
      applyBibleWordBookSearchRaw(rawValue);
    },
    [applyBibleWordBookSearchRaw],
  );
  const applyStrongsSearch = useCallback(
    (rawValue?: string) => {
      setStrongsWordAccordionValue([]);
      applyStrongsSearchRaw(rawValue);
    },
    [applyStrongsSearchRaw],
  );
  const applyKjvWordsPhrasesSearch = useCallback(
    (term: string) => {
      applyOldEnglishSearch(term);
      applyPhrasesSearch(term);
      applyUnitsSearch(term);
    },
    [applyOldEnglishSearch, applyPhrasesSearch, applyUnitsSearch],
  );

  const resolveAIDictionaryEntryTarget = useCallback(
    (rawValue: string) =>
      aiDictionary ? resolveAIDictionaryKey(aiDictionary, rawValue) : null,
    [aiDictionary],
  );

  const openAIDictionaryEntry = useCallback(
    async (rawValue: string) => {
      const data = aiDictionary ?? (await ensureAIDictionaryLoaded());
      const matchedKey = resolveAIDictionaryKey(data, rawValue);
      if (!matchedKey) {
        applyAIDictionarySearch(rawValue);
        return;
      }
      setAIDictionaryWordAccordionValue([matchedKey]);
      setAIDictionarySearchTerm("");
      setSelectedAIDictionaryEntry({ key: matchedKey, entry: data[matchedKey] });
    },
    [
      aiDictionary,
      applyAIDictionarySearch,
      ensureAIDictionaryLoaded,
      setAIDictionarySearchTerm,
      setSelectedAIDictionaryEntry,
    ],
  );

  const openLinkedStrongsEntry = useCallback(
    (code: string) => {
      setStrongsError(null);
      setIsStrongsSearching(false);
      setStrongsSearchTerm("");
      setStrongsWordAccordionValue([code]);
      if (strongsSearchInputRef.current) {
        strongsSearchInputRef.current.value = "";
      }

      const applySelection = (greek: StrongsPayload, hebrew: StrongsPayload) => {
        const source = code.startsWith("G") ? greek : hebrew;
        const entry = source[code];
        if (!entry) {
          setSelectedStrongsEntries([]);
          return;
        }
        setSelectedStrongsEntries([
          {
            code,
            testament: code.startsWith("G") ? "greek" : "hebrew",
            entry,
          },
        ]);
        openStudyTool("strongs");
      };

      if (strongsGreek && strongsHebrew) {
        applySelection(strongsGreek, strongsHebrew);
        return;
      }

      setIsStrongsLoading(true);
      void ensureStrongsLoaded()
        .then(({ greek, hebrew }) => applySelection(greek, hebrew))
        .catch((error) => {
          setStrongsError(
            error instanceof Error
              ? error.message
              : "Failed to load Strong's data",
          );
          setSelectedStrongsEntries([]);
        })
        .finally(() => setIsStrongsLoading(false));
    },
    [
      ensureStrongsLoaded,
      openStudyTool,
      setIsStrongsLoading,
      setIsStrongsSearching,
      setSelectedStrongsEntries,
      setStrongsError,
      setStrongsSearchTerm,
      strongsGreek,
      strongsHebrew,
    ],
  );

  const selectGenealogyPerson = useCallback(
    (personId: string) => {
      if (!personId) {
        return;
      }
      setGenealogySearchTerm("");
      setSelectedGenealogyIds([personId]);
      openStudyTool("genealogy");
    },
    [openStudyTool, setGenealogySearchTerm, setSelectedGenealogyIds],
  );

  const renderGenealogyPersonDetails = useCallback(
    (person: GenealogyPerson) => (
      <GenealogyPersonDetails
        person={person}
        genealogyById={genealogyById}
        onSelectPerson={selectGenealogyPerson}
        onOpenTree={openGenealogyTree}
        renderReferencePreview={renderPreview}
        onOpenReference={onOpenReference}
        onCloseSidebar={onCloseSidebar}
      />
    ),
    [
      genealogyById,
      onCloseSidebar,
      onOpenReference,
      renderPreview,
      openGenealogyTree,
      selectGenealogyPerson,
    ],
  );

  const openCrossReferencesForVerse = useCallback(
    (bookIndex: number, chapterIndex: number, verseNumber: number) => {
      const requestId = ++crossRefsRequestIdRef.current;
      const key = chapterVerseKey(bookIndex, chapterIndex, verseNumber);
      openStudyTool("cross-refs");
      setCrossRefsError(null);
      setIsCrossRefsLoading(true);

      const applySelection = (data: NonNullable<typeof crossRefs>) => {
        if (crossRefsRequestIdRef.current !== requestId) {
          return;
        }
        setSelectedCrossReferences({ key, references: data[key] ?? [] });
        setIsCrossRefsLoading(false);
      };

      if (crossRefs) {
        applySelection(crossRefs);
        return;
      }
      void ensureCrossRefsLoaded()
        .then(applySelection)
        .catch((error) => {
          if (crossRefsRequestIdRef.current !== requestId) {
            return;
          }
          setCrossRefsError(
            error instanceof Error
              ? error.message
              : "Failed to load cross-reference data",
          );
          setIsCrossRefsLoading(false);
        });
    },
    [
      crossRefs,
      ensureCrossRefsLoaded,
      openStudyTool,
      setCrossRefsError,
      setIsCrossRefsLoading,
      setSelectedCrossReferences,
    ],
  );

  const { openWordInStudyTools, personPlaceNotice } = useWordStudyCoordinator({
    books,
    concordance,
    websters,
    aiDictionary,
    bibleWordBook,
    hitchcocks,
    oldEnglish,
    phrases,
    units,
    genealogy,
    ancientMaps,
    strongsGreek,
    strongsHebrew,
    ensureConcordanceLoaded,
    ensureWebstersLoaded,
    ensureAIDictionaryLoaded,
    ensureBibleWordBookLoaded,
    ensureHitchcocksLoaded,
    ensureOldEnglishLoaded,
    ensurePhrasesLoaded,
    ensureUnitsLoaded,
    ensureGenealogyLoaded,
    ensureAncientMapsLoaded,
    ensureStrongsLoaded,
    openStudyTool,
    setNotesContext: onSetNotesContext,
    setConcordanceAccordionValue: setAccordionValue,
    setConcordanceError,
    setIsConcordanceLoading,
    setConcordanceSearchTerm,
    setConcordanceWordAccordionValue,
    setSelectedConcordanceWord,
    setWebstersSearchTerm,
    setWebstersWordAccordionValue,
    setSelectedWebstersEntry,
    setAIDictionarySearchTerm,
    setAIDictionaryWordAccordionValue,
    setSelectedAIDictionaryEntry,
    setBibleWordBookSearchTerm,
    setBibleWordBookWordAccordionValue,
    setSelectedBibleWordBookEntry,
    setHitchcocksSearchTerm,
    setSelectedHitchcocksEntry,
    setOldEnglishSearchTerm,
    setSelectedOldEnglishEntry,
    setPhrasesSearchTerm,
    setSelectedPhrasesEntry,
    setUnitsSearchTerm,
    setSelectedUnitsEntry,
    setGenealogySearchTerm,
    setSelectedGenealogyIds,
    setMapsSearchTerm,
    setSelectedMapsEntries,
    setStrongsError,
    setIsStrongsLoading,
    setStrongsSearchTerm,
    setIsStrongsSearching,
    setStrongsWordAccordionValue,
    setSelectedStrongsEntries,
    strongsSearchInputRef,
  });

  const runSelectionCommand = useEffectEvent(
    (command: StudyToolsSelectionCommand) => {
      if (command.type === "verse") {
        onSetNotesContext({
          bookIndex: command.bookIndex,
          chapterIndex: command.chapterIndex,
          verseNumber: command.verseNumber,
        });
        openCrossReferencesForVerse(
          command.bookIndex,
          command.chapterIndex,
          command.verseNumber,
        );
        return;
      }

      if (command.verseNumber !== null) {
        openCrossReferencesForVerse(
          command.bookIndex,
          command.chapterIndex,
          command.verseNumber,
        );
      }
      openWordInStudyTools(command);
    },
  );

  useEffect(() => {
    if (selectionCommand) {
      runSelectionCommand(selectionCommand);
    }
  }, [selectionCommand]);

  const sidebarState = deriveStudySidebarState({
    accordionValue,
    crossRefsCount: selectedCrossReferences?.references.length ?? 0,
    concordanceCount: concordanceSearchResults.length,
    webstersCount: webstersSearchResults.length,
    aiDictionaryCount: aiDictionarySearchResults.length,
    strongsCount: strongsSearchResults.length,
    bibleWordBookCount: bibleWordBookSearchResults.length,
    kjvWordsPhrasesCount:
      oldEnglishSearchResults.length +
      phrasesSearchResults.length +
      unitsSearchResults.length,
    mapsCount: mapsSearchResults.filter(entry => !entry.selectionNote).length,
    hitchcocksCount: hitchcocksSearchResults.length,
    genealogyCount: genealogySearchResults.length,
  });

  const toolsProps: ReaderStudyToolsContentProps = {
    summaryProps: { isOpen: accordionValue.includes("summary"), context: timelineContext, books, renderPreview, onOpenReference, onCloseSidebar },
    timelineProps: { isOpen: accordionValue.includes("timeline"), context: timelineContext, books, renderPreview, onOpenReference, onCloseSidebar },
    crossRefsProps: {
      hasInfo: sidebarState.hasCrossRefsInfo,
      isOpen: sidebarState.isCrossRefsSectionOpen,
      isLoading: isCrossRefsLoading,
      error: crossRefsError,
      selected: selectedCrossReferences,
      books,
      renderPreview,
      onOpenReference,
      onCloseSidebar,
    },
    concordanceProps: {
      hasInfo: sidebarState.hasConcordanceInfo,
      isOpen: sidebarState.isConcordanceSectionOpen,
      isLoading: isConcordanceLoading,
      isSearching: isConcordanceSearching,
      error: concordanceError,
      searchTerm: concordanceSearchTerm,
      results: concordanceSearchResults,
      wordAccordionValue: concordanceWordAccordionValue,
      onWordAccordionValueChange: setConcordanceWordAccordionValue,
      onSearch: applyConcordanceSearch,
      renderPreview,
      onOpenReference,
      onCloseSidebar,
    },
    webstersProps: {
      hasInfo: sidebarState.hasWebstersInfo,
      isOpen: sidebarState.isWebstersSectionOpen,
      isLoading: isWebstersLoading,
      isSearching: isWebstersSearching,
      error: webstersError,
      searchTerm: webstersSearchTerm,
      results: webstersSearchResults,
      wordAccordionValue: webstersWordAccordionValue,
      onWordAccordionValueChange: setWebstersWordAccordionValue,
      onSearch: applyWebstersSearch,
    },
    aiDictionaryProps: {
      hasInfo: sidebarState.hasAIDictionaryInfo,
      isOpen: sidebarState.isAIDictionarySectionOpen,
      isLoading: isAIDictionaryLoading,
      isSearching: isAIDictionarySearching,
      error: aiDictionaryError,
      searchTerm: aiDictionarySearchTerm,
      results: aiDictionarySearchResults,
      wordAccordionValue: aiDictionaryWordAccordionValue,
      onWordAccordionValueChange: setAIDictionaryWordAccordionValue,
      resolveEntryTarget: resolveAIDictionaryEntryTarget,
      onOpenEntry: openAIDictionaryEntry,
      onSearch: applyAIDictionarySearch,
    },
    strongsProps: {
      hasInfo: sidebarState.hasStrongsInfo,
      isOpen: sidebarState.isStrongsSectionOpen,
      isLoading: isStrongsLoading,
      isSearching: isStrongsSearching,
      error: strongsError,
      searchTerm: strongsSearchTerm,
      results: strongsSearchResults,
      wordAccordionValue: strongsWordAccordionValue,
      onWordAccordionValueChange: setStrongsWordAccordionValue,
      onSearch: applyStrongsSearch,
      onOpenLinkedStrongsEntry: openLinkedStrongsEntry,
      inputRef: strongsSearchInputRef,
      renderPreview,
      onOpenReference,
      onCloseSidebar,
    },
    kjvWordsPhrasesProps: {
      hasInfo: sidebarState.hasKjvWordsPhrasesInfo,
      isOpen: sidebarState.isKjvWordsPhrasesSectionOpen,
      oldEnglish: {
        isLoading: isOldEnglishLoading,
        isSearching: isOldEnglishSearching,
        error: oldEnglishError,
        searchTerm: oldEnglishSearchTerm,
        results: oldEnglishSearchResults,
      },
      phrases: {
        isLoading: isPhrasesLoading,
        isSearching: isPhrasesSearching,
        error: phrasesError,
        searchTerm: phrasesSearchTerm,
        results: phrasesSearchResults,
      },
      units: {
        isLoading: isUnitsLoading,
        isSearching: isUnitsSearching,
        error: unitsError,
        searchTerm: unitsSearchTerm,
        results: unitsSearchResults,
      },
      onSearch: applyKjvWordsPhrasesSearch,
      renderPreview,
      onOpenReference,
      onCloseSidebar,
    },
    bibleWordBookProps: {
      hasInfo: sidebarState.hasBibleWordBookInfo,
      isOpen: sidebarState.isBibleWordBookSectionOpen,
      isLoading: isBibleWordBookLoading,
      isSearching: isBibleWordBookSearching,
      error: bibleWordBookError,
      searchTerm: bibleWordBookSearchTerm,
      results: bibleWordBookSearchResults,
      wordAccordionValue: bibleWordBookWordAccordionValue,
      onWordAccordionValueChange: setBibleWordBookWordAccordionValue,
      onSearch: applyBibleWordBookSearch,
    },
    mapsProps: {
      selectionNotice: personPlaceNotice,
      hasInfo: sidebarState.hasMapsInfo,
      isOpen: sidebarState.isMapsSectionOpen,
      isLoading: isMapsLoading,
      isSearching: isMapsSearching,
      error: mapsError,
      searchTerm: mapsSearchTerm,
      resultsLength: mapsSearchResults.length,
      displayEntries: mapsDisplayEntries,
      onSearch: applyMapsSearch,
      onOpenMapDialog,
      renderPreview,
      onOpenReference,
      onCloseSidebar,
    },
    genealogyProps: {
      selectionNotice: personPlaceNotice,
      hasInfo: sidebarState.hasGenealogyInfo,
      isOpen: sidebarState.isGenealogySectionOpen,
      isLoading: isGenealogyLoading,
      isSearching: isGenealogySearching,
      error: genealogyError,
      searchTerm: genealogySearchTerm,
      results: genealogySearchResults,
      onSearch: applyGenealogySearch,
      renderPersonDetails: renderGenealogyPersonDetails,
    },
    hitchcocksProps: {
      hasInfo: sidebarState.hasHitchcocksInfo,
      isOpen: sidebarState.isHitchcocksSectionOpen,
      isLoading: isHitchcocksLoading,
      isSearching: isHitchcocksSearching,
      error: hitchcocksError,
      searchTerm: hitchcocksSearchTerm,
      results: hitchcocksSearchResults,
      onSearch: applyHitchcocksSearch,
    },
  };

  return {
    toolsProps,
    genealogyTree: {
      open: genealogyTreePersonId !== null,
      person: genealogyTreePersonId
        ? (genealogyById.get(genealogyTreePersonId) ?? null)
        : null,
      genealogyById,
      onOpenChange: (open: boolean) => {
        if (!open) {
          setGenealogyTreePersonId(null);
        }
      },
      onSelectPerson: (personId: string) => {
        selectGenealogyPerson(personId);
        setGenealogyTreePersonId(personId);
      },
    },
  };
}
