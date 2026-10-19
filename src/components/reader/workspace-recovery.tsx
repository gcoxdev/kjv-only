import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { startFreshWorkspace } from "@/lib/saved-workspace"

export function WorkspaceRecovery() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">
        Your tabs, panels, chapters, selected verses, and searches reopen on your next visit.
        Shared links open their own layout. Welcome Home applies to new workspaces.
      </p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>Start Fresh Workspace</AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a fresh workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes your current tabs and panels and reopens the starting workspace.
              Saved notes, bookmarks, reading progress, settings, and downloads are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startFreshWorkspace}>Start Fresh</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
