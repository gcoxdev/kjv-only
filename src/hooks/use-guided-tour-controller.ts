import { useCallback, useState } from "react";

import type { GuidedTourStep } from "@/components/reader/guided-tour";

const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  {
    id: "main-menu",
    title: "Main Menu",
    description:
      "Use the menu to open pages such as Settings, Reading Progress, Download, Help, and more.",
    selector: "[data-tour='main-menu']",
  },
  {
    id: "reference-command-button",
    title: "Quick Open",
    description:
      "Use Quick Open to type Bible references such as John 3:16 or several passages at once, then choose whether to open them in tabs or panels.",
    selector: "[data-tour='reference-command-button']",
  },
  {
    id: "search-button",
    title: "Search",
    description:
      "Open the search workspace from here to run phrase, word, and regex searches across the Bible.",
    selector: "[data-tour='search-button']",
  },
  {
    id: "mode-toggle",
    title: "Read and Study Modes",
    description:
      "Switch between simpler reading and full study mode here. Study mode enables the sidebar and broader tool workflow.",
    selector: "[data-tour='mode-toggle']",
  },
  {
    id: "tabs-strip",
    title: "Tabs",
    description:
      "Your layouts live in tabs, making it easy to organize different reading, study, and page setups.",
    selector: "[data-tour='tabs-strip']",
  },
  {
    id: "add-tab",
    title: "Add Tabs",
    description:
      "Use this button to create another tab for a separate reading layout, page, or study workspace.",
    selector: "[data-tour='add-tab']",
  },
  {
    id: "tab-options",
    title: "Tab Options",
    description:
      "Each tab has its own options menu for relabeling, reordering, and closing that tab.",
    selector: "[data-tour='tab-options']",
  },
  {
    id: "sidebar",
    title: "Study Sidebar",
    description:
      "Sidebar Home opens reading progress, tools, topics, notes, bookmarks, search, and quizzes alongside the Bible text. Use the Home button beside a view title to return.",
    selector: "[data-tour='sidebar']",
  },
  {
    id: "reader-panel",
    title: "Reader Panel",
    description:
      "This is the main Bible reading workspace. From here you can read, split panels, highlight verses, and open study tools.",
    selector: "[data-tour='reader-panel']",
  },
  {
    id: "panel-menu",
    title: "Panel Options",
    description:
      "Each panel has its own menu for history, fullscreen, home, splitting, moving, and other panel-specific actions.",
    selector: "[data-tour='panel-menu']",
  },
  {
    id: "panel-bottom-bar",
    title: "Panel Bottom Bar",
    description:
      "The bottom bar gives quick access to chapter audio, chapter progress updates, and chapter navigation.",
    selector: "[data-tour='panel-bottom-bar']",
  },
];

type UseGuidedTourControllerParams = {
  firstReaderTabId: string | null;
  setActiveTabId: (tabId: string | null) => void;
};

export function clampGuidedTourStepIndex(nextIndex: number) {
  return Math.max(0, Math.min(nextIndex, GUIDED_TOUR_STEPS.length - 1));
}

export function useGuidedTourController({
  firstReaderTabId,
  setActiveTabId,
}: UseGuidedTourControllerParams) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const goToStep = useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampGuidedTourStepIndex(nextIndex);
      const step = GUIDED_TOUR_STEPS[clampedIndex];
      if (
        (step.id === "reader-panel" || step.id === "panel-menu") &&
        firstReaderTabId
      ) {
        setActiveTabId(firstReaderTabId);
      }
      setStepIndex(clampedIndex);
    },
    [firstReaderTabId, setActiveTabId],
  );

  const startGuidedTour = useCallback(() => {
    setIsOpen(true);
    goToStep(0);
  }, [goToStep]);

  const closeGuidedTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showNextStep = useCallback(() => {
    if (stepIndex >= GUIDED_TOUR_STEPS.length - 1) {
      closeGuidedTour();
      return;
    }
    goToStep(stepIndex + 1);
  }, [closeGuidedTour, goToStep, stepIndex]);

  const showPreviousStep = useCallback(() => {
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  return {
    startGuidedTour,
    guidedTourProps: {
      open: isOpen,
      stepIndex,
      steps: GUIDED_TOUR_STEPS,
      onNext: showNextStep,
      onPrevious: showPreviousStep,
      onClose: closeGuidedTour,
    },
  };
}
