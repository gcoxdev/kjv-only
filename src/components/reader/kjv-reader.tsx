import type { AncientMapEntry } from "@/lib/maps";
import { VisualToolTargetContext, VisualToolNavigateContext } from "@/hooks/use-visual-tool-target";
import { routeVisualTool } from "@/lib/visual-tool-routing";
import type { VisualToolRequest } from "@/types/reader";
import { useTimelineReaderContext } from "@/hooks/use-timeline-reader-context";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  loadAIDictionary,
  loadBibleWordBook,
  loadHitchcocks,
  loadMapGeoJson,
  loadOldEnglish,
  loadPhrases,
  loadUnits,
  loadWebsters,
} from "@/lib/reader-data";
import { resolveAIDictionaryKey } from "@/lib/references";
import {
  deriveTokenAccordionState,
  type TokenAccordionOptions,
} from "@/lib/word-study-selection";
import {
  readableHighlightTextColor,
} from "@/lib/highlight-color";
import { chapterProgressKey, panelViewportElement } from "@/lib/reader-view";
import {
  collectLeafIds,
  findLeafNode,
  updateLeafNode,
  updateSameOrientationGroupLayout,
  updateSplitRatio,
} from "@/lib/reader-layout";
import { panelNodeContainsView } from "@/lib/workspace-navigation";
import { useLayoutHashSync } from "@/hooks/use-layout-hash-sync";
import type {
  AIDictionaryEntry,
  AIDictionaryPayload,
  BibleWordBookEntry,
  BibleWordBookPayload,
  GenealogyPerson,
  HitchcocksPayload,
  LeafNode,
  OldEnglishPayload,
  PhraseEntry,
  PhrasesPayload,
  ReaderTab,
  SplitOrientation,
  StudyToolsSelectionCommand,
  StrongsPayload,
  TokenPopupState,
  UnitsEntry,
  UnitsPayload,
  WebstersEntry,
  WebstersPayload,
  WordVerseSelectionTarget,
  PendingReaderScrollTarget,
} from "@/types/reader";
import type { BookmarkScope } from "@/types/bookmarks";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarActivitySync } from "@/components/reader/sidebar-activity-sync";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { SidebarOpenRequestSync } from "@/components/reader/sidebar-open-request-sync";
import { SidebarCloseRequestSync } from "@/components/reader/sidebar-close-request-sync";
import { GenealogyPersonDetails } from "@/components/reader/genealogy-person-details";
import { useReferencePreview } from "@/hooks/use-reference-preview";
import { useTabActions } from "@/hooks/use-tab-actions";
import { useMapDialogState } from "@/hooks/use-map-dialog-state";
import { useReaderDerivedState } from "@/hooks/use-reader-derived-state";
import { useDictionarySearchTool } from "@/hooks/use-dictionary-search-tool";
import { useStrongsSearchTool } from "@/hooks/use-strongs-search-tool";
import { useGenealogySearchTool } from "@/hooks/use-genealogy-search-tool";
import { useMapsSearchTool } from "@/hooks/use-maps-search-tool";
import { useConcordanceCrossRefsTool } from "@/hooks/use-concordance-crossrefs-tool";
import { useTopicsTool } from "@/hooks/use-topics-tool";
import { useReaderBookmarks } from "@/hooks/use-reader-bookmarks";
import { useReaderNotes } from "@/hooks/use-reader-notes";
import { useLeafHistory } from "@/hooks/use-leaf-history";
import { usePanelTransfer } from "@/hooks/use-panel-transfer";
import { usePanelTargeting } from "@/hooks/use-panel-targeting";
import { usePanelRouting } from "@/hooks/use-panel-routing";
import { usePanelInteractionController } from "@/hooks/use-panel-interaction-controller";
import { usePendingReaderScroll } from "@/hooks/use-pending-reader-scroll";
import { usePwaInstallation } from "@/hooks/use-pwa-installation";
import { useGuidedTourController } from "@/hooks/use-guided-tour-controller";
import { useCompletionCelebration } from "@/hooks/use-completion-celebration";
import { useReaderStartup } from "@/hooks/use-reader-startup";
import {
  useBookmarksViewModel,
  useProgressViewModel,
  useSettingsViewModel,
  useStudyToolsViewModel,
} from "@/hooks/use-reader-view-models";
import { useWorkspaceNavigation } from "@/hooks/use-workspace-navigation";
import { useWordStudyNavigation } from "@/hooks/use-word-study-navigation";
import {
  useWordStudyCoordinator,
  type OpenWordInStudyToolsArgs,
} from "@/hooks/use-word-study-coordinator";
import { useVerseHighlights } from "@/hooks/use-verse-highlights";
import { useReaderShellState } from "@/hooks/use-reader-shell-state";
import { useReaderController } from "@/hooks/use-reader-controller";
import { useStudyWorkspaceState } from "@/hooks/use-study-workspace-state";
import { useStudyModeLifecycle } from "@/hooks/use-study-mode-lifecycle";
import { useReaderStorageWarning } from "@/hooks/use-reader-storage-warning";
import { useFirstReaderReadyMeasure } from "@/hooks/use-first-reader-ready-measure";
import { useTokenPopupDismissal } from "@/hooks/use-token-popup-dismissal";
import { useReaderLeafCleanup } from "@/hooks/use-reader-leaf-cleanup";
import { useTopicsPreload } from "@/hooks/use-topics-preload";
import { TabsStrip } from "@/components/reader/tabs-strip";
import { TokenPopupCard } from "@/components/reader/token-popup-card";
import { ReaderTopBar } from "@/components/reader/reader-top-bar";
import { ReferenceCommandDialog } from "@/components/reader/reference-command-dialog";
import { TabsWorkspace } from "@/components/reader/tabs-workspace";
import { ReaderStatusScreen } from "@/components/reader/reader-status-screen";
import { ReaderWorkspacePanels } from "@/components/reader/reader-workspace-panels";
import { ReaderImportControls } from "@/components/reader/reader-import-controls";
import { PwaUpdateNotice } from "@/components/reader/pwa-update-notice";
import { ToolReferenceDisplayModeProvider } from "@/components/reader/tool-reference-list";
import { CompletionCelebration } from "@/components/reader/completion-celebration";
import { GuidedTour } from "@/components/reader/guided-tour";
import type { StudyToolsPanelProps } from "@/components/reader/study-tools-panel";
import type {
  TopicsContentProps,
  TopicsPanelProps,
} from "@/components/reader/study-tools/topics-tool";
import { filterRecordEntries } from "@/lib/leaf-state";
import { useShortcutPreferences } from "@/hooks/use-keyboard-shortcuts";
import { useReaderShortcuts } from "@/hooks/use-reader-shortcuts";
import type { SettingsTab } from "@/components/reader/settings-dialog";

const LazyReaderStudySidebar = lazy(async () => {
  const module = await import("@/components/reader/reader-study-sidebar");
  return { default: module.ReaderStudySidebar };
});

const LazyMapAndPhotoDialogs = lazy(async () => {
  const module = await import("@/components/reader/map-and-photo-dialogs");
  return { default: module.MapAndPhotoDialogs };
});

const LazyRenameTabDialog = lazy(async () => {
  const module = await import("@/components/reader/rename-tab-dialog");
  return { default: module.RenameTabDialog };
});

const LazyGenealogyTreeDialog = lazy(async () => {
  const module = await import("@/components/reader/genealogy-tree-dialog");
  return { default: module.GenealogyTreeDialog };
});

export function KJVReader() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [tabs, setTabs] = useState<ReaderTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeReaderWordHighlight, setActiveReaderWordHighlight] = useState<{
    leafId: string;
    verseNumber: number;
    word: string;
  } | null>(null);
  const [pendingReaderScrollTargets, setPendingReaderScrollTargets] = useState<
    PendingReaderScrollTarget[]
  >([]);
  const [sidebarOpenRequestKey, setSidebarOpenRequestKey] = useState(0);
  const [sidebarCloseRequestKey, setSidebarCloseRequestKey] = useState(0);
  const [isReferenceCommandOpen, setIsReferenceCommandOpen] = useState(false);
  const [activePanelLeafId, setActivePanelLeafId] = useState<string | null>(null);
  const {
    bindings: shortcutBindings,
    setBinding: setShortcutBinding,
    resetBinding: resetShortcutBinding,
    resetAllBindings: resetAllShortcutBindings,
  } = useShortcutPreferences();
  const {
    activeTab: studyWorkspaceTab,
    accordionValue: concordanceAccordionValue,
    setActiveTab: setStudyWorkspaceTab,
    showTool: showStudyTool,
    setAccordionValue: setConcordanceAccordionValue,
  } = useStudyWorkspaceState({
    initialAccordionValue: [],
  });
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const hasOpenSearchView = useMemo(
    () => tabs.some((tab) => panelNodeContainsView(tab.root, "search")),
    [tabs],
  );
  const {
    isStudyMode,
    tabsOrientation,
    isRightSidebarOpen,
    isGenealogyTreeOpen,
    genealogyTreePersonId,
    setIsStudyMode,
    setTabsOrientation,
    setIsRightSidebarOpen,
    setIsGenealogyTreeOpen,
    setGenealogyTreePersonId,
  } = useReaderShellState();
  const {
    preferences: {
      theme,
      setTheme,
      readerColorTheme,
      setReaderColorTheme,
      fontSize,
      setFontSize,
      lightHighlightColor,
      setLightHighlightColor,
      darkHighlightColor,
      setDarkHighlightColor,
      verseSpacing,
      setVerseSpacing,
      contextVerseCount,
      setContextVerseCount,
      toolReferenceDisplayMode,
      setToolReferenceDisplayMode,
      hideReadModeVerseNumbers,
      setHideReadModeVerseNumbers,
      readModeParagraphIndent,
      setReadModeParagraphIndent,
      flowVersesByParagraph,
      setFlowVersesByParagraph,
      showWelcomeHomeAtStartup,
      setShowWelcomeHomeAtStartup,
      wordVerseSelectionTarget,
      setWordVerseSelectionTarget,
      notesLinkOpenTarget,
      setNotesLinkOpenTarget,
      searchResultOpenTarget,
      setSearchResultOpenTarget,
      bookmarkOpenTarget,
      setBookmarkOpenTarget,
      genealogyOpenTarget,
      setGenealogyOpenTarget,
      mapsOpenTarget,
      setMapsOpenTarget,
      timelineOpenTarget,
      setTimelineOpenTarget,
      referenceLinkOpenTarget,
      setReferenceLinkOpenTarget,
    },
    readingProgress: { readChapters, setReadChapters },
    corpus: { books, isCorpusLoaded, loadError },
    searchPages: {
      stateByLeafId: searchPageStateByLeafId,
      changeState: changeSearchPageState,
      initializeState: initializeSearchPageState,
      pruneState: pruneSearchPageState,
      swapState: swapSearchPageState,
      restoreDefinitions: restoreSearchPageDefinitions,
    },
    verseSearch: {
      index: verseSearchIndex,
      isBuilding: isVerseSearchIndexBuilding,
      isReady: isVerseSearchIndexReady,
      error: verseSearchIndexError,
      runSmartSearch: runSmartVerseSearch,
      runSearchResultAnalysis,
    },
  } = useReaderController({
    tabsOrientation,
    setTabsOrientation,
    searchEnabled: hasOpenSearchView || studyWorkspaceTab === "search",
  });
  const wordVerseSelectionTargetRef =
    useRef<WordVerseSelectionTarget>(wordVerseSelectionTarget);

  useReaderStorageWarning();
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTab>("visual");
  const [tokenPopup, setTokenPopup] = useState<TokenPopupState | null>(null);
  const [fullscreenLeafId, setFullscreenLeafId] = useState<string | null>(null);
  const [panelMenuOpenLeafId, setPanelMenuOpenLeafId] = useState<string | null>(
    null,
  );
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
  const [studyToolsSelectionCommandsByLeafId, setStudyToolsSelectionCommands] =
    useState<Record<string, StudyToolsSelectionCommand>>({});
  const nextStudyToolsSelectionCommandIdRef = useRef(0);
  const queuePanelVerseSelection = useCallback(
    (
      leafId: string,
      selection: {
        bookIndex: number;
        chapterIndex: number;
        verseNumber: number;
      },
    ) => {
      const command: StudyToolsSelectionCommand = {
        id: ++nextStudyToolsSelectionCommandIdRef.current,
        type: "verse",
        ...selection,
      };
      setStudyToolsSelectionCommands((current) => ({
        ...current,
        [leafId]: command,
      }));
    },
    [],
  );
  const queuePanelWordSelection = useCallback(
    (leafId: string, selection: OpenWordInStudyToolsArgs) => {
      const command: StudyToolsSelectionCommand = {
        id: ++nextStudyToolsSelectionCommandIdRef.current,
        type: "word",
        ...selection,
      };
      setStudyToolsSelectionCommands((current) => ({
        ...current,
        [leafId]: command,
      }));
    },
    [],
  );
  const {
    targetedPanelLeafId,
    targetedPanelLeafIdRef,
    setTargetedPanelLeafId,
    showTargetedPanelToggle,
    toggleTargetedPanel,
  } = usePanelTargeting({
    tabs,
    wordVerseSelectionTarget,
    notesLinkOpenTarget,
    searchResultOpenTarget,
    bookmarkOpenTarget,
    genealogyOpenTarget,
    mapsOpenTarget,
    timelineOpenTarget,
    referenceLinkOpenTarget,
  });
  const {
    isMapDialogOpen,
    activeMapDialogEntry,
    isMapDialogLoading,
    mapDialogError,
    mapDialogGeoJson,
    onMapDialogOpenChange,
    onCloseMapDialog,
    openMapDialog: openMapModal,
    resetMapDialogState,
  } = useMapDialogState({
    loadMapGeoJsonByFile: loadMapGeoJson,
  });
  const tabEndRef = useRef<HTMLDivElement>(null);
  const strongsSearchInputRef = useRef<HTMLInputElement | null>(null);
  const panelElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fullscreenRequestedLeafIdRef = useRef<string | null>(null);
  const { canInstallPwa, isPwaInstalled, installPwa } = usePwaInstallation();

  const {
    highlightedVerseRangesByLeafId,
    clearLeafHighlights,
    setLeafHighlights,
    queueVerseHighlights,
    setVerseHighlights,
    swapLeafHighlights,
    pruneLeafHighlights,
  } = useVerseHighlights({
    panelElementRefs,
    activeTabId,
    tabsVersion: tabs,
  });
  const { parseCurrentLayoutHash, applyParsedLayout } = useLayoutHashSync({
    isLoaded: isLoaded && isCorpusLoaded,
    tabs,
    activeTabId,
    tabsOrientation,
    highlightedVerseRangesByLeafId,
    searchPageStateByLeafId,
    targetedPanelLeafId,
    showTargetedPanelToggle,
    setTabs,
    setActiveTabId,
    setTabsOrientation,
    setVerseHighlights,
    queueVerseHighlights,
    setTargetedPanelLeafId,
    restoreSearchPageDefinitions,
  });

  const finishFirstReaderReadyMeasureRef = useFirstReaderReadyMeasure();

  useEffect(() => {
    wordVerseSelectionTargetRef.current = wordVerseSelectionTarget;
  }, [wordVerseSelectionTarget]);

  useTokenPopupDismissal(Boolean(tokenPopup), setTokenPopup);

  useReaderStartup({
    isLoaded,
    bookCount: books.length,
    isCorpusLoaded,
    loadError,
    showWelcomeHomeAtStartup,
    parseCurrentLayoutHash,
    applyParsedLayout,
    setIsLoaded,
    setTabs,
    setActiveTabId,
    finishFirstReaderReadyMeasureRef,
  });

  const {
    chapterRefs,
    chapterRefIndex,
    activeTab,
    modelLeafNeighbors,
    existingTabTargets,
    progressByTestament,
    readChapterCountByBook,
    readingContinuation,
    totalProgressPercent,
  } = useReaderDerivedState({
    books,
    tabs,
    activeTabId,
    readChapters,
  });

  const timelineContext = useTimelineReaderContext(activeTab, activePanelLeafId);

  const completionCelebrationProps = useCompletionCelebration({
    totalChapters: isCorpusLoaded ? progressByTestament.total.total : 0,
    readChapters: isCorpusLoaded ? progressByTestament.total.read : 0,
  });

  const {
    readerNotes,
    notesContext,
    setNotesContext,
    notesTabStateByLeafId,
    createGeneralNote,
    createContextNote,
    updateNote,
    deleteNote,
    importNotes,
    changeNotesTabState,
    initializeNotesTabState,
    swapNotesTabState,
    pruneNotesTabState,
  } = useReaderNotes({
    activeTab,
  });

  const {
    readerBookmarks,
    highlightModeEnabledByLeafId,
    selectedHighlightScope,
    setSelectedHighlightScope,
    upsertBookmark,
    updateBookmark,
    deleteBookmark,
    importBookmarks,
    toggleHighlightModeForLeaf,
    disableHighlightModeForLeaf,
    swapHighlightModeForLeaves,
    pruneHighlightModeForLeaves,
    createChapterBookmark,
  } = useReaderBookmarks({
    books,
  });
  const {
    importSummary,
    closeImportSummary,
    notesImportInputRef,
    bookmarksImportInputRef,
    exportNotes,
    exportBookmarks,
    requestNotesImport,
    requestBookmarksImport,
    handleImportNotesFile,
    handleImportBookmarksFile,
  } = usePanelTransfer({
    readerNotes,
    readerBookmarks,
    importNotes,
    importBookmarks,
  });
  const activeLeafIds = useMemo(
    () => new Set(tabs.flatMap((tab) => collectLeafIds(tab.root))),
    [tabs],
  );

  const notesHighlightScope = useMemo<BookmarkScope | null>(() => {
    if (selectedHighlightScope) {
      return selectedHighlightScope;
    }
    if (!activeTab) {
      return null;
    }

    for (const leafId of collectLeafIds(activeTab.root)) {
      const leaf = findLeafNode(activeTab.root, leafId);
      if (!leaf || leaf.view !== "reader") {
        continue;
      }
      const ranges = highlightedVerseRangesByLeafId[leafId] ?? [];
      if (ranges.length === 0) {
        continue;
      }
      if (ranges.length === 1) {
        const onlyRange = ranges[0];
        if (onlyRange.start === onlyRange.end) {
          return {
            type: "verse",
            bookIndex: leaf.bookIndex,
            chapterIndex: leaf.chapterIndex,
            verseNumber: onlyRange.start,
          };
        }
        return {
          type: "range",
          start: {
            bookIndex: leaf.bookIndex,
            chapterIndex: leaf.chapterIndex,
            verseNumber: onlyRange.start,
          },
          end: {
            bookIndex: leaf.bookIndex,
            chapterIndex: leaf.chapterIndex,
            verseNumber: onlyRange.end,
          },
        };
      }
      return {
        type: "selection",
        bookIndex: leaf.bookIndex,
        chapterIndex: leaf.chapterIndex,
        ranges,
      };
    }

    return null;
  }, [activeTab, highlightedVerseRangesByLeafId, selectedHighlightScope]);

  const sidebarAvailable = isStudyMode;

  const mapWebstersResult = useCallback(
    (key: string, entry: WebstersEntry) => ({ key, entry }),
    [],
  );
  const mapAIDictionaryResult = useCallback(
    (key: string, entry: AIDictionaryEntry) => ({ key, entry }),
    [],
  );
  const mapHitchcocksResult = useCallback(
    (key: string, definition: string) => ({ key, definition }),
    [],
  );

  useReaderLeafCleanup({
    activeLeafIds,
    pruneHighlightModeForLeaves,
    pruneLeafHighlights,
    pruneNotesTabState,
    pruneSearchPageState,
    setActiveReaderWordHighlight,
    setPendingReaderScrollTargets,
  });
  useEffect(() => {
    setStudyToolsSelectionCommands((current) =>
      filterRecordEntries(current, activeLeafIds),
    );
  }, [activeLeafIds]);
  const mapOldEnglishResult = useCallback(
    (key: string, definitions: string[]) => ({ key, definitions }),
    [],
  );
  const mapBibleWordBookResult = useCallback(
    (key: string, entry: BibleWordBookEntry) => ({ key, entry }),
    [],
  );
  const mapPhraseResult = useCallback(
    (key: string, entry: PhraseEntry) => ({ key, entry }),
    [],
  );
  const mapUnitsResult = useCallback(
    (key: string, entry: UnitsEntry) => ({ key, entry }),
    [],
  );

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
    resetTransientState: resetConcordanceTransientState,
  } = useConcordanceCrossRefsTool();

  const applyConcordanceSearch = useCallback(
    (rawValue?: string) => {
      setConcordanceWordAccordionValue([]);
      applyConcordanceSearchRaw(rawValue);
    },
    [applyConcordanceSearchRaw],
  );

  const concordanceWords = useMemo(
    () =>
      concordance
        ? Object.keys(concordance.words).sort((a, b) => a.localeCompare(b))
        : [],
    [concordance],
  );
  const {
    searchTerm: topicsSearchTerm,
    selectedLetters: topicsSelectedLetters,
    isLoading: isTopicsLoading,
    isSearching: isTopicsSearching,
    error: topicsError,
    results: topicsResults,
    availableLetters: topicsAvailableLetters,
    ensureTopicsLoaded,
    applySearch: applyTopicsSearch,
    selectLetter: selectTopicsLetter,
    clearLetters: clearTopicsLetters,
  } = useTopicsTool();

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
    resetTransientState: resetWebstersTransientState,
  } = useDictionarySearchTool<
    WebstersPayload,
    WebstersEntry,
    { key: string; entry: WebstersEntry }
  >({
    load: loadWebsters,
    errorMessage: "Failed to load Webster's data",
    mapResult: mapWebstersResult,
  });

  const applyWebstersSearch = useCallback(
    (rawValue?: string) => {
      setWebstersWordAccordionValue([]);
      applyWebstersSearchRaw(rawValue);
    },
    [applyWebstersSearchRaw],
  );

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
    getSearchStrings: (key, entry) => [
      key,
      ...(entry.aliases ?? []),
      ...entry.definitions,
      entry.note ?? "",
    ],
  });

  const applyAIDictionarySearch = useCallback(
    (rawValue?: string) => {
      setAIDictionaryWordAccordionValue([]);
      applyAIDictionarySearchRaw(rawValue);
    },
    [applyAIDictionarySearchRaw],
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

  const resolveAIDictionaryEntryTarget = useCallback(
    (rawValue: string) => {
      if (!aiDictionary) {
        return null;
      }
      return resolveAIDictionaryKey(aiDictionary, rawValue);
    },
    [aiDictionary],
  );

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
    resetTransientState: resetHitchcocksTransientState,
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
    resetTransientState: resetOldEnglishTransientState,
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
    resetTransientState: resetBibleWordBookTransientState,
  } = useDictionarySearchTool<
    BibleWordBookPayload,
    BibleWordBookEntry,
    { key: string; entry: BibleWordBookEntry }
  >({
    load: loadBibleWordBook,
    errorMessage: "Failed to load Bible Word-Book data",
    mapResult: mapBibleWordBookResult,
    getSearchStrings: (key, entry) => [
      key,
      ...(entry.aliases ?? []),
      entry.partOfSpeech ?? "",
      entry.partOfSpeechLabel ?? "",
      entry.meaning,
      entry.body,
      ...(entry.sourceReferences ?? []),
    ],
  });

  const applyBibleWordBookSearch = useCallback(
    (rawValue?: string) => {
      setBibleWordBookWordAccordionValue([]);
      applyBibleWordBookSearchRaw(rawValue);
    },
    [applyBibleWordBookSearchRaw],
  );

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
    getSearchStrings: (key, entry) => [key, ...(entry.aliases ?? [])],
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
    getSearchStrings: (key, entry) => [key, ...(entry.aliases ?? [])],
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
    resetTransientState: resetStrongsTransientState,
  } = useStrongsSearchTool();

  const applyStrongsSearch = useCallback(
    (rawValue?: string) => {
      setStrongsWordAccordionValue([]);
      applyStrongsSearchRaw(rawValue);
    },
    [applyStrongsSearchRaw],
  );

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
    resetTransientState: resetGenealogyTransientState,
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
    applyMapsSearch: applyMapsSearchRaw,
    resetTransientState: resetMapsTransientState,
  } = useMapsSearchTool();

  const applyMapsSearch = useCallback(
    (rawValue?: string) => {
      applyMapsSearchRaw(rawValue);
    },
    [applyMapsSearchRaw],
  );

  const resetStudyToolAccordions = useCallback(() => {
    setConcordanceAccordionValue([]);
    setWebstersWordAccordionValue([]);
    setBibleWordBookWordAccordionValue([]);
    setStrongsWordAccordionValue([]);
  }, [
    setConcordanceAccordionValue,
    setBibleWordBookWordAccordionValue,
    setStrongsWordAccordionValue,
    setWebstersWordAccordionValue,
  ]);

  const closeStudySidebar = useCallback(() => {
    setIsRightSidebarOpen(false);
  }, [setIsRightSidebarOpen]);

  useStudyModeLifecycle(isStudyMode, {
    closeSidebar: closeStudySidebar,
    resetAccordions: resetStudyToolAccordions,
    resetConcordance: resetConcordanceTransientState,
    resetWebsters: resetWebstersTransientState,
    resetHitchcocks: resetHitchcocksTransientState,
    resetBibleWordBook: resetBibleWordBookTransientState,
    resetOldEnglish: resetOldEnglishTransientState,
    resetGenealogy: resetGenealogyTransientState,
    resetStrongs: resetStrongsTransientState,
    resetMaps: resetMapsTransientState,
    resetMapDialog: resetMapDialogState,
  });

  const updateActiveTab = useCallback(
    (updater: (tab: ReaderTab) => ReaderTab) => {
      if (!activeTabId) {
        return;
      }

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTabId ? updater(tab) : tab,
        ),
      );
    },
    [activeTabId, setTabs],
  );

  const updateLeafLocation = useCallback((
    leafId: string,
    patch: Partial<
      Pick<
        LeafNode,
        | "bookIndex"
        | "chapterIndex"
        | "view"
        | "pickerTestament"
        | "pickerBookIndex"
        | "visualTool"
        | "pageId"
      >
    >,
  ) => {
    const shouldResetScroll =
      patch.bookIndex !== undefined || patch.chapterIndex !== undefined;

    if (shouldResetScroll) {
      clearLeafHighlights(leafId);
      setSelectedHighlightScope(null);
    }

    updateActiveTab((tab) => ({
      ...tab,
      root: updateLeafNode(tab.root, leafId, patch),
    }));

    if (!shouldResetScroll) {
      return;
    }

    // Wait for React to commit the chapter/book change before forcing scroll top.
    requestAnimationFrame(() => {
      const panelElement = panelElementRefs.current[leafId];
      const viewport = panelViewportElement(panelElement);
      if (viewport) {
        viewport.scrollTo({ top: 0, behavior: "auto" });
      }
    });
  }, [clearLeafHighlights, setSelectedHighlightScope, updateActiveTab]);

  const { leafHistoryByLeafId, navigateLeafHistory, swapLeafHistoryState } =
    useLeafHistory({
      tabs,
      applyHistoryEntry: (leafId, entry) => {
        updateLeafLocation(leafId, {
          view: entry.view,
          visualTool: entry.visualTool,
          bookIndex: entry.bookIndex,
          chapterIndex: entry.chapterIndex,
          pickerTestament: entry.pickerTestament,
          pickerBookIndex: entry.pickerBookIndex,
        });
        updateActiveTab((tab) => ({
          ...tab,
          root: updateLeafNode(tab.root, leafId, {
            pageId: entry.pageId,
          }),
        }));
      },
    });

  const {
    neighborsForLeaf,
    clearAllPanelPreviews,
    clearMovePreview,
    clearAddPreview,
    clearOrientationPreview,
    splitLeaf,
    setMovePreviewTarget,
    setAddPreviewTarget,
    setGroupInsertPreviewTarget,
    setAroundGroupPreviewTarget,
    setOrientationPreviewTarget,
    insertPanelInGroup,
    addAroundGroup,
    toggleParentGroupOrientation,
    moveLeaf,
    closeLeaf,
  } = usePanelInteractionController({
    activeRoot: activeTab?.root ?? null,
    modelLeafNeighbors,
    panelElementRefs,
    panelMenuOpenLeafId,
    setPanelMenuOpenLeafId,
    fullscreenLeafId,
    setFullscreenLeafId,
    fullscreenRequestedLeafIdRef,
    updateActiveTab,
    swapNotesTabState,
    swapSearchPageState,
    swapLeafHistoryState,
    swapHighlightModeForLeaves,
    swapLeafHighlights,
    setActiveReaderWordHighlight,
    setPendingReaderScrollTargets,
    setTargetedPanelLeafId,
  });

  usePendingReaderScroll({
    activeTabId,
    tabs,
    highlightedVerseRangesByLeafId,
    pendingReaderScrollTargets,
    setPendingReaderScrollTargets,
    panelElementRefs,
  });

  const {
    tabsRef,
    showTabById,
    moveLeafChapter,
    openChapterInNewTab,
    openSearchTab,
    openStaticPageTab,
    openStudyTool,
  } = useWorkspaceNavigation({
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeRoot: activeTab?.root ?? null,
    chapterRefs,
    chapterRefIndex,
    tabsOrientation,
    tabEndRef,
    initializeSearchPageState,
    readerNotes,
    notesContext,
    initializeNotesTabState,
    targetedPanelLeafIdRef,
    setTargetedPanelLeafId,
    wordVerseSelectionTargetRef,
    setIsRightSidebarOpen,
    setSidebarOpenRequestKey,
    showStudyTool,
    updateLeafLocation,
  });

  const shareLayout = useCallback(async () => {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      toast.success("Layout copied to clipboard.");
    } catch {
      toast.error("Unable to copy layout to clipboard.");
    }
  }, []);

  const {
    openReaderTarget,
    openBookmarkTarget,
    openSearchResultTarget,
    openChapterReference,
    runReferenceCommandAction,
  } = usePanelRouting({
    activeTabId,
    books,
    tabsRef,
    targetedPanelLeafIdRef,
    setTabs,
    setTargetedPanelLeafId,
    showTabById,
    clearLeafHighlights,
    setLeafHighlights,
    setSelectedHighlightScope,
    setPendingReaderScrollTargets,
    setActiveReaderWordHighlight,
    bookmarkOpenTarget,
    searchResultOpenTarget,
    referenceLinkOpenTarget,
  });

  const handleClearLeafHighlights = useCallback(
    (leafId: string) => {
      clearLeafHighlights(leafId);
      setSelectedHighlightScope(null);
    },
    [clearLeafHighlights, setSelectedHighlightScope],
  );

  function setAllBookChaptersRead(bookIndex: number, isRead: boolean) {
    const book = books[bookIndex];
    if (!book) {
      return;
    }
    setReadChapters((current) => {
      const next = new Set(current);
      for (
        let chapterIndex = 0;
        chapterIndex < book.chapters.length;
        chapterIndex += 1
      ) {
        const key = chapterProgressKey(bookIndex, chapterIndex);
        if (isRead) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  function setAllTestamentChaptersRead(
    testament: "old" | "new",
    isRead: boolean,
  ) {
    const startIndex = testament === "old" ? 0 : 39;
    const endIndex =
      testament === "old" ? Math.min(39, books.length) : books.length;

    setReadChapters((current) => {
      const next = new Set(current);
      for (let bookIndex = startIndex; bookIndex < endIndex; bookIndex += 1) {
        const book = books[bookIndex];
        if (!book) {
          continue;
        }
        for (
          let chapterIndex = 0;
          chapterIndex < book.chapters.length;
          chapterIndex += 1
        ) {
          const key = chapterProgressKey(bookIndex, chapterIndex);
          if (isRead) {
            next.add(key);
          } else {
            next.delete(key);
          }
        }
      }
      return next;
    });
  }

  function updateSplitSize(splitId: string, ratio: number) {
    updateActiveTab((tab) => ({
      ...tab,
      root: updateSplitRatio(tab.root, splitId, ratio),
    }));
  }

  function updateSplitGroupLayout(
    groupRootId: string,
    orientation: SplitOrientation,
    sizes: number[],
  ) {
    updateActiveTab((tab) => ({
      ...tab,
      root: updateSameOrientationGroupLayout(
        tab.root,
        groupRootId,
        orientation,
        sizes,
      ),
    }));
  }

  function toggleChapterRead(bookIndex: number, chapterIndex: number) {
    const key = chapterProgressKey(bookIndex, chapterIndex);
    setReadChapters((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function resetAllProgress() {
    setReadChapters(new Set());
    completionCelebrationProps.onOpenChange(false);
  }

  const {
    isRenameDialogOpen,
    renameValue,
    renameError,
    setIsRenameDialogOpen,
    moveLeafToNewTab,
    addTab,
    closeTab,
    moveTab,
    reorderTab,
    openRenameDialog,
    confirmRenameTab,
    moveLeafToExistingTab,
    onRenameValueChange,
    onRenameCancel,
  } = useTabActions({
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    tabsOrientation,
    tabEndRef,
    clearAllPanelPreviews,
  });

  const syncTokenAccordionState = useCallback(
    (rawWord: string, options: TokenAccordionOptions = {}) => {
      setConcordanceAccordionValue(
        deriveTokenAccordionState(rawWord, {
          ...options,
          concordanceData: options.concordanceData ?? concordance,
          webstersData: options.webstersData ?? websters,
          aiDictionaryData: options.aiDictionaryData ?? aiDictionary,
          bibleWordBookData: options.bibleWordBookData ?? bibleWordBook,
          hitchcocksData: options.hitchcocksData ?? hitchcocks,
          oldEnglishData: options.oldEnglishData ?? oldEnglish,
          unitsData: options.unitsData ?? units,
          genealogyData: options.genealogyData ?? genealogy,
          ancientMapsData: options.ancientMapsData ?? ancientMaps,
          strongsGreekData: options.strongsGreekData ?? strongsGreek,
          strongsHebrewData: options.strongsHebrewData ?? strongsHebrew,
        }),
      );
    },
    [
      ancientMaps,
      aiDictionary,
      bibleWordBook,
      concordance,
      genealogy,
      hitchcocks,
      oldEnglish,
      units,
      setConcordanceAccordionValue,
      strongsGreek,
      strongsHebrew,
      websters,
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

      const applySelection = (
        greek: StrongsPayload,
        hebrew: StrongsPayload,
      ) => {
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
        showStudyTool("strongs");
      };

      if (strongsGreek && strongsHebrew) {
        applySelection(strongsGreek, strongsHebrew);
        return;
      }

      setIsStrongsLoading(true);
      void ensureStrongsLoaded()
        .then(({ greek, hebrew }) => {
          applySelection(greek, hebrew);
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load Strong's data";
          setStrongsError(message);
          setSelectedStrongsEntries([]);
        })
        .finally(() => {
          setIsStrongsLoading(false);
        });
    },
    [
      ensureStrongsLoaded,
      showStudyTool,
      setIsStrongsLoading,
      setIsStrongsSearching,
      setSelectedStrongsEntries,
      setStrongsError,
      setStrongsSearchTerm,
      strongsGreek,
      strongsHebrew,
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
    onPanelWordSelection: queuePanelWordSelection,
    setNotesContext,
    setConcordanceAccordionValue,
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

  const {
    openCrossReferencesForVerse,
    openNoteLinkTarget,
    openTokenDetailsFromElement,
  } = useWordStudyNavigation({
    books,
    crossRefs,
    ensureCrossRefsLoaded,
    openStudyTool,
    onPanelVerseSelection: queuePanelVerseSelection,
    setCrossRefsError,
    setIsCrossRefsLoading,
    setSelectedCrossReferences,
    setNotesContext,
    openReaderTarget,
    notesLinkOpenTarget,
    setActiveReaderWordHighlight,
    syncTokenAccordionState,
    openWordInStudyTools,
    setTokenPopup,
  });

  const handleVerseSelection = useCallback(
    (
      leafId: string,
      bookIndex: number,
      chapterIndex: number,
      verseNumber: number,
    ) => {
      const highlightModeEnabled = Boolean(
        highlightModeEnabledByLeafId[leafId],
      );
      if (!highlightModeEnabled) {
        setActiveReaderWordHighlight(null);
        openCrossReferencesForVerse(
          bookIndex,
          chapterIndex,
          verseNumber,
          leafId,
        );
        return;
      }

      setActiveReaderWordHighlight(null);
      setNotesContext({ bookIndex, chapterIndex, verseNumber });
      const existingRanges = highlightedVerseRangesByLeafId[leafId] ?? [];
      const selectedVerses = new Set<number>();
      for (const range of existingRanges) {
        for (let current = range.start; current <= range.end; current += 1) {
          selectedVerses.add(current);
        }
      }

      const nextSelectedVerses = new Set(selectedVerses);
      if (nextSelectedVerses.has(verseNumber)) {
        nextSelectedVerses.delete(verseNumber);
      } else {
        nextSelectedVerses.add(verseNumber);
      }

      const nextRanges = Array.from(nextSelectedVerses)
        .sort((left, right) => left - right)
        .reduce<Array<{ start: number; end: number }>>((ranges, current) => {
          const previous = ranges[ranges.length - 1];
          if (!previous || current > previous.end + 1) {
            ranges.push({ start: current, end: current });
          } else {
            previous.end = current;
          }
          return ranges;
        }, []);

      setLeafHighlights(leafId, nextRanges);

      if (nextRanges.length === 1) {
        const onlyRange = nextRanges[0];
        if (onlyRange.start === onlyRange.end) {
          setSelectedHighlightScope({
            type: "verse",
            bookIndex,
            chapterIndex,
            verseNumber: onlyRange.start,
          });
        } else {
          setSelectedHighlightScope({
            type: "range",
            start: {
              bookIndex,
              chapterIndex,
              verseNumber: onlyRange.start,
            },
            end: {
              bookIndex,
              chapterIndex,
              verseNumber: onlyRange.end,
            },
          });
        }
      } else {
        setSelectedHighlightScope({
          type: "selection",
          bookIndex,
          chapterIndex,
          ranges: nextRanges,
        });
      }
    },
    [
      highlightedVerseRangesByLeafId,
      highlightModeEnabledByLeafId,
      openCrossReferencesForVerse,
      setActiveReaderWordHighlight,
      setLeafHighlights,
      setNotesContext,
      setSelectedHighlightScope,
    ],
  );

  const bookmarkLeafSelection = useCallback(
    (leafId: string) => {
      let matchedLeaf: LeafNode | null = null;
      for (const tab of tabs) {
        const leaf = findLeafNode(tab.root, leafId);
        if (leaf?.view === "reader") {
          matchedLeaf = leaf;
          break;
        }
      }

      if (!matchedLeaf) {
        return;
      }

      const ranges = highlightedVerseRangesByLeafId[leafId] ?? [];
      if (ranges.length === 0) {
        createChapterBookmark(matchedLeaf.bookIndex, matchedLeaf.chapterIndex);
        return;
      }

      if (ranges.length === 1) {
        const [range] = ranges;
        if (range.start === range.end) {
          upsertBookmark({
            type: "verse",
            bookIndex: matchedLeaf.bookIndex,
            chapterIndex: matchedLeaf.chapterIndex,
            verseNumber: range.start,
          });
          return;
        }
        upsertBookmark({
          type: "range",
          start: {
            bookIndex: matchedLeaf.bookIndex,
            chapterIndex: matchedLeaf.chapterIndex,
            verseNumber: range.start,
          },
          end: {
            bookIndex: matchedLeaf.bookIndex,
            chapterIndex: matchedLeaf.chapterIndex,
            verseNumber: range.end,
          },
        });
        return;
      }

      upsertBookmark({
        type: "selection",
        bookIndex: matchedLeaf.bookIndex,
        chapterIndex: matchedLeaf.chapterIndex,
        ranges,
      });
    },
    [
      createChapterBookmark,
      highlightedVerseRangesByLeafId,
      tabs,
      upsertBookmark,
    ],
  );

  const closeRightSidebarForMobile = useCallback(() => {
    setSidebarCloseRequestKey((current) => current + 1);
  }, []);


  const {
    openReference: openConcordanceReference,
    renderPreview: referencePreviewContent,
  } = useReferencePreview({
    books,
    openChapterReference,
    contextVerseCount,
  });

  const selectGenealogyPerson = useCallback(
    (personId: string) => {
      if (!personId) {
        return;
      }
      setGenealogySearchTerm("");
      setSelectedGenealogyIds([personId]);
      if (isGenealogyTreeOpen) {
        setGenealogyTreePersonId(personId);
      }
      showStudyTool("genealogy");
    },
    [
      isGenealogyTreeOpen,
      setGenealogySearchTerm,
      setGenealogyTreePersonId,
      setSelectedGenealogyIds,
      showStudyTool,
    ],
  );

  const openVisualTool = useCallback((request: VisualToolRequest) => {
    const destination = request.kind === "genealogy" ? genealogyOpenTarget : request.kind === "maps" ? mapsOpenTarget : timelineOpenTarget;
    const result = routeVisualTool(tabsRef.current, activeTabId, targetedPanelLeafIdRef.current, request, destination);
    if (!result) return false;
    clearLeafHighlights(result.leafId);
    setSelectedHighlightScope(null);
    setPendingReaderScrollTargets(current => current.filter(target => target.leafId !== result.leafId));
    setActiveReaderWordHighlight(current => current?.leafId === result.leafId ? null : current);
    tabsRef.current = result.tabs;
    setTabs(result.tabs);
    targetedPanelLeafIdRef.current = result.targetedLeafId;
    setTargetedPanelLeafId(result.targetedLeafId);
    showTabById(result.tabId);
    setActivePanelLeafId(result.leafId);
    setIsSidebarActive(false);
    closeRightSidebarForMobile();
    return true;
  }, [genealogyOpenTarget, mapsOpenTarget, timelineOpenTarget, tabsRef, activeTabId, targetedPanelLeafIdRef,
    clearLeafHighlights, setSelectedHighlightScope, setPendingReaderScrollTargets, setActiveReaderWordHighlight,
    setTabs, setTargetedPanelLeafId, showTabById, closeRightSidebarForMobile]);

  const navigateVisualTool = useCallback(async (request: VisualToolRequest, beforeOpen?: () => boolean) => {
    // Resolve IDs before dismissing the source so failed/offline loads are retryable.
    const mapEntry = request.kind === "maps"
      ? (await ensureAncientMapsLoaded()).find(entry => entry.geojson_file === request.geojsonFile) : null;
    if (request.kind === "maps" && !mapEntry) throw new Error("This map is no longer available.");
    if (request.kind === "genealogy") {
      const people = await ensureGenealogyLoaded();
      if (!people.some(person => person.id === request.personId)) throw new Error("This person is no longer available.");
    }
    if (beforeOpen && !beforeOpen()) return;
    if (openVisualTool(request)) return;
    if (request.kind === "maps" && mapEntry) openMapModal(mapEntry);
    if (request.kind === "genealogy") {
      setGenealogyTreePersonId(request.personId);
      setIsGenealogyTreeOpen(true);
    }
  }, [ensureAncientMapsLoaded, ensureGenealogyLoaded, openVisualTool, openMapModal, setGenealogyTreePersonId, setIsGenealogyTreeOpen]);

  const openMapDialog = useCallback((entry: AncientMapEntry) => {
    if (!openVisualTool({ kind: "maps", geojsonFile: entry.geojson_file })) openMapModal(entry);
  }, [openVisualTool, openMapModal]);

  const openGenealogyTree = useCallback((personId: string) => {
    if (!personId) {
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (openVisualTool({ kind: "genealogy", personId })) return;
    setGenealogyTreePersonId(personId);
    setIsGenealogyTreeOpen(true);
  }, [openVisualTool, setGenealogyTreePersonId, setIsGenealogyTreeOpen]);

  const renderGenealogyPersonDetails = useCallback(
    (person: GenealogyPerson) => (
      <GenealogyPersonDetails
        person={person}
        genealogyById={genealogyById}
        onSelectPerson={selectGenealogyPerson}
        onOpenTree={openGenealogyTree}
        renderReferencePreview={referencePreviewContent}
        onOpenReference={openConcordanceReference}
        onCloseSidebar={closeRightSidebarForMobile}
      />
    ),
    [
      closeRightSidebarForMobile,
      genealogyById,
      openGenealogyTree,
      openConcordanceReference,
      referencePreviewContent,
      selectGenealogyPerson,
    ],
  );

  const genealogyTreePerson = genealogyTreePersonId
    ? (genealogyById.get(genealogyTreePersonId) ?? null)
    : null;

  async function toggleFullscreenLeaf(leafId: string) {
    try {
      if (document.fullscreenElement) {
        if (fullscreenLeafId === leafId) {
          fullscreenRequestedLeafIdRef.current = null;
          setPanelMenuOpenLeafId(null);
          clearAllPanelPreviews();
          await document.exitFullscreen();
          return;
        }

        // Already in browser fullscreen: just switch the active fullscreen panel.
        fullscreenRequestedLeafIdRef.current = leafId;
        disableHighlightModeForLeaf(leafId);
        setFullscreenLeafId(leafId);
        setPanelMenuOpenLeafId(null);
        clearAllPanelPreviews();
        return;
      }

      fullscreenRequestedLeafIdRef.current = leafId;
      disableHighlightModeForLeaf(leafId);
      setFullscreenLeafId(leafId);
      setPanelMenuOpenLeafId(null);
      clearAllPanelPreviews();
      if (!document.documentElement.requestFullscreen) {
        setFullscreenLeafId(null);
        fullscreenRequestedLeafIdRef.current = null;
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Ignore fullscreen rejections (browser policy/user gesture edge cases).
      if (!document.fullscreenElement) {
        setFullscreenLeafId(null);
        fullscreenRequestedLeafIdRef.current = null;
      }
    }
  }

  const activeHighlightColor =
    theme === "dark" ? darkHighlightColor : lightHighlightColor;
  const highlightTextColor = useMemo(
    () => readableHighlightTextColor(activeHighlightColor),
    [activeHighlightColor],
  );
  const highlightCheckboxColor = useMemo(
    () => readableHighlightTextColor(highlightTextColor),
    [highlightTextColor],
  );

  const firstReaderTabId = useMemo(
    () =>
      tabs.find((tab) => panelNodeContainsView(tab.root, "reader"))?.id ?? null,
    [tabs],
  );
  const { startGuidedTour, guidedTourProps } = useGuidedTourController({
    firstReaderTabId,
    setActiveTabId,
  });

  useTopicsPreload({ tabs, studyWorkspaceTab, ensureTopicsLoaded });

  const {
    allStudyAccordionsOpen,
    sharedStudyToolsProps,
    onExpandAll: expandAllStudyTools,
    onCollapseAll: collapseAllStudyTools,
  } = useStudyToolsViewModel({
    summaryProps: { context: timelineContext, books, renderPreview: referencePreviewContent, onOpenReference: openConcordanceReference, onCloseSidebar: closeRightSidebarForMobile },
    timelineProps: { context: timelineContext, books, renderPreview: referencePreviewContent, onOpenReference: openConcordanceReference, onCloseSidebar: closeRightSidebarForMobile },
    accordionValue: concordanceAccordionValue,
    onAccordionValueChange: setConcordanceAccordionValue,
    infoCounts: {
      crossRefs: selectedCrossReferences?.references.length ?? 0,
      concordance: concordanceSearchResults.length,
      websters: webstersSearchResults.length,
      aiDictionary: aiDictionarySearchResults.length,
      strongs: strongsSearchResults.length,
      bibleWordBook: bibleWordBookSearchResults.length,
      kjvWordsPhrases:
        oldEnglishSearchResults.length +
        phrasesSearchResults.length +
        unitsSearchResults.length,
      maps: mapsSearchResults.filter(entry => !entry.selectionNote).length,
      hitchcocks: hitchcocksSearchResults.length,
      genealogy: genealogySearchResults.length,
    },
    crossRefsProps: {
      isLoading: isCrossRefsLoading,
      error: crossRefsError,
      selected: selectedCrossReferences,
      books,
      renderPreview: referencePreviewContent,
      onOpenReference: openConcordanceReference,
      onCloseSidebar: closeRightSidebarForMobile,
    },
    concordanceProps: {
      isLoading: isConcordanceLoading,
      isSearching: isConcordanceSearching,
      error: concordanceError,
      searchTerm: concordanceSearchTerm,
      results: concordanceSearchResults,
      wordAccordionValue: concordanceWordAccordionValue,
      onWordAccordionValueChange: setConcordanceWordAccordionValue,
      onSearch: applyConcordanceSearch,
      renderPreview: referencePreviewContent,
      onOpenReference: openConcordanceReference,
      onCloseSidebar: closeRightSidebarForMobile,
    },
    webstersProps: {
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
      renderPreview: referencePreviewContent,
      onOpenReference: openConcordanceReference,
      onCloseSidebar: closeRightSidebarForMobile,
    },
    kjvWordsPhrasesProps: {
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
      renderPreview: referencePreviewContent,
      onOpenReference: openConcordanceReference,
      onCloseSidebar: closeRightSidebarForMobile,
    },
    onOldEnglishSearch: applyOldEnglishSearch,
    onPhrasesSearch: applyPhrasesSearch,
    onUnitsSearch: applyUnitsSearch,
    bibleWordBookProps: {
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
      isLoading: isMapsLoading,
      isSearching: isMapsSearching,
      error: mapsError,
      searchTerm: mapsSearchTerm,
      resultsLength: mapsSearchResults.length,
      displayEntries: mapsDisplayEntries,
      onSearch: applyMapsSearch,
      onOpenMapDialog: openMapDialog,
      renderPreview: referencePreviewContent,
      onOpenReference: openConcordanceReference,
      onCloseSidebar: closeRightSidebarForMobile,
    },
    genealogyProps: {
      selectionNotice: personPlaceNotice,
      isLoading: isGenealogyLoading,
      isSearching: isGenealogySearching,
      error: genealogyError,
      searchTerm: genealogySearchTerm,
      results: genealogySearchResults,
      onSearch: applyGenealogySearch,
      renderPersonDetails: renderGenealogyPersonDetails,
    },
    hitchcocksProps: {
      isLoading: isHitchcocksLoading,
      isSearching: isHitchcocksSearching,
      error: hitchcocksError,
      searchTerm: hitchcocksSearchTerm,
      results: hitchcocksSearchResults,
      onSearch: applyHitchcocksSearch,
    },
  });

  const studyToolsPanelProps: StudyToolsPanelProps = {
    timelineContext,
    books,
    renderPreview: referencePreviewContent,
    onOpenReference: openConcordanceReference,
    onCloseSidebar: closeRightSidebarForMobile,
    onOpenMapDialog: openMapDialog,
    onSetNotesContext: setNotesContext,
  };
  const topicsPanelProps: TopicsPanelProps = {
    renderPreview: referencePreviewContent,
    onOpenReference: openConcordanceReference,
    onCloseSidebar: closeRightSidebarForMobile,
  };
  const topicsSidebarProps: TopicsContentProps = {
    isLoading: isTopicsLoading,
    isSearching: isTopicsSearching,
    error: topicsError,
    searchTerm: topicsSearchTerm,
    selectedLetters: topicsSelectedLetters,
    availableLetters: topicsAvailableLetters,
    results: topicsResults,
    onSearch: applyTopicsSearch,
    onSelectLetter: selectTopicsLetter,
    onClearLetters: clearTopicsLetters,
    renderPreview: referencePreviewContent,
    onOpenReference: openConcordanceReference,
    onCloseSidebar: closeRightSidebarForMobile,
  };

  const bookmarksPanelProps = useBookmarksViewModel({
    books,
    bookmarks: readerBookmarks,
    onOpenBookmark: openBookmarkTarget,
    onUpdateBookmark: updateBookmark,
    onDeleteBookmark: deleteBookmark,
  });

  const settingsPanelProps = useSettingsViewModel({
    activeTab: activeSettingsTab,
    onActiveTabChange: setActiveSettingsTab,
    theme,
    onThemeChange: setTheme,
    readerColorTheme,
    onReaderColorThemeChange: setReaderColorTheme,
    fontSize,
    setFontSize,
    lightHighlightColor,
    setLightHighlightColor,
    darkHighlightColor,
    setDarkHighlightColor,
    verseSpacing,
    onVerseSpacingChange: setVerseSpacing,
    contextVerseCount,
    onContextVerseCountChange: setContextVerseCount,
    toolReferenceDisplayMode,
    onToolReferenceDisplayModeChange: setToolReferenceDisplayMode,
    hideReadModeVerseNumbers,
    onHideReadModeVerseNumbersChange: setHideReadModeVerseNumbers,
    readModeParagraphIndent,
    onReadModeParagraphIndentChange: setReadModeParagraphIndent,
    flowVersesByParagraph,
    onFlowVersesByParagraphChange: setFlowVersesByParagraph,
    tabsOrientation,
    onTabsOrientationChange: setTabsOrientation,
    wordVerseSelectionTarget,
    onWordVerseSelectionTargetChange: setWordVerseSelectionTarget,
    notesLinkOpenTarget,
    onNotesLinkOpenTargetChange: setNotesLinkOpenTarget,
    searchResultOpenTarget,
    onSearchResultOpenTargetChange: setSearchResultOpenTarget,
    bookmarkOpenTarget,
    onBookmarkOpenTargetChange: setBookmarkOpenTarget,
    referenceLinkOpenTarget,
    genealogyOpenTarget,
    onGenealogyOpenTargetChange: setGenealogyOpenTarget,
    mapsOpenTarget,
    onMapsOpenTargetChange: setMapsOpenTarget,
    timelineOpenTarget,
    onTimelineOpenTargetChange: setTimelineOpenTarget,
    onReferenceLinkOpenTargetChange: setReferenceLinkOpenTarget,
    showWelcomeHomeAtStartup,
    onShowWelcomeHomeAtStartupChange: setShowWelcomeHomeAtStartup,
    shortcutBindings,
    onShortcutBindingChange: setShortcutBinding,
    onResetShortcutBinding: resetShortcutBinding,
    onResetAllShortcutBindings: resetAllShortcutBindings,
  });

  const progressPanelProps = useProgressViewModel({
    totalProgressPercent,
    progressByTestament,
    readingContinuation,
    isReadingProgressReady: isCorpusLoaded,
    onSetAllTestamentChaptersRead: setAllTestamentChaptersRead,
    onSetAllBookChaptersRead: setAllBookChaptersRead,
    onOpenChapterInNewTab: openChapterInNewTab,
    onContinueReading: openChapterInNewTab,
    onToggleChapterRead: toggleChapterRead,
    onResetAllProgress: resetAllProgress,
  });

  const notesSidebarProps = {
    books,
    notes: readerNotes,
    context: notesContext,
    selectedHighlightScope: notesHighlightScope,
    onCreateGeneralNote: createGeneralNote,
    onCreateContextNote: createContextNote,
    onUpdateNote: updateNote,
    onDeleteNote: deleteNote,
    onOpenNoteLink: openNoteLinkTarget,
    saveShortcut: shortcutBindings["general.saveNote"],
    shortcutsActive: isSidebarActive,
  };
  const searchSidebarProps = {
    books,
    concordanceWords,
    verseIndex: verseSearchIndex,
    isVerseIndexBuilding: isVerseSearchIndexBuilding,
    isVerseIndexReady: isVerseSearchIndexReady,
    verseIndexError: verseSearchIndexError,
    runSmartSearch: runSmartVerseSearch,
    runSearchResultAnalysis,
    ensureConcordanceWordsLoaded: ensureConcordanceLoaded,
    contextVerseCount,
    onOpenResult: openSearchResultTarget,
    autoFocusInput: isSidebarActive && studyWorkspaceTab === "search",
  };
  const activateSidebar = useCallback(() => setIsSidebarActive(true), []);
  const deactivateSidebar = useCallback(() => setIsSidebarActive(false), []);
  const leaveSidebar = useCallback(() => {
    setIsSidebarActive(false);
    closeRightSidebarForMobile();
  }, [closeRightSidebarForMobile]);
  const activateWorkspacePanel = useCallback((leafId: string) => {
    setIsSidebarActive(false);
    setActivePanelLeafId(leafId);
  }, []);

  const canGoLeafHistoryBack = useCallback(
    (leafId: string) => (leafHistoryByLeafId[leafId]?.index ?? 0) > 0,
    [leafHistoryByLeafId],
  );
  const canGoLeafHistoryForward = useCallback(
    (leafId: string) => {
      const history = leafHistoryByLeafId[leafId];
      return Boolean(
        history && history.index < history.entries.length - 1,
      );
    },
    [leafHistoryByLeafId],
  );
  const goLeafHistoryBack = useCallback(
    (leafId: string) => navigateLeafHistory(leafId, -1),
    [navigateLeafHistory],
  );
  const goLeafHistoryForward = useCallback(
    (leafId: string) => navigateLeafHistory(leafId, 1),
    [navigateLeafHistory],
  );

  const openShortcutSettings = useCallback(() => {
    setActiveSettingsTab("shortcuts");
    openStaticPageTab("settings");
  }, [openStaticPageTab]);

  const focusPanel = useCallback((leafId: string) => {
    setActivePanelLeafId(leafId);
    requestAnimationFrame(() => {
      panelElementRefs.current[leafId]?.focus({ preventScroll: true });
    });
  }, []);

  const shortcutPanelLeafId = useReaderShortcuts({
    bindings: shortcutBindings,
    tabs,
    activeTab,
    activeTabId,
    activePanelLeafId,
    setActiveTabId,
    onOpenReference: () => setIsReferenceCommandOpen(true),
    onOpenSearch: openSearchTab,
    sidebarAvailable,
    isSidebarOpen: isRightSidebarOpen,
    onSidebarOpenChange: setIsRightSidebarOpen,
    onOpenShortcutSettings: openShortcutSettings,
    onAddTab: addTab,
    onCloseTab: closeTab,
    onRenameTab: openRenameDialog,
    onMoveTab: moveTab,
    onMoveChapter: moveLeafChapter,
    onUpdateLeafLocation: updateLeafLocation,
    onSplitLeaf: splitLeaf,
    onCloseLeaf: closeLeaf,
    onToggleFullscreenLeaf: toggleFullscreenLeaf,
    canGoHistoryBack: canGoLeafHistoryBack,
    canGoHistoryForward: canGoLeafHistoryForward,
    onGoHistoryBack: goLeafHistoryBack,
    onGoHistoryForward: goLeafHistoryForward,
    onToggleGroupOrientation: toggleParentGroupOrientation,
    onOpenPanelMenu: setPanelMenuOpenLeafId,
    onMoveLeafToNewTab: moveLeafToNewTab,
    panelNeighborsForLeaf: neighborsForLeaf,
    onFocusPanel: focusPanel,
    onMoveLeaf: moveLeaf,
    onInsertPanelInGroup: insertPanelInGroup,
    onAddAroundGroup: addAroundGroup,
    onToggleHighlightMode: toggleHighlightModeForLeaf,
    onClearHighlights: handleClearLeafHighlights,
    onBookmarkChapter: createChapterBookmark,
    onBookmarkSelection: bookmarkLeafSelection,
    highlightedVerseRangesByLeafId,
  });

  if (!isLoaded) {
    return <ReaderStatusScreen message="Loading Bible data..." />;
  }

  if (loadError || !activeTab) {
    return (
      <ReaderStatusScreen
        message={
          loadError ?? "No Bible data available. Run npm run build:data."
        }
      />
    );
  }

  const tokenPopupCard = tokenPopup ? (
    <TokenPopupCard
      token={tokenPopup.token}
      x={tokenPopup.x}
      y={tokenPopup.y}
    />
  ) : null;

  const tabsStrip = (
    <TabsStrip
      tabs={tabs}
      activeTabId={activeTabId}
      tabsOrientation={tabsOrientation}
      tabEndRef={tabEndRef}
      onActivateTab={setActiveTabId}
      onOpenRenameDialog={openRenameDialog}
      onMoveTab={moveTab}
      onReorderTab={reorderTab}
      onCloseTab={closeTab}
      onAddTab={addTab}
    />
  );

  const mountedTabPanels = (
    <ReaderWorkspacePanels
      tabs={tabs}
      activeTabId={activeTabId}
      modelLeafNeighbors={modelLeafNeighbors}
      panelTreeProps={{
        books,
        chapterRefIndex,
        chapterRefCount: chapterRefs.length,
        readChapters,
        readChapterCountByBook,
        hideReadModeVerseNumbers,
        panelMenuOpenLeafId,
        setPanelMenuOpenLeafId,
        neighborsForLeaf,
        fullscreenLeafId,
        panelElementRefs,
        clearAllPanelPreviews,
        updateLeafLocation,
        toggleFullscreenLeaf,
        toggleParentGroupOrientation,
        setOrientationPreviewTarget,
        clearOrientationPreview,
        moveLeaf,
        setMovePreviewTarget,
        clearMovePreview,
        splitLeaf,
        setAddPreviewTarget,
        clearAddPreview,
        insertPanelInGroup,
        setGroupInsertPreviewTarget,
        addAroundGroup,
        setAroundGroupPreviewTarget,
        existingTabTargets,
        moveLeafToExistingTab,
        moveLeafToNewTab,
        closeLeaf,
        flowVersesByParagraph,
        readModeParagraphIndent,
        isStudyMode,
        fontSize,
        verseSpacing,
        onOpenTokenDetails: openTokenDetailsFromElement,
        onSelectVerse: handleVerseSelection,
        concordanceWords,
        verseSearchIndex,
        isVerseSearchIndexBuilding,
        isVerseSearchIndexReady,
        verseSearchIndexError,
        runSmartVerseSearch,
        runSearchResultAnalysis,
        ensureConcordanceWordsLoaded: ensureConcordanceLoaded,
        onOpenSearchResult: openSearchResultTarget,
        notes: readerNotes,
        notesContext,
        activeReaderWordHighlight,
        notesTabStateByLeafId,
        onChangeNotesTabState: changeNotesTabState,
        searchPageStateByLeafId,
        contextVerseCount,
        onChangeSearchPageState: changeSearchPageState,
        onCreateGeneralNote: createGeneralNote,
        onCreateContextNote: createContextNote,
        onUpdateNote: updateNote,
        onDeleteNote: deleteNote,
        onOpenNoteLink: openNoteLinkTarget,
        selectedHighlightScope: notesHighlightScope,
        showTargetedPanelToggle,
        targetedPanelLeafId,
        onToggleTargetedPanel: toggleTargetedPanel,
        canGoLeafHistoryBack,
        canGoLeafHistoryForward,
        onGoLeafHistoryBack: goLeafHistoryBack,
        onGoLeafHistoryForward: goLeafHistoryForward,
        moveLeafChapter,
        toggleChapterRead,
        updateSplitSize,
        updateSplitGroupLayout,
        highlightModeEnabledByLeafId,
        highlightedVerseRangesByLeafId,
        onClearLeafHighlights: handleClearLeafHighlights,
        onToggleHighlightMode: toggleHighlightModeForLeaf,
        onBookmarkLeafSelection: bookmarkLeafSelection,
        studyToolsPanelProps,
        studyToolsSelectionCommandsByLeafId,
        topicsPanelProps,
        bookmarksPanelProps,
        settingsPanelProps,
        progressPanelProps,
        canInstallPwa,
        isPwaInstalled,
        onInstallPwa: installPwa,
        onExportNotes: exportNotes,
        onExportBookmarks: exportBookmarks,
        renderReferencePreview: referencePreviewContent,
        onOpenReference: openConcordanceReference,
        onCloseSidebar: closeRightSidebarForMobile,
        onStartTour: startGuidedTour,
        onOpenSearchTab: openSearchTab,
        onOpenStaticPageTab: openStaticPageTab,
        activePanelLeafId: isSidebarActive ? null : shortcutPanelLeafId,
        onActivePanelChange: activateWorkspacePanel,
      }}
    />
  );
  return (
    <VisualToolNavigateContext.Provider value={navigateVisualTool}>
    <VisualToolTargetContext.Provider value={openVisualTool}>
    <ToolReferenceDisplayModeProvider
      mode={toolReferenceDisplayMode}
      books={books}
    >
      <div
        className="reader-shell h-screen w-full overflow-hidden bg-background"
        style={
          {
            "--verse-highlight-bg": activeHighlightColor,
            "--verse-highlight-fg": highlightTextColor,
            "--verse-highlight-checkbox-fg": highlightCheckboxColor,
          } as React.CSSProperties
        }
      >
      <SidebarProvider
        open={sidebarAvailable ? isRightSidebarOpen : false}
        onOpenChange={(open) => {
          if (!sidebarAvailable) {
            return;
          }
          setIsRightSidebarOpen(open);
        }}
        style={
          {
            "--sidebar-width": "24rem",
            "--sidebar-width-mobile": "var(--reader-sidebar-width-mobile)",
          } as React.CSSProperties
        }
      >
        <SidebarActivitySync enabled={sidebarAvailable} onDeactivate={deactivateSidebar} />
        <SidebarOpenRequestSync
          requestKey={sidebarOpenRequestKey}
          enabled={sidebarAvailable}
        />
        <SidebarCloseRequestSync
          requestKey={sidebarCloseRequestKey}
          enabled={sidebarAvailable}
        />
        <SidebarInset className="flex h-screen min-h-0 flex-col overflow-hidden">
          <ReaderTopBar
            isStudyMode={isStudyMode}
            showSidebarToggle={sidebarAvailable}
            onStudyModeChange={setIsStudyMode}
            onOpenReferenceCommand={() => setIsReferenceCommandOpen(true)}
            onOpenSearch={openSearchTab}
            onShareLayout={shareLayout}
            onOpenProgress={() => openStaticPageTab("progress")}
            onOpenSettings={() => openStaticPageTab("settings")}
            onOpenPage={openStaticPageTab}
            onExportNotes={exportNotes}
            onImportNotes={requestNotesImport}
            onExportBookmarks={exportBookmarks}
            onImportBookmarks={requestBookmarksImport}
          />
          <PwaUpdateNotice
            onOpenDetails={() => openStaticPageTab("download")}
          />
          <ReferenceCommandDialog
            books={books}
            open={isReferenceCommandOpen}
            onOpenChange={setIsReferenceCommandOpen}
            onRunAction={runReferenceCommandAction}
          />
          <ReaderImportControls
            importSummary={importSummary}
            notesImportInputRef={notesImportInputRef}
            bookmarksImportInputRef={bookmarksImportInputRef}
            onImportNotesFile={handleImportNotesFile}
            onImportBookmarksFile={handleImportBookmarksFile}
            onCloseImportSummary={closeImportSummary}
          />

          <TabsWorkspace
            tabsOrientation={tabsOrientation}
            tabsStrip={tabsStrip}
          readerContent={
              <div className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
                {mountedTabPanels}
              </div>
            }
          />
          <GuidedTour {...guidedTourProps} />
        </SidebarInset>

        {sidebarAvailable ? (
          // Reserve the responsive sidebar gap while its content loads. Without
          // it, a late import can move panel controls during the first click.
          <Suspense fallback={
            <div data-tour="sidebar">
              <Sidebar side="right">
                <p role="status" className="p-3 text-sm text-muted-foreground">Loading sidebar…</p>
              </Sidebar>
            </div>
          }>
            <LazyReaderStudySidebar
              visible={sidebarAvailable}
              activeTab={studyWorkspaceTab}
              accordionValue={concordanceAccordionValue}
              onAccordionValueChange={setConcordanceAccordionValue}
              onActiveTabChange={setStudyWorkspaceTab}
              onActivate={activateSidebar}
              onNavigateAway={leaveSidebar}
              onExpandAll={expandAllStudyTools}
              onCollapseAll={collapseAllStudyTools}
              canExpand={!allStudyAccordionsOpen}
              canCollapse={concordanceAccordionValue.length > 0}
              {...sharedStudyToolsProps}
              topicsProps={topicsSidebarProps}
              notesProps={notesSidebarProps}
              searchProps={searchSidebarProps}
              progressProps={progressPanelProps}
              bookmarksProps={bookmarksPanelProps}
            />
          </Suspense>
        ) : null}
      </SidebarProvider>

      <Toaster theme={theme} />

      {tokenPopupCard}

      {isMapDialogOpen ? (
        <Suspense fallback={null}>
          <LazyMapAndPhotoDialogs
            isMapDialogOpen={isMapDialogOpen}
            activeMapDialogEntry={activeMapDialogEntry}
            isMapDialogLoading={isMapDialogLoading}
            mapDialogError={mapDialogError}
            mapDialogGeoJson={mapDialogGeoJson}
            onMapDialogOpenChange={onMapDialogOpenChange}
            onCloseMapDialog={onCloseMapDialog}
            onOpenMap={openMapModal}
            onOpenReference={(reference) => {
              onCloseMapDialog();
              openConcordanceReference(reference);
            }}
            renderReferencePreview={referencePreviewContent}
          />
        </Suspense>
      ) : null}

      {isRenameDialogOpen ? (
        <Suspense fallback={null}>
          <LazyRenameTabDialog
            open={isRenameDialogOpen}
            value={renameValue}
            error={renameError}
            onOpenChange={setIsRenameDialogOpen}
            onValueChange={onRenameValueChange}
            onCancel={onRenameCancel}
            onConfirm={confirmRenameTab}
          />
        </Suspense>
      ) : null}

      <CompletionCelebration {...completionCelebrationProps} />

      {isGenealogyTreeOpen ? (
        <Suspense fallback={null}>
          <LazyGenealogyTreeDialog
            open={isGenealogyTreeOpen}
            person={genealogyTreePerson}
            genealogyById={genealogyById}
            renderReferencePreview={referencePreviewContent}
            onOpenReference={openConcordanceReference}
            onCloseSidebar={closeRightSidebarForMobile}
            onOpenChange={(open) => {
              setIsGenealogyTreeOpen(open);
              if (!open) {
                setGenealogyTreePersonId(null);
              }
            }}
            onSelectPerson={(personId) => {
              selectGenealogyPerson(personId);
              setGenealogyTreePersonId(personId);
            }}
          />
        </Suspense>
      ) : null}
      </div>
    </ToolReferenceDisplayModeProvider>
    </VisualToolTargetContext.Provider>
    </VisualToolNavigateContext.Provider>
  );
}
