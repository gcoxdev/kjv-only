import { QuizHelp } from "./quiz-help";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletionConfetti } from "@/components/reader/completion-confetti";
import { useQuizRewards } from "@/hooks/use-quiz-rewards";
import { quizPracticeStreak, quizRewardMilestones, type QuizCompletionReward } from "@/lib/quiz/rewards";
import { quizScopeLabel, type quizStats } from "@/lib/quiz/engine";
import type { QuizAttempt, QuizBank } from "@/lib/quiz/types";
import { QuizRewardPreferences } from "./quiz-reward-preferences";

export function QuizRewards({ bank, attempts, stats, now }: { bank: QuizBank; attempts: QuizAttempt[]; stats: ReturnType<typeof quizStats>; now: number }) {
  const [preferences] = useQuizRewards();
  const streak = useMemo(() => preferences.showStreak ? quizPracticeStreak(attempts, now) : null, [attempts, now, preferences.showStreak]);
  const milestones = useMemo(() => quizRewardMilestones(bank.questions, stats), [bank, stats]);
  const orders = bank.questions.filter(q => q.practiceSet === "book-order");
  return <Card aria-label="Practice rewards"><CardHeader className="pb-3"><CardTitle>Practice rewards</CardTitle><QuizHelp title="Practice rewards"><p>First learning earns 10/20/30 points for Easy/Medium/Hard. Correct due reviews earn 5 points, once per objective per day. Milestones add no points.</p><p>Streaks count days with answered questions, even wrong or assisted answers. Skips do not count; assessments count when finished. Days follow your device’s time zone. A break resets only the current streak.</p><p>Backups preserve milestones and streaks; display settings stay on this device. Celebrations require correct answers without help; reduced-motion settings disable confetti.</p></QuizHelp></CardHeader><CardContent className="flex flex-col gap-4 pb-4">
    <QuizRewardPreferences compact />
    {streak ? <section aria-label="Quiz practice streak" className="flex flex-col gap-2"><p className="text-sm"><strong>{streak.current} day{streak.current === 1 ? "" : "s"} current</strong> · {streak.best} best · {streak.totalDays} practiced</p><p className="text-xs text-muted-foreground">{streak.practicedToday ? "Practiced today" : "Not practiced today"}</p></section> : null}
    <details><summary className="cursor-pointer text-sm font-medium">Skill milestones</summary><div className="mt-3 flex flex-col gap-4">{milestones.map(group => <section key={group.id} aria-label={`${group.label} milestones`} className="flex flex-col gap-2"><h3 className="text-sm font-medium">{group.label}</h3><p className="text-xs text-muted-foreground">{group.learned}/{group.total} learned · {group.mastered}/{group.total} mastered</p><div className="flex flex-wrap gap-2">{group.learnedTarget ? <Badge variant="secondary">{group.learnedTarget} learned</Badge> : null}{group.masteredTarget ? <Badge>{group.masteredTarget} mastered</Badge> : null}</div><p className="text-xs text-muted-foreground">{group.nextLearned ? `Next learned: ${group.nextLearned}. ` : "Learning milestones complete. "}{group.nextMastered ? `Next mastered: ${group.nextMastered}.` : "Mastery milestones complete."}</p></section>)}</div></details>
    <details><summary className="cursor-pointer text-sm font-medium">Complete book-order achievements</summary><ul className="mt-3 flex flex-col gap-3">{orders.map(q => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{quizScopeLabel(q)} book order</span><Badge variant={stats.get(q.objective)?.mastered ? "default" : "secondary"}>{stats.get(q.objective)?.status ?? "Not started"}</Badge></li>)}</ul></details>
  </CardContent></Card>;
}

export function QuizCelebration({ reward, expiresAt }: { reward: QuizCompletionReward; expiresAt: number }) {
  const [confetti, setConfetti] = useState(() => Date.now() < expiresAt);
  useEffect(() => { const timer = window.setTimeout(() => setConfetti(false), Math.max(0, expiresAt - Date.now())); return () => window.clearTimeout(timer); }, [expiresAt]);
  return <>
    {confetti ? <CompletionConfetti /> : null}
    <p role="status" className="text-sm">Well done! {reward.recalled} objective{reward.recalled === 1 ? "" : "s"} recalled without help · {reward.learned} newly learned · {reward.mastered} newly mastered.</p>
  </>;
}
