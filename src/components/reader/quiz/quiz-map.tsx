import { quizMapPoint, quizMapRegion } from "@/lib/quiz/map-regions";
import type { QuizAnswer, QuizQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

export function QuizMap({ question: q, answer, onChange, disabled }: { question: QuizQuestion; answer: QuizAnswer; onChange: (answer: QuizAnswer) => void; disabled: boolean }) {
  const region = quizMapRegion(q);
  const legacy = !q.mapRegion || q.mapRegion === "north-aegean";
  return <figure className="flex flex-col gap-2">
    <figcaption className="text-sm text-muted-foreground">{region.label} · North ↑</figcaption>
    <svg viewBox={`0 0 ${region.width} ${region.height}`} role="group" aria-label={`Schematic ${region.label} map`} className={cn("mx-auto w-full max-w-md overflow-hidden rounded-lg border", region.waterBackground ? "bg-background" : "bg-accent")}>
      {region.shapes.map((shape, i) => <path key={i} d={shape.path} aria-hidden="true" className={cn(shape.kind === "land" ? "fill-accent" : shape.kind === "river" ? "fill-none stroke-muted-foreground" : "fill-background stroke-border")} strokeWidth={shape.kind === "river" ? 1.5 : 1} />)}
      {q.places!.map((point, i) => {
        const value = q.choices[i], selected = value === answer;
        const { x, y } = quizMapPoint(q, point);
        return <g key={value} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-pressed={selected} aria-label={q.mapLabels![i]} transform={`translate(${x},${y})`} onClick={() => { if (!disabled) onChange(value); }} onKeyDown={e => { if (!disabled && ["Enter", " "].includes(e.key)) { e.preventDefault(); onChange(value); } }} className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <circle r={legacy ? 24 : 27} className={cn("stroke-2 stroke-primary", selected ? "fill-primary" : "fill-background/25")} /><text textAnchor="middle" dy="6" strokeWidth={selected ? 0 : 3} className={cn(selected ? "fill-primary-foreground" : "fill-foreground stroke-background [paint-order:stroke]")}>{value}</text>
        </g>;
      })}
    </svg>
    <p className="text-xs text-muted-foreground">Approximate locations and simplified geography, not historical shorelines or exact sites. Choose a marker or its equivalent description below.</p>
  </figure>;
}
