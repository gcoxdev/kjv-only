import { startTransition, useCallback, useState } from "react";

import type { StudyWorkspaceTab, StudyWorkspaceTool } from "@/types/reader";

const STUDY_WORKSPACE_TABS: StudyWorkspaceTab[] = ["home", "tools", "topics", "notes", "bookmarks", "search", "progress"];
const STUDY_WORKSPACE_TOOLS: StudyWorkspaceTool[] = [
  "summary",
  "cross-refs",
  "concordance",
  "topics",
  "websters",
  "strongs",
  "kjv-words-phrases",
  "bible-word-book",
  "hitchcocks",
  "ai-dictionary",
  "genealogy",
  "maps",
  "timeline",
];

export function normalizeStudyWorkspaceTab(
  value: string | null | undefined,
): StudyWorkspaceTab {
  return STUDY_WORKSPACE_TABS.includes(value as StudyWorkspaceTab)
    ? (value as StudyWorkspaceTab)
    : "home";
}

export function normalizeStudyWorkspaceTool(
  value: string | null | undefined,
): StudyWorkspaceTool {
  if (value === "old-english" || value === "phrases" || value === "units") {
    return "kjv-words-phrases";
  }
  return STUDY_WORKSPACE_TOOLS.includes(value as StudyWorkspaceTool)
    ? (value as StudyWorkspaceTool)
    : "concordance";
}

export type UseStudyWorkspaceStateArgs = {
  initialAccordionValue: string[];
};

export function useStudyWorkspaceState({
  initialAccordionValue,
}: UseStudyWorkspaceStateArgs) {
  const [activeTab, setActiveTab] = useState<StudyWorkspaceTab>("home");
  const [activeTool, setActiveTool] = useState<StudyWorkspaceTool>("concordance");
  const [accordionValue, setAccordionValue] = useState<string[]>(
    initialAccordionValue,
  );

  const showTool = useCallback((tool: StudyWorkspaceTool) => {
    startTransition(() => {
      setActiveTab(tool === "topics" ? "topics" : "tools");
      setActiveTool(tool);
      setAccordionValue((current) =>
        current.includes(tool) ? current : [...current, tool],
      );
    });
  }, []);

  const handleAccordionValueChange = useCallback((value: string[]) => {
    setAccordionValue(value);
    const nextTool = [...value]
      .reverse()
      .find((item): item is StudyWorkspaceTool =>
        STUDY_WORKSPACE_TOOLS.includes(item as StudyWorkspaceTool),
      );
    if (nextTool) {
      setActiveTool(nextTool);
    }
  }, []);

  return {
    activeTab,
    activeTool,
    accordionValue,
    setActiveTab,
    setActiveTool,
    setAccordionValue: handleAccordionValueChange,
    updateAccordionValue: setAccordionValue,
    showTool,
  };
}
