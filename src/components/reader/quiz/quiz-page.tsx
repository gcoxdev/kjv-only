import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, DownloadIcon, GraduationCapIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { loadQuizBank } from "@/lib/quiz/data";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { createId } from "@/lib/reader-layout";
import { createQuizSession, filterQuizQuestions, gradeQuizAnswer, hasQuizAnswer, QUIZ_KINDS, QUIZ_SKILLS, quizAnswerLabel, quizObjectives, quizScopeLabel, quizStats, selectQuizQuestions } from "@/lib/quiz/engine";
import { addQuizSession, claimQuizSession, exportQuizData, importQuizBackup, parseQuizBackup, readQuizSnapshot, releaseQuizSession, renewQuizSession, resetQuizData, subscribeQuiz, updateQuizSession } from "@/lib/quiz/storage";
import { useQuizOptions } from "@/hooks/use-quiz-options";
import { nextReadingQuizStep } from "@/lib/quiz/reading";
import { beginReadingQuiz, dismissReadingQuiz, offerReadingQuiz, skipReadingQuiz } from "@/lib/quiz/storage";
import { QuizReadingFlowCard } from "./quiz-reading-flow";
import { useReadChapters } from "@/hooks/use-read-chapters";
import { cn } from "@/lib/utils";
import type { QuizAction, QuizAnswer, QuizBackup, QuizBank, QuizEntry, QuizFilters, QuizQuestion, QuizReadingFlow, QuizReadingRequest, QuizSession, QuizSnapshot } from "@/lib/quiz/types";
import { QuizAnswerControls, QuizEvidence, QuizSelect } from "./quiz-controls";
import { QuizReview } from "./quiz-review";

// Keep a failed-to-save draft available if Home unmounts this view. Never mix it into earned credit.
const LazyQuizMastery = lazy(async () => ({ default: (await import("./quiz-mastery")).QuizMastery }));
const drafts = new Map<string, QuizAnswer>();
const QUESTION_PAGE_SIZE = 25;
function download(value: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const item = (value: string) => ({ value, label: value });
export type QuizPageProps = { initialBook?: string; initialChapter?: number; readingRequest?: QuizReadingRequest; readingChapters?: ReadonlySet<string>; onFinishReading?: () => void };
export function QuizPage(props: QuizPageProps) {
  const [bank, setBank] = useState<QuizBank | null>(null), [error, setError] = useState<string | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; loadQuizBank().then(value => { if (active) { setBank(value); setError(null); } }).catch(e => { if (active) setError(String(e.message)); }); return () => { active = false; }; }, [retry]);
  if (!bank) return <div className="flex h-full flex-col gap-3 overflow-auto p-3">{error ? <><p role="alert">{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry loading quiz</Button></> : <><p role="status">Loading quiz…</p><Skeleton className="h-28 w-full" /></>}</div>;
  return <QuizWorkspace bank={bank} {...props} />;
}
function Feedback({ q, entry, points }: { q: QuizQuestion; entry: QuizEntry; points: number }) {
  const correct = !entry.skipped && gradeQuizAnswer(q, entry.answer);
  return <section aria-label="Answer feedback" className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3"><h3 className={cn("font-medium", correct ? "text-success" : "text-foreground")}>{entry.skipped ? "Skipped" : correct ? "Correct" : "Review the answer"}{entry.assisted ? " · Assisted" : ""}{points > 0 ? ` · +${points} points` : ""}</h3>
    <p className="text-sm"><strong>Answer:</strong> {quizAnswerLabel(q)}</p><p className="text-sm">{q.explanation}</p>
    {Array.isArray(entry.answer) && Array.isArray(q.answer) ? <p className="text-xs text-muted-foreground">{entry.answer.filter((a, i) => a === q.answer[i]).length} of {q.answer.length} positions correct. Full correctness is required for this objective.</p> : null}
    <QuizEvidence question={q} />{entry.assisted ? <p className="text-xs text-muted-foreground">Assisted practice does not earn unassisted learning or mastery credit.</p> : null}
  </section>;
}
function QuizWorkspace({ bank, initialBook = "Genesis", initialChapter = 1, readingRequest, readingChapters, onFinishReading }: QuizPageProps & { bank: QuizBank }) {
  const [owner] = useState(createId), [snapshot, setSnapshot] = useState<QuizSnapshot | null>(null), [error, setError] = useState<string | null>(null), [pending, setPending] = useState(0);
  const [view, setView] = useState<"setup" | "quiz" | "progress" | "questions">("setup"), [sessionId, setSessionId] = useState<string | null>(null), [draftVersion, setDraftVersion] = useState(0);
  const [options, setOptions] = useQuizOptions();
  const [scopeFilters, setFilters] = useState<QuizFilters>(() => ({ scope: "chapter", book: initialBook, chapter: initialChapter, skill: "all", difficulty: "all", readOnly: false }));
  const filters = useMemo(() => ({ ...scopeFilters, skill: options.skill, difficulty: options.difficulty, readOnly: options.readOnly }), [scopeFilters, options]);
  const length = String(options.length), mode = options.mode;
  const setLength = (length: string) => setOptions(current => ({ ...current, length: Number(length) as typeof options.length }));
  const setMode = (mode: QuizSession["mode"]) => setOptions(current => ({ ...current, mode }));
  const [search, setSearch] = useState("");
  const [readingFlowId, setReadingFlowId] = useState<string | null>(null), [readingRetry, setReadingRetry] = useState(0);
  const offeredRequest = useRef<string | null>(null);
  const [questionPage, setQuestionPage] = useState(0);
  const [reviewNow, setReviewNow] = useState(Date.now);
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), questionRef = useRef<HTMLHeadingElement>(null), queue = useRef(Promise.resolve());
  const { readChapters: storedReadChapters } = useReadChapters();
  const readChapters = readingChapters ?? storedReadChapters;
  const [readingCardLimit, setReadingCardLimit] = useState(5);
  const refresh = useCallback(() => readQuizSnapshot(bank).then(value => { setSnapshot(value); setReviewNow(Date.now()); }).catch(e => setError(e.message)), [bank]);
  useEffect(() => { void refresh(); return subscribeQuiz(() => { void refresh(); }); }, [refresh]);
  useEffect(() => {
    if (view !== "progress") return;
    const tick = () => { if (document.visibilityState === "visible") setReviewNow(Date.now()); };
    const interval = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [view]);
  useEffect(() => {
    if (!sessionId) return;
    const id = sessionId;
    const interval = window.setInterval(() => { void renewQuizSession(bank, id, owner).catch(e => setError(e.message)); }, 20_000);
    return () => { window.clearInterval(interval); void releaseQuizSession(bank, id, owner).catch(() => { /* Lease expiration also releases a crashed/closed view. */ }); };
  }, [bank, owner, sessionId]);
  const run = useCallback((task: () => Promise<QuizSnapshot>, after?: (value: QuizSnapshot) => void) => {
    setPending(n => n + 1);
    queue.current = queue.current.then(async () => { try { const next = await task(); setSnapshot(next); setError(null); after?.(next); } catch (e) { setError(e instanceof Error ? e.message : "Quiz operation failed."); } finally { setPending(n => n - 1); } });
  }, []);
  useEffect(() => {
    if (!readingRequest) return;
    const requestKey = `${readingRequest.id}:${readingRetry}`;
    if (offeredRequest.current === requestKey) return;
    offeredRequest.current = requestKey;
    let result: Awaited<ReturnType<typeof offerReadingQuiz>>;
    run(async () => { result = await offerReadingQuiz(bank, readingRequest, options, owner, readChapters); return result.snapshot; }, () => {
      setReadingFlowId(result.flowId);
      if (result.sessionId) { setSessionId(result.sessionId); setView("quiz"); }
      else setView("setup");
    });
  }, [bank, readingRequest, readingRetry, options, owner, readChapters, run]);
  const stats = useMemo(() => quizStats(bank, snapshot?.attempts ?? [], reviewNow), [bank, snapshot, reviewNow]);
  const questions = useMemo(() => new Map(bank.questions.map(q => [q.id, q])), [bank]);
  const objectives = useMemo(() => quizObjectives(bank.questions), [bank]);
  const matchingQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bank.questions.filter(q => `${q.prompt} ${q.book} ${q.id}`.toLowerCase().includes(query));
  }, [bank, search]);
  const lastQuestionPage = Math.max(0, Math.ceil(matchingQuestions.length / QUESTION_PAGE_SIZE) - 1);
  const currentQuestionPage = Math.min(questionPage, lastQuestionPage);
  const questionStart = currentQuestionPage * QUESTION_PAGE_SIZE;
  const visibleQuestions = matchingQuestions.slice(questionStart, questionStart + QUESTION_PAGE_SIZE);
  const pool = useMemo(() => filterQuizQuestions(bank, filters, readChapters), [bank, filters, readChapters]);
  const sessionQuestionCount = Math.min(Number(length), quizObjectives(pool).length);
  const session = snapshot?.sessions.find(s => s.id === sessionId), entry = session?.entries[session.index], question = entry ? questions.get(entry.id) : undefined;
  const draftKey = session && entry ? `${session.id}:${entry.id}` : "";
  // draftVersion deliberately subscribes this view to local input changes between durable writes.
  void draftVersion;
  const locked = !!session && !session.done && session.owner !== owner;
  const answer = entry ? !locked && drafts.has(draftKey) ? drafts.get(draftKey)! : entry.answer : "";
  const mutate = (action: QuizAction, after?: () => void) => { if (!session) return; run(() => updateQuizSession(bank, session.id, owner, action), () => after?.()); };
  const changeAnswer = (value: QuizAnswer) => { if (!session || !entry) return; const key = draftKey; drafts.set(key, value); setDraftVersion(n => n + 1); mutate({ type: "answer", qid: entry.id, answer: value }, () => { if (JSON.stringify(drafts.get(key)) === JSON.stringify(value)) { drafts.delete(key); setDraftVersion(n => n + 1); } }); };
  const start = (selected: QuizQuestion[] = pool, label = filters.scope === "chapter" ? `${filters.book} ${filters.chapter}` : filters.scope === "book" ? `${filters.book} · ${filters.content === "connections" ? "connections sample" : "sample"}` : `${filters.scope === "OT" ? "Old Testament" : filters.scope === "NT" ? "New Testament" : "Whole Bible"} · ${filters.content === "connections" ? "connections sample" : "sample"}`, selectedMode = mode) => {
    const picked = selectQuizQuestions(bank, selected, snapshot?.attempts ?? [], Number(length));
    if (!picked.length) return;
    const created = createQuizSession(bank, picked, label, selectedMode, owner);
    run(() => addQuizSession(bank, created), () => { setSessionId(created.id); setView("quiz"); });
  };
  const resume = (s: QuizSession, takeover = false) => {
    if (s.owner && s.owner !== owner && s.leaseUntil > Date.now() && !takeover) { setConfirmAction({ title: "Continue this quiz here?", description: "This session is open in another panel or browser tab. Taking over will make that view read-only.", run: () => resume(s, true) }); return; }
    run(() => claimQuizSession(bank, s.id, owner, takeover), next => { setReadingFlowId(next.readingFlows?.find(f => !f.closed && f.steps.some(step => step.sessionId === s.id && !step.skipped))?.id ?? null); setSessionId(s.id); setView("quiz"); });
  };
  const exportData = async () => {
    try {
      await queue.current;
      const data = await exportQuizData();
      const unsavedDrafts = [...drafts].map(([key, value]) => ({ key, answer: value }));
      download({ type: "kjv-only-quiz", schema: 1, bank: bank.version, exported: new Date().toISOString(), ...data, unsavedDrafts }, "kjv-quiz-progress.json");
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed."); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error("Quiz backup is too large (maximum 20 MB).");
      const backup: QuizBackup = parseQuizBackup(JSON.parse(await file.text()), bank);
      setConfirmAction({ title: "Merge quiz progress?", description: `${backup.sessions.length} sessions and ${backup.attempts.length} attempts. Existing sessions are preserved; duplicate credit will not be added.`, run: () => run(() => importQuizBackup(bank, backup)) });
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid backup."); }
  };
  const total = { learned: [...stats.values()].filter(s => s.learned).length, mastered: [...stats.values()].filter(s => s.mastered).length, points: (snapshot?.attempts ?? []).reduce((n, a) => n + a.points, 0) };
  const pendingSessions = snapshot?.sessions.filter(s => !s.done) ?? [];
  const filterUpdate = (patch: Partial<QuizFilters>) => {
    setFilters(current => ({ ...current, ...patch }));
    setOptions(current => ({ ...current, ...(patch.skill !== undefined ? { skill: patch.skill } : {}), ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}), ...(patch.readOnly !== undefined ? { readOnly: patch.readOnly } : {}) }));
  };
  const milestone = [5, 10, 25, 50, 100].filter(n => n <= total.learned).at(-1);
  const saveAndLeave = () => { setView("setup"); setSessionId(null); };
  const finishReadingForNow = () => { saveAndLeave(); setReadingFlowId(null); onFinishReading?.(); };
  const continueReadingFlow = (flow: QuizReadingFlow, index: number) => {
    let nextSession: string | null = null;
    run(async () => { const result = await beginReadingQuiz(bank, flow.id, index, owner, readChapters); nextSession = result.sessionId; return result.snapshot; }, next => {
      setReadingFlowId(flow.id);
      if (nextSession) resume(next.sessions.find(s => s.id === nextSession)!);
      else { setSessionId(null); setView("setup"); }
    });
  };
  const readingCards = (snapshot?.readingFlows ?? []).filter(flow => view === "setup" ? !flow.closed && (flow.id === readingFlowId || nextReadingQuizStep(flow, snapshot!.sessions) >= 0) : view === "quiz" && flow.id === readingFlowId && flow.steps.some(step => step.sessionId === sessionId)).sort((a, b) => Number(b.id === readingFlowId) - Number(a.id === readingFlowId) || b.created - a.created);
  const confirmReset = () => setConfirmAction({ title: "Reset quiz progress?", description: "This removes all quiz sessions, points, and mastery on this browser. Reading progress is unaffected. Export a backup first if you want to keep your results.", run: () => { void resetQuizData().then(() => { drafts.clear(); setSessionId(null); setError(null); void refresh(); }).catch(e => setError(e.message)); } });
  return <section aria-label="Bible quiz" className="@container flex h-full min-h-0 min-w-0 flex-col overflow-y-auto p-3">
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><GraduationCapIcon className="size-5" />Quiz</h2><Badge variant="secondary">{objectives.length} objectives</Badge></div>
      <ToggleGroup value={[view === "quiz" ? "setup" : view]} onValueChange={values => { const next = values[0]; if (next === "setup" || next === "progress" || next === "questions") { setReviewNow(Date.now()); setView(next); } }} variant="outline" spacing={1} aria-label="Quiz sections" className="flex-wrap">
        <ToggleGroupItem value="setup">Start</ToggleGroupItem><ToggleGroupItem value="progress">Progress</ToggleGroupItem><ToggleGroupItem value="questions" disabled={pendingSessions.length > 0}>Questions</ToggleGroupItem>
      </ToggleGroup>
      {error ? <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive p-3 text-sm"><p>{error}</p><p>Keep Quiz open if an answer has not saved. Your draft remains available for retry or export.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { if (entry && drafts.has(draftKey)) changeAnswer(drafts.get(draftKey)!); else { setError(null); if (readingRequest && !readingFlowId) setReadingRetry(n => n + 1); void refresh(); } }}>Retry</Button><Button size="sm" variant="outline" onClick={() => void exportData()}>Export backup</Button>{!snapshot ? <Button size="sm" variant="ghost" disabled={pending > 0} onClick={confirmReset}>Reset quiz progress</Button> : null}</div></div> : null}
      {!snapshot ? <p role="status">Opening saved quiz progress…</p> : null}
      {snapshot ? readingCards.slice(0, readingCardLimit).map(flow => <QuizReadingFlowCard key={flow.id} flow={flow} sessions={snapshot.sessions} activeSessionId={view === "quiz" ? sessionId : null} pending={pending > 0 || locked}
        onStart={index => continueReadingFlow(flow, index)}
        onSkip={index => run(() => skipReadingQuiz(bank, flow.id, index, owner), () => { setReadingFlowId(flow.id); setSessionId(null); setView("setup"); })}
        onLater={finishReadingForNow}
        onDismiss={() => run(() => dismissReadingQuiz(bank, flow.id), () => { setReadingFlowId(null); saveAndLeave(); onFinishReading?.(); })} />) : null}
      {readingCards.length > readingCardLimit ? <Button size="sm" variant="outline" onClick={() => setReadingCardLimit(n => n + 5)}>Show more reading sequences ({readingCards.length - readingCardLimit})</Button> : null}
      {snapshot && view === "setup" ? <>
        <p className="text-sm text-muted-foreground">Practice a passage, learn unfamiliar words, and explore connections. This pack samples {bank.featured.length} chapters plus selected vocabulary. Choose a broader scope to practice chapter questions together or focus on dedicated broader connections.</p>
        {pendingSessions.length ? <Card><CardHeader><CardTitle>Continue a quiz</CardTitle><CardDescription>Your existing quizzes stay saved. Continue one below.{readingCards.length ? " You can also start a reading quiz above." : ""} Opening the same session elsewhere preserves answers and shared credit.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{pendingSessions.map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm">{s.label}</p><p className="text-xs text-muted-foreground">{s.entries.filter(e => e.submitted).length}/{s.entries.length} submitted · {s.mode}</p></div><Button size="sm" variant="outline" disabled={pending > 0} onClick={() => resume(s)}>Continue</Button></div>)}</CardContent></Card> : null}
        <Card><CardHeader><CardTitle>Start a quiz</CardTitle><CardDescription>Untimed. Answers lead back to the KJV.</CardDescription></CardHeader><CardContent className="pb-4"><FieldGroup className="grid @lg:grid-cols-2">
          <QuizSelect label="Scope" value={filters.scope} items={[{ value: "chapter", label: "Chapter" }, { value: "book", label: "Book" }, { value: "OT", label: "Old Testament" }, { value: "NT", label: "New Testament" }, { value: "bible", label: "Whole Bible" }]} onChange={value => filterUpdate({ scope: value as QuizFilters["scope"] })} />
          <QuizSelect label="Skill" value={filters.skill} items={[{ value: "all", label: "All skills" }, ...Object.entries(QUIZ_SKILLS).map(([value, label]) => ({ value, label }))]} onChange={value => filterUpdate({ skill: value as QuizFilters["skill"] })} />
          {["chapter", "book"].includes(filters.scope) ? <QuizSelect label="Book" value={filters.book} items={bank.books.map(item)} onChange={book => filterUpdate({ book, chapter: 1 })} /> : null}
          {filters.scope === "chapter" ? <QuizSelect label="Chapter" value={String(filters.chapter)} items={Array.from({ length: BIBLE_BOOKS[bank.books.indexOf(filters.book)]?.chapterCount ?? 1 }, (_, i) => item(String(i + 1)))} onChange={value => filterUpdate({ chapter: Number(value) })} /> : null}
          {filters.scope !== "chapter" ? <QuizSelect label="Question set" value={filters.content ?? "all"} items={[{ value: "all", label: "All available questions" }, { value: "connections", label: "Broader connections" }]} onChange={value => filterUpdate({ content: value as QuizFilters["content"] })} /> : null}
          <QuizSelect label="Difficulty" value={filters.difficulty} items={[{ value: "all", label: "Mixed difficulty" }, ...["Easy", "Medium", "Hard"].map(item)]} onChange={value => filterUpdate({ difficulty: value as QuizFilters["difficulty"] })} />
          <QuizSelect label="Questions" value={length} items={[5, 10, 20, 30].map(n => item(String(n)))} onChange={setLength} />
          <QuizSelect label="Mode" value={mode} items={[{ value: "practice", label: "Practice · immediate feedback" }, { value: "assessment", label: "Assessment · feedback at end" }]} onChange={value => setMode(value as QuizSession["mode"])} />
          <Field orientation="horizontal"><FieldLabel htmlFor={`${owner}-read`}>Only chapters marked read</FieldLabel><Switch id={`${owner}-read`} checked={filters.readOnly} onCheckedChange={readOnly => filterUpdate({ readOnly })} /></Field>
        </FieldGroup></CardContent><CardFooter className="flex flex-wrap justify-between gap-3"><p className="text-xs text-muted-foreground">{pool.length ? `Up to ${sessionQuestionCount} question${sessionQuestionCount === 1 ? "" : "s"}. Overlapping exercises are kept apart.` : "No questions match yet. Try another chapter, a broader scope, or different filters."}</p><Button disabled={!pool.length || pending > 0} onClick={() => start()}>Start quiz</Button></CardFooter></Card>
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">{([['Vocabulary','Vocabulary'],['order','Ordering'],['timeline','Timeline'],['family','Family tree'],['map','Map'],['text','Short answer']] as const).map(([value,label]) => <Button key={value} variant="outline" size="sm" disabled={pending > 0} onClick={() => start(bank.questions.filter(q => !q.practiceSet && (value === "Vocabulary" ? q.skill === value : q.kind === value)), `${label} · sample`, "practice")}>{label}</Button>)}</div>
        <p className="text-xs text-muted-foreground">Example buttons use the whole question bank and Practice mode. Finish open sessions to browse answers in Questions. Saved progress is local to this device/browser.</p>
        <Card><CardHeader><CardTitle>Optional challenges</CardTitle><CardDescription>Choose these separately from ordinary quizzes and quizzes after reading. They use Practice mode across the whole Bible, independently of the filters above.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 pb-4">
          <div className="flex flex-col gap-2"><p className="text-sm">Verse memory starts with 12 selected verses. Use exact KJV wording; choose the session length above.</p><Button variant="outline" disabled={pending > 0} onClick={() => start(bank.questions.filter(q => q.practiceSet === "memory"), "Verse memory", "practice")}>Practice verse memory</Button></div>
          <div className="flex flex-col gap-2"><p className="text-sm">Arrange a complete list in the app’s KJV table-of-contents order. Each list is one exercise.</p>{([['ot', 'Old Testament · 39 books'], ['nt', 'New Testament · 27 books'], ['bible', 'Whole Bible · 66 books']] as const).map(([scope, label]) => <Button key={scope} className="h-auto min-h-8 whitespace-normal" variant="outline" disabled={pending > 0} onClick={() => start(bank.questions.filter(q => q.id === `book-order-${scope}`), label, "practice")}>{label}</Button>)}</div>
          <p className="text-xs text-muted-foreground">Results contribute to personal progress and review dates. These additions do not change the requirements of the October 26 coverage badges.</p>
        </CardContent></Card>
      </> : null}
      {view === "quiz" && session && entry && question ? <>
        <div className="flex flex-wrap items-center justify-between gap-2"><Button size="sm" variant="ghost" onClick={saveAndLeave} disabled={pending > 0}><ArrowLeftIcon data-icon="inline-start" />Save & leave</Button><Badge variant="outline">{session.mode}</Badge></div>
        {session.done ? <>
          <Card><CardHeader><CardTitle>Session complete</CardTitle><CardDescription>{session.label}</CardDescription></CardHeader><CardContent className="pb-4"><p className="text-2xl font-semibold">{session.entries.filter(e => !e.skipped && gradeQuizAnswer(questions.get(e.id)!, e.answer)).length} / {session.entries.length} correct</p><p className="text-sm text-muted-foreground">{session.entries.filter(e => e.assisted).length} assisted · +{snapshot!.attempts.filter(a => a.session === session.id).reduce((n, a) => n + a.points, 0)} points</p></CardContent><CardFooter><Button onClick={saveAndLeave}>Start another quiz</Button></CardFooter></Card>
          {session.entries.map(e => <Card key={e.id}><CardHeader><CardTitle>{questions.get(e.id)!.prompt}</CardTitle><CardDescription>Your answer: {e.skipped ? "Skipped" : Array.isArray(e.answer) ? e.answer.join(" → ") : e.answer}</CardDescription></CardHeader><CardContent><Feedback q={questions.get(e.id)!} entry={e} points={snapshot!.attempts.find(a => a.id === `${session.id}:${e.id}`)?.points ?? 0} /></CardContent></Card>)}
        </> : <>
          <p className="text-sm">{session.label} · Question {session.index + 1} of {session.entries.length}</p><Progress value={100 * session.entries.filter(e => e.submitted).length / session.entries.length} aria-label="Quiz completion" />
          {locked ? <div role="status" className="flex flex-col gap-2 rounded-lg border p-3"><p>This session is open in another view. Your answers are protected.</p><Button variant="outline" onClick={() => resume(session)}>Take over</Button></div> : null}
          <Card><CardHeader><div className="flex flex-wrap gap-2"><Badge>{QUIZ_SKILLS[question.skill]}</Badge><Badge variant="secondary">{question.difficulty}</Badge><Badge variant="outline">{QUIZ_KINDS[question.kind]}</Badge></div><CardTitle><h3 ref={questionRef} tabIndex={-1} className="text-lg leading-relaxed">{question.prompt}</h3></CardTitle></CardHeader><CardContent className="flex flex-col gap-4 pb-4">
            <QuizAnswerControls key={entry.id} question={question} entry={entry} answer={answer} disabled={entry.submitted || locked} onChange={changeAnswer} />
            {entry.help !== "none" && !entry.submitted ? <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"><p className="text-sm">Assisted practice{entry.help === "answer" ? ` · ${quizAnswerLabel(question)}` : " · Read the cited passage for help."}</p><QuizEvidence question={question} /></div> : null}
            {entry.submitted && session.mode === "practice" ? <Feedback q={question} entry={entry} points={snapshot!.attempts.find(a => a.id === `${session.id}:${entry.id}`)?.points ?? 0} /> : entry.submitted ? <p role="status" className="text-sm">Answer saved. Feedback appears after finishing the assessment.</p> : null}
          </CardContent><CardFooter className="flex flex-wrap gap-2">
            {session.mode === "practice" && !entry.submitted ? <><Button size="sm" variant="ghost" disabled={locked || pending > 0} onClick={() => mutate({ type: "help", qid: entry.id, help: "passage" })}>Read passage / hint</Button><Button size="sm" variant="ghost" disabled={locked || pending > 0} onClick={() => mutate({ type: "help", qid: entry.id, help: "answer" })}>Reveal answer</Button></> : null}
            <div className="flex w-full flex-wrap items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={locked || pending > 0 || session.index === 0} onClick={() => mutate({ type: "navigate", index: session.index - 1 })}>Previous</Button><div className="flex gap-2">{entry.submitted ? <Button size="sm" disabled={locked || pending > 0} onClick={() => { if (session.index < session.entries.length - 1) mutate({ type: "navigate", index: session.index + 1 }, () => questionRef.current?.focus()); else { const missing = session.entries.findIndex(e => !e.submitted); mutate(missing >= 0 ? { type: "navigate", index: missing } : { type: "finish" }); } }}>{session.index === session.entries.length - 1 ? "Finish quiz" : "Next"}</Button> : <><Button size="sm" variant="ghost" disabled={locked || pending > 0} onClick={() => mutate({ type: "submit", qid: entry.id, answer, skip: true })}>Skip</Button><Button size="sm" disabled={locked || pending > 0 || !hasQuizAnswer(question, answer)} onClick={() => mutate({ type: "submit", qid: entry.id, answer })}>Submit answer</Button></>}</div></div>
          </CardFooter></Card><p role="status" className="text-xs text-muted-foreground">{pending > 0 ? "Saving…" : error ? "Some changes may be unsaved." : "Progress saved"} · {question.id}</p>
        </>}
      </> : null}
      {view === "progress" && snapshot ? <>
        <Card><CardHeader><CardTitle>Your learning progress</CardTitle><CardDescription>{objectives.length} available objectives · Reading progress is separate.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 pb-4"><div className="grid grid-cols-3 gap-3">{[[total.learned, "Learned"], [total.mastered, "Mastered"], [total.points, "Points"]].map(([n,label]) => <div key={label}><p className="text-2xl font-semibold">{n}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><Progress value={100 * total.mastered / objectives.length} aria-label="Available objectives mastered" /><p className="text-xs text-muted-foreground">Learned: one correct unassisted answer. Mastered: correct recall in separate sessions at least seven days apart. Later mistakes prompt review without removing earned mastery.</p>{milestone ? <Badge variant="secondary">Milestone: {milestone} objectives learned</Badge> : <p className="text-xs text-muted-foreground">Learn five objectives to earn your first milestone.</p>}</CardContent></Card>
        <QuizReview objectives={objectives} stats={stats} now={reviewNow} pending={pending > 0} onReview={key => {
          // Recheck at click time: the visible schedule refreshes once a minute.
          const current = quizStats(bank, snapshot.attempts);
          start(bank.questions.filter(q => current.get(q.objective)?.[key]), key === "due" ? "Practice due items" : "Review mistakes", "practice");
        }} />
        <Card><CardHeader><CardTitle>Skills and difficulty</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{[...Object.entries(QUIZ_SKILLS), ...["Easy", "Medium", "Hard"].map(v => [v,v])].map(([key,label]) => { const group = objectives.filter(q => q.skill === key || q.difficulty === key); return <div key={key}><p className="text-sm">{label}: {group.filter(q => stats.get(q.objective)?.learned).length} learned · {group.filter(q => stats.get(q.objective)?.mastered).length}/{group.length} mastered</p><Progress aria-label={`${label} mastery`} value={100 * group.filter(q => stats.get(q.objective)?.mastered).length / group.length} /></div>; })}</CardContent></Card>
        <Suspense fallback={<p role="status">Loading mastery progress…</p>}><LazyQuizMastery bank={bank} attempts={snapshot.attempts} stats={stats} pending={pending > 0} onPractice={(selected, label) => {
          const wanted = new Set(selected.map(q => q.objective));
          start(bank.questions.filter(q => wanted.has(q.objective)), label, "practice");
        }} /></Suspense>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void exportData()}><DownloadIcon data-icon="inline-start" />Export progress</Button><Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={pending > 0}><UploadIcon data-icon="inline-start" />Import progress</Button><Button size="sm" variant="ghost" disabled={pending > 0} onClick={confirmReset}>Reset quiz progress</Button></div><input ref={inputRef} hidden type="file" accept=".json,application/json" aria-label="Import quiz backup" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="text-xs text-muted-foreground">Stored on this device/browser. Export a backup before clearing browser data or moving devices. First learning earns 10/20/30 points by difficulty; correct due reviews earn 5 points at most once per objective per day.</p>
      </> : null}
      {view === "questions" && !pendingSessions.length ? <>
        <Field><FieldLabel htmlFor={`${owner}-question-search`}>Search questions</FieldLabel><Input id={`${owner}-question-search`} value={search} onChange={e => { setSearch(e.target.value); setQuestionPage(0); }} placeholder="Try ephah, creation, or Acts" /></Field>
        <nav aria-label="Question pages" className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm text-muted-foreground">{matchingQuestions.length ? `Questions ${questionStart + 1}–${questionStart + visibleQuestions.length} of ${matchingQuestions.length}` : "No questions match your search."}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={currentQuestionPage === 0} onClick={() => setQuestionPage(currentQuestionPage - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={currentQuestionPage === lastQuestionPage} onClick={() => setQuestionPage(currentQuestionPage + 1)}>Next</Button>
          </div>
        </nav>
        <div role="list" aria-label="Question results" className="flex flex-col gap-4">{visibleQuestions.map(q => <Card key={q.id} role="listitem"><CardHeader><CardDescription>{quizScopeLabel(q)} · {q.difficulty} · {QUIZ_KINDS[q.kind]}</CardDescription><CardTitle>{q.prompt}</CardTitle></CardHeader><CardContent><details><summary className="cursor-pointer text-sm">Answer and evidence</summary><div className="mt-3 flex flex-col gap-3"><p className="text-sm font-medium">{quizAnswerLabel(q)}</p><p className="text-sm">{q.explanation}</p><QuizEvidence question={q} /><p className="text-xs text-muted-foreground">Question ID: {q.id}</p></div></details></CardContent></Card>)}</div>
      </> : null}
      <Separator /><p className="text-xs text-muted-foreground">Bible quiz · KJV-based questions and cited passages. Vocabulary includes uncommon biblical terms, not only archaic English. Maps and modern unit estimates use the sources on Credits.</p>
      <Dialog open={!!confirmAction} onOpenChange={open => { if (!open) setConfirmAction(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmAction?.title}</DialogTitle><DialogDescription>{confirmAction?.description}</DialogDescription></DialogHeader><DialogFooter><Button size="sm" variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button><Button size="sm" onClick={() => { const action = confirmAction; setConfirmAction(null); action?.run(); }}>Confirm</Button></DialogFooter></DialogContent></Dialog>
    </div>
  </section>;
}
