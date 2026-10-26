import { CompletionConfetti } from "./completion-confetti";
import { PartyPopperIcon, SparklesIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CompletionCelebrationProps = {
  open: boolean;
  showConfetti: boolean;
  verse: {
    reference: string;
    text: string;
  };
  onOpenChange: (open: boolean) => void;
};

export function CompletionCelebration({
  open,
  showConfetti,
  verse,
  onOpenChange,
}: CompletionCelebrationProps) {
  return (
    <>
      {showConfetti ? <CompletionConfetti /> : null}
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/15 text-primary">
              <PartyPopperIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Congratulations!</AlertDialogTitle>
            <AlertDialogDescription>
              You reached 100% reading progress across the whole Bible.
            </AlertDialogDescription>
            <AlertDialogDescription>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <SparklesIcon className="size-4" />
                Finishing the full reading plan is no small thing.
              </span>
            </AlertDialogDescription>
            <div className="rounded-lg border border-subtle-divider bg-muted/40 p-3 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {verse.reference}
              </p>
              <p className="text-sm text-foreground">{verse.text}</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:flex group-data-[size=sm]/alert-dialog-content:grid-cols-none justify-end px-3 py-2 sm:justify-end">
            <AlertDialogAction className="w-auto self-auto" onClick={() => onOpenChange(false)}>
              Amen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
