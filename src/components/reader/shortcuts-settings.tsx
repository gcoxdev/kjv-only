import { useEffect, useMemo, useRef, useState } from "react"
import { KeyboardIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SHORTCUT_CATEGORIES,
  SHORTCUT_DEFINITIONS,
  findShortcutConflict,
  formatShortcutStroke,
  shortcutBindingEquals,
  shortcutDefinition,
  shortcutStrokeFromKeyboardEvent,
  shortcutStrokeHasCommandModifier,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutBindings,
} from "@/lib/keyboard-shortcuts"

type ShortcutsSettingsProps = {
  bindings: ShortcutBindings
  onBindingChange: (actionId: ShortcutActionId, binding: ShortcutBinding) => void
  onResetBinding: (actionId: ShortcutActionId) => void
  onResetAllBindings: () => void
}

function useIsMac() {
  return useMemo(
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform),
    [],
  )
}

function ShortcutKeys({
  binding,
  isMac,
}: {
  binding: readonly string[] | null
  isMac: boolean
}) {
  if (!binding) {
    return <span className="text-xs text-muted-foreground">Not set</span>
  }
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {binding.map((stroke, index) => (
        <span key={`${stroke}-${index}`} className="contents">
          {index > 0 ? (
            <span className="text-[10px] text-muted-foreground" aria-hidden="true">
              then
            </span>
          ) : null}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-xs">
            {formatShortcutStroke(stroke, isMac)}
          </kbd>
        </span>
      ))}
    </span>
  )
}

export function ShortcutsSettings({
  bindings,
  onBindingChange,
  onResetBinding,
  onResetAllBindings,
}: ShortcutsSettingsProps) {
  const isMac = useIsMac()
  const [query, setQuery] = useState("")
  const [editingActionId, setEditingActionId] =
    useState<ShortcutActionId | null>(null)
  const [draftBinding, setDraftBinding] = useState<string[]>([])
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const captureStartedRef = useRef(false)
  const editingDefinition = editingActionId
    ? shortcutDefinition(editingActionId)
    : null
  const conflict = editingActionId
    ? findShortcutConflict(bindings, editingActionId, draftBinding)
    : null
  const requiresEditableModifier =
    editingActionId === "general.saveNote" &&
    draftBinding.length > 0 &&
    !shortcutStrokeHasCommandModifier(draftBinding[0])

  useEffect(() => {
    if (!editingActionId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (event.key === "Escape") {
        event.preventDefault()
        setEditingActionId(null)
        return
      }
      if (event.key === "Backspace" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        captureStartedRef.current = true
        setDraftBinding((current) => current.slice(0, -1))
        return
      }
      const stroke = shortcutStrokeFromKeyboardEvent(event)
      if (!stroke) return
      event.preventDefault()
      if (!captureStartedRef.current) {
        captureStartedRef.current = true
        setDraftBinding([stroke])
        return
      }
      setDraftBinding((current) =>
        current.length >= 3 ? [...current.slice(0, 2), stroke] : [...current, stroke],
      )
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [editingActionId])

  const openEditor = (actionId: ShortcutActionId) => {
    setEditingActionId(actionId)
    setDraftBinding(bindings[actionId] ? [...bindings[actionId]] : [])
    captureStartedRef.current = false
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matchingDefinitions = SHORTCUT_DEFINITIONS.filter((definition) =>
    normalizedQuery.length === 0
      ? true
      : `${definition.label} ${definition.description} ${definition.category}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
  )

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Filter shortcuts"
              aria-label="Filter shortcuts"
              className="pl-8"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setResetAllOpen(true)}>
            <RotateCcwIcon />
            Restore defaults
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Click a shortcut to replace it. Chords are entered one step at a time and
          wait briefly for the next key. Shortcuts do not run while typing in a form
          or note editor, except Save active note.
        </p>

        {SHORTCUT_CATEGORIES.map((category) => {
          const definitions = matchingDefinitions.filter(
            (definition) => definition.category === category,
          )
          if (definitions.length === 0) return null
          return (
            <FieldSet key={category} className="gap-2 rounded-lg border p-3">
              <FieldLegend>{category}</FieldLegend>
              <FieldGroup className="gap-2">
                {definitions.map((definition) => {
                  const binding = bindings[definition.id]
                  const isDefault = shortcutBindingEquals(
                    binding,
                    definition.defaultBinding,
                  )
                  return (
                    <Field
                      key={definition.id}
                      orientation="horizontal"
                      className="items-center gap-2 rounded-md border p-2"
                    >
                      <FieldContent className="min-w-0">
                        <FieldTitle>{definition.label}</FieldTitle>
                        <FieldDescription className="text-xs">
                          {definition.description}
                        </FieldDescription>
                      </FieldContent>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto min-h-8 min-w-20 px-2"
                          onClick={() => openEditor(definition.id)}
                          aria-label={`${binding ? binding.map(stroke => formatShortcutStroke(stroke, isMac)).join(" then ") : "Not set"}: Change shortcut for ${definition.label}`}
                        >
                          <ShortcutKeys binding={binding} isMac={isMac} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onResetBinding(definition.id)}
                          disabled={isDefault}
                          aria-label={`Restore default shortcut for ${definition.label}`}
                          title="Restore default"
                        >
                          <RotateCcwIcon />
                        </Button>
                      </div>
                    </Field>
                  )
                })}
              </FieldGroup>
            </FieldSet>
          )
        })}
        {matchingDefinitions.length === 0 ? (
          <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
            No shortcuts match “{query}”.
          </p>
        ) : null}
      </div>

      <Dialog
        open={editingActionId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingActionId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set keyboard shortcut</DialogTitle>
            <DialogDescription>
              {editingDefinition?.label ?? "Shortcut"}. Press up to three key
              combinations in order, then save.
            </DialogDescription>
          </DialogHeader>
          <div
            className="flex min-h-20 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-4"
            aria-live="polite"
          >
            {draftBinding.length > 0 ? (
              <ShortcutKeys binding={draftBinding} isMac={isMac} />
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyboardIcon /> Press shortcut keys
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Backspace removes the last step. Escape cancels.
          </p>
          {conflict ? (
            <p role="alert" className="text-sm text-destructive">
              This conflicts with “{conflict.label}”. Choose a different shortcut.
            </p>
          ) : null}
          {requiresEditableModifier ? (
            <p role="alert" className="text-sm text-destructive">
              Save active note must begin with Ctrl/Command or Alt so normal
              typing remains available.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (editingActionId) onBindingChange(editingActionId, null)
                setEditingActionId(null)
              }}
            >
              <Trash2Icon />
              Clear
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingActionId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                draftBinding.length === 0 ||
                conflict !== null ||
                requiresEditableModifier
              }
              onClick={() => {
                if (editingActionId) onBindingChange(editingActionId, draftBinding)
                setEditingActionId(null)
              }}
            >
              Save shortcut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={resetAllOpen} onOpenChange={setResetAllOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore all shortcut defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              Every customized or cleared shortcut will return to its original
              binding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onResetAllBindings()
                setResetAllOpen(false)
              }}
            >
              Restore defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
