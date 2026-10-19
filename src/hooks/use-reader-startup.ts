import { useEffect, useRef } from "react";

import { createId, createLeaf } from "@/lib/reader-layout";
import type { ParsedLayoutHash } from "@/lib/layout-hash";
import type { ReaderTab } from "@/types/reader";
import { readStartupWorkspace } from "@/lib/saved-workspace";

type UseReaderStartupParams = {
  isLoaded: boolean;
  bookCount: number;
  isCorpusLoaded: boolean;
  loadError: string | null;
  showWelcomeHomeAtStartup: boolean;
  applyParsedLayout: (parsed: ParsedLayoutHash) => void;
  setIsLoaded: (isLoaded: boolean) => void;
  setTabs: React.Dispatch<React.SetStateAction<ReaderTab[]>>;
  setActiveTabId: (tabId: string | null) => void;
  finishFirstReaderReadyMeasureRef: {
    current: (() => void) | null;
  };
};

function createWelcomeHomeTab(): ReaderTab {
  return {
    id: createId(),
    title: "Welcome Home",
    root: {
      ...createLeaf(0, 0, "page"),
      pageId: "welcome-home",
    },
  };
}

function createGenesisReaderTab(): ReaderTab {
  return {
    id: createId(),
    title: "Genesis 1",
    root: createLeaf(0, 0, "reader"),
  };
}

export function useReaderStartup({
  isLoaded,
  bookCount,
  isCorpusLoaded,
  loadError,
  showWelcomeHomeAtStartup,
  applyParsedLayout,
  setIsLoaded,
  setTabs,
  setActiveTabId,
  finishFirstReaderReadyMeasureRef,
}: UseReaderStartupParams) {
  const didInitializeReaderRef = useRef(false);
  const didApplyStartupWelcomeHomeRef = useRef(false);
  const didRestoreLayoutRef = useRef(false);
  const startupLayoutRef = useRef<ParsedLayoutHash | null | undefined>(undefined);

  useEffect(() => {
    if (didInitializeReaderRef.current) {
      return;
    }

    if (startupLayoutRef.current === undefined) {
      startupLayoutRef.current = readStartupWorkspace(window.location.hash);
    }
    const parsedLayout = startupLayoutRef.current;
    if (loadError) {
      didInitializeReaderRef.current = true;
      setIsLoaded(true);
      finishFirstReaderReadyMeasureRef.current?.();
      finishFirstReaderReadyMeasureRef.current = null;
      return;
    }
    if (bookCount === 0 || (parsedLayout && !isCorpusLoaded)) {
      return;
    }

    didInitializeReaderRef.current = true;
    if (parsedLayout && parsedLayout.tabs.length > 0) {
      didRestoreLayoutRef.current = true;
      applyParsedLayout(parsedLayout);
    } else {
      const readerTab = createGenesisReaderTab();
      const initialTabs = showWelcomeHomeAtStartup
        ? [readerTab, createWelcomeHomeTab()]
        : [readerTab];
      setTabs(initialTabs);
      setActiveTabId(initialTabs[initialTabs.length - 1]?.id ?? readerTab.id);
    }
    setIsLoaded(true);
    finishFirstReaderReadyMeasureRef.current?.();
    finishFirstReaderReadyMeasureRef.current = null;
  }, [
    applyParsedLayout,
    bookCount,
    finishFirstReaderReadyMeasureRef,
    isCorpusLoaded,
    loadError,
    setActiveTabId,
    setIsLoaded,
    setTabs,
    showWelcomeHomeAtStartup,
  ]);

  useEffect(() => {
    if (!isLoaded || didApplyStartupWelcomeHomeRef.current) {
      return;
    }
    didApplyStartupWelcomeHomeRef.current = true;
    if (didRestoreLayoutRef.current) {
      return;
    }
    setTabs((currentTabs) => {
      if (currentTabs.length === 0) {
        return currentTabs;
      }
      const existingWelcomeTab = currentTabs.find(
        (tab) =>
          tab.root.type === "leaf" &&
          tab.root.view === "page" &&
          tab.root.pageId === "welcome-home",
      );
      const otherTabs = currentTabs.filter(
        (tab) =>
          !(
            tab.root.type === "leaf" &&
            tab.root.view === "page" &&
            tab.root.pageId === "welcome-home"
          ),
      );
      const nextTabs = showWelcomeHomeAtStartup
        ? [...otherTabs, existingWelcomeTab ?? createWelcomeHomeTab()]
        : currentTabs;
      const welcomeTab = nextTabs.find(
        (tab) =>
          tab.root.type === "leaf" &&
          tab.root.view === "page" &&
          tab.root.pageId === "welcome-home",
      );
      if (welcomeTab) {
        setActiveTabId(welcomeTab.id);
      }
      return nextTabs;
    });
  }, [isLoaded, setActiveTabId, setTabs, showWelcomeHomeAtStartup]);
}
