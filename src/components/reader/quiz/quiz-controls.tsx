import { useId, useRef, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToolReferenceList } from "@/components/reader/tool-reference-list";
import { useToolReferenceContext } from "@/components/reader/tool-reference-context";
import { ReaderControlTooltip } from "@/components/reader/reader-control-tooltip";
import { quizFamilyRoot, quizReferenceCode } from "@/lib/quiz/engine";
import { cn } from "@/lib/utils";
import { QuizMap } from "./quiz-map";
import type { QuizAnswer, QuizEntry, QuizQuestion } from "@/lib/quiz/types";
export function QuizSelect({ label, value, items, onChange, disabled = false }: { label: string; value: string; items: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Select value={value} items={items} onValueChange={v => { if (v !== null) onChange(v); }} disabled={disabled}>
    <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent align="start"><SelectGroup>{items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectGroup></SelectContent>
  </Select></Field>;
}
export function QuizEvidence({ question }: { question: QuizQuestion }) {
  const { actions } = useToolReferenceContext();
  if (!actions) throw new Error("Quiz references require the reader reference provider.");
  return <>
    {question.refs.length ? <ToolReferenceList references={question.refs.map(quizReferenceCode)} referenceLabels={Object.fromEntries(question.refs.map(r => [quizReferenceCode(r), r.label]))} highlightWord="" {...actions} /> : null}
    {question.evidence ? <p className="text-xs text-muted-foreground">{question.evidence}</p> : null}
    {question.measure ? <p className="text-xs text-muted-foreground">Modern equivalents are approximate. Measurement sources are listed on Credits.</p> : null}
  </>;
}

function OrderPosition({ values, move, disabled }: { values: string[]; move: (from: number, to: number) => void; disabled: boolean }) {
  const [selected, setSelected] = useState(values[0]), [position, setPosition] = useState("1");
  const positionId = useId(), target = Number(position);
  return <FieldGroup className="gap-3">
    <QuizSelect label="Book to move" value={selected} items={[...values].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value }))} onChange={setSelected} disabled={disabled} />
    <Field><FieldLabel htmlFor={positionId}>Move to position</FieldLabel><Input id={positionId} type="number" min={1} max={values.length} step={1} inputMode="numeric" value={position} onChange={e => setPosition(e.target.value)} disabled={disabled} /></Field>
    <Button variant="outline" size="sm" disabled={disabled || !Number.isInteger(target) || target < 1 || target > values.length || values.indexOf(selected) === target - 1} onClick={() => move(values.indexOf(selected), target - 1)}>Move book</Button>
  </FieldGroup>;
}

export function QuizAnswerControls({ question: q, entry, answer, onChange, disabled }: { question: QuizQuestion; entry: QuizEntry; answer: QuizAnswer; onChange: (answer: QuizAnswer) => void; disabled: boolean }) {
  const drag = useRef<number | null>(null), [announcement, setAnnouncement] = useState("");
  const inputId = useId();
  if (q.kind === "memory") return <Field data-disabled={disabled}><FieldLabel htmlFor={inputId}>Verse from memory</FieldLabel><Textarea id={inputId} aria-describedby={`${inputId}-help`} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} rows={5} maxLength={500} value={String(answer)} onChange={e => onChange(e.target.value)} disabled={disabled} /><FieldDescription id={`${inputId}-help`}>Use the exact KJV words in order. Capitalization, punctuation, and extra spaces do not matter. Opening the passage or revealing the answer marks this attempt as assisted.</FieldDescription></Field>;
  if (q.kind === "text") return <Field><FieldLabel htmlFor={inputId}>Your answer</FieldLabel><Input id={inputId} autoComplete="off" spellCheck={false} value={String(answer)} onChange={e => onChange(e.target.value)} disabled={disabled} maxLength={500} /><p className="text-xs text-muted-foreground">Capitalization and punctuation do not matter.</p></Field>;
  if (q.kind === "order" || q.kind === "timeline") {
    const values = answer as string[];
    const move = (from: number, to: number) => { if (disabled || from === to || to < 0 || to >= values.length) return; const next = [...values], item = next.splice(from, 1)[0]; next.splice(to, 0, item); onChange(next); setAnnouncement(`${item} moved to position ${to + 1}.`); };
    return <div className="flex flex-col gap-3"><p className="text-xs text-muted-foreground">Drag cards or use the move buttons. The top item comes first. {q.kind === "timeline" ? "Spacing does not represent elapsed time." : ""}</p>
      {values.length > 10 ? <OrderPosition key={q.id} values={values} move={move} disabled={disabled} /> : null}
      <ol className={cn("flex flex-col gap-2", q.kind === "timeline" && "ml-2 border-l-2 pl-3")}>{values.map((text, i) => <li key={text} draggable={!disabled} onDragStart={event => { drag.current = i; event.dataTransfer.setData("text/plain", String(i)); event.dataTransfer.effectAllowed = "move"; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag.current !== null) move(drag.current, i); drag.current = null; }} onDragEnd={() => { drag.current = null; }} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{i + 1}</span><span className="min-w-0 flex-1 text-sm">{text}</span><div className="flex shrink-0 flex-col gap-1">
          <ReaderControlTooltip label={`Move ${text} up`}><Button variant="outline" size="icon-sm" aria-label={`Move ${text} up`} disabled={disabled || i === 0} onClick={() => move(i, i - 1)}><ArrowUpIcon /></Button></ReaderControlTooltip>
          <ReaderControlTooltip label={`Move ${text} down`}><Button variant="outline" size="icon-sm" aria-label={`Move ${text} down`} disabled={disabled || i === values.length - 1} onClick={() => move(i, i + 1)}><ArrowDownIcon /></Button></ReaderControlTooltip>
        </div></li>)}</ol><Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(structuredClone(entry.initial))}>Reset arrangement</Button><p role="status" className="sr-only">{announcement}</p></div>;
  }
  if (q.kind === "match" || q.kind === "family") return <div className="flex flex-col gap-3">
    {q.kind === "family" ? <><p className="text-xs text-muted-foreground">Each arrow means father → son.</p>{quizFamilyRoot(q) ? <p data-slot="quiz-family-root" className="rounded-lg border bg-muted p-2 text-center">{quizFamilyRoot(q)}</p> : null}</> : null}
    {q.slots!.map((slot, i) => <div key={i} className="flex flex-col gap-2">{q.kind === "family" ? <span aria-hidden="true" className="text-center">↓</span> : null}<QuizSelect label={`${i + 1}. ${slot}`} value={(answer as string[])[i]} items={[{ value: "", label: "Choose…" }, ...entry.choices.map(value => ({ value, label: value }))]} disabled={disabled} onChange={value => { const next = [...answer as string[]]; next[i] = value; onChange(next); }} /></div>)}
  </div>;
  const map = q.kind === "map";
  return <div className="flex flex-col gap-3">{map ? <QuizMap question={q} answer={answer} onChange={onChange} disabled={disabled} /> : null}
    <ToggleGroup orientation="vertical" variant="outline" spacing={2} value={typeof answer === "string" && answer ? [answer] : []} onValueChange={values => { if (!disabled) onChange(values[0] ?? ""); }} disabled={disabled} className="w-full" aria-label="Answer choices">
      {(map ? q.choices : entry.choices).map((choice, i) => <ToggleGroupItem key={choice} value={choice} className="h-auto min-h-10 w-full justify-start px-3 py-2 text-left whitespace-normal"><span className="mr-2 shrink-0">{map ? choice : String.fromCharCode(65 + i)}.</span><span>{map ? q.mapLabels![i].slice(4) : choice}</span></ToggleGroupItem>)}
    </ToggleGroup>
  </div>;
}
