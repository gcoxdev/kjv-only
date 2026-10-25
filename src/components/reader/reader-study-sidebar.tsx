import { lazy, memo, Suspense, useState, type ComponentProps, type ReactNode } from "react";
import { CopyMinusIcon, CopyPlusIcon, HouseIcon } from "lucide-react";

import type { NotesPage } from "@/components/reader/notes-page";
import type { SearchPage } from "@/components/reader/search-page";
import type { ProgressPanelContentProps } from "@/components/reader/progress-dialog";
import { BookmarksTool } from "@/components/reader/study-tools/bookmarks-tool";
import { TopicsContent, type TopicsContentProps } from "@/components/reader/study-tools/topics-tool";
import { ReaderStudyToolsContent, type ReaderStudyToolsContentProps } from "@/components/reader/reader-study-tools-content";
import { PanelHome } from "@/components/reader/panel-home";
import { PANEL_HOME_DESTINATIONS } from "@/lib/panel-home";
import { StudyToolsSidebar } from "@/components/reader/study-tools-sidebar";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createDefaultSearchPageState } from "@/hooks/use-reader-search-pages";
import { loadSearchPage } from "@/lib/search-page-loader";
import type { NotesTabState } from "@/types/notes";
import type { StudyWorkspaceTab, PanelHomeDestination, SearchPageState } from "@/types/reader";
import { areReaderViewModelsEqual } from "@/lib/reader-view-model";

const LazyNotesPage = lazy(async () => ({ default: (await import("@/components/reader/notes-page")).NotesPage }));
const LazySearchPage = lazy(async () => ({ default: (await loadSearchPage()).SearchPage }));
const LazyQuiz = lazy(async () => ({ default: (await import("@/components/reader/quiz/quiz-page")).QuizPage }));
const LazyProgress = lazy(async () => ({ default: (await import("@/components/reader/progress-dialog")).ProgressPanelContent }));

type ReaderStudySidebarProps = {
  visible: boolean;
  activeTab: StudyWorkspaceTab;
  accordionValue: string[];
  onAccordionValueChange: (value: string[]) => void;
  onActiveTabChange: (value: StudyWorkspaceTab) => void;
  onActivate: () => void;
  onNavigateAway: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  canExpand: boolean;
  canCollapse: boolean;
  topicsProps: TopicsContentProps;
  notesProps: Omit<ComponentProps<typeof NotesPage>, "tabState" | "onTabStateChange">;
  searchProps: Omit<ComponentProps<typeof SearchPage>, "state" | "onStateChange">;
  progressProps: ProgressPanelContentProps;
  bookmarksProps: ComponentProps<typeof BookmarksTool>;
} & ReaderStudyToolsContentProps;

export const ReaderStudySidebar = memo(function ReaderStudySidebar({
  visible, activeTab, accordionValue, onAccordionValueChange, onActiveTabChange, onActivate, onNavigateAway,
  onExpandAll, onCollapseAll, canExpand, canCollapse,
  topicsProps, notesProps, searchProps, progressProps, bookmarksProps, ...toolsProps
}: ReaderStudySidebarProps) {
  const [notesState, setNotesState] = useState<NotesTabState>({ filter: "all", selectedNoteId: null, context: null });
  const [searchState, setSearchState] = useState<SearchPageState | null>(null);
  const continueReading = (bookIndex: number, chapterIndex: number) => {
    progressProps.onContinueReading(bookIndex, chapterIndex);
    onNavigateAway();
  };
  const { title, icon } = activeTab === "home"
    ? { title: "Sidebar Home", icon: HouseIcon }
    : PANEL_HOME_DESTINATIONS[activeTab];

  // Exhaustive against the shared Home destinations: new options cannot silently
  // appear in Home without also gaining a sidebar content view.
  const content: Record<PanelHomeDestination, () => ReactNode> = {
    tools: () => (
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 p-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onExpandAll} disabled={!canExpand}>
              <CopyPlusIcon data-icon="inline-start" />Expand All
            </Button>
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onCollapseAll} disabled={!canCollapse}>
              <CopyMinusIcon data-icon="inline-start" />Collapse All
            </Button>
          </div>
          <Separator />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [contain:inline-size]">
          <Accordion className="workspace-panel-elevated w-full rounded-2xl border px-3 **:data-[slot=accordion-trigger]:transition-none [&_[data-slot=accordion-trigger]>svg]:transition-none"
            multiple value={accordionValue} onValueChange={(value) => onAccordionValueChange(value.filter(Boolean) as string[])}>
            <ReaderStudyToolsContent {...toolsProps} />
          </Accordion>
        </div>
      </div>
    ),
    topics: () => <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden p-2 [contain:inline-size]"><TopicsContent {...topicsProps} /></div>,
    notes: () => <LazyNotesPage {...notesProps} tabState={notesState} onTabStateChange={(patch) => setNotesState((current) => ({ ...current, ...patch }))}
      onOpenNoteLink={(target) => { notesProps.onOpenNoteLink(target); onNavigateAway(); }} />,
    bookmarks: () => <div className="h-full overflow-y-auto p-2"><BookmarksTool {...bookmarksProps}
      onOpenBookmark={(bookmark) => { bookmarksProps.onOpenBookmark(bookmark); onNavigateAway(); }} /></div>,
    search: () => <LazySearchPage {...searchProps} state={searchState ?? createDefaultSearchPageState(searchProps.books)}
      onStateChange={(patch) => setSearchState((current) => ({ ...(current ?? createDefaultSearchPageState(searchProps.books)), ...patch }))}
      onOpenResult={(...args) => { searchProps.onOpenResult(...args); onNavigateAway(); }} />,
    quiz: () => <LazyQuiz initialBook={toolsProps.summaryProps.books[toolsProps.summaryProps.context?.bookIndex ?? 0]?.name} initialChapter={(toolsProps.summaryProps.context?.chapterIndex ?? 0) + 1} />,
    progress: () => <div className="h-full overflow-y-auto p-2"><LazyProgress {...progressProps} onContinueReading={continueReading}
      onOpenChapterInNewTab={(bookIndex, chapterIndex) => { progressProps.onOpenChapterInNewTab(bookIndex, chapterIndex); onNavigateAway(); }} /></div>,
  };

  return (
    <div data-tour="sidebar">
      <StudyToolsSidebar visible={visible} title={title} icon={icon} isHome={activeTab === "home"}
        onHome={() => onActiveTabChange("home")} onActivate={onActivate}>
        <Suspense fallback={<p className="p-3 text-sm text-muted-foreground">Loading {title.toLowerCase()}...</p>}>
          {activeTab === "home" ? (
            <div className="h-full overflow-y-auto p-2">
              <PanelHome readingContinuation={progressProps.readingContinuation}
                isReadingProgressReady={progressProps.isReadingProgressReady}
                onContinueReading={continueReading} onOpen={onActiveTabChange} />
            </div>
          ) : content[activeTab]()}
        </Suspense>
      </StudyToolsSidebar>
    </div>
  );
}, areReaderViewModelsEqual);
