import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import type { QuizReadingRequest } from "@/lib/quiz/types";
import { QuizPage } from "./quiz-page";

export function ReadingQuizDialog({ request, readChapters, onClose }: { request: QuizReadingRequest; readChapters: ReadonlySet<string>; onClose: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[90dvh] max-h-[56rem] min-h-0 flex-col gap-2 p-3 sm:max-w-3xl">
      <DialogHeader className="shrink-0 pr-8"><DialogTitle>Quiz after reading</DialogTitle><DialogDescription>Quizzes are optional. Return to reading whenever you like.</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1"><QuizPage initialBook={BIBLE_BOOKS[request.bookIndex].name} initialChapter={request.chapterIndex + 1} readingRequest={request} readingChapters={readChapters} onFinishReading={onClose} /></div>
    </DialogContent>
  </Dialog>;
}
