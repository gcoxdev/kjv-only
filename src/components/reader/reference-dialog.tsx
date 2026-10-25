import { useId, useState } from "react";
import { ExternalLinkIcon, ListTreeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useOptionalSidebar } from "@/components/ui/sidebar";
import { DialogDismissButton } from "./dialog-dismiss-button";
import type { ConcordanceReferencePopoverProps } from "./concordance-reference-popover";

export function ReferenceDialog({ reference, label, highlightWord, renderPreview, onOpenReference, onCloseSidebar }: ConcordanceReferencePopoverProps) {
  const [open, setOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const contentId = useId();
  const sidebar = useOptionalSidebar();
  const openReference = () => {
    setOpen(false);
    onOpenReference(reference);
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
      sidebar?.setOpenMobile(false);
      onCloseSidebar();
    }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<button type="button" className="inline-flex items-center rounded-md border border-border px-1.5 py-px text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />}>{label ?? reference}</DialogTrigger>
    <DialogContent showCloseButton={false} className="flex max-h-[85dvh] flex-col sm:max-w-xl">
      <DialogTitle className="sr-only">{label ?? reference}</DialogTitle>
      <DialogDismissButton onClose={() => setOpen(false)} />
      <div id={contentId} className="min-h-0 flex-1 overflow-y-auto pr-8 text-sm leading-relaxed">{renderPreview(reference, highlightWord, { includeContext: showContext })}</div>
      <DialogFooter className="flex-row flex-wrap gap-2">
        <Button type="button" size="xs" variant={showContext ? "secondary" : "outline"} aria-pressed={showContext} aria-controls={contentId} onClick={() => setShowContext(value => !value)}><ListTreeIcon data-icon="inline-start" />Context</Button>
        <Button type="button" size="xs" variant="outline" onClick={openReference}><ExternalLinkIcon data-icon="inline-start" />Open</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
