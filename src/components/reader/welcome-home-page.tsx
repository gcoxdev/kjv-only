import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  BookOpenIcon,
  CompassIcon,
  DownloadIcon,
  HouseIcon,
  NotebookTabsIcon,
  SearchIcon,
  ScrollTextIcon,
} from "lucide-react";

import { ConcordanceReferencePopover } from "@/components/reader/concordance-reference-popover";
import { ReadingContinuationCard } from "@/components/reader/reading-continuation-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { dayOfYear } from "@/lib/calendar-date";
import { parseBibleReference } from "@/lib/references";
import { preloadSearchPage } from "@/lib/search-page-loader";
import {
  loadDailyScriptureTopics,
  type DailyScriptureTopicsPayload,
} from "@/lib/reader-data";
import type { Book } from "@/types/bible";
import type { ReadingContinuation } from "@/lib/reading-progress";
import type { StaticPageId } from "@/types/reader";

type WelcomeHomePageProps = {
  books: Book[];
  onStartTour: () => void;
  onOpenSearch: () => void;
  onOpenPage: (pageId: StaticPageId) => void;
  readingContinuation: ReadingContinuation | null;
  isReadingProgressReady: boolean;
  onContinueReading: (bookIndex: number, chapterIndex: number) => void;
  renderPreview: (reference: string, highlightWord: string) => ReactNode;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
  showAtStartup: boolean;
  onShowAtStartupChange: (checked: boolean) => void;
};

type DailyScriptureEntry = {
  reference: string;
  topic: string;
};

function renderVerseText(book: Book, chapterIndex: number, verseStart: number, verseEnd: number) {
  const chapter = book.chapters[chapterIndex];
  if (!chapter) {
    return "";
  }

  const verses = chapter.verses.filter(
    (verse) => verse.verse >= verseStart && verse.verse <= verseEnd,
  );

  return verses
    .map((verse) =>
      verse.tokens.reduce((text, token, index) => {
        const tokenText = token.divineName ? token.text.toUpperCase() : token.text;
        const noLeadingSpace =
          index === 0 ||
          /^['")\].,;:!?]+$/.test(tokenText) ||
          tokenText === "'s";
        return `${text}${noLeadingSpace ? "" : " "}${tokenText}`;
      }, ""),
    )
    .join(" ");
}

export function WelcomeHomePage({
  books,
  onStartTour,
  onOpenSearch,
  onOpenPage,
  readingContinuation,
  isReadingProgressReady,
  onContinueReading,
  renderPreview,
  onOpenReference,
  onCloseSidebar,
  showAtStartup,
  onShowAtStartupChange,
}: WelcomeHomePageProps) {
  const [dailyTopics, setDailyTopics] = useState<
    DailyScriptureTopicsPayload["topics"]
  >([]);

  const [dailySeed, setDailySeed] = useState(() => dayOfYear(new Date()) - 1);

  useEffect(() => {
    let day = new Date().toDateString();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      if (now.toDateString() !== day) {
        day = now.toDateString();
        setDailySeed(dayOfYear(now) - 1);
      }
      clearTimeout(timer);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadDailyScriptureTopics()
      .then((payload) => {
        if (!cancelled) {
          setDailyTopics(payload.topics);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDailyTopics([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const todaysEntry = useMemo<DailyScriptureEntry | null>(() => {
    if (dailyTopics.length === 0) {
      return null;
    }

    const topicIndex = dailySeed % dailyTopics.length;
    const topic = dailyTopics[topicIndex];
    if (!topic || topic.references.length === 0) {
      return null;
    }

    const referenceIndex = Math.floor(dailySeed / dailyTopics.length) % topic.references.length;
    const reference = topic.references[referenceIndex];
    if (!reference) {
      return null;
    }

    return {
      topic: topic.topic,
      reference,
    };
  }, [dailySeed, dailyTopics]);

  const dailyVerseText = useMemo(() => {
    if (!todaysEntry) {
      return "";
    }
    const parsed = parseBibleReference(todaysEntry.reference);
    if (!parsed) {
      return "";
    }
    const book = books[parsed.bookIndex];
    if (!book || parsed.startChapterIndex !== parsed.endChapterIndex) {
      return "";
    }
    return renderVerseText(
      book,
      parsed.startChapterIndex,
      parsed.startVerse,
      parsed.endVerse,
    );
  }, [books, todaysEntry]);

  function showAnotherScripture() {
    if (dailyTopics.length === 0) {
      return;
    }
    const totalPairs = dailyTopics.reduce(
      (count, topic) => count + Math.max(topic.references.length, 1),
      0,
    );
    if (totalPairs <= 1) {
      return;
    }
    let nextSeed = dailySeed;
    while (nextSeed === dailySeed) {
      nextSeed = Math.floor(Math.random() * totalPairs * dailyTopics.length);
    }
    setDailySeed(nextSeed);
  }

  return (
    <div className="flex flex-col gap-6" data-tour="welcome-home">
      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            Daily Scripture
          </CardTitle>
          <CardDescription>
            A Scripture to carry into today's reading and study.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-7 text-muted-foreground">
          {todaysEntry ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {todaysEntry.topic}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={showAnotherScripture}
                >
                  <BookOpenIcon />
                  Another Scripture
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-3">
                <div className="inline-flex max-w-full flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
                  <ConcordanceReferencePopover
                    reference={todaysEntry.reference}
                    highlightWord=""
                    renderPreview={renderPreview}
                    onOpenReference={onOpenReference}
                    onCloseSidebar={onCloseSidebar}
                  />
                </div>
                <p>{dailyVerseText || "Open the reference to read today's passage."}</p>
              </div>
            </>
          ) : (
            <p>Loading today's Scripture...</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HouseIcon className="size-4 text-muted-foreground" />
            Welcome Home
          </CardTitle>
          <CardDescription>
            KJV Only is a Scripture-first workspace for reading, studying,
            searching, note-taking, and cross-referencing the King James Bible.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
          <p>
            The goal is to keep the Bible text central while giving you fast
            access to notes, bookmarks, cross references, dictionaries,
            genealogy, maps, offline resources, and flexible multi-panel study
            layouts.
          </p>
          <p>
            A Genesis 1 reading tab is already open beside this page, so you
            can begin immediately, open search, or take the guided tour first.
          </p>
          <ReadingContinuationCard
            readingContinuation={readingContinuation}
            isReadingProgressReady={isReadingProgressReady}
            onContinueReading={onContinueReading}
            onOpenProgress={() => onOpenPage("progress")}
            className="bg-background/55"
          />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/55 px-3 py-2">
            <Label htmlFor="welcome-home-startup-card">
              Open Welcome Home Tab At Startup
            </Label>
            <Switch
              id="welcome-home-startup-card"
              checked={showAtStartup}
              onCheckedChange={onShowAtStartupChange}
            />
          </div>
          <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-3">
            <Button type="button" variant="outline" onClick={onStartTour}>
              <CompassIcon data-icon="inline-start" />
              Take the Tour
            </Button>
            <Button
              type="button"
              variant="outline"
              onMouseEnter={preloadSearchPage}
              onFocus={preloadSearchPage}
              onClick={onOpenSearch}
            >
              <SearchIcon />
              Open Search
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenPage("download")}>
              <DownloadIcon />
              Offline Download
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollTextIcon className="size-4 text-muted-foreground" />
              Read
            </CardTitle>
            <CardDescription>
              Move through books and chapters quickly, keep multiple panels
              open, and organize your own reading layout.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookTabsIcon className="size-4 text-muted-foreground" />
              Study
            </CardTitle>
            <CardDescription>
              Open notes, bookmarks, maps, Strong&apos;s, genealogy, and other
              study tools beside the text instead of leaving the reader.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="size-4 text-muted-foreground" />
              Search
            </CardTitle>
            <CardDescription>
              Search by phrase, selected words, or regex and send results to a
              new tab, panel, or targeted panel.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
