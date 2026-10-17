import {
  createContext,
  memo,
  type ReactNode,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import { ExternalLinkIcon, ListTreeIcon } from "lucide-react";

import { ConcordanceReferencePopover } from "@/components/reader/concordance-reference-popover";
import { ToolReferenceFilter } from "@/components/reader/tool-reference-filter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import { useOptionalSidebar } from "@/components/ui/sidebar";
import { orderToolReferences } from "@/lib/tool-references";
import type { Book } from "@/types/bible";
import type { ToolReferenceDisplayMode } from "@/types/reader";

type ReferencePreviewRenderer = (
  reference: string,
  highlightWord: string,
  options?: {
    includeContext?: boolean;
    citationActions?: ReactNode;
    contextId?: string;
  },
) => ReactNode;

type ToolReferenceListProps = {
  references: string[];
  referenceLabels?: Record<string, string>;
  highlightWord: string;
  renderPreview: ReferencePreviewRenderer;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
};

const SCROLLABLE_REFERENCE_COUNT = 6;
const INITIAL_REFERENCE_ROWS = 50;
const REFERENCE_ROW_BATCH_SIZE = 50;
const EMPTY_BOOKS: Book[] = [];
const EMPTY_BOOK_INDEXES = new Set<number>();
type ToolReferenceDisplayContextValue = {
  mode: ToolReferenceDisplayMode;
  books: Book[];
};
const ToolReferenceDisplayModeContext =
  createContext<ToolReferenceDisplayContextValue>({
    mode: "buttons",
    books: EMPTY_BOOKS,
  });

export function ToolReferenceDisplayModeProvider({
  mode,
  books,
  children,
}: {
  mode: ToolReferenceDisplayMode;
  books: Book[];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ mode, books }), [books, mode]);
  return (
    <ToolReferenceDisplayModeContext.Provider value={value}>
      {children}
    </ToolReferenceDisplayModeContext.Provider>
  );
}

function useToolReferenceDisplayMode() {
  return useContext(ToolReferenceDisplayModeContext);
}

export const ToolReferenceList = memo(function ToolReferenceList({
  references,
  referenceLabels,
  highlightWord,
  renderPreview,
  onOpenReference,
  onCloseSidebar,
}: ToolReferenceListProps) {
  const { mode: displayMode, books } = useToolReferenceDisplayMode();
  const sidebar = useOptionalSidebar();
  const listId = useId().replace(/[^a-zA-Z0-9_-]/g, "-");
  const referenceSignature = useMemo(
    () => references.join("\u0000"),
    [references],
  );
  const orderedReferences = useMemo(
    () => orderToolReferences(references),
    [references],
  );
  const [bookFilterState, setBookFilterState] = useState<{
    referenceSignature: string;
    excludedBookIndexes: Set<number>;
  }>(() => ({
    referenceSignature,
    excludedBookIndexes: new Set(),
  }));
  const excludedBookIndexes =
    bookFilterState.referenceSignature === referenceSignature
      ? bookFilterState.excludedBookIndexes
      : EMPTY_BOOK_INDEXES;
  const filteredReferences = useMemo(
    () =>
      orderedReferences.filter(
        (entry) =>
          !entry.location ||
          !excludedBookIndexes.has(entry.location.bookIndex),
      ),
    [excludedBookIndexes, orderedReferences],
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );
  const [visibleReferenceCount, setVisibleReferenceCount] = useState(
    INITIAL_REFERENCE_ROWS,
  );

  const setBooksIncluded = (bookIndexes: number[], checked: boolean) => {
    setVisibleReferenceCount(INITIAL_REFERENCE_ROWS);
    setBookFilterState((current) => {
      const next = new Set(
        current.referenceSignature === referenceSignature
          ? current.excludedBookIndexes
          : EMPTY_BOOK_INDEXES,
      );
      for (const bookIndex of bookIndexes) {
        if (checked) {
          next.delete(bookIndex);
        } else {
          next.add(bookIndex);
        }
      }
      return { referenceSignature, excludedBookIndexes: next };
    });
  };

  const showAllReferences = () => {
    setVisibleReferenceCount(INITIAL_REFERENCE_ROWS);
    setBookFilterState({
      referenceSignature,
      excludedBookIndexes: new Set(),
    });
  };

  const openReference = (reference: string) => {
    onOpenReference(reference);
    const supportsHover =
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    if (!supportsHover) {
      sidebar?.setOpenMobile(false);
      onCloseSidebar();
    }
  };

  const visibleReferences = filteredReferences.slice(0, visibleReferenceCount);
  const remainingReferenceCount =
    filteredReferences.length - visibleReferences.length;

  const table = displayMode === "table" ? (
    <Table className="table-fixed">
      <TableCaption className="sr-only">Scripture references</TableCaption>
      <TableBody>
        {visibleReferences.map((entry) => {
          const { reference, originalIndex } = entry;
          const rowKey = `${reference}-${originalIndex}`;
          const isExpanded = expandedRows.has(rowKey);
          const contextId = `tool-reference-context-${listId}-${rowKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          const citationActions = (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => openReference(reference)}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Open
              </Button>
              <Button
                type="button"
                size="xs"
                variant={isExpanded ? "secondary" : "outline"}
                aria-controls={contextId}
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpandedRows((current) => {
                    const next = new Set(current);
                    if (next.has(rowKey)) {
                      next.delete(rowKey);
                    } else {
                      next.add(rowKey);
                    }
                    return next;
                  })
                }
              >
                <ListTreeIcon data-icon="inline-start" />
                {isExpanded ? "Hide" : "Context"}
              </Button>
            </div>
          );
          return (
            <TableRow key={rowKey} data-reference={reference}>
              <TableCell className="w-full min-w-0 align-top whitespace-normal break-words">
                <div
                  className="min-w-0 text-xs leading-relaxed [content-visibility:auto] [contain-intrinsic-size:auto_5rem]"
                >
                  {renderPreview(reference, highlightWord, {
                    includeContext: isExpanded,
                    citationActions,
                    contextId,
                  })}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      {remainingReferenceCount > 0 ? (
        <TableFooter>
          <TableRow>
            <TableCell className="text-center">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setVisibleReferenceCount((current) =>
                    Math.min(
                      filteredReferences.length,
                      current + REFERENCE_ROW_BATCH_SIZE,
                    ),
                  )
                }
              >
                Show more ({remainingReferenceCount} remaining)
              </Button>
            </TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  ) : null;

  const referenceContent = (() => {
    if (filteredReferences.length === 0) {
      return (
        <div className="flex flex-col items-start gap-2 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            No references match the current filters.
          </p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={showAllReferences}
          >
            Show all references
          </Button>
        </div>
      );
    }

    if (displayMode === "buttons") {
      return (
        <div
          data-tool-reference-display="buttons"
          className="flex flex-wrap gap-1.5"
        >
          {filteredReferences.map(({ reference, originalIndex }) => (
            <ConcordanceReferencePopover
              key={`${reference}-${originalIndex}`}
              reference={reference}
              label={referenceLabels?.[reference]}
              highlightWord={highlightWord}
              renderPreview={renderPreview}
              onOpenReference={onOpenReference}
              onCloseSidebar={onCloseSidebar}
            />
          ))}
        </div>
      );
    }

    return filteredReferences.length > SCROLLABLE_REFERENCE_COUNT ? (
      <ScrollArea
        data-tool-reference-display="table"
        className="h-[min(24rem,60vh)] w-full min-w-0 max-w-full rounded-md border"
      >
        {table}
      </ScrollArea>
    ) : (
      <div
        data-tool-reference-display="table"
        className="w-full min-w-0 max-w-full rounded-md border"
      >
        {table}
      </div>
    );
  })();

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ToolReferenceFilter
        orderedReferences={orderedReferences}
        books={books}
        excludedBookIndexes={excludedBookIndexes}
        visibleCount={filteredReferences.length}
        onBooksChange={setBooksIncluded}
        onShowAll={showAllReferences}
      />
      {referenceContent}
    </div>
  );
});
