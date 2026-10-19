import { afterEach, expect, it, vi } from "vitest"
import { checkStorageProtection, requestStorageProtection } from "@/lib/storage-persistence"

afterEach(() => vi.unstubAllGlobals())

it("checks existing protection without requesting permission", async () => {
  const persist = vi.fn()
  vi.stubGlobal("navigator", { storage: { persisted: vi.fn().mockResolvedValue(true), persist } })
  expect(await checkStorageProtection()).toBe("protected")
  expect(persist).not.toHaveBeenCalled()
})

it.each([true, false])("reports the browser's permission decision: %s", async granted => {
  const persist = vi.fn().mockResolvedValue(granted)
  vi.stubGlobal("navigator", { storage: { persisted: vi.fn().mockResolvedValue(false), persist } })
  expect(await checkStorageProtection()).toBe("unprotected")
  expect(await requestStorageProtection()).toBe(granted ? "protected" : "declined")
  expect(persist).toHaveBeenCalledOnce()
})

it("handles unsupported and failed storage APIs without throwing", async () => {
  vi.stubGlobal("navigator", {})
  expect(await checkStorageProtection()).toBe("unsupported")
  expect(await requestStorageProtection()).toBe("unsupported")
  vi.stubGlobal("navigator", { storage: { persisted: () => { throw new Error("blocked") }, persist: vi.fn().mockRejectedValue(new Error("blocked")) } })
  expect(await checkStorageProtection()).toBe("error")
  expect(await requestStorageProtection()).toBe("error")
})
