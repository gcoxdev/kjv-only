import { chapterLabel } from "@/lib/bible-books";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpenCheckIcon, BookOpenIcon } from "lucide-react";
import { bookCodeForIndex, iconPath } from "@/lib/reader-view";
import type { ReadingContinuation } from "@/lib/reading-progress";

type ProgressChapter = {
  chapterIndex: number;
  chapterNumber: number;
  read: boolean;
};

type ProgressBook = {
  name: string;
  bookIndex: number;
  read: number;
  total: number;
  chapters: ProgressChapter[];
};

type ProgressTestament = {
  label: string;
  read: number;
  total: number;
  books: ProgressBook[];
};

type ProgressByTestament = {
  old: ProgressTestament;
  new: ProgressTestament;
  total: { read: number; total: number };
};

export type ProgressPanelContentProps = {
  totalProgressPercent: number;
  progressByTestament: ProgressByTestament;
  readingContinuation: ReadingContinuation | null;
  isReadingProgressReady: boolean;
  onSetAllTestamentChaptersRead: (testament: "old" | "new", read: boolean) => void;
  onSetAllBookChaptersRead: (bookIndex: number, read: boolean) => void;
  onOpenChapterInNewTab: (bookIndex: number, chapterIndex: number) => void;
  onContinueReading: (bookIndex: number, chapterIndex: number) => void;
  onToggleChapterRead: (bookIndex: number, chapterIndex: number) => void;
  onResetAllProgress: () => void;
};

export function ProgressPanelContent({
  totalProgressPercent,
  progressByTestament,
  readingContinuation,
  isReadingProgressReady,
  onSetAllTestamentChaptersRead,
  onSetAllBookChaptersRead,
  onOpenChapterInNewTab,
  onContinueReading,
  onToggleChapterRead,
  onResetAllProgress,
}: ProgressPanelContentProps) {
  const continuationLabel = readingContinuation
    ? `${chapterLabel(readingContinuation.bookName, readingContinuation.chapterNumber)}`
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 flex flex-col gap-3 overflow-auto pr-1 text-sm">
        <Progress value={totalProgressPercent} className="w-full">
          <ProgressLabel className="font-semibold">Whole Bible</ProgressLabel>
          <ProgressValue>
            {() =>
              `${progressByTestament.total.read}/${progressByTestament.total.total} (${totalProgressPercent}%)`
            }
          </ProgressValue>
        </Progress>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/70 p-3">
          <div className="min-w-0 flex-[1_1_12rem] break-words">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Up next
            </p>
            <p className="mt-1 font-semibold text-foreground" aria-live="polite">
              {!isReadingProgressReady
                ? "Preparing reading progress..."
                : continuationLabel ?? "Reading complete"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {!isReadingProgressReady
                ? "The full chapter list is still loading."
                : continuationLabel
                  ? "Continue with the next unread chapter after your most recently marked chapter."
                  : "Every chapter in the Bible is marked as read."}
            </p>
          </div>
          <Button
            type="button"
            disabled={!isReadingProgressReady || !readingContinuation}
            aria-label={
              continuationLabel
                ? `Continue reading at ${continuationLabel}`
                : "Reading complete"
            }
            onClick={() => {
              if (readingContinuation) {
                onContinueReading(
                  readingContinuation.bookIndex,
                  readingContinuation.chapterIndex,
                );
              }
            }}
          >
            <BookOpenIcon data-icon="inline-start" />
            {isReadingProgressReady && readingContinuation
              ? "Continue Reading"
              : isReadingProgressReady
                ? "Bible Complete"
                : "Preparing..."}
          </Button>
        </div>

        <Accordion className="w-full rounded-md border px-3" multiple defaultValue={[]}>
          {[progressByTestament.old, progressByTestament.new].map((testament) => {
            const testamentPercent =
              testament.total > 0
                ? Math.round((testament.read / testament.total) * 100)
                : 0;
            const testamentCode = testament.label.startsWith("Old") ? "OT" : "NT";
            const testamentIconSrc = iconPath(
              testamentPercent === 100 ? "color" : "bw",
              testamentCode,
            );

            return (
              <AccordionItem key={testament.label} value={testament.label} className="w-full">
                <AccordionTrigger className="w-full">
                  <div className="flex w-full items-center gap-3">
                    <img
                      src={testamentIconSrc}
                      alt={`${testament.label} icon`}
                      className="size-10 shrink-0"
                    />
                    <Progress value={testamentPercent} className="w-full">
                      <ProgressLabel>{testament.label}</ProgressLabel>
                      <ProgressValue>
                        {() =>
                          `${testament.read}/${testament.total} (${testamentPercent}%)`
                        }
                      </ProgressValue>
                    </Progress>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <Accordion className="w-full rounded-md border px-2" multiple defaultValue={[]}>
                    {testament.books.map((book) => {
                      const bookPercent =
                        book.total > 0
                          ? Math.round((book.read / book.total) * 100)
                          : 0;
                      const bookIconSrc = iconPath(
                        bookPercent === 100 ? "color" : "bw",
                        bookCodeForIndex(book.bookIndex),
                      );

                      return (
                        <AccordionItem
                          key={book.name}
                          value={`${testament.label}-${book.name}`}
                          className="w-full"
                        >
                          <AccordionTrigger className="w-full px-1">
                            <div className="flex w-full items-center gap-3">
                              <img
                                src={bookIconSrc}
                                alt={`${book.name} icon`}
                                className="size-10 shrink-0"
                              />
                              <Progress value={bookPercent} className="w-full">
                                <ProgressLabel className="text-xs">{book.name}</ProgressLabel>
                                <ProgressValue className="text-xs">
                                  {() => `${book.read}/${book.total} (${bookPercent}%)`}
                                </ProgressValue>
                              </Progress>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 px-1">
                            <div className="flex flex-col gap-1">
                              {book.chapters.map((chapter) => (
                                <div
                                  key={`${book.name}-${chapter.chapterNumber}`}
                                  className="flex items-center gap-2"
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 justify-start"
                                    onClick={() =>
                                      onOpenChapterInNewTab(
                                        book.bookIndex,
                                        chapter.chapterIndex,
                                      )
                                    }
                                  >
                                    {`Chapter ${chapter.chapterNumber}`}
                                  </Button>
                                  <Button
                                    variant={chapter.read ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() =>
                                      onToggleChapterRead(
                                        book.bookIndex,
                                        chapter.chapterIndex,
                                      )
                                    }
                                  >
                                    {chapter.read ? <BookOpenIcon /> : <BookOpenCheckIcon />}
                                    {chapter.read ? "Read" : "Mark Read"}
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onSetAllBookChaptersRead(
                                    book.bookIndex,
                                    book.read !== book.total,
                                  )
                                }
                              >
                                {book.read === book.total
                                  ? "Mark all incomplete"
                                  : "Mark all complete"}
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onSetAllTestamentChaptersRead(
                          testamentCode === "OT" ? "old" : "new",
                          testament.read !== testament.total,
                        )
                      }
                    >
                      {testament.read === testament.total
                        ? "Mark testament incomplete"
                        : "Mark testament complete"}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
      <div className="flex justify-end pt-3">
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm("Reset all reading progress?")) {
              onResetAllProgress();
            }
          }}
        >
          Reset Progress
        </Button>
      </div>
    </div>
  );
}
