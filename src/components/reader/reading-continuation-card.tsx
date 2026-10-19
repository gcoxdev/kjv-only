import { chapterLabel } from "@/lib/bible-books";
import { BookOpenIcon, ChartBarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReadingContinuation } from "@/lib/reading-progress"

type ReadingContinuationCardProps = {
  readingContinuation: ReadingContinuation | null
  isReadingProgressReady: boolean
  onContinueReading: (bookIndex: number, chapterIndex: number) => void
  onOpenProgress: () => void
  className?: string
}

export function ReadingContinuationCard({
  readingContinuation,
  isReadingProgressReady,
  onContinueReading,
  onOpenProgress,
  className,
}: ReadingContinuationCardProps) {
  const continuationLabel = readingContinuation
    ? `${chapterLabel(readingContinuation.bookName, readingContinuation.chapterNumber)}`
    : null

  return (
    <section
      aria-label="Reading progress"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3",
        className,
      )}
    >
      <div className="min-w-0 flex-[1_1_12rem] break-words">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Reading progress
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground" aria-live="polite">
          {!isReadingProgressReady
            ? "Preparing reading progress..."
            : continuationLabel
              ? `Next: ${continuationLabel}`
              : "Reading complete"}
        </p>
      </div>
      <div className="flex max-w-full flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
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
              )
            }
          }}
        >
          <BookOpenIcon data-icon="inline-start" />
          Continue
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenProgress}
        >
          <ChartBarIcon data-icon="inline-start" />
          Reading Progress
        </Button>
      </div>
    </section>
  )
}
