import { chapterLabel } from "@/lib/bible-books";
import { type ReactNode } from "react";
import { BookSearchIcon, LoaderCircleIcon } from "lucide-react";

import type { Book } from "@/types/bible";
import { cn } from "@/lib/utils";
import { parseBibleReference } from "@/lib/references";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ToolReferenceList } from "@/components/reader/tool-reference-list";
import { Badge } from "@/components/ui/badge";

type CrossRefsToolProps = {
  hasInfo: boolean;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  selected: { key: string; references: string[] } | null;
  books: Book[];
  renderPreview: (reference: string, highlightWord: string) => ReactNode;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
};

function selectedLabel(selectedKey: string, books: Book[]) {
  const parsed = parseBibleReference(selectedKey);
  if (!parsed) {
    return selectedKey;
  }
  const book = books[parsed.bookIndex];
  return `${chapterLabel(book?.name ?? parsed.bookCode, parsed.startChapterIndex + 1)}:${parsed.startVerse}`;
}

export function CrossRefsTool({
  hasInfo,
  isOpen,
  isLoading,
  error,
  selected,
  books,
  renderPreview,
  onOpenReference,
  onCloseSidebar,
}: CrossRefsToolProps) {
  return (
    <AccordionItem value="cross-refs">
      <AccordionTrigger
        className={cn(hasInfo && "text-success")}
      >
        <BookSearchIcon />
        Cross References
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-2 overflow-visible">
        {isOpen ? (
          <>
            {isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" />
                Loading cross references...
              </p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !selected ? (
              <p className="text-sm text-muted-foreground">
                Click a word or verse to load cross references.
              </p>
            ) : selected.references.length === 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{selectedLabel(selected.key, books)}</p>
                <p className="text-sm text-muted-foreground">No cross references found.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{selectedLabel(selected.key, books)}</p>
                <Accordion
                  className="w-full rounded-md border px-2 [&_[data-slot=accordion-content]]:pb-1 [&_[data-slot=accordion-trigger]]:py-1"
                  multiple
                >
                  <AccordionItem value="cross-refs-references">
                    <AccordionTrigger className="min-w-0">
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        <span className="min-w-0 flex-1 break-words text-left">
                          References
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {selected.references.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ToolReferenceList
                        references={selected.references}
                        highlightWord=""
                        renderPreview={renderPreview}
                        onOpenReference={onOpenReference}
                        onCloseSidebar={onCloseSidebar}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
