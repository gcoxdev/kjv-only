import { useEffect, useState, type ReactNode } from "react";
import { BookOpenTextIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReaderControlTooltip } from "@/components/reader/reader-control-tooltip";
import { ToolReferenceList } from "@/components/reader/tool-reference-list";
import type { TimelineReaderContext } from "@/hooks/use-timeline-reader-context";
import { loadChapterSummaries, loadSummaryOverview, summaryChapterLabel, summaryReferenceCode, summaryReferenceLabel, type ChapterSummaries, type SummaryReference } from "@/lib/summaries";
import type { Book } from "@/types/bible";

type SummaryToolProps = {
  isOpen: boolean;
  context: TimelineReaderContext | null;
  books: Book[];
  renderPreview: (reference: string, highlightWord: string) => ReactNode;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
};

type LoadedSummary = {
  chapterBookIndex: number | null;
  attempt: number;
} & ({ data: { chapters: ChapterSummaries | null; overview: Awaited<ReturnType<typeof loadSummaryOverview>> } } | { error: string });

function SummaryReferences({ references, books, ...props }: Pick<SummaryToolProps, "books" | "renderPreview" | "onOpenReference" | "onCloseSidebar"> & { references: SummaryReference[] }) {
  const labels = Object.fromEntries(references.map(reference => [summaryReferenceCode(reference, books), summaryReferenceLabel(reference)]));
  return <ToolReferenceList references={Object.keys(labels)} referenceLabels={labels} highlightWord="" {...props} />;
}

export function SummaryTool({ isOpen, context, books, ...referenceProps }: SummaryToolProps) {
  const [level, setLevel] = useState("chapter");
  const [browsing, setBrowsing] = useState<TimelineReaderContext | null>(null);
  const selection = browsing ?? context ?? { bookIndex: 0, chapterIndex: 0 };
  const bookIndex = Math.max(0, Math.min(selection.bookIndex, books.length - 1));
  const book = books[bookIndex];
  const chapterIndex = Math.max(0, Math.min(selection.chapterIndex, (book?.chapters.length ?? 1) - 1));
  const chapterNumber = chapterIndex + 1;
  const [loaded, setLoaded] = useState<LoadedSummary | null>(null);
  const [attempt, setAttempt] = useState(0);
  const chapterBookIndex = level === "chapter" ? bookIndex : null;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void Promise.all([chapterBookIndex === null ? Promise.resolve(null) : loadChapterSummaries(chapterBookIndex), loadSummaryOverview()]).then(
      ([chapters, overview]) => {
        if (!cancelled) setLoaded({ chapterBookIndex, attempt, data: { chapters, overview } });
      },
      () => {
        if (!cancelled) setLoaded({ chapterBookIndex, attempt, error: "Could not load summaries. Check your connection or download the app for offline use, then try again." });
      },
    );
    return () => { cancelled = true; };
  }, [isOpen, chapterBookIndex, attempt]);

  const current = loaded?.chapterBookIndex === chapterBookIndex && loaded.attempt === attempt ? loaded : null;
  const data = current && "data" in current ? current.data : null;
  const chapter = data?.chapters?.chapters[chapterIndex];
  const overview = data?.overview.books[bookIndex];
  const bible = data?.overview.bible;
  const selectChapter = (index: number) => setBrowsing({ bookIndex, chapterIndex: index });

  return (
    <AccordionItem value="summary">
      <AccordionTrigger className="text-success"><BookOpenTextIcon />Summary</AccordionTrigger>
      <AccordionContent className="min-w-0 overflow-visible">
        {isOpen && book ? (
          <Tabs value={level} onValueChange={(value) => setLevel(String(value))} className="min-w-0 gap-3">
            <TabsList className="w-full" aria-label="Summary level">
              <TabsTrigger value="chapter">Chapter</TabsTrigger>
              <TabsTrigger value="book">Book</TabsTrigger>
              <TabsTrigger value="bible">Bible</TabsTrigger>
            </TabsList>
            {level !== "bible" ? (
              <div className="flex min-w-0 flex-col gap-2" role="group" aria-label="Summary passage">
                <Select value={String(bookIndex)} onValueChange={(value) => {
                  if (value !== null) setBrowsing({ bookIndex: Number(value), chapterIndex: 0 });
                }}>
                  <SelectTrigger className="w-full min-w-0" aria-label="Summary book"><SelectValue>{book.name}</SelectValue></SelectTrigger>
                  <SelectContent className="min-w-52" align="start" alignItemWithTrigger={false}>
                    <SelectGroup>{books.map((entry, index) => (
                      <SelectItem key={entry.name} value={String(index)}><span className="whitespace-nowrap">{entry.name}</span></SelectItem>
                    ))}</SelectGroup>
                  </SelectContent>
                </Select>
                {level === "chapter" ? (
                  <div className="flex items-center gap-1">
                    <ReaderControlTooltip label="Previous summary chapter">
                      <Button size="icon-sm" variant="outline" aria-label="Previous summary chapter" disabled={chapterIndex === 0} onClick={() => selectChapter(chapterIndex - 1)}><ChevronLeftIcon /></Button>
                    </ReaderControlTooltip>
                    <Select value={String(chapterIndex)} onValueChange={(value) => { if (value !== null) selectChapter(Number(value)); }}>
                      <SelectTrigger className="min-w-0 flex-1" aria-label="Summary chapter"><SelectValue>{book.name === "Psalms" ? "Psalm" : "Chapter"} {chapterNumber}</SelectValue></SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>{book.chapters.map((entry, index) => (
                          <SelectItem key={entry.chapter} value={String(index)}>{entry.chapter}</SelectItem>
                        ))}</SelectGroup>
                      </SelectContent>
                    </Select>
                    <ReaderControlTooltip label="Next summary chapter">
                      <Button size="icon-sm" variant="outline" aria-label="Next summary chapter" disabled={chapterIndex === book.chapters.length - 1} onClick={() => selectChapter(chapterIndex + 1)}><ChevronRightIcon /></Button>
                    </ReaderControlTooltip>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                  <span>{browsing ? "Browsing summaries" : context ? "Following reader" : "Choose a passage to explore"}</span>
                  {browsing && context ? <Button size="xs" variant="outline" onClick={() => setBrowsing(null)}>Follow reader</Button> : null}
                </div>
              </div>
            ) : null}
            {!current ? <p role="status" className="text-sm text-muted-foreground">Loading summaries…</p> : "error" in current ? (
              <div className="flex flex-col items-start gap-2">
                <p role="alert" className="text-sm text-destructive">{current.error}</p>
                <Button size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>
              </div>
            ) : null}
            <TabsContent value="chapter" className="min-w-0">
              {chapter && level === "chapter" ? (
                <article className="flex flex-col gap-3" aria-label={`${summaryChapterLabel(book.name, chapterNumber)} summary`}>
                  <div>
                    <p className="text-xs text-muted-foreground">{summaryChapterLabel(book.name, chapterNumber)}</p>
                    <h3 className="font-medium">{chapter.title}</h3>
                  </div>
                  {chapter.parts.map(part => (
                    <div key={part.start} className="flex min-w-0 flex-col gap-1.5">
                      <p className="leading-relaxed">{part.text}</p>
                      <SummaryReferences references={[{ book: book.name, chapter: chapterNumber, start: part.start, end: part.end }]} books={books} {...referenceProps} />
                    </div>
                  ))}
                </article>
              ) : null}
            </TabsContent>
            <TabsContent value="book" className="min-w-0">
              {overview && level === "book" ? (
                <article className="flex flex-col gap-3" aria-label={`${book.name} book summary`}>
                  <h3 className="font-medium">{overview.title}</h3>
                  {overview.parts.map(part => (
                    <div key={part.start} className="flex flex-col items-start gap-1.5">
                      <Button variant="outline" size="xs" aria-label={`Show ${summaryChapterLabel(book.name, part.start)} summary`} onClick={() => { selectChapter(part.start - 1); setLevel("chapter"); }}>
                        {book.name === "Psalms" ? (part.start === part.end ? "Psalm" : "Psalms") : (part.start === part.end ? "Chapter" : "Chapters")} {part.start}{part.start === part.end ? "" : `–${part.end}`}
                      </Button>
                      <p className="leading-relaxed">{part.text}</p>
                    </div>
                  ))}
                </article>
              ) : null}
            </TabsContent>
            <TabsContent value="bible" className="min-w-0">
              {bible && level === "bible" ? (
                <article className="flex flex-col gap-4" aria-label="Whole Bible summary">
                  <div className="flex flex-col gap-2">
                    <h3 className="font-medium">{bible.title}</h3>
                    <p className="leading-relaxed">{bible.intro}</p>
                  </div>
                  {bible.testaments.map(testament => (
                    <section key={testament.id} className="flex flex-col gap-3" aria-label={`${testament.name} summary`}>
                      <div>
                        <h4 className="font-medium">{testament.name}</h4>
                        <p className="text-xs text-muted-foreground">{testament.subtitle}</p>
                      </div>
                      {testament.parts.map((part, index) => (
                        <div key={index} className="flex min-w-0 flex-col gap-1.5">
                          <p className="leading-relaxed">{part.text}</p>
                          <SummaryReferences references={part.references} books={books} {...referenceProps} />
                        </div>
                      ))}
                    </section>
                  ))}
                </article>
              ) : null}
            </TabsContent>
          </Tabs>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
