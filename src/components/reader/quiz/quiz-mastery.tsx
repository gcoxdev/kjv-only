import { QuizHelp } from "./quiz-help";
import { useMemo, useState } from "react";
import { AwardIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { QUIZ_SKILLS, type quizStats } from "@/lib/quiz/engine";
import { masteryCounts, quizCompletionBadges, quizMasteryTree, type MasteryScope } from "@/lib/quiz/mastery";
import { QUIZ_COVERAGE_RELEASES } from "@/lib/quiz/releases";
import type { QuizAttempt, QuizBank, QuizQuestion } from "@/lib/quiz/types";
import { QuizSelect } from "./quiz-controls";
import { QuizReviewDate } from "./quiz-review";

type Stats = ReturnType<typeof quizStats>;
type Node = MasteryScope<QuizQuestion>;
type Counts = ReturnType<typeof masteryCounts>;
type BranchProps = {
  node: Node; stats: Stats; groups: Map<string, { questions: QuizQuestion[]; own: QuizQuestion[]; counts: Counts }>;
  pending: boolean; onPractice: (questions: QuizQuestion[], label: string) => void;
};
function ObjectiveList({ questions, stats, label }: { questions: QuizQuestion[]; stats: Stats; label: string }) {
  const [open, setOpen] = useState(false), [limit, setLimit] = useState(25);
  return <details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">{label} ({questions.length})</summary>
    {open ? <div className="mt-3 flex flex-col gap-3"><ul className="flex flex-col gap-3">{questions.slice(0, limit).map(q => <li key={q.objective} className="flex flex-col gap-1 text-sm">
      <p><strong>{stats.get(q.objective)?.status ?? "Not started"}</strong> — {q.prompt}</p>
      <p className="text-xs text-muted-foreground">{q.difficulty} · {QUIZ_SKILLS[q.skill]} · <QuizReviewDate progress={stats.get(q.objective)} /></p>
    </li>)}</ul>{questions.length > limit ? <Button size="sm" variant="outline" onClick={() => setLimit(n => n + 25)}>Show more objectives</Button> : null}</div> : null}
  </details>;
}
function ScopeBody({ node, stats, groups, pending, onPractice }: BranchProps) {
  const { questions, own, counts } = groups.get(node.id)!;
  return <div className="mt-3 flex flex-col gap-3">
    <Progress value={counts.total ? 100 * counts.mastered / counts.total : 0} aria-label={`${node.label} available objectives mastered`} />
    <p className="text-xs text-muted-foreground">{counts.notStarted} not started · {counts.due} due for review · {counts.learned - counts.mastered} learned, not yet mastered</p>
    {node.level !== "chapter" && questions.some(q => !q.practiceSet) ? <p className="text-xs text-muted-foreground">Chapter sets: {node.coveredChapters}/{node.totalChapters}.</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="h-auto min-h-7 max-w-full whitespace-normal text-left" disabled={pending || !questions.length} onClick={() => onPractice(questions, `${node.label} · mastery practice`)}>Practice {node.label}</Button>
      <Button size="sm" variant="outline" className="h-auto min-h-7 max-w-full whitespace-normal text-left" disabled={pending || !counts.due} onClick={() => onPractice(questions.filter(q => stats.get(q.objective)?.due), `${node.label} · due review`)}>Review due in {node.label}</Button>
    </div>
    {own.length ? <ObjectiveList questions={own} stats={stats} label={node.level === "chapter" ? "Objectives" : `${node.label} broader connections`} /> : null}
    {node.children.filter(c => groups.get(c.id)!.questions.length).map(child => <ScopeBranch key={child.id} node={child} stats={stats} groups={groups} pending={pending} onPractice={onPractice} />)}
  </div>;
}
function ScopeBranch(props: BranchProps) {
  const [open, setOpen] = useState(false);
  const counts = props.groups.get(props.node.id)!.counts;
  return <details className="rounded-md border p-3" onToggle={e => setOpen(e.currentTarget.open)} data-mastery-scope={props.node.id}>
    <summary className="cursor-pointer text-sm font-medium"><span>{props.node.label}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{counts.learned}/{counts.total} learned · {counts.mastered}/{counts.total} mastered</span></summary>
    {open ? <ScopeBody {...props} /> : null}
  </details>;
}

export function QuizMastery({ bank, stats, pending, onPractice }: {
  bank: QuizBank; stats: Stats; pending: boolean;
  onPractice: BranchProps["onPractice"];
}) {
  const [skill, setSkill] = useState("all"), [difficulty, setDifficulty] = useState("all");
  const [exerciseSet, setExerciseSet] = useState("core");
  const coreTree = useMemo(() => quizMasteryTree({ ...bank, questions: bank.questions.filter(q => !q.practiceSet) }), [bank]);
  const tree = useMemo(() => exerciseSet === "core" ? coreTree : quizMasteryTree({ ...bank, questions: bank.questions.filter(q => q.practiceSet === exerciseSet) }), [bank, coreTree, exerciseSet]);
  const groups = useMemo(() => {
    const result = new Map<string, { questions: QuizQuestion[]; own: QuizQuestion[]; counts: Counts }>();
    const matches = (q: QuizQuestion) => (skill === "all" || q.skill === skill) && (difficulty === "all" || q.difficulty === difficulty);
    const visit = (node: Node) => {
      const questions = node.objectives.filter(matches);
      result.set(node.id, { questions, own: node.own.filter(matches), counts: masteryCounts(questions, stats) });
      node.children.forEach(visit);
    };
    visit(tree); return result;
  }, [tree, skill, difficulty, stats]);
  const counts = groups.get(tree.id)!.counts;
  return <Card aria-label="Mastery explorer">
      <CardHeader className="pb-3"><CardTitle>Mastery explorer</CardTitle><QuizHelp title="Mastery explorer"><p>Browse by testament, book, and chapter. Questions linking passages appear under their shared book, testament, or Bible scope.</p><p>Filters apply to this view and its practice buttons, not badge requirements. Practice uses your chosen question count and may include unread chapters.</p></QuizHelp></CardHeader>
      <CardContent className="flex flex-col gap-4 pb-4">
        <FieldGroup className="grid @lg:grid-cols-2">
          <QuizSelect label="Mastery exercise set" value={exerciseSet} onChange={setExerciseSet} items={[{ value: "core", label: "Core quizzes" }, { value: "memory", label: "Optional verse memory" }, { value: "book-order", label: "Optional book ordering" }]} />
          <QuizSelect label="Mastery skill" value={skill} onChange={setSkill} items={[{ value: "all", label: "All skills" }, ...Object.entries(QUIZ_SKILLS).map(([value, label]) => ({ value, label }))]} />
          <QuizSelect label="Mastery difficulty" value={difficulty} onChange={setDifficulty} items={[{ value: "all", label: "All difficulties" }, ...["Easy", "Medium", "Hard"].map(value => ({ value, label: value }))]} />
        </FieldGroup>
        <p className="text-sm">{counts.learned}/{counts.total} learned · {counts.mastered}/{counts.total} mastered{counts.total ? ` (${Math.floor(10000 * counts.mastered / counts.total) / 100}%)` : ""}</p>
        <p className="text-xs text-muted-foreground">Practice may include unread chapters.</p>
        {counts.total ? <ScopeBody node={tree} stats={stats} groups={groups} pending={pending} onPractice={onPractice} /> : <p role="status" className="text-sm">No objectives match these filters.</p>}
      </CardContent>
    </Card>;
}

export function QuizCompletionBadges({ bank, attempts }: { bank: QuizBank; attempts: QuizAttempt[] }) {
  const [badgeLevel, setBadgeLevel] = useState("all"), [badgeKind, setBadgeKind] = useState("all"), [badgeLimit, setBadgeLimit] = useState(10);
  const coreTree = useMemo(() => quizMasteryTree({ ...bank, questions: bank.questions.filter(q => !q.practiceSet) }), [bank]);
  const badges = useMemo(() => quizCompletionBadges(QUIZ_COVERAGE_RELEASES, attempts), [attempts]);
  const visibleBadges = badges.filter(b => (badgeLevel === "all" || badgeLevel === b.level) && (badgeKind === "all" || badgeKind === b.kind));
  return <Card aria-label="Completion badges">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><AwardIcon className="size-5" />Completion badges</CardTitle><QuizHelp title="Completion badges"><p>Learn every objective in a scope to earn Learned. Recall each correctly without help in separate sessions at least seven days apart for Mastered.</p><p>Badges follow fixed question sets. Broader badges require every included chapter and connection. New questions and later mistakes do not remove earned badges.</p><p>Backups restore badges; resetting quiz progress removes them.</p></QuizHelp></CardHeader>
      <CardContent className="flex flex-col gap-4 pb-4">
        <p className="text-sm">{badges.filter(b => b.kind === "Learned").length} Learned badges · {badges.filter(b => b.kind === "Mastered").length} Mastered badges</p>
        <p className="text-xs text-muted-foreground">{QUIZ_COVERAGE_RELEASES.at(-1)!.label} · {coreTree.coveredChapters}/{coreTree.totalChapters} chapters</p>
        <FieldGroup className="grid @lg:grid-cols-2">
          <QuizSelect label="Badge level" value={badgeLevel} onChange={v => { setBadgeLevel(v); setBadgeLimit(10); }} items={[{ value: "all", label: "All levels" }, { value: "chapter", label: "Chapter" }, { value: "book", label: "Book" }, { value: "testament", label: "Testament" }, { value: "bible", label: "Whole Bible" }]} />
          <QuizSelect label="Badge achievement" value={badgeKind} onChange={v => { setBadgeKind(v); setBadgeLimit(10); }} items={[{ value: "all", label: "Learned and Mastered" }, { value: "Learned", label: "Learned" }, { value: "Mastered", label: "Mastered" }]} />
        </FieldGroup>
        {visibleBadges.length ? <ul aria-label="Earned completion badges" className="flex flex-col gap-3">{visibleBadges.slice(0, badgeLimit).map(b => <li key={b.id} className="flex flex-col items-start gap-1">
          <Badge variant={b.kind === "Mastered" ? "default" : "secondary"}>{b.label} · {b.kind}</Badge>
          <p className="text-xs text-muted-foreground">{b.releaseLabel} · {b.objectiveCount} objectives · <time dateTime={new Date(b.earnedAt).toISOString()}>{new Date(b.earnedAt).toLocaleDateString()}</time></p>
        </li>)}</ul> : <p className="text-sm">{badges.length ? "No earned badges match these filters." : "Complete a chapter’s objectives to earn a badge."}</p>}
        {visibleBadges.length > badgeLimit ? <Button variant="outline" size="sm" onClick={() => setBadgeLimit(n => n + 10)}>Show more badges ({visibleBadges.length - badgeLimit})</Button> : null}
      </CardContent>
    </Card>;
}
