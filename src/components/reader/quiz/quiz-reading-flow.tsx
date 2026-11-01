import { QuizHelp } from "./quiz-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { QUIZ_SKILLS } from "@/lib/quiz/engine";
import { nextReadingQuizStep, readingQuizStepLabel } from "@/lib/quiz/reading";
import type { QuizReadingFlow, QuizSession } from "@/lib/quiz/types";

export function QuizReadingFlowCard({ flow, sessions, activeSessionId, pending, onStart, onSkip, onLater, onDismiss }: {
  flow: QuizReadingFlow; sessions: QuizSession[]; activeSessionId: string | null; pending: boolean;
  onStart: (step: number) => void; onSkip: (step: number) => void; onLater: () => void; onDismiss: () => void;
}) {
  const index = nextReadingQuizStep(flow, sessions), next = flow.steps[index];
  const active = !!next?.sessionId && next.sessionId === activeSessionId;
  return <Card>
    <CardHeader className="pb-3"><CardTitle>After reading {readingQuizStepLabel(flow, "chapter")}</CardTitle><QuizHelp title="Reading quizzes"><p>Take quizzes in order, skip a level, or return later. Started quizzes stay saved.</p><p>Milestone offers follow KJV book order; they do not mean you have read or mastered earlier chapters.</p></QuizHelp><CardDescription>{active ? `Quiz ${index + 1} of ${flow.steps.length} · ${readingQuizStepLabel(flow, next.scope)}` : "Continue, skip, or come back later."}</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-2 pb-4">
      <details key={active ? "active" : "overview"} open={!active}><summary className="cursor-pointer text-sm font-medium">Sequence and quiz options</summary><div className="mt-2 flex flex-col gap-2">
      <ol aria-label="Reading quiz sequence" className="flex flex-col gap-1 text-sm">{flow.steps.map((step, i) => {
        const session = sessions.find(s => s.id === step.sessionId);
        const status = step.skipped === "empty" ? "Skipped: no questions match your filters" : step.skipped ? "Skipped" : session?.done ? "Complete" : step.sessionId ? "In progress" : "Waiting";
        return <li key={step.scope}>{i + 1}. {readingQuizStepLabel(flow, step.scope)} — {status}</li>;
      })}</ol>
      <p className="text-xs text-muted-foreground">Up to {flow.options.length} questions per quiz · {flow.options.difficulty === "all" ? "Mixed difficulty" : flow.options.difficulty} · {flow.options.skill === "all" ? "All skills" : QUIZ_SKILLS[flow.options.skill]} · {flow.options.mode === "practice" ? "Practice" : "Assessment"}. {flow.options.readOnly ? "Only chapters marked read." : "May include unread chapters."}</p>
      </div></details>
      {!next ? <p className="text-sm">No remaining quizzes in this sequence.</p> : null}
    </CardContent>
    <CardFooter className="flex flex-wrap gap-2">
      {next && !active ? <Button size="sm" disabled={pending} onClick={() => onStart(index)}>{next.sessionId ? "Resume" : index === 0 ? "Start" : "Continue to"} {readingQuizStepLabel(flow, next.scope)}{index === 0 && !next.sessionId ? " quiz" : ""}</Button> : null}
      {next ? <Button size="sm" variant="outline" disabled={pending} onClick={() => onSkip(index)}>Skip this quiz</Button> : null}
      <Button size="sm" variant="outline" disabled={pending} onClick={onLater}>Finish for now</Button>
      {next ? <Button size="sm" variant="ghost" disabled={pending} onClick={onDismiss}>Dismiss sequence</Button> : null}
    </CardFooter>
  </Card>;
}
