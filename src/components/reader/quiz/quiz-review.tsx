import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY, quizScopeLabel, type quizStats } from "@/lib/quiz/engine";
import type { QuizQuestion } from "@/lib/quiz/types";

type Stats = ReturnType<typeof quizStats>;
type ObjectiveProgress = NonNullable<ReturnType<Stats["get"]>>;
const reviewReasons = { mistake: "Review a missed answer", assisted: "Try without assistance", skipped: "Try a skipped question", scheduled: "Scheduled recall" };
export function QuizReviewDate({ progress }: { progress: ObjectiveProgress | undefined }) {
  if (!progress || progress.dueAt === null) return null;
  return <span>{progress.due ? `Review due · ${reviewReasons[progress.reviewReason!]}` : <>Next review: <time dateTime={new Date(progress.dueAt).toISOString()}>{new Date(progress.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></>}</span>;
}

export function QuizReview({ objectives, stats, now, pending, onReview }: {
  objectives: QuizQuestion[]; stats: Stats; now: number; pending: boolean;
  onReview: (kind: "due" | "missed") => void;
}) {
  const summary = useMemo(() => {
    let due = 0, missed = 0, upcoming = 0;
    const scheduled: { question: QuizQuestion; progress: ObjectiveProgress }[] = [];
    for (const question of objectives) {
      const progress = stats.get(question.objective)!;
      if (progress.due) due++;
      if (progress.missed) missed++;
      if (progress.dueAt !== null) {
        if (!progress.due && progress.dueAt <= now + 7 * DAY) upcoming++;
        scheduled.push({ question, progress });
      }
    }
    scheduled.sort((a, b) => a.progress.dueAt! - b.progress.dueAt! || a.question.id.localeCompare(b.question.id));
    return { due, missed, upcoming, next: scheduled.slice(0, 5), count: scheduled.length };
  }, [objectives, stats, now]);

  return <Card>
    <CardHeader><CardTitle>Review schedule</CardTitle><CardDescription>Review needs are separate from earned mastery.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-3 pb-4">
      <div className="grid grid-cols-3 gap-3">
        {[[summary.due, "Due now"], [summary.missed, "Missed or skipped"], [summary.upcoming, "Due in next 7 days"]].map(([count, label]) => <div key={label}><p className="text-2xl font-semibold">{count}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
      </div>
      <p className="text-xs text-muted-foreground">After learning an objective, review is due in one day. Successful due reviews in later sessions extend the interval to seven, then thirty days. Early practice does not postpone review. A missed, skipped, or assisted answer prompts practice again; successful recovery restarts the one-day interval.</p>
      {summary.count ? <details>
        <summary className="cursor-pointer text-sm font-medium">Next reviews ({summary.next.length} of {summary.count})</summary>
        <ul className="mt-3 flex flex-col gap-3">{summary.next.map(({ question, progress }) => <li key={question.objective} className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{quizScopeLabel(question)}</p><p>{question.prompt}</p>
          <p className="text-xs text-muted-foreground"><QuizReviewDate progress={progress} /></p>
        </li>)}</ul>
      </details> : <p className="text-sm text-muted-foreground">Complete a quiz to start your review schedule.</p>}
      {!summary.due && summary.count > 0 ? <p className="text-sm">You’re caught up on scheduled reviews.</p> : null}
    </CardContent>
    <CardFooter className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={pending || !summary.missed} onClick={() => onReview("missed")}>Review mistakes</Button><Button size="sm" variant="outline" disabled={pending || !summary.due} onClick={() => onReview("due")}>Practice due items</Button></div>
      <p className="text-xs text-muted-foreground">Review buttons use all your attempted objectives and the session length chosen on Start, regardless of its scope filters.</p>
    </CardFooter>
  </Card>;
}
