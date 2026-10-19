// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StorageProtectionControl } from "@/components/reader/storage-protection"
import { checkStorageProtection, requestStorageProtection, type StorageProtection } from "@/lib/storage-persistence"

vi.mock("@/lib/storage-persistence", () => ({
  checkStorageProtection: vi.fn(),
  requestStorageProtection: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(checkStorageProtection).mockResolvedValue("unprotected")
  vi.mocked(requestStorageProtection).mockResolvedValue("protected")
})
afterEach(cleanup)

describe("StorageProtectionControl", () => {
  it("waits for status and requests permission only after a click, preventing duplicate requests", async () => {
    const check = deferred<StorageProtection>()
    const request = deferred<StorageProtection>()
    vi.mocked(checkStorageProtection).mockReturnValue(check.promise)
    vi.mocked(requestStorageProtection).mockReturnValue(request.promise)
    render(<StorageProtectionControl />)
    expect(screen.getByRole("status").textContent).toContain("Checking")
    expect(screen.queryByRole("button")).toBeNull()
    await act(async () => { check.resolve("unprotected") })
    expect(requestStorageProtection).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Protect Offline Data" }))
    const pending = screen.getByRole<HTMLButtonElement>("button", { name: "Requesting Protection…" })
    expect(pending.disabled).toBe(true)
    fireEvent.click(pending)
    expect(requestStorageProtection).toHaveBeenCalledTimes(1)
    await act(async () => { request.resolve("protected") })
    expect(screen.getByRole("status").textContent).toContain("Protected from automatic browser storage cleanup")
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("explains a refusal and allows a later successful retry", async () => {
    vi.mocked(requestStorageProtection).mockResolvedValueOnce("declined").mockResolvedValueOnce("protected")
    render(<StorageProtectionControl />)
    fireEvent.click(await screen.findByRole("button", { name: "Protect Offline Data" }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("did not grant protection"))
    const retry = screen.getByRole<HTMLButtonElement>("button", { name: "Protect Offline Data" })
    expect(retry.disabled).toBe(false)
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Protected from automatic"))
    expect(requestStorageProtection).toHaveBeenCalledTimes(2)
  })

  it.each([
    ["protected", "Protected from automatic"],
    ["unsupported", "does not offer storage protection"],
  ] as const)("does not offer a permission request when %s", async (status, message) => {
    vi.mocked(checkStorageProtection).mockResolvedValue(status)
    render(<StorageProtectionControl />)
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(message))
    expect(screen.queryByRole("button")).toBeNull()
    expect(requestStorageProtection).not.toHaveBeenCalled()
  })

  it("keeps a failed request recoverable and explains that downloads were not changed", async () => {
    vi.mocked(checkStorageProtection).mockResolvedValue("error")
    vi.mocked(requestStorageProtection).mockResolvedValue("error")
    render(<StorageProtectionControl />)
    fireEvent.click(await screen.findByRole("button", { name: "Protect Offline Data" }))
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Protect Offline Data" }).disabled).toBe(false))
    expect(screen.getByRole("status").textContent).toContain("Your downloads have not been changed")
    expect(requestStorageProtection).toHaveBeenCalledTimes(1)
  })

  it("does not let a late check from an unmounted control change the next control", async () => {
    const oldCheck = deferred<StorageProtection>()
    vi.mocked(checkStorageProtection).mockReturnValueOnce(oldCheck.promise).mockResolvedValueOnce("protected")
    const first = render(<StorageProtectionControl />)
    first.unmount()
    render(<StorageProtectionControl />)
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Protected from automatic"))
    await act(async () => { oldCheck.resolve("unprotected") })
    expect(screen.queryByRole("button")).toBeNull()
  })
})
