import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { ProgressPanelContentProps } from "@/components/reader/progress-dialog";
import type { ReaderStudyToolsContentProps } from "@/components/reader/reader-study-tools-content";
import type { SettingsPanelContentProps } from "@/components/reader/settings-dialog";
import type { BookmarksToolProps } from "@/components/reader/study-tools/bookmarks-tool";
import {
  STUDY_ACCORDION_ITEMS,
  deriveStudySidebarState,
} from "@/hooks/use-study-sidebar-state";
import {
  defaultHighlightColor,
  normalizeHighlightColor,
} from "@/lib/highlight-color";

type StudyToolKey = keyof ReaderStudyToolsContentProps;
type StudyToolInput<Key extends StudyToolKey> = Omit<
  ReaderStudyToolsContentProps[Key],
  "hasInfo" | "isOpen"
>;

type StudyInfoCounts = {
  crossRefs: number;
  concordance: number;
  websters: number;
  aiDictionary: number;
  strongs: number;
  bibleWordBook: number;
  kjvWordsPhrases: number;
  maps: number;
  hitchcocks: number;
  genealogy: number;
};

type UseStudyToolsViewModelParams = {
  accordionValue: string[];
  onAccordionValueChange: (value: string[]) => void;
  infoCounts: StudyInfoCounts;
  summaryProps: StudyToolInput<"summaryProps">;
  crossRefsProps: StudyToolInput<"crossRefsProps">;
  concordanceProps: StudyToolInput<"concordanceProps">;
  webstersProps: StudyToolInput<"webstersProps">;
  aiDictionaryProps: StudyToolInput<"aiDictionaryProps">;
  strongsProps: StudyToolInput<"strongsProps">;
  kjvWordsPhrasesProps: Omit<
    StudyToolInput<"kjvWordsPhrasesProps">,
    "onSearch"
  >;
  onOldEnglishSearch: (term: string) => void;
  onPhrasesSearch: (term: string) => void;
  onUnitsSearch: (term: string) => void;
  bibleWordBookProps: StudyToolInput<"bibleWordBookProps">;
  timelineProps: StudyToolInput<"timelineProps">;
  mapsProps: StudyToolInput<"mapsProps">;
  genealogyProps: StudyToolInput<"genealogyProps">;
  hitchcocksProps: StudyToolInput<"hitchcocksProps">;
};

export function useStudyToolsViewModel({
  accordionValue,
  onAccordionValueChange,
  infoCounts,
  summaryProps,
  crossRefsProps,
  concordanceProps,
  webstersProps,
  aiDictionaryProps,
  strongsProps,
  kjvWordsPhrasesProps,
  onOldEnglishSearch,
  onPhrasesSearch,
  onUnitsSearch,
  bibleWordBookProps,
  mapsProps,
  timelineProps,
  genealogyProps,
  hitchcocksProps,
}: UseStudyToolsViewModelParams) {
  const sidebarState = deriveStudySidebarState({
    accordionValue,
    crossRefsCount: infoCounts.crossRefs,
    concordanceCount: infoCounts.concordance,
    webstersCount: infoCounts.websters,
    aiDictionaryCount: infoCounts.aiDictionary,
    strongsCount: infoCounts.strongs,
    bibleWordBookCount: infoCounts.bibleWordBook,
    kjvWordsPhrasesCount: infoCounts.kjvWordsPhrases,
    mapsCount: infoCounts.maps,
    hitchcocksCount: infoCounts.hitchcocks,
    genealogyCount: infoCounts.genealogy,
  });

  const onKjvWordsPhrasesSearch = useCallback(
    (term: string) => {
      onOldEnglishSearch(term);
      onPhrasesSearch(term);
      onUnitsSearch(term);
    },
    [onOldEnglishSearch, onPhrasesSearch, onUnitsSearch],
  );
  const onExpandAll = useCallback(() => {
    onAccordionValueChange([...STUDY_ACCORDION_ITEMS]);
  }, [onAccordionValueChange]);
  const onCollapseAll = useCallback(() => {
    onAccordionValueChange([]);
  }, [onAccordionValueChange]);

  const sharedStudyToolsProps: ReaderStudyToolsContentProps = {
    summaryProps: { ...summaryProps, isOpen: accordionValue.includes("summary") },
    timelineProps: { ...timelineProps, isOpen: accordionValue.includes("timeline") },
    crossRefsProps: {
      hasInfo: sidebarState.hasCrossRefsInfo,
      isOpen: sidebarState.isCrossRefsSectionOpen,
      ...crossRefsProps,
    },
    concordanceProps: {
      hasInfo: sidebarState.hasConcordanceInfo,
      isOpen: sidebarState.isConcordanceSectionOpen,
      ...concordanceProps,
    },
    webstersProps: {
      hasInfo: sidebarState.hasWebstersInfo,
      isOpen: sidebarState.isWebstersSectionOpen,
      ...webstersProps,
    },
    aiDictionaryProps: {
      hasInfo: sidebarState.hasAIDictionaryInfo,
      isOpen: sidebarState.isAIDictionarySectionOpen,
      ...aiDictionaryProps,
    },
    strongsProps: {
      hasInfo: sidebarState.hasStrongsInfo,
      isOpen: sidebarState.isStrongsSectionOpen,
      ...strongsProps,
    },
    kjvWordsPhrasesProps: {
      hasInfo: sidebarState.hasKjvWordsPhrasesInfo,
      isOpen: sidebarState.isKjvWordsPhrasesSectionOpen,
      ...kjvWordsPhrasesProps,
      onSearch: onKjvWordsPhrasesSearch,
    },
    bibleWordBookProps: {
      hasInfo: sidebarState.hasBibleWordBookInfo,
      isOpen: sidebarState.isBibleWordBookSectionOpen,
      ...bibleWordBookProps,
    },
    mapsProps: {
      hasInfo: sidebarState.hasMapsInfo,
      isOpen: sidebarState.isMapsSectionOpen,
      ...mapsProps,
    },
    genealogyProps: {
      hasInfo: sidebarState.hasGenealogyInfo,
      isOpen: sidebarState.isGenealogySectionOpen,
      ...genealogyProps,
    },
    hitchcocksProps: {
      hasInfo: sidebarState.hasHitchcocksInfo,
      isOpen: sidebarState.isHitchcocksSectionOpen,
      ...hitchcocksProps,
    },
  };

  return {
    allStudyAccordionsOpen: sidebarState.allStudyAccordionsOpen,
    sharedStudyToolsProps,
    onExpandAll,
    onCollapseAll,
  };
}

type UseSettingsViewModelParams = Omit<
  SettingsPanelContentProps,
  | "onIncreaseFontSize"
  | "onDecreaseFontSize"
  | "onResetFontSize"
  | "onLightHighlightColorChange"
  | "onResetLightHighlightColor"
  | "onDarkHighlightColorChange"
  | "onResetDarkHighlightColor"
> & {
  setFontSize: Dispatch<SetStateAction<number>>;
  setLightHighlightColor: Dispatch<SetStateAction<string>>;
  setDarkHighlightColor: Dispatch<SetStateAction<string>>;
};

export function useSettingsViewModel({
  setFontSize,
  setLightHighlightColor,
  setDarkHighlightColor,
  activeTab,
  onActiveTabChange,
  theme,
  onThemeChange,
  readerColorTheme,
  onReaderColorThemeChange,
  fontSize,
  lightHighlightColor,
  darkHighlightColor,
  verseSpacing,
  onVerseSpacingChange,
  contextVerseCount,
  onContextVerseCountChange,
  toolReferenceDisplayMode,
  onToolReferenceDisplayModeChange,
  hideReadModeVerseNumbers,
  onHideReadModeVerseNumbersChange,
  readModeParagraphIndent,
  onReadModeParagraphIndentChange,
  flowVersesByParagraph,
  onFlowVersesByParagraphChange,
  tabsOrientation,
  onTabsOrientationChange,
  wordVerseSelectionTarget,
  onWordVerseSelectionTargetChange,
  notesLinkOpenTarget,
  onNotesLinkOpenTargetChange,
  searchResultOpenTarget,
  onSearchResultOpenTargetChange,
  bookmarkOpenTarget,
  onBookmarkOpenTargetChange,
  genealogyOpenTarget,
  onGenealogyOpenTargetChange,
  mapsOpenTarget,
  onMapsOpenTargetChange,
  timelineOpenTarget,
  onTimelineOpenTargetChange,
  referenceLinkOpenTarget,
  onReferenceLinkOpenTargetChange,
  showWelcomeHomeAtStartup,
  onShowWelcomeHomeAtStartupChange,
  shortcutBindings,
  onShortcutBindingChange,
  onResetShortcutBinding,
  onResetAllShortcutBindings,
}: UseSettingsViewModelParams) {
  const onIncreaseFontSize = useCallback(() => {
    setFontSize((current) => current + 4);
  }, [setFontSize]);
  const onDecreaseFontSize = useCallback(() => {
    setFontSize((current) => Math.max(8, current - 4));
  }, [setFontSize]);
  const onResetFontSize = useCallback(() => {
    setFontSize(16);
  }, [setFontSize]);
  const onLightHighlightColorChange = useCallback(
    (value: string) => {
      setLightHighlightColor(normalizeHighlightColor(value));
    },
    [setLightHighlightColor],
  );
  const onResetLightHighlightColor = useCallback(() => {
    setLightHighlightColor(defaultHighlightColor());
  }, [setLightHighlightColor]);
  const onDarkHighlightColorChange = useCallback(
    (value: string) => {
      setDarkHighlightColor(normalizeHighlightColor(value));
    },
    [setDarkHighlightColor],
  );
  const onResetDarkHighlightColor = useCallback(() => {
    setDarkHighlightColor(defaultHighlightColor());
  }, [setDarkHighlightColor]);

  return {
    activeTab,
    onActiveTabChange,
    theme,
    onThemeChange,
    readerColorTheme,
    onReaderColorThemeChange,
    fontSize,
    onIncreaseFontSize,
    onDecreaseFontSize,
    onResetFontSize,
    lightHighlightColor,
    onLightHighlightColorChange,
    onResetLightHighlightColor,
    darkHighlightColor,
    onDarkHighlightColorChange,
    onResetDarkHighlightColor,
    verseSpacing,
    onVerseSpacingChange,
    contextVerseCount,
    onContextVerseCountChange,
    toolReferenceDisplayMode,
    onToolReferenceDisplayModeChange,
    hideReadModeVerseNumbers,
    onHideReadModeVerseNumbersChange,
    readModeParagraphIndent,
    onReadModeParagraphIndentChange,
    flowVersesByParagraph,
    onFlowVersesByParagraphChange,
    tabsOrientation,
    onTabsOrientationChange,
    wordVerseSelectionTarget,
    onWordVerseSelectionTargetChange,
    notesLinkOpenTarget,
    onNotesLinkOpenTargetChange,
    searchResultOpenTarget,
    onSearchResultOpenTargetChange,
    bookmarkOpenTarget,
    onBookmarkOpenTargetChange,
    genealogyOpenTarget,
    onGenealogyOpenTargetChange,
    mapsOpenTarget,
    onMapsOpenTargetChange,
    timelineOpenTarget,
    onTimelineOpenTargetChange,
    referenceLinkOpenTarget,
    onReferenceLinkOpenTargetChange,
    showWelcomeHomeAtStartup,
    onShowWelcomeHomeAtStartupChange,
    shortcutBindings,
    onShortcutBindingChange,
    onResetShortcutBinding,
    onResetAllShortcutBindings,
  } satisfies SettingsPanelContentProps;
}

export function useBookmarksViewModel(props: BookmarksToolProps) {
  return props;
}

export function useProgressViewModel(props: ProgressPanelContentProps) {
  return props;
}
