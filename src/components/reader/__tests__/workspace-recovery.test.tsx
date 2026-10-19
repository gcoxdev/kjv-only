// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WorkspaceRecovery } from "@/components/reader/workspace-recovery"
import { startFreshWorkspace } from "@/lib/saved-workspace"

vi.mock("@/lib/saved-workspace", () => ({ startFreshWorkspace: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("WorkspaceRecovery", () => {
  it("explains what is kept and resets only after confirmation", async () => {
    render(<WorkspaceRecovery />)
    expect(screen.queryByRole("alertdialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Start Fresh Workspace" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Start a fresh workspace?" })
    expect(dialog.textContent).toContain("Saved notes, bookmarks, reading progress, settings, and downloads are kept")
    expect(startFreshWorkspace).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Start Fresh" }))
    expect(startFreshWorkspace).toHaveBeenCalledTimes(1)
  })

  it("cancels without resetting and returns focus to the trigger", async () => {
    render(<WorkspaceRecovery />)
    const trigger = screen.getByRole("button", { name: "Start Fresh Workspace" })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(startFreshWorkspace).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    fireEvent.click(trigger)
    expect(await screen.findByRole("alertdialog")).toBeTruthy()
    expect(startFreshWorkspace).not.toHaveBeenCalled()
  })
})
