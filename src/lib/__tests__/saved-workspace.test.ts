import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { consumeLocalStorageIssueKeys } from "@/lib/local-storage"
import { readStartupWorkspace, saveWorkspace, startFreshWorkspace, WORKSPACE_STORAGE_KEY } from "@/lib/saved-workspace"

const layout = "#tab=1&tabs=v&layout=Study:h60(JHN.3.16*;ROM.8)|Notes:notes"
let values: Map<string, string>
beforeEach(() => {
  values = new Map()
  consumeLocalStorageIssueKeys()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
    dispatchEvent: vi.fn(),
    history: { replaceState: vi.fn() },
    location: { pathname: "/", search: "?test=1", reload: vi.fn() },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("saved workspace", () => {
  it("restores tabs, splits, chapters, selected verses, orientation and target without a URL", () => {
    expect(saveWorkspace(layout)).toBe(true)
    const restored = readStartupWorkspace("")!
    expect(restored.tabs.map(tab => tab.title)).toEqual(["Study", "Notes"])
    expect(restored.activeTabIndex).toBe(1)
    expect(restored.tabsOrientation).toBe("vertical")
    expect(restored.tabs[0].root).toMatchObject({ type: "split", ratio: 60,
      first: { bookIndex: 42, chapterIndex: 2 }, second: { bookIndex: 44, chapterIndex: 7 } })
    expect(Object.values(restored.highlightedVerseRangesByLeafId)).toEqual([[{ start: 16, end: 16 }]])
    expect(restored.targetedPanelLeafId).toBeTruthy()
  })
  it("gives shared links precedence, including malformed explicit links", () => {
    saveWorkspace(layout)
    expect(readStartupWorkspace("#layout=Shared:PSA.23")?.tabs[0].title).toBe("Shared")
    expect(readStartupWorkspace("#layout=broken")).toBeNull()
    expect(readStartupWorkspace("")?.tabs[0].title).toBe("Study")
  })
  it.each(["{broken", '"wrong"', '{"version":2,"layoutHash":"#layout=Study:GEN.1"}', '{"version":1,"layoutHash":"#layout=bad"}'])("recovers safely from invalid saved data: %s", saved => {
    values.set(WORKSPACE_STORAGE_KEY, saved)
    expect(readStartupWorkspace("")).toBeNull()
    expect(consumeLocalStorageIssueKeys()).toContain(WORKSPACE_STORAGE_KEY)
  })
  it("does not replace the last usable layout with an invalid one", () => {
    saveWorkspace(layout)
    expect(saveWorkspace("#layout=invalid")).toBe(false)
    expect(readStartupWorkspace("")?.tabs[0].title).toBe("Study")
  })
  it("starts fresh without deleting other saved data", () => {
    saveWorkspace(layout)
    values.set("kjv-reader-notes-v1", "keep")
    startFreshWorkspace()
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/?test=1#fresh")
    expect(window.location.reload).toHaveBeenCalledOnce()
    expect(values.has(WORKSPACE_STORAGE_KEY)).toBe(false)
    expect(values.get("kjv-reader-notes-v1")).toBe("keep")
  })
  it("honors the fresh-start marker even if clearing storage previously failed", () => {
    saveWorkspace(layout)
    expect(readStartupWorkspace("#fresh")).toBeNull()
    expect(values.has(WORKSPACE_STORAGE_KEY)).toBe(false)
  })
  it("keeps shared links usable when local storage is blocked", () => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("blocked") } })
    expect(readStartupWorkspace("#layout=Shared:PSA.23")?.tabs[0].title).toBe("Shared")
    expect(readStartupWorkspace("")).toBeNull()
    expect(saveWorkspace(layout)).toBe(false)
  })
})
