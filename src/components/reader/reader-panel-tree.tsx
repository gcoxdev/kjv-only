import { ReaderErrorBoundary } from "@/components/reader/reader-error-boundary";
import { chapterLabel } from "@/lib/bible-books";
import { VISUAL_TOOL_TITLES } from "@/lib/visual-tool-routing";
import { HistoryIcon, MapIcon, NetworkIcon } from "lucide-react";
import { ReaderControlTooltip } from "@/components/reader/reader-control-tooltip";
import {
  Fragment,
  lazy,
  memo,
  Suspense,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AudioLinesIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronLeftCircleIcon,
  ChevronRightCircleIcon,
  BookmarkIcon,
  BookMarkedIcon,
  BookOpenCheckIcon,
  BookOpenIcon,
  HouseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookTextIcon,
  CrosshairIcon,
  EraserIcon,
  EllipsisVerticalIcon,
  ExpandIcon,
  ExternalLinkIcon,
  HighlighterIcon,
  LocateFixedIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  NotebookPenIcon,
  RotateCwIcon,
  SearchIcon,
  SplitSquareHorizontalIcon,
  SplitSquareVerticalIcon,
  SquareChevronDownIcon,
  SquareChevronLeftIcon,
  SquareChevronRightIcon,
  SquareChevronUpIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  ToolboxIcon,
  XIcon,
} from "lucide-react";

import { type Book, type Chapter, type VerseToken } from "@/types/bible";
import type {
  LeafNode,
  PanelDirection,
  PanelNode,
  SearchPageState,
  StaticPageId,
  StudyToolsSelectionCommand,
} from "@/types/reader";
import { cn } from "@/lib/utils";
import { countLeaves, findParentSplitForLeaf } from "@/lib/reader-layout";
import {
  bookCodeForIndex,
  chapterProgressKey,
  iconPath,
  panelViewportElement,
} from "@/lib/reader-view";
import type { VerseSearchIndexEntry } from "@/lib/search";
import type {
  RunSearchResultAnalysis,
  RunSmartVerseSearch,
} from "@/lib/smart-search-worker";
import type { BookmarkScope } from "@/types/bookmarks";
import { BookChapterPicker } from "@/components/reader/book-chapter-picker";
import { PanelHome } from "@/components/reader/panel-home";
import { StaticPage } from "@/components/reader/static-page";
import type { SettingsPanelContentProps } from "@/components/reader/settings-dialog";
import type { ProgressPanelContentProps } from "@/components/reader/progress-dialog";
import type { StudyToolsPanelProps } from "@/components/reader/study-tools-panel";
import type { TopicsPanelProps } from "@/components/reader/study-tools/topics-tool";
import { getStaticPage } from "@/lib/static-pages";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChapterTextContent } from "@/components/reader/chapter-text-content";
import type { BookmarksToolProps } from "@/components/reader/study-tools/bookmarks-tool";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { LeafNeighbors } from "@/lib/reader-neighbors";
import type {
  NoteLinkTarget,
  NotesContext,
  NotesTabState,
  ReaderNote,
} from "@/types/notes";
import { loadSearchPage } from "@/lib/search-page-loader";

type ExistingTabTarget = {
  id: string;
  index: number;
  title: string;
};

const LazySearchPage = lazy(async () => {
  const module = await loadSearchPage();
  return { default: module.SearchPage };
});

const LazyNotesPage = lazy(async () => {
  const module = await import("@/components/reader/notes-page");
  return { default: module.NotesPage };
});

const LazyStudyToolsPanel = lazy(async () => {
  const module = await import("@/components/reader/study-tools-panel");
  return { default: module.StudyToolsPanel };
});

const LazyTopicsPanel = lazy(async () => {
  const module = await import("@/components/reader/study-tools/topics-tool");
  return { default: module.TopicsPanel };
});

const LazyBookmarksTool = lazy(async () => {
  const module = await import("@/components/reader/study-tools/bookmarks-tool");
  return { default: module.BookmarksTool };
});

const LazyVisualToolPanel = lazy(() => import("@/components/reader/visual-tool-panel"));

const LazySettingsPanelContent = lazy(async () => {
  const module = await import("@/components/reader/settings-dialog");
  return { default: module.SettingsPanelContent };
});

const LazyProgressPanelContent = lazy(async () => {
  const module = await import("@/components/reader/progress-dialog");
  return { default: module.ProgressPanelContent };
});

const AUXILIARY_PANEL_FALLBACK = (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    Loading panel...
  </div>
);

const AUDIO_PLAYBACK_RATE_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.25;
  return {
    value,
    label: `${value.toFixed(2)}x`,
  };
});

type LeafLocationPatch = Partial<
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
>;

export type ReaderPanelTreeProps = {
  root: PanelNode;
  books: Book[];
  activeRoot: PanelNode | null;
  chapterRefIndex: Map<string, number>;
  chapterRefCount: number;
  readChapters: Set<string>;
  readChapterCountByBook: Map<number, number>;
  hideReadModeVerseNumbers: boolean;
  panelMenuOpenLeafId: string | null;
  setPanelMenuOpenLeafId: (leafId: string | null) => void;
  modelLeafNeighbors: Map<string, LeafNeighbors>;
  neighborsForLeaf: (leafId: string) => LeafNeighbors;
  fullscreenLeafId: string | null;
  panelElementRefs: RefObject<Record<string, HTMLDivElement | null>>;
  clearAllPanelPreviews: () => void;
  updateLeafLocation: (leafId: string, patch: LeafLocationPatch) => void;
  toggleFullscreenLeaf: (leafId: string) => Promise<void>;
  toggleParentGroupOrientation: (leafId: string) => void;
  setOrientationPreviewTarget: (leafId: string) => void;
  clearOrientationPreview: () => void;
  moveLeaf: (leafId: string, direction: PanelDirection) => void;
  setMovePreviewTarget: (leafId: string, direction: PanelDirection) => void;
  clearMovePreview: () => void;
  splitLeaf: (leafId: string, direction: PanelDirection) => void;
  setAddPreviewTarget: (leafId: string, direction: PanelDirection) => void;
  clearAddPreview: () => void;
  insertPanelInGroup: (leafId: string, direction: PanelDirection) => void;
  setGroupInsertPreviewTarget: (
    leafId: string,
    direction: PanelDirection,
  ) => void;
  addAroundGroup: (leafId: string, direction: PanelDirection) => void;
  setAroundGroupPreviewTarget: (
    leafId: string,
    direction: PanelDirection,
  ) => void;
  existingTabTargets: ExistingTabTarget[];
  moveLeafToExistingTab: (leafId: string, targetTabId: string) => void;
  moveLeafToNewTab: (leafId: string) => void;
  closeLeaf: (leafId: string) => void;
  flowVersesByParagraph: boolean;
  readModeParagraphIndent: boolean;
  isStudyMode: boolean;
  fontSize: number;
  verseSpacing: number;
  onOpenTokenDetails: (
    element: HTMLElement,
    leafId: string,
    token: VerseToken,
    bookIndex: number,
    chapterIndex: number,
    verseNumber: number,
    tokenIndex: number,
  ) => void;
  onSelectVerse: (
    leafId: string,
    bookIndex: number,
    chapterIndex: number,
    verseNumber: number,
  ) => void;
  concordanceWords: string[];
  verseSearchIndex: VerseSearchIndexEntry[];
  isVerseSearchIndexBuilding: boolean;
  isVerseSearchIndexReady: boolean;
  verseSearchIndexError: string | null;
  runSmartVerseSearch: RunSmartVerseSearch;
  runSearchResultAnalysis: RunSearchResultAnalysis;
  ensureConcordanceWordsLoaded: () => Promise<unknown>;
  onOpenSearchResult: (
    bookIndex: number,
    chapterIndex: number,
    verseStart: number,
    verseEnd?: number,
  ) => void;
  notes: ReaderNote[];
  notesContext: NotesContext | null;
  activeReaderWordHighlight: {
    leafId: string;
    verseNumber: number;
    word: string;
  } | null;
  notesTabStateByLeafId: Record<string, NotesTabState>;
  onChangeNotesTabState: (
    leafId: string,
    patch: Partial<NotesTabState>,
  ) => void;
  onCreateGeneralNote: () => string;
  onCreateContextNote: (context: NotesContext | null) => string | null;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<ReaderNote, "title" | "body" | "scope" | "folder" | "tags">>,
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onOpenNoteLink: (target: NoteLinkTarget) => void;
  selectedHighlightScope: BookmarkScope | null;
  showTargetedPanelToggle: boolean;
  targetedPanelLeafId: string | null;
  onToggleTargetedPanel: (leafId: string) => void;
  canGoLeafHistoryBack: (leafId: string) => boolean;
  canGoLeafHistoryForward: (leafId: string) => boolean;
  onGoLeafHistoryBack: (leafId: string) => void;
  onGoLeafHistoryForward: (leafId: string) => void;
  moveLeafChapter: (leafId: string, step: -1 | 1) => void;
  toggleChapterRead: (bookIndex: number, chapterIndex: number) => void;
  updateSplitSize: (splitId: string, ratio: number) => void;
  updateSplitGroupLayout: (
    groupRootId: string,
    orientation: "horizontal" | "vertical",
    sizes: number[],
  ) => void;
  highlightModeEnabledByLeafId: Record<string, boolean>;
  highlightedVerseRangesByLeafId: Record<
    string,
    Array<{ start: number; end: number }>
  >;
  searchPageStateByLeafId: Record<string, SearchPageState>;
  contextVerseCount: number;
  onChangeSearchPageState: (
    leafId: string,
    patch: Partial<SearchPageState>,
  ) => void;
  onClearLeafHighlights: (leafId: string) => void;
  onToggleHighlightMode: (leafId: string) => void;
  onBookmarkLeafSelection: (leafId: string) => void;
  studyToolsPanelProps: StudyToolsPanelProps;
  studyToolsSelectionCommandsByLeafId: Record<
    string,
    StudyToolsSelectionCommand
  >;
  topicsPanelProps: TopicsPanelProps;
  bookmarksPanelProps: BookmarksToolProps;
  settingsPanelProps: SettingsPanelContentProps;
  progressPanelProps: ProgressPanelContentProps;
  canInstallPwa: boolean;
  isPwaInstalled: boolean;
  onInstallPwa: () => void | Promise<void>;
  onExportNotes: () => void;
  onExportBookmarks: () => void;
  renderReferencePreview: (reference: string, highlightWord: string) => ReactNode;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
  onStartTour: () => void;
  onOpenSearchTab: () => void;
  onOpenStaticPageTab: (pageId: StaticPageId) => void;
  activePanelLeafId: string | null;
  onActivePanelChange: (leafId: string) => void;
};

type ReaderLeafPanelProps = Omit<ReaderPanelTreeProps, "root"> & {
  leaf: LeafNode;
};

function formatAudioTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const ReaderLeafPanel = memo(function ReaderLeafPanel({
  leaf,
  books,
  activeRoot,
  chapterRefIndex,
  chapterRefCount,
  readChapters,
  readChapterCountByBook,
  hideReadModeVerseNumbers,
  panelMenuOpenLeafId,
  setPanelMenuOpenLeafId,
  modelLeafNeighbors,
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
  onOpenTokenDetails,
  onSelectVerse,
  concordanceWords,
  verseSearchIndex,
  isVerseSearchIndexBuilding,
  isVerseSearchIndexReady,
  verseSearchIndexError,
  runSmartVerseSearch,
  runSearchResultAnalysis,
  ensureConcordanceWordsLoaded,
  onOpenSearchResult,
  notes,
  notesContext,
  activeReaderWordHighlight,
  notesTabStateByLeafId,
  onChangeNotesTabState,
  searchPageStateByLeafId,
  contextVerseCount,
  onChangeSearchPageState,
  onCreateGeneralNote,
  onCreateContextNote,
  onUpdateNote,
  onDeleteNote,
  onOpenNoteLink,
  selectedHighlightScope,
  showTargetedPanelToggle,
  targetedPanelLeafId,
  onToggleTargetedPanel,
  canGoLeafHistoryBack,
  canGoLeafHistoryForward,
  onGoLeafHistoryBack,
  onGoLeafHistoryForward,
  moveLeafChapter,
  toggleChapterRead,
  highlightModeEnabledByLeafId,
  highlightedVerseRangesByLeafId,
  onClearLeafHighlights,
  onToggleHighlightMode,
  onBookmarkLeafSelection,
  studyToolsPanelProps,
  studyToolsSelectionCommandsByLeafId,
  topicsPanelProps,
  bookmarksPanelProps,
  settingsPanelProps,
  progressPanelProps,
  canInstallPwa,
  isPwaInstalled,
  onInstallPwa,
  onExportNotes,
  onExportBookmarks,
  renderReferencePreview,
  onOpenReference,
  onCloseSidebar,
  onStartTour,
  onOpenSearchTab,
  onOpenStaticPageTab,
  activePanelLeafId,
  onActivePanelChange,
}: ReaderLeafPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const lastAudioSrcRef = useRef("");
  const [readingProgress, setReadingProgress] = useState(0);
  const [audioVisible, setAudioVisible] = useState(false);
  const [audioAutoPlay, setAudioAutoPlay] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioErrored, setAudioErrored] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeOpacity, setSwipeOpacity] = useState(1);
  const [swipeTransitionEnabled, setSwipeTransitionEnabled] = useState(false);
  const swipeGestureRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    lock: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const swipeAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = panelViewportElement(panelRef.current);
    if (!viewport) {
      setReadingProgress(0);
      return;
    }

    let rafId: number | null = null;
    const calculateProgress = () => {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const next = maxScroll <= 0 ? 0 : Math.round((viewport.scrollTop / maxScroll) * 100);
      setReadingProgress(next);
    };
    const onScroll = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(calculateProgress);
    };

    calculateProgress();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [leaf.id, leaf.bookIndex, leaf.chapterIndex]);

  useEffect(() => {
    return () => {
      if (swipeAnimationTimeoutRef.current !== null) {
        window.clearTimeout(swipeAnimationTimeoutRef.current);
      }
    };
  }, []);

  const book = books[leaf.bookIndex] ?? null;
  const chapter: Chapter | null = book?.chapters[leaf.chapterIndex] ?? null;
  const key = `${leaf.bookIndex}-${leaf.chapterIndex}`;
  const chapterReadKey = chapterProgressKey(leaf.bookIndex, leaf.chapterIndex);
  const isChapterRead = readChapters.has(chapterReadKey);
  const readChapterCount = readChapterCountByBook.get(leaf.bookIndex) ?? 0;
  const isBookComplete = book ? readChapterCount === book.chapters.length : false;
  const currentBookIconCode = bookCodeForIndex(leaf.bookIndex);
  const currentBookIconSrc = iconPath(
    isBookComplete ? "color" : "bw",
    currentBookIconCode,
  );
  const showVerseNumbers = !hideReadModeVerseNumbers;
  const isPanelMenuOpen = panelMenuOpenLeafId === leaf.id;
  const neighbors = isPanelMenuOpen
    ? (modelLeafNeighbors.get(leaf.id) ?? neighborsForLeaf(leaf.id))
    : {};
  const moveDirections = isPanelMenuOpen
    ? (["left", "right", "up", "down"] as PanelDirection[]).filter(
        (direction) => Boolean(neighbors[direction]),
      )
    : [];
  const parentSplit =
    isPanelMenuOpen && activeRoot
      ? findParentSplitForLeaf(activeRoot, leaf.id)
      : null;
  const isSingleHomePanel =
    leaf.view === "picker" && activeRoot ? countLeaves(activeRoot) <= 1 : false;
  const groupTargets = parentSplit
    ? parentSplit.orientation === "horizontal"
      ? { left: true, right: true, up: false, down: false }
      : { left: false, right: false, up: true, down: true }
    : { left: false, right: false, up: false, down: false };
  const aroundGroupTargets = parentSplit
    ? parentSplit.orientation === "horizontal"
      ? { left: false, right: false, up: true, down: true }
      : { left: true, right: true, up: false, down: false }
    : { left: false, right: false, up: false, down: false };
  const nextOrientationLabel = parentSplit
    ? parentSplit.orientation === "horizontal"
      ? "Make Group Vertical"
      : "Make Group Horizontal"
    : null;
  const hasGroupAddOptions = Boolean(
    groupTargets.left ||
      groupTargets.right ||
      groupTargets.up ||
      groupTargets.down ||
      aroundGroupTargets.left ||
      aroundGroupTargets.right ||
      aroundGroupTargets.up ||
      aroundGroupTargets.down,
  );
  const refIndex = chapterRefIndex.get(key) ?? -1;
  const hasPrev = refIndex > 0;
  const hasNext = refIndex >= 0 && refIndex < chapterRefCount - 1;
  const audioSrc = chapter
    ? `/audio/${bookCodeForIndex(leaf.bookIndex)}.${chapter.chapter}.mp3`
    : null;
  const effectiveVolume = audioMuted ? 0 : audioVolume;
  const isFullscreenLeaf = fullscreenLeafId === leaf.id;
  const hasHighlightInLeaf =
    (highlightedVerseRangesByLeafId[leaf.id]?.length ?? 0) > 0;
  const highlightModeEnabled = Boolean(highlightModeEnabledByLeafId[leaf.id]);
  const canGoPrevChapter = hasPrev;
  const canGoNextChapter = hasNext;
  const swipeContainerStyle = useMemo(
    () => ({
      transform: swipeOffset === 0 ? undefined : `translateX(${swipeOffset}px)`,
      opacity: swipeOpacity,
      transition: swipeTransitionEnabled
        ? "transform 220ms ease, opacity 220ms ease"
        : undefined,
      touchAction: "pan-y",
    }),
    [swipeOffset, swipeOpacity, swipeTransitionEnabled],
  );

  const completeSwipeNavigation = (step: -1 | 1) => {
    const panelWidth = panelRef.current?.clientWidth ?? 0;
    const exitOffset =
      step === 1 ? -Math.max(panelWidth, 240) : Math.max(panelWidth, 240);

    setSwipeTransitionEnabled(true);
    setSwipeOffset(exitOffset);
    setSwipeOpacity(0.84);

    if (swipeAnimationTimeoutRef.current !== null) {
      window.clearTimeout(swipeAnimationTimeoutRef.current);
    }

    swipeAnimationTimeoutRef.current = window.setTimeout(() => {
      moveLeafChapter(leaf.id, step);
      const enterOffset = -exitOffset;
      setSwipeTransitionEnabled(false);
      setSwipeOffset(enterOffset);
      setSwipeOpacity(0.84);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSwipeTransitionEnabled(true);
          setSwipeOffset(0);
          setSwipeOpacity(1);
        });
      });

      swipeAnimationTimeoutRef.current = window.setTimeout(() => {
        setSwipeTransitionEnabled(false);
        setSwipeOpacity(1);
        swipeAnimationTimeoutRef.current = null;
      }, 220);
    }, 220);
  };

  const handleReaderTouchStart = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (leaf.view !== "reader" || !chapter || isStudyMode) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    swipeGestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: true,
      lock: "pending",
    };
    setSwipeTransitionEnabled(false);
  };

  const handleReaderTouchMove = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    const gesture = swipeGestureRef.current;
    if (!gesture || !gesture.active || isStudyMode) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    if (gesture.lock === "pending") {
      if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
        return;
      }
      gesture.lock =
        Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (gesture.lock !== "horizontal") {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const constrainedOffset =
      (deltaX < 0 && !canGoNextChapter) || (deltaX > 0 && !canGoPrevChapter)
        ? deltaX * 0.2
        : deltaX * 0.65;

    setSwipeOffset(constrainedOffset);
    setSwipeOpacity(Math.max(0.76, 1 - Math.abs(constrainedOffset) / 900));
  };

  const finishReaderSwipe = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    const gesture = swipeGestureRef.current;
    if (!gesture || !gesture.active || isStudyMode) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    swipeGestureRef.current = null;

    if (gesture.lock !== "horizontal") {
      setSwipeTransitionEnabled(false);
      setSwipeOffset(0);
      setSwipeOpacity(1);
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const width = panelRef.current?.clientWidth ?? 0;
    const threshold = Math.min(140, Math.max(64, width * 0.18));

    if (deltaX <= -threshold && canGoNextChapter) {
      completeSwipeNavigation(1);
      return;
    }

    if (deltaX >= threshold && canGoPrevChapter) {
      completeSwipeNavigation(-1);
      return;
    }

    setSwipeTransitionEnabled(true);
    setSwipeOffset(0);
    setSwipeOpacity(1);
    swipeAnimationTimeoutRef.current = window.setTimeout(() => {
      setSwipeTransitionEnabled(false);
      swipeAnimationTimeoutRef.current = null;
    }, 220);
  };

  const closePanelMenu = () => {
    setPanelMenuOpenLeafId(null);
    clearAllPanelPreviews();
  };

  const openBookPickerPanelHome = () => {
    const isReaderContext = leaf.view === "reader";
    const isOldTestament = leaf.bookIndex < 39;
    updateLeafLocation(leaf.id, {
      view: "picker",
      pickerTestament:
        leaf.pickerTestament ??
        (isReaderContext ? (isOldTestament ? "old" : "new") : null),
      pickerBookIndex:
        leaf.pickerBookIndex ?? (isReaderContext ? leaf.bookIndex : null),
    });
  };

  const visualToolTitle = leaf.visualTool ? VISUAL_TOOL_TITLES[leaf.visualTool.kind] : "Tool";
  const VisualToolIcon = leaf.visualTool?.kind === "genealogy" ? NetworkIcon : leaf.visualTool?.kind === "maps" ? MapIcon : HistoryIcon;
  const panelHeaderIcon =
    leaf.view === "visual-tool" ? (
      <VisualToolIcon className="size-4 shrink-0 text-muted-foreground" />
    ) :
    leaf.view === "picker" ? (
      <HouseIcon className="size-4 shrink-0 text-muted-foreground" />
    ) : leaf.view === "tools" ? (
      <ToolboxIcon className="size-4 shrink-0 text-muted-foreground" />
    ) : leaf.view === "topics" ? (
      <BookTextIcon className="size-4 shrink-0 text-muted-foreground" />
    ) : leaf.view === "notes" ? (
      <NotebookPenIcon className="size-4 shrink-0 text-muted-foreground" />
    ) : leaf.view === "bookmarks" ? (
      <BookMarkedIcon className="size-4 shrink-0 text-muted-foreground" />
    ) : leaf.view === "search" ? (
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
    ) : leaf.view === "page" ? (
      (() => {
        const PageIcon = getStaticPage(leaf.pageId)?.icon;
        return PageIcon ? (
          <PageIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
        );
      })()
    ) : null;
  const isActivePanel = activePanelLeafId === leaf.id;
  const isTargetedPanel = targetedPanelLeafId === leaf.id;
  const canHistoryBack = canGoLeafHistoryBack(leaf.id);
  const canHistoryForward = canGoLeafHistoryForward(leaf.id);
  const panelAccessibleName =
    leaf.view === "reader"
      ? chapterLabel(book?.name ?? "Bible", chapter?.chapter ?? leaf.chapterIndex + 1)
      : leaf.view === "visual-tool" ? visualToolTitle
      : leaf.view === "picker"
        ? "Panel Home"
        : leaf.view === "page"
          ? (getStaticPage(leaf.pageId)?.title ?? "Page")
          : leaf.view.charAt(0).toUpperCase() + leaf.view.slice(1);

  return (
    <div
      data-panel-leaf-id={leaf.id}
      data-active-panel={isActivePanel ? "true" : undefined}
      role="region"
      aria-label={`${panelAccessibleName} panel`}
      tabIndex={-1}
      onPointerDownCapture={() => onActivePanelChange(leaf.id)}
      onFocusCapture={() => onActivePanelChange(leaf.id)}
      ref={(element) => {
        panelRef.current = element;
        panelElementRefs.current[leaf.id] = element;
      }}
      className={cn(
        "h-full w-full min-w-0 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isFullscreenLeaf && "fixed inset-0 z-40 h-screen w-screen",
      )}
    >
      <Card
        className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-none py-0"
        data-tour={leaf.view === "reader" ? "reader-panel" : undefined}
      >
        <CardHeader
          data-active-panel-header={isActivePanel ? "true" : undefined}
          className={cn(
            "border-b p-2! transition-colors",
            isActivePanel &&
              "border-primary! bg-primary/18! [&>div>p]:text-foreground! [&>div>svg]:text-foreground!",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            {showTargetedPanelToggle ? (
              <Button
                type="button"
                variant={isTargetedPanel ? "default" : "outline"}
                size="icon-sm"
                className={cn(
                  "shrink-0",
                  !isTargetedPanel && "text-muted-foreground",
                )}
                onClick={() => onToggleTargetedPanel(leaf.id)}
                aria-label={
                  isTargetedPanel ? "Clear targeted panel" : "Target this panel"
                }
              >
                {isTargetedPanel ? <LocateFixedIcon /> : <CrosshairIcon />}
              </Button>
            ) : null}
            {leaf.view === "reader" && chapter ? (
              <>
                <img
                  src={currentBookIconSrc}
                  alt={`${book?.name ?? "Book"} icon`}
                  className="size-6 shrink-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-auto max-w-full justify-start px-2"
                  onClick={openBookPickerPanelHome}
                >
                  {chapterLabel(book?.name ?? "Book", chapter.chapter)}
                </Button>
              </>
            ) : panelHeaderIcon ? (
              <>
                {panelHeaderIcon}
                {leaf.view === "visual-tool" ? (
                  <p className="text-sm text-muted-foreground">{visualToolTitle}</p>
                ) : leaf.view === "picker" ? (
                  <p className="text-sm text-muted-foreground">Panel Home</p>
                ) : leaf.view === "search" ? (
                  <p className="text-sm text-muted-foreground">Search</p>
                ) : leaf.view === "topics" ? (
                  <p className="text-sm text-muted-foreground">Topics</p>
                ) : leaf.view === "notes" ? (
                  <p className="text-sm text-muted-foreground">Notes</p>
                ) : leaf.view === "tools" ? (
                  <p className="text-sm text-muted-foreground">Tools</p>
                ) : leaf.view === "bookmarks" ? (
                  <p className="text-sm text-muted-foreground">Bookmarks</p>
                ) : leaf.view === "page" ? (
                  <p className="text-sm text-muted-foreground">
                    {getStaticPage(leaf.pageId)?.title ?? "Page"}
                  </p>
                ) : null}
              </>
            ) : leaf.view === "visual-tool" ? (
              <p className="text-sm text-muted-foreground">{visualToolTitle}</p>
            ) : leaf.view === "search" ? (
              <p className="text-sm text-muted-foreground">Search</p>
            ) : leaf.view === "topics" ? (
              <p className="text-sm text-muted-foreground">Topics</p>
            ) : leaf.view === "notes" ? (
              <p className="text-sm text-muted-foreground">Notes</p>
            ) : leaf.view === "tools" ? (
              <p className="text-sm text-muted-foreground">Tools</p>
            ) : leaf.view === "bookmarks" ? (
              <p className="text-sm text-muted-foreground">Bookmarks</p>
            ) : leaf.view === "page" ? (
              <p className="text-sm text-muted-foreground">
                {getStaticPage(leaf.pageId)?.title ?? "Page"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a book and chapter
              </p>
            )}

            <DropdownMenu
              open={isPanelMenuOpen}
              onOpenChange={(open) => {
                if (open) {
                  setPanelMenuOpenLeafId(leaf.id);
                  return;
                }
                if (panelMenuOpenLeafId === leaf.id) {
                  setPanelMenuOpenLeafId(null);
                }
                clearAllPanelPreviews();
              }}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label="Panel options"
                    data-tour={leaf.view === "reader" ? "panel-menu" : undefined}
                  />
                }
              >
                <EllipsisVerticalIcon data-icon="inline-start" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    closePanelMenu();
                    void toggleFullscreenLeaf(leaf.id);
                  }}
                >
                  {isFullscreenLeaf ? <MinimizeIcon /> : <ExpandIcon />}
                  {isFullscreenLeaf ? "Exit Full Screen" : "Full Screen"}
                </DropdownMenuItem>
                {leaf.view !== "picker" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        openBookPickerPanelHome();
                        closePanelMenu();
                      }}
                    >
                      <HouseIcon />
                      Home
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem
                  disabled={!canHistoryBack}
                  onClick={() => {
                    onGoLeafHistoryBack(leaf.id);
                    closePanelMenu();
                  }}
                >
                  <ChevronLeftCircleIcon />
                  Back
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canHistoryForward}
                  onClick={() => {
                    onGoLeafHistoryForward(leaf.id);
                    closePanelMenu();
                  }}
                >
                  <ChevronRightCircleIcon />
                  Forward
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {leaf.view === "reader" && !isFullscreenLeaf ? (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => {
                          onToggleHighlightMode(leaf.id);
                          closePanelMenu();
                        }}
                      >
                        <HighlighterIcon />
                        {highlightModeEnabled
                          ? "Turn Highlight Mode Off"
                          : "Turn Highlight Mode On"}
                      </DropdownMenuItem>
                      {hasHighlightInLeaf ? (
                        <DropdownMenuItem
                          onClick={() => {
                            onClearLeafHighlights(leaf.id);
                            closePanelMenu();
                          }}
                        >
                          <EraserIcon />
                          Clear Highlights
                        </DropdownMenuItem>
                      ) : null}
                      {hasHighlightInLeaf ? (
                        <DropdownMenuItem
                          onClick={() => {
                            onBookmarkLeafSelection(leaf.id);
                            closePanelMenu();
                          }}
                        >
                          <BookmarkIcon />
                          Bookmark Highlighted
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onClick={() => {
                          onBookmarkLeafSelection(leaf.id);
                          closePanelMenu();
                        }}
                      >
                        <BookMarkedIcon />
                        Bookmark Chapter
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                ) : null}
                {!isFullscreenLeaf ? (
                  <>
                    {parentSplit ? (
                      <DropdownMenuItem
                        onClick={() => toggleParentGroupOrientation(leaf.id)}
                        onPointerEnter={() => setOrientationPreviewTarget(leaf.id)}
                        onPointerLeave={() => clearOrientationPreview()}
                      >
                        <RotateCwIcon />
                        {nextOrientationLabel}
                      </DropdownMenuItem>
                    ) : null}
                    {leaf.view === "reader" || parentSplit || moveDirections.length > 0 ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {moveDirections.length > 0 ? (
                      <>
                        <DropdownMenuGroup>
                          {moveDirections.includes("left") ? (
                            <DropdownMenuItem
                              onClick={() => moveLeaf(leaf.id, "left")}
                              onPointerEnter={() =>
                                setMovePreviewTarget(leaf.id, "left")
                              }
                              onPointerLeave={() => clearMovePreview()}
                            >
                              <ArrowLeftIcon />
                              Move Left
                            </DropdownMenuItem>
                          ) : null}
                          {moveDirections.includes("right") ? (
                            <DropdownMenuItem
                              onClick={() => moveLeaf(leaf.id, "right")}
                              onPointerEnter={() =>
                                setMovePreviewTarget(leaf.id, "right")
                              }
                              onPointerLeave={() => clearMovePreview()}
                            >
                              <ArrowRightIcon />
                              Move Right
                            </DropdownMenuItem>
                          ) : null}
                          {moveDirections.includes("up") ? (
                            <DropdownMenuItem
                              onClick={() => moveLeaf(leaf.id, "up")}
                              onPointerEnter={() =>
                                setMovePreviewTarget(leaf.id, "up")
                              }
                              onPointerLeave={() => clearMovePreview()}
                            >
                              <ArrowUpIcon />
                              Move Up
                            </DropdownMenuItem>
                          ) : null}
                          {moveDirections.includes("down") ? (
                            <DropdownMenuItem
                              onClick={() => moveLeaf(leaf.id, "down")}
                              onPointerEnter={() =>
                                setMovePreviewTarget(leaf.id, "down")
                              }
                              onPointerLeave={() => clearMovePreview()}
                            >
                              <ArrowDownIcon />
                              Move Down
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Split Panel</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => splitLeaf(leaf.id, "left")}
                        onPointerEnter={() => setAddPreviewTarget(leaf.id, "left")}
                        onPointerLeave={() => clearAddPreview()}
                      >
                        <SplitSquareHorizontalIcon />
                        Split Left
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => splitLeaf(leaf.id, "right")}
                        onPointerEnter={() => setAddPreviewTarget(leaf.id, "right")}
                        onPointerLeave={() => clearAddPreview()}
                      >
                        <SplitSquareHorizontalIcon className="rotate-180" />
                        Split Right
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => splitLeaf(leaf.id, "up")}
                        onPointerEnter={() => setAddPreviewTarget(leaf.id, "up")}
                        onPointerLeave={() => clearAddPreview()}
                      >
                        <SplitSquareVerticalIcon />
                        Split Above
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => splitLeaf(leaf.id, "down")}
                        onPointerEnter={() => setAddPreviewTarget(leaf.id, "down")}
                        onPointerLeave={() => clearAddPreview()}
                      >
                        <SplitSquareVerticalIcon className="rotate-180" />
                        Split Below
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {hasGroupAddOptions ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Insert In Group</DropdownMenuLabel>
                          {groupTargets.left ? (
                            <DropdownMenuItem
                              onClick={() => insertPanelInGroup(leaf.id, "left")}
                              onPointerEnter={() =>
                                setGroupInsertPreviewTarget(leaf.id, "left")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronLeftIcon />
                              Add Left
                            </DropdownMenuItem>
                          ) : null}
                          {groupTargets.right ? (
                            <DropdownMenuItem
                              onClick={() => insertPanelInGroup(leaf.id, "right")}
                              onPointerEnter={() =>
                                setGroupInsertPreviewTarget(leaf.id, "right")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronRightIcon />
                              Add Right
                            </DropdownMenuItem>
                          ) : null}
                          {groupTargets.up ? (
                            <DropdownMenuItem
                              onClick={() => insertPanelInGroup(leaf.id, "up")}
                              onPointerEnter={() =>
                                setGroupInsertPreviewTarget(leaf.id, "up")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronUpIcon />
                              Add Above
                            </DropdownMenuItem>
                          ) : null}
                          {groupTargets.down ? (
                            <DropdownMenuItem
                              onClick={() => insertPanelInGroup(leaf.id, "down")}
                              onPointerEnter={() =>
                                setGroupInsertPreviewTarget(leaf.id, "down")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronDownIcon />
                              Add Below
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Add Around Group</DropdownMenuLabel>
                          {aroundGroupTargets.left ? (
                            <DropdownMenuItem
                              onClick={() => addAroundGroup(leaf.id, "left")}
                              onPointerEnter={() =>
                                setAroundGroupPreviewTarget(leaf.id, "left")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronLeftIcon />
                              Add Left
                            </DropdownMenuItem>
                          ) : null}
                          {aroundGroupTargets.right ? (
                            <DropdownMenuItem
                              onClick={() => addAroundGroup(leaf.id, "right")}
                              onPointerEnter={() =>
                                setAroundGroupPreviewTarget(leaf.id, "right")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronRightIcon />
                              Add Right
                            </DropdownMenuItem>
                          ) : null}
                          {aroundGroupTargets.up ? (
                            <DropdownMenuItem
                              onClick={() => addAroundGroup(leaf.id, "up")}
                              onPointerEnter={() =>
                                setAroundGroupPreviewTarget(leaf.id, "up")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronUpIcon />
                              Add Above
                            </DropdownMenuItem>
                          ) : null}
                          {aroundGroupTargets.down ? (
                            <DropdownMenuItem
                              onClick={() => addAroundGroup(leaf.id, "down")}
                              onPointerEnter={() =>
                                setAroundGroupPreviewTarget(leaf.id, "down")
                              }
                              onPointerLeave={() => clearAddPreview()}
                            >
                              <SquareChevronDownIcon />
                              Add Below
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    {existingTabTargets.length > 0 ? (
                      <>
                        <DropdownMenuGroup>
                          {existingTabTargets.map((targetTab) => (
                            <DropdownMenuItem
                              key={`move-panel-${leaf.id}-${targetTab.id}`}
                              onClick={() =>
                                moveLeafToExistingTab(leaf.id, targetTab.id)
                              }
                            >
                              <ExternalLinkIcon />
                              {`Move to Tab ${targetTab.index + 1}) ${targetTab.title}`}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem onClick={() => moveLeafToNewTab(leaf.id)}>
                      <ExternalLinkIcon />
                      Move to New Tab
                    </DropdownMenuItem>
                    {!isSingleHomePanel ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => closeLeaf(leaf.id)}>
                          <XIcon />
                          Close Panel
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {leaf.view === "reader" && chapter ? (
          <>
            <CardContent className="min-h-0 flex-1 p-0">
              <div
                className={cn(
                  "h-full w-full",
                  !isStudyMode && "select-none touch-pan-y",
                )}
                style={swipeContainerStyle}
                onTouchStartCapture={handleReaderTouchStart}
                onTouchMoveCapture={handleReaderTouchMove}
                onTouchEndCapture={finishReaderSwipe}
                onTouchCancelCapture={finishReaderSwipe}
              >
                <ScrollArea className="h-full w-full" data-panel-content-scroll>
                  <div
                    data-reader-chapter-root
                    data-book-index={leaf.bookIndex}
                    data-chapter-index={leaf.chapterIndex}
                  >
                    <ChapterTextContent
                      bookName={book.name}
                      chapterNumber={chapter.chapter}
                      verses={chapter.verses}
                      flowVersesByParagraph={flowVersesByParagraph}
                      readModeParagraphIndent={readModeParagraphIndent}
                      showVerseNumbers={showVerseNumbers}
                      isStudyMode={isStudyMode}
                      enableVerseSelection={isStudyMode || highlightModeEnabled}
                      highlightModeEnabled={highlightModeEnabled}
                      highlightedVerseRanges={
                        highlightedVerseRangesByLeafId[leaf.id] ?? null
                      }
                      noteWordHighlight={
                        activeReaderWordHighlight?.leafId === leaf.id
                          ? {
                              verseNumber: activeReaderWordHighlight.verseNumber,
                              word: activeReaderWordHighlight.word,
                            }
                          : null
                      }
                      fontSize={fontSize}
                      verseSpacing={verseSpacing}
                      onOpenTokenDetails={(element, token, verseNumber, tokenIndex) =>
                        onOpenTokenDetails(
                          element,
                          leaf.id,
                          token,
                          leaf.bookIndex,
                          leaf.chapterIndex,
                          verseNumber,
                          tokenIndex,
                        )
                      }
                      onSelectVerse={(verseNumber) =>
                        onSelectVerse(
                          leaf.id,
                          leaf.bookIndex,
                          leaf.chapterIndex,
                          verseNumber,
                        )
                      }
                    />
                  </div>
                </ScrollArea>
              </div>
            </CardContent>

            <div className="border-t">
              <Progress
                value={readingProgress}
                className="w-full"
                aria-label={`Reading progress for ${chapterLabel(book?.name ?? "Book", chapter.chapter)}`}
              />
              {audioVisible ? (
                <div className="flex flex-col gap-2 border-b p-2">
                  {audioSrc ? (
                    <>
                      <audio
                        ref={audioRef}
                        src={audioSrc}
                        preload="metadata"
                        muted={audioMuted}
                        onPlay={() => {
                          setAudioPlaying(true);
                        }}
                        onPause={() => {
                          setAudioPlaying(false);
                        }}
                        onTimeUpdate={(event) => {
                          setAudioCurrentTime(event.currentTarget.currentTime);
                        }}
                        onLoadedMetadata={(event) => {
                          const element = event.currentTarget;
                          const previousSrc = lastAudioSrcRef.current;
                          const isSameTrack = previousSrc === audioSrc;
                          lastAudioSrcRef.current = audioSrc ?? "";
                          element.playbackRate = audioPlaybackRate;
                          element.volume = audioVolume;
                          if (isSameTrack) {
                            if (audioCurrentTime > 0) {
                              element.currentTime = audioCurrentTime;
                            }
                          } else {
                            element.currentTime = 0;
                            setAudioCurrentTime(0);
                            setAudioPlaying(false);
                          }
                          setAudioDuration(Number.isFinite(element.duration) ? element.duration : 0);
                          setAudioErrored(false);
                          if (pendingAutoPlayRef.current) {
                            pendingAutoPlayRef.current = false;
                            void element.play().catch(() => {});
                          }
                        }}
                        onEnded={() => {
                          setAudioPlaying(false);
                          if (audioAutoPlay && hasNext) {
                            pendingAutoPlayRef.current = true;
                            moveLeafChapter(leaf.id, 1);
                          }
                        }}
                        onError={() => {
                          setAudioErrored(true);
                        }}
                        className="hidden"
                      />
                      <div className="@container/audio">
                        <div className="flex flex-col gap-2 @md/audio:flex-row @md/audio:items-center">
                          <div className="flex w-full min-w-0 items-center gap-2 @md/audio:w-1/2 @lg/audio:w-7/12">
                            <ReaderControlTooltip label={audioPlaying ? "Pause audio" : "Play audio"}>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => {
                                  const audio = audioRef.current;
                                  if (!audio) {
                                    return;
                                  }
                                  if (audio.paused) {
                                    void audio.play().catch(() => {});
                                  } else {
                                    audio.pause();
                                  }
                                }}
                                aria-label={audioPlaying ? "Pause audio" : "Play audio"}
                              >
                                {audioPlaying ? <PauseIcon /> : <PlayIcon />}
                              </Button>
                            </ReaderControlTooltip>
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="w-16 shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                {formatAudioTime(audioCurrentTime)}/{formatAudioTime(audioDuration)}
                              </span>
                              <Slider
                                className="flex-1"
                                min={0}
                                max={audioDuration || 1}
                                value={[Math.min(audioCurrentTime, audioDuration || 0)]}
                                onValueChange={(value) => {
                                  const nextTime = Array.isArray(value) ? (value[0] ?? 0) : value;
                                  const audio = audioRef.current;
                                  if (!audio) {
                                    return;
                                  }
                                  audio.currentTime = nextTime;
                                  setAudioCurrentTime(nextTime);
                                }}
                                aria-label="Seek chapter audio"
                              />
                            </div>
                          </div>

                          <div className="flex w-full min-w-0 items-center gap-1.5 @md/audio:w-1/2 @md/audio:justify-start @lg/audio:w-5/12 @lg/audio:justify-end">
                            <Select
                              value={`${audioPlaybackRate.toFixed(2)}x`}
                              onValueChange={(value) => {
                                if (!value) {
                                  return;
                                }
                                const nextRate = Number.parseFloat(value);
                                if (!Number.isFinite(nextRate)) {
                                  return;
                                }
                                setAudioPlaybackRate(nextRate);
                                const audio = audioRef.current;
                                if (audio) {
                                  audio.playbackRate = nextRate;
                                }
                              }}
                            >
                              <ReaderControlTooltip label="Audio playback speed">
                                <SelectTrigger aria-label="Audio playback speed" size="sm" className="h-7 w-20 shrink-0 px-2 text-xs tabular-nums">
                                  <SelectValue />
                                </SelectTrigger>
                              </ReaderControlTooltip>
                              <SelectContent className="w-max min-w-0">
                                <SelectGroup>
                                  {AUDIO_PLAYBACK_RATE_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.label}
                                      className="pr-8"
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <ReaderControlTooltip label={audioMuted ? "Unmute audio" : "Mute audio"}>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => {
                                    const nextMuted = !audioMuted;
                                    setAudioMuted(nextMuted);
                                    const audio = audioRef.current;
                                    if (audio) {
                                      audio.muted = nextMuted;
                                    }
                                  }}
                                  aria-label={audioMuted ? "Unmute audio" : "Mute audio"}
                                >
                                  {effectiveVolume <= 0 ? (
                                    <VolumeXIcon />
                                  ) : effectiveVolume < 0.5 ? (
                                    <Volume1Icon />
                                  ) : (
                                    <Volume2Icon />
                                  )}
                                </Button>
                              </ReaderControlTooltip>
                              <div className="min-w-14 flex-1">
                                <Slider
                                  className="w-full"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={[audioVolume]}
                                  onValueChange={(value) => {
                                    const nextVolume = Array.isArray(value) ? (value[0] ?? 0) : value;
                                    setAudioVolume(nextVolume);
                                    const audio = audioRef.current;
                                    if (audio) {
                                      audio.volume = nextVolume;
                                    }
                                  }}
                                  aria-label="Audio volume"
                                />
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[11px] whitespace-nowrap text-muted-foreground">Auto</span>
                              <ReaderControlTooltip label="Automatically play the next chapter">
                                <Switch
                                  checked={audioAutoPlay}
                                  onCheckedChange={(checked) => {
                                    setAudioAutoPlay(checked === true);
                                  }}
                                  size="sm"
                                  aria-label="Toggle auto-play next chapter"
                                />
                              </ReaderControlTooltip>
                            </div>
                          </div>
                        </div>
                      </div>
                      {audioErrored ? (
                        <p className="text-xs text-muted-foreground">
                          Audio unavailable for this chapter.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Audio unavailable for this chapter.
                    </p>
                  )}
                </div>
              ) : null}
              <div
                className="@container/toolbar flex items-center justify-between p-2"
                data-tour="panel-bottom-bar"
              >
                <ReaderControlTooltip label={audioVisible ? "Hide audio" : "Show audio"}>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={audioVisible ? "Hide audio" : "Show audio"}
                    onClick={() =>
                      setAudioVisible((current) => {
                        const nextVisible = !current;
                        if (!nextVisible) {
                          const audio = audioRef.current;
                          if (audio) {
                            audio.pause();
                            setAudioCurrentTime(audio.currentTime);
                          }
                          setAudioPlaying(false);
                        }
                        return nextVisible;
                      })
                    }
                  >
                    <AudioLinesIcon />
                    <span className="hidden @md/toolbar:inline">
                      {audioVisible ? "Hide Audio" : "Show Audio"}
                    </span>
                  </Button>
                </ReaderControlTooltip>
                <div className="flex items-center gap-2">
                  <ReaderControlTooltip label={isChapterRead ? "Mark chapter unread" : "Mark chapter read"}>
                    <Button
                      variant={isChapterRead ? "default" : "outline"}
                      size="sm"
                      aria-label={isChapterRead ? "Read: mark chapter unread" : "Mark Read: mark chapter read"}
                      onClick={() =>
                        toggleChapterRead(leaf.bookIndex, leaf.chapterIndex)
                      }
                    >
                      {isChapterRead ? <BookOpenCheckIcon /> : <BookOpenIcon />}
                      <span className="hidden @md/toolbar:inline">
                        {isChapterRead ? "Read" : "Mark Read"}
                      </span>
                    </Button>
                  </ReaderControlTooltip>
                  <ReaderControlTooltip label="Previous chapter" disabled={!hasPrev}>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Previous chapter"
                      onClick={() => moveLeafChapter(leaf.id, -1)}
                      disabled={!hasPrev}
                    >
                      <ChevronLeftIcon />
                      <span className="hidden @md/toolbar:inline">Previous</span>
                    </Button>
                  </ReaderControlTooltip>
                  <ReaderControlTooltip label="Next chapter" disabled={!hasNext}>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Next chapter"
                      onClick={() => moveLeafChapter(leaf.id, 1)}
                      disabled={!hasNext}
                    >
                      <ChevronRightIcon />
                      <span className="hidden @md/toolbar:inline">Next</span>
                    </Button>
                  </ReaderControlTooltip>
                </div>
              </div>
            </div>
          </>
        ) : leaf.view === "search" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading search...
                </div>
              }
            >
              <LazySearchPage
                autoFocusInput={isActivePanel}
                books={books}
                concordanceWords={concordanceWords}
                verseIndex={verseSearchIndex}
                isVerseIndexBuilding={isVerseSearchIndexBuilding}
                isVerseIndexReady={isVerseSearchIndexReady}
                verseIndexError={verseSearchIndexError}
                runSmartSearch={runSmartVerseSearch}
                runSearchResultAnalysis={runSearchResultAnalysis}
                ensureConcordanceWordsLoaded={ensureConcordanceWordsLoaded}
                contextVerseCount={contextVerseCount}
                state={
                  searchPageStateByLeafId[leaf.id] ?? {
                    searchMode: "smart",
                    caseSensitive: false,
                    chipInput: "",
                    phraseInput: "",
                    lastSearchMode: null,
                    lastSearchCaseSensitive: false,
                    lastSearchPhraseInput: "",
                    lastSearchSelectedWords: [],
                    isControlsCollapsed: false,
                    selectedWords: [],
                    expandedBookTree: ["entire", "old", "new"],
                    selectedBookIndexes: [],
                    resultSort: "relevance",
                    showResultContext: false,
                    resultFacets: null,
                    currentPage: 1,
                    results: [],
                    error: null,
                  }
                }
                onStateChange={(patch) => onChangeSearchPageState(leaf.id, patch)}
                onOpenResult={onOpenSearchResult}
              />
            </Suspense>
          </CardContent>
        ) : leaf.view === "visual-tool" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <Suspense fallback={AUXILIARY_PANEL_FALLBACK}>
              {leaf.visualTool ? <LazyVisualToolPanel key={`${leaf.visualTool.kind}:${leaf.visualTool.requestId ?? leaf.id}`}
                request={leaf.visualTool} tools={studyToolsPanelProps}
                onChange={visualTool => updateLeafLocation(leaf.id, { visualTool })} /> : <p className="p-3">Open a tool from Tools.</p>}
            </Suspense>
          </CardContent>
        ) : leaf.view === "notes" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading notes...
                </div>
              }
            >
              <LazyNotesPage
                books={books}
                notes={notes}
                context={notesContext}
                selectedHighlightScope={selectedHighlightScope}
                tabState={notesTabStateByLeafId[leaf.id] ?? null}
                onTabStateChange={(patch) => onChangeNotesTabState(leaf.id, patch)}
                onCreateGeneralNote={onCreateGeneralNote}
                onCreateContextNote={onCreateContextNote}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
                onOpenNoteLink={onOpenNoteLink}
                saveShortcut={settingsPanelProps.shortcutBindings["general.saveNote"]}
                shortcutsActive={activePanelLeafId === leaf.id}
              />
            </Suspense>
          </CardContent>
        ) : leaf.view === "tools" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <Suspense fallback={AUXILIARY_PANEL_FALLBACK}>
              <LazyStudyToolsPanel
                {...studyToolsPanelProps}
                selectionCommand={
                  studyToolsSelectionCommandsByLeafId[leaf.id]
                }
              />
            </Suspense>
          </CardContent>
        ) : leaf.view === "topics" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-2">
            <Suspense fallback={AUXILIARY_PANEL_FALLBACK}>
              <LazyTopicsPanel {...topicsPanelProps} />
            </Suspense>
          </CardContent>
        ) : leaf.view === "bookmarks" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-2">
            <Suspense fallback={AUXILIARY_PANEL_FALLBACK}>
              <LazyBookmarksTool {...bookmarksPanelProps} />
            </Suspense>
          </CardContent>
        ) : leaf.view === "page" ? (
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {leaf.pageId === "settings" ? (
              <div className="h-full overflow-y-auto p-4">
                <Suspense fallback={AUXILIARY_PANEL_FALLBACK}>
                  <LazySettingsPanelContent {...settingsPanelProps} />
                </Suspense>
              </div>
            ) : leaf.pageId === "progress" ? (
              <div className="h-full overflow-y-auto p-4">
                <Suspense fallback={AUXILIARY_PANEL_FALLBACK}>
                  <LazyProgressPanelContent {...progressPanelProps} />
                </Suspense>
              </div>
            ) : (
              <StaticPage
                books={books}
                pageId={leaf.pageId}
                canInstallPwa={canInstallPwa}
                isPwaInstalled={isPwaInstalled}
                onInstallPwa={onInstallPwa}
                onExportNotes={onExportNotes}
                onExportBookmarks={onExportBookmarks}
                renderPreview={renderReferencePreview}
                onOpenReference={onOpenReference}
                onCloseSidebar={onCloseSidebar}
                onStartTour={onStartTour}
                onOpenSearch={onOpenSearchTab}
                onOpenPage={onOpenStaticPageTab}
                readingContinuation={progressPanelProps.readingContinuation}
                isReadingProgressReady={progressPanelProps.isReadingProgressReady}
                onContinueReading={progressPanelProps.onContinueReading}
                showWelcomeHomeAtStartup={settingsPanelProps.showWelcomeHomeAtStartup}
                onShowWelcomeHomeAtStartupChange={
                  settingsPanelProps.onShowWelcomeHomeAtStartupChange
                }
              />
            )}
          </CardContent>
        ) : (
          <CardContent className="min-h-0 flex-1 overflow-auto p-2">
            <div className="flex flex-col gap-3">
              <PanelHome
                readingContinuation={progressPanelProps.readingContinuation}
                isReadingProgressReady={progressPanelProps.isReadingProgressReady}
                onContinueReading={(bookIndex, chapterIndex) =>
                  updateLeafLocation(leaf.id, {
                    view: "reader", bookIndex, chapterIndex,
                    pickerTestament: null, pickerBookIndex: null,
                  })
                }
                onOpen={(destination) => updateLeafLocation(leaf.id,
                  destination === "progress" ? { view: "page", pageId: "progress" } : { view: destination })}
                className="bg-card/70"
              />
              <p className="text-sm text-muted-foreground">
                Choose a book and chapter
              </p>
              <BookChapterPicker
                books={books}
                selectedTestament={leaf.pickerTestament}
                selectedBookIndex={leaf.pickerBookIndex}
                currentBookIndex={
                  leaf.pickerTestament !== null || leaf.pickerBookIndex !== null
                    ? leaf.bookIndex
                    : null
                }
                currentChapterIndex={
                  leaf.pickerTestament !== null || leaf.pickerBookIndex !== null
                    ? leaf.chapterIndex
                    : null
                }
                onSelectTestament={(testament) =>
                  updateLeafLocation(leaf.id, {
                    pickerTestament: testament,
                    pickerBookIndex: null,
                  })
                }
                onBackToTestaments={() =>
                  updateLeafLocation(leaf.id, {
                    pickerTestament: null,
                    pickerBookIndex: null,
                  })
                }
                onSelectBook={(bookIndex) =>
                  updateLeafLocation(leaf.id, {
                    pickerBookIndex: bookIndex,
                  })
                }
                onGoToBookSelection={(testament) =>
                  updateLeafLocation(leaf.id, {
                    pickerTestament: testament,
                    pickerBookIndex: null,
                  })
                }
                onGoToChapterSelection={(testament, bookIndex) =>
                  updateLeafLocation(leaf.id, {
                    pickerTestament: testament,
                    pickerBookIndex: bookIndex,
                  })
                }
                onSelectChapter={(bookIndex, chapterIndex) =>
                  updateLeafLocation(leaf.id, {
                    bookIndex,
                    chapterIndex,
                    view: "reader",
                    pickerTestament: null,
                    pickerBookIndex: null,
                  })
                }
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
});

export const ReaderPanelTree = memo(function ReaderPanelTree({
  root,
  books,
  activeRoot,
  chapterRefIndex,
  chapterRefCount,
  readChapters,
  readChapterCountByBook,
  hideReadModeVerseNumbers,
  panelMenuOpenLeafId,
  setPanelMenuOpenLeafId,
  modelLeafNeighbors,
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
  onOpenTokenDetails,
  onSelectVerse,
  concordanceWords,
  verseSearchIndex,
  isVerseSearchIndexBuilding,
  isVerseSearchIndexReady,
  verseSearchIndexError,
  runSmartVerseSearch,
  runSearchResultAnalysis,
  ensureConcordanceWordsLoaded,
  onOpenSearchResult,
  notes,
  notesContext,
  activeReaderWordHighlight,
  notesTabStateByLeafId,
  onChangeNotesTabState,
  searchPageStateByLeafId,
  contextVerseCount,
  onChangeSearchPageState,
  onCreateGeneralNote,
  onCreateContextNote,
  onUpdateNote,
  onDeleteNote,
  onOpenNoteLink,
  selectedHighlightScope,
  showTargetedPanelToggle,
  targetedPanelLeafId,
  onToggleTargetedPanel,
  canGoLeafHistoryBack,
  canGoLeafHistoryForward,
  onGoLeafHistoryBack,
  onGoLeafHistoryForward,
  moveLeafChapter,
  toggleChapterRead,
  updateSplitSize,
  updateSplitGroupLayout,
  highlightModeEnabledByLeafId,
  highlightedVerseRangesByLeafId,
  onClearLeafHighlights,
  onToggleHighlightMode,
  onBookmarkLeafSelection,
  studyToolsPanelProps,
  studyToolsSelectionCommandsByLeafId,
  topicsPanelProps,
  bookmarksPanelProps,
  settingsPanelProps,
  progressPanelProps,
  canInstallPwa,
  isPwaInstalled,
  onInstallPwa,
  onExportNotes,
  onExportBookmarks,
  renderReferencePreview,
  onOpenReference,
  onCloseSidebar,
  onStartTour,
  onOpenSearchTab,
  onOpenStaticPageTab,
  activePanelLeafId,
  onActivePanelChange,
}: ReaderPanelTreeProps) {
  const renderLeaf = (leaf: LeafNode) => (
    <ReaderErrorBoundary key={leaf.id} label="This panel" resetKey={`${leaf.view}:${leaf.bookIndex}:${leaf.chapterIndex}`}>
    <ReaderLeafPanel
      key={leaf.id}
      leaf={leaf}
      books={books}
      activeRoot={activeRoot}
      chapterRefIndex={chapterRefIndex}
      chapterRefCount={chapterRefCount}
      readChapters={readChapters}
      readChapterCountByBook={readChapterCountByBook}
      hideReadModeVerseNumbers={hideReadModeVerseNumbers}
      panelMenuOpenLeafId={panelMenuOpenLeafId}
      setPanelMenuOpenLeafId={setPanelMenuOpenLeafId}
      modelLeafNeighbors={modelLeafNeighbors}
      neighborsForLeaf={neighborsForLeaf}
      fullscreenLeafId={fullscreenLeafId}
      panelElementRefs={panelElementRefs}
      clearAllPanelPreviews={clearAllPanelPreviews}
      updateLeafLocation={updateLeafLocation}
      toggleFullscreenLeaf={toggleFullscreenLeaf}
      toggleParentGroupOrientation={toggleParentGroupOrientation}
      setOrientationPreviewTarget={setOrientationPreviewTarget}
      clearOrientationPreview={clearOrientationPreview}
      moveLeaf={moveLeaf}
      setMovePreviewTarget={setMovePreviewTarget}
      clearMovePreview={clearMovePreview}
      splitLeaf={splitLeaf}
      setAddPreviewTarget={setAddPreviewTarget}
      clearAddPreview={clearAddPreview}
      insertPanelInGroup={insertPanelInGroup}
      setGroupInsertPreviewTarget={setGroupInsertPreviewTarget}
      addAroundGroup={addAroundGroup}
      setAroundGroupPreviewTarget={setAroundGroupPreviewTarget}
      existingTabTargets={existingTabTargets}
      moveLeafToExistingTab={moveLeafToExistingTab}
      moveLeafToNewTab={moveLeafToNewTab}
      closeLeaf={closeLeaf}
      flowVersesByParagraph={flowVersesByParagraph}
      readModeParagraphIndent={readModeParagraphIndent}
      isStudyMode={isStudyMode}
      fontSize={fontSize}
      verseSpacing={verseSpacing}
      onOpenTokenDetails={onOpenTokenDetails}
      onSelectVerse={onSelectVerse}
      concordanceWords={concordanceWords}
      verseSearchIndex={verseSearchIndex}
      isVerseSearchIndexBuilding={isVerseSearchIndexBuilding}
      isVerseSearchIndexReady={isVerseSearchIndexReady}
      verseSearchIndexError={verseSearchIndexError}
      runSmartVerseSearch={runSmartVerseSearch}
      runSearchResultAnalysis={runSearchResultAnalysis}
      ensureConcordanceWordsLoaded={ensureConcordanceWordsLoaded}
      onOpenSearchResult={onOpenSearchResult}
      notes={notes}
      notesContext={notesContext}
      activeReaderWordHighlight={activeReaderWordHighlight}
      notesTabStateByLeafId={notesTabStateByLeafId}
      onChangeNotesTabState={onChangeNotesTabState}
      searchPageStateByLeafId={searchPageStateByLeafId}
      contextVerseCount={contextVerseCount}
      onChangeSearchPageState={onChangeSearchPageState}
      onCreateGeneralNote={onCreateGeneralNote}
      onCreateContextNote={onCreateContextNote}
      onUpdateNote={onUpdateNote}
      onDeleteNote={onDeleteNote}
      onOpenNoteLink={onOpenNoteLink}
      selectedHighlightScope={selectedHighlightScope}
      showTargetedPanelToggle={showTargetedPanelToggle}
      targetedPanelLeafId={targetedPanelLeafId}
      onToggleTargetedPanel={onToggleTargetedPanel}
      canGoLeafHistoryBack={canGoLeafHistoryBack}
      canGoLeafHistoryForward={canGoLeafHistoryForward}
      onGoLeafHistoryBack={onGoLeafHistoryBack}
      onGoLeafHistoryForward={onGoLeafHistoryForward}
      moveLeafChapter={moveLeafChapter}
      toggleChapterRead={toggleChapterRead}
      updateSplitSize={updateSplitSize}
      updateSplitGroupLayout={updateSplitGroupLayout}
      highlightModeEnabledByLeafId={highlightModeEnabledByLeafId}
      highlightedVerseRangesByLeafId={highlightedVerseRangesByLeafId}
      onClearLeafHighlights={onClearLeafHighlights}
      onToggleHighlightMode={onToggleHighlightMode}
      onBookmarkLeafSelection={onBookmarkLeafSelection}
      studyToolsPanelProps={studyToolsPanelProps}
      studyToolsSelectionCommandsByLeafId={
        studyToolsSelectionCommandsByLeafId
      }
      topicsPanelProps={topicsPanelProps}
      bookmarksPanelProps={bookmarksPanelProps}
      settingsPanelProps={settingsPanelProps}
      progressPanelProps={progressPanelProps}
      canInstallPwa={canInstallPwa}
      isPwaInstalled={isPwaInstalled}
      onInstallPwa={onInstallPwa}
      onExportNotes={onExportNotes}
      onExportBookmarks={onExportBookmarks}
      renderReferencePreview={renderReferencePreview}
      onOpenReference={onOpenReference}
      onCloseSidebar={onCloseSidebar}
      onStartTour={onStartTour}
      onOpenSearchTab={onOpenSearchTab}
      onOpenStaticPageTab={onOpenStaticPageTab}
      activePanelLeafId={activePanelLeafId}
      onActivePanelChange={onActivePanelChange}
    />
    </ReaderErrorBoundary>
  );

  const flattenRenderableChildren = (
    node: PanelNode,
    orientation: "horizontal" | "vertical",
  ): PanelNode[] => {
    if (node.type === "split" && node.orientation === orientation) {
      return [
        ...flattenRenderableChildren(node.first, orientation),
        ...flattenRenderableChildren(node.second, orientation),
      ];
    }

    return [node];
  };

  const renderNode = (node: PanelNode): ReactNode => {
    if (node.type === "leaf") {
      return renderLeaf(node);
    }

    const groupChildren = flattenRenderableChildren(node, node.orientation);

    return (
      <ResizablePanelGroup
        orientation={node.orientation}
        onLayoutChanged={(layout) => {
          if (groupChildren.length <= 2) {
            const nextSize = layout[`${node.id}-first`];
            if (typeof nextSize === "number") {
              updateSplitSize(node.id, nextSize);
            }
            return;
          }

          const nextSizes = groupChildren
            .map((_, index) => layout[`${node.id}-item-${index}`])
            .filter((value): value is number => typeof value === "number");

          if (nextSizes.length === groupChildren.length) {
            updateSplitGroupLayout(node.id, node.orientation, nextSizes);
          }
        }}
        className="min-h-0 min-w-0 flex-1"
      >
        {groupChildren.map((child, index) => {
          const defaultSize =
            groupChildren.length <= 2
              ? index === 0
                ? node.ratio
                : 100 - node.ratio
              : 100 / groupChildren.length;

          return (
            <Fragment key={`${node.id}-item-${index}`}>
              {index > 0 ? <ResizableHandle withHandle /> : null}
              <ResizablePanel
                id={
                  groupChildren.length <= 2
                    ? `${node.id}-${index === 0 ? "first" : "second"}`
                    : `${node.id}-item-${index}`
                }
                defaultSize={defaultSize}
                minSize={15}
              >
                {renderNode(child)}
              </ResizablePanel>
            </Fragment>
          );
        })}
      </ResizablePanelGroup>
    );
  };

  return <>{renderNode(root)}</>;
});
