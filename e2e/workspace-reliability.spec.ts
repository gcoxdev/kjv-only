import { expect, test, type Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })
const KEY = "kjv-workspace-v1"
const STUDY = "/#tab=0&tabs=v&layout=Study:h60(JHN.3.16*;ROM.8)|Notes:notes"

async function openMenu(page: Page, name: string) {
  await page.getByLabel("Open menu").click()
  await page.getByRole("menuitem", { name, exact: true }).click()
}

for (const width of [390, 1280]) {
  test(`restores a saved workspace on a new visit at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(STUDY)
    await expect(page.getByRole("region", { name: "John 3 panel", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Romans 8 panel", exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), KEY)).toContain("JHN.3.16")
    const savedHash = await page.evaluate(() => location.hash)
    await page.close()
    const reopened = await context.newPage()
    await reopened.setViewportSize({ width, height: 844 })
    await reopened.goto("/")
    await expect(reopened.getByRole("region", { name: "John 3 panel", exact: true })).toBeVisible()
    await expect(reopened.getByRole("region", { name: "Romans 8 panel", exact: true })).toBeVisible()
    await expect(reopened.getByRole("button", { name: "Notes", exact: true }).first()).toBeVisible()
    await expect.poll(() => reopened.evaluate(() => location.hash)).toBe(savedHash)

    // A shared URL overrides the saved workspace on a fresh visit.
    const shared = await context.newPage()
    await shared.goto("/#layout=Shared:PSA.23")
    await expect(shared.getByRole("region", { name: "Psalm 23 panel", exact: true })).toBeVisible()
    await expect(shared.getByRole("region", { name: "John 3 panel", exact: true })).toHaveCount(0)
  })
}

test("start fresh requires confirmation and preserves other saved data", async ({ page }) => {
  await page.goto(STUDY)
  await expect(page.getByRole("region", { name: "John 3 panel", exact: true })).toBeVisible()
  await page.evaluate(() => localStorage.setItem("kjv-read-chapters-v1", JSON.stringify(["0:0"])))
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== "kjv-workspace-v1")))
  await openMenu(page, "Settings")
  await page.getByRole("tab", { name: "Other", exact: true }).click()
  await page.getByRole("button", { name: "Start Fresh Workspace", exact: true }).click()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("button", { name: "Study", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Start Fresh Workspace", exact: true }).click()
  await page.getByRole("button", { name: "Start Fresh", exact: true }).click()
  await expect(page.getByRole("button", { name: "Genesis 1", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Study", exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), KEY)).toContain("GEN.1")
  for (const [key, value] of Object.entries(before)) {
    // Orientation is a preference and follows the current workspace; the fresh
    // default can update it. Personal data and every other key must survive.
    if (key !== "kjv-display-settings-v1") expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(value)
  }
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Genesis 1", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Study", exact: true })).toHaveCount(0)
})

test("invalid saved workspace falls back to the normal start", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{"version":1,"layoutHash":"#layout=broken"}'), KEY)
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Genesis 1", exact: true })).toBeVisible()
  await expect(page.getByText("The application could not finish loading.", { exact: false })).toHaveCount(0)
})

test("offline storage protection is requested only after clicking", async ({ page }) => {
  await page.addInitScript(() => {
    let protectedStorage = false
    Object.defineProperty(navigator, "storage", { configurable: true, value: {
      persisted: async () => protectedStorage,
      persist: async () => { protectedStorage = true; return true },
      estimate: async () => ({ usage: 0, quota: 1_000_000 }),
    } })
  })
  await page.goto("/")
  await openMenu(page, "Download")
  await expect(page.getByRole("button", { name: "Protect Offline Data", exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.storage.persisted())).toBe(false)
  await page.getByRole("button", { name: "Protect Offline Data", exact: true }).click()
  await expect(page.getByText("Protected from automatic browser storage cleanup.", { exact: false })).toBeVisible()
  expect(await page.evaluate(() => navigator.storage.persisted())).toBe(true)
})

for (const mode of ["declined", "unsupported", "error"] as const) {
  test(`offline storage protection explains ${mode}`, async ({ page }) => {
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, "storage", { configurable: true, value: mode === "unsupported" ? {} : {
        persisted: async () => false,
        persist: async () => {
          if (mode === "error") throw new Error("Storage blocked")
          return false
        },
        estimate: async () => ({ usage: 0, quota: 1_000_000 }),
      } })
    }, mode)
    await page.goto("/")
    await openMenu(page, "Download")
    if (mode === "unsupported") {
      await expect(page.getByText("This browser does not offer storage protection here.", { exact: false })).toBeVisible()
      await expect(page.getByRole("button", { name: "Protect Offline Data", exact: true })).toHaveCount(0)
    } else {
      await page.getByRole("button", { name: "Protect Offline Data", exact: true }).click()
      await expect(page.getByText(mode === "declined" ? "The browser did not grant protection." : "Could not check or request storage protection.", { exact: false })).toBeVisible()
      await expect(page.getByRole("button", { name: "Protect Offline Data", exact: true })).toBeEnabled()
    }
  })
}
