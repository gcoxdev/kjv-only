import { useId } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useQuizRewards } from "@/hooks/use-quiz-rewards";

export function QuizRewardPreferences({ compact = false }: { compact?: boolean }) {
  const [preferences, setPreferences] = useQuizRewards();
  const id = useId();
  return <FieldGroup className="gap-4">
    <Field orientation="horizontal"><FieldContent><FieldLabel htmlFor={`${id}-streak`}>Show quiz practice streak</FieldLabel>{!compact ? <FieldDescription>Count practice days without penalties for taking a break.</FieldDescription> : null}</FieldContent><Switch id={`${id}-streak`} checked={preferences.showStreak} onCheckedChange={showStreak => setPreferences(current => ({ ...current, showStreak }))} /></Field>
    <Field orientation="horizontal"><FieldContent><FieldLabel htmlFor={`${id}-celebrations`}>Quiz completion celebrations</FieldLabel>{!compact ? <FieldDescription>Celebrate completed quizzes with correct unassisted answers. Reduced-motion preferences disable confetti.</FieldDescription> : null}</FieldContent><Switch id={`${id}-celebrations`} checked={preferences.celebrations} onCheckedChange={celebrations => setPreferences(current => ({ ...current, celebrations }))} /></Field>
  </FieldGroup>;
}
