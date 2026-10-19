import { useCallback, useEffect, useRef } from "react";
import { saveWorkspace } from "@/lib/saved-workspace";

import {
  parseLayoutHash,
  serializeLayoutHash,
  type ParsedLayoutHash,
  type SerializedVerseRange,
} from "@/lib/layout-hash";
import type {
  ReaderTab,
  SearchDefinition,
  SearchPageState,
  TabsOrientation,
} from "@/types/reader";

type UseLayoutHashSyncParams = {
  isLoaded: boolean;
  tabs: ReaderTab[];
  activeTabId: string | null;
  tabsOrientation: TabsOrientation;
  highlightedVerseRangesByLeafId: Record<string, SerializedVerseRange[]>;
  searchPageStateByLeafId: Record<string, SearchPageState>;
  targetedPanelLeafId: string | null;
  showTargetedPanelToggle: boolean;
  setTabs: (tabs: ReaderTab[]) => void;
  setActiveTabId: (tabId: string | null) => void;
  setTabsOrientation: (orientation: TabsOrientation) => void;
  setVerseHighlights: (
    next: Record<string, SerializedVerseRange[]>,
  ) => void;
  queueVerseHighlights: (
    leafId: string,
    ranges: SerializedVerseRange[],
  ) => void;
  setTargetedPanelLeafId: (leafId: string | null) => void;
  restoreSearchPageDefinitions: (
    definitionsByLeafId: Record<string, SearchDefinition>,
  ) => void;
};

export function useLayoutHashSync({
  isLoaded,
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
}: UseLayoutHashSyncParams) {
  const syncedLayoutHashRef = useRef("");
  const savedLayoutHashRef = useRef("");

  const applyParsedLayout = useCallback(
    (parsed: ParsedLayoutHash) => {
      const nextHash = serializeLayoutHash({
        tabs: parsed.tabs,
        activeTabId:
          parsed.tabs[parsed.activeTabIndex]?.id ?? parsed.tabs[0]?.id ?? null,
        tabsOrientation: parsed.tabsOrientation,
        highlightedVerseRangesByLeafId: parsed.highlightedVerseRangesByLeafId,
        searchPageStateByLeafId: parsed.searchPageDefinitionsByLeafId,
        targetedPanelLeafId: parsed.targetedPanelLeafId,
      });
      syncedLayoutHashRef.current = nextHash;
      setTabs(parsed.tabs);
      setActiveTabId(
        parsed.tabs[parsed.activeTabIndex]?.id ?? parsed.tabs[0]?.id ?? null,
      );
      setTargetedPanelLeafId(parsed.targetedPanelLeafId);
      setTabsOrientation(parsed.tabsOrientation);
      setVerseHighlights(parsed.highlightedVerseRangesByLeafId);
      restoreSearchPageDefinitions(parsed.searchPageDefinitionsByLeafId);
      for (const [leafId, ranges] of Object.entries(
        parsed.highlightedVerseRangesByLeafId,
      )) {
        queueVerseHighlights(leafId, ranges);
      }
    },
    [
      queueVerseHighlights,
      restoreSearchPageDefinitions,
      setActiveTabId,
      setTabs,
      setTabsOrientation,
      setTargetedPanelLeafId,
      setVerseHighlights,
    ],
  );

  const parseCurrentLayoutHash = useCallback(
    () => parseLayoutHash(window.location.hash),
    [],
  );

  useEffect(() => {
    if (!isLoaded || tabs.length === 0) {
      return;
    }
    const nextHash = serializeLayoutHash({
      tabs,
      activeTabId,
      tabsOrientation,
      highlightedVerseRangesByLeafId,
      searchPageStateByLeafId,
      targetedPanelLeafId: showTargetedPanelToggle ? targetedPanelLeafId : null,
    });
    if (savedLayoutHashRef.current !== nextHash) {
      if (saveWorkspace(nextHash)) savedLayoutHashRef.current = nextHash;
    }
    if (
      syncedLayoutHashRef.current === nextHash &&
      window.location.hash === nextHash
    ) {
      return;
    }
    syncedLayoutHashRef.current = nextHash;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [
    activeTabId,
    highlightedVerseRangesByLeafId,
    isLoaded,
    showTargetedPanelToggle,
    searchPageStateByLeafId,
    tabs,
    tabsOrientation,
    targetedPanelLeafId,
  ]);

  useEffect(() => {
    function onHashChange() {
      const parsed = parseCurrentLayoutHash();
      if (!parsed) {
        return;
      }
      applyParsedLayout(parsed);
    }

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [applyParsedLayout, parseCurrentLayoutHash]);

  return {
    parseCurrentLayoutHash,
    applyParsedLayout,
  };
}
