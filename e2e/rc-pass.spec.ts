import AxeBuilder from "@axe-core/playwright"
import { devices, expect, test, type Locator, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"

const FIRST_VERSE = "In the beginning God created the heaven and the earth."

test.skip(
  !process.env.PLAYWRIGHT_USE_PREVIEW,
  "Release-candidate matrix requires the production preview server",
)

async function expectReaderReady(page: Page) {
  const genesisTab = page.getByRole("button", { name: "Genesis 1", exact: true })
  await expect(genesisTab).toBeVisible()
  await genesisTab.click()
  await expect(
    page.getByText(FIRST_VERSE, { exact: false }).filter({ visible: true }),
  ).toBeVisible()
}

async function openAccordion(trigger: Locator) {
  await expect(trigger).toBeVisible()
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click()
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
}

async function openPanelHome(page: Page) {
  await page.getByLabel("Panel options").filter({ visible: true }).first().click()
  await page.getByRole("menuitem", { name: "Home", exact: true }).click()
  await expect(page.getByText("Panel Home", { exact: true })).toBeVisible()
}

async function openMainMenuItem(page: Page, name: string) {
  await page.getByLabel("Open menu").click()
  await page.getByRole("menuitem", { name, exact: true }).click()
}

test("uses the icon-only brand whenever the header is constrained", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "kjv-display-settings-v1",
      JSON.stringify({ tabsOrientation: "vertical" }),
    )
  })
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/")
  await expectReaderReady(page)

  const brandLabel = page.locator("header").first().getByText("KJV Only", {
    exact: true,
  })
  await expect(brandLabel).toHaveCSS("display", "none")

  await page.setViewportSize({ width: 768, height: 1024 })
  const desktopSidebar = page.locator(
    'div[data-slot="sidebar"][data-side="right"]',
  )
  await expect(desktopSidebar).toHaveAttribute("data-state", "expanded")
  await expect(
    page.locator('[data-slot="sidebar-container"][data-side="right"]'),
  ).toBeVisible()
  await expect(brandLabel).toHaveCSS("display", "none")

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(desktopSidebar).toHaveAttribute("data-state", "collapsed")
  await expect(brandLabel).toHaveCSS("display", "block")
})

test("round-trips a created note and chapter bookmark", async ({ page }) => {
  await page.goto("/")
  await expectReaderReady(page)

  await page.getByLabel("Panel options").filter({ visible: true }).first().click()
  await page.getByRole("menuitem", { name: "Bookmark Chapter", exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(
          localStorage.getItem("kjv-reader-bookmarks-v1") ?? "[]",
        ) as Array<{ label?: string }>
        return stored.some((bookmark) => bookmark.label === "Genesis 1")
      }),
    )
    .toBe(true)

  await openPanelHome(page)
  await page
    .getByRole("button", { name: "Notes", exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await page.getByRole("button", { name: "New General", exact: true }).click()
  await page.getByPlaceholder("Note title").fill("RC note")
  await page.getByLabel("Save note").click()
  await expect(page.getByText("RC note", { exact: true }).filter({ visible: true })).toBeVisible()

  await page.getByLabel("Edit note").click()
  await page.getByPlaceholder("Note title").fill("RC note updated")
  await page.getByLabel("Save note").click()
  await expect(
    page.getByText("RC note updated", { exact: true }).filter({ visible: true }),
  ).toBeVisible()

  const notesDownloadPromise = page.waitForEvent("download")
  await openMainMenuItem(page, "Export Notes")
  const notesDownload = await notesDownloadPromise
  const notesPath = await notesDownload.path()
  expect(notesPath).not.toBeNull()
  const notesPayload = JSON.parse(await readFile(notesPath!, "utf8")) as {
    notes: Array<{ title?: string }>
  }
  expect(notesPayload.notes.some((note) => note.title === "RC note updated")).toBe(true)

  const bookmarksDownloadPromise = page.waitForEvent("download")
  await openMainMenuItem(page, "Export Bookmarks")
  const bookmarksDownload = await bookmarksDownloadPromise
  const bookmarksPath = await bookmarksDownload.path()
  expect(bookmarksPath).not.toBeNull()
  const bookmarksPayload = JSON.parse(await readFile(bookmarksPath!, "utf8")) as {
    bookmarks: Array<{ label?: string }>
  }
  expect(
    bookmarksPayload.bookmarks.some((bookmark) => bookmark.label === "Genesis 1"),
  ).toBe(true)

  await page.locator('input[type="file"]').first().setInputFiles(notesPath!)
  await expect(page.getByRole("alertdialog")).toContainText("Notes Imported")
  await page.getByRole("button", { name: "OK" }).click()
  await page.locator('input[type="file"]').nth(1).setInputFiles(bookmarksPath!)
  await expect(page.getByRole("alertdialog")).toContainText("Bookmarks Imported")
  await page.getByRole("button", { name: "OK" }).click()
})

test.describe("constrained mobile study matrix", () => {
  test.use({
    userAgent: devices["Pixel 5"].userAgent,
    viewport: devices["Pixel 5"].viewport,
    deviceScaleFactor: devices["Pixel 5"].deviceScaleFactor,
    isMobile: devices["Pixel 5"].isMobile,
    hasTouch: devices["Pixel 5"].hasTouch,
    serviceWorkers: "block",
    contextOptions: { reducedMotion: "reduce" },
  })

  test("settles word, Strong's, phrase, place, and genealogy tools", async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const client = await page.context().newCDPSession(page)
    await client.send("Network.enable")
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 100,
      downloadThroughput: 1_250_000,
      uploadThroughput: 625_000,
      connectionType: "cellular4g",
    })
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 })

    await page.goto("/")
    await expectReaderReady(page)
    await page.evaluate(() => {
      performance.clearMeasures("kjv:study-word-all-tools")
    })
    await page
      .getByRole("button", { name: "Details for beginning", exact: true })
      .first()
      .click()

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            performance.getEntriesByName("kjv:study-word-all-tools").at(-1)
              ?.duration,
        ),
      )
      .toBeTruthy()
    await expect(
      page
        .getByRole("button", { name: "Concordance", exact: true })
        .filter({ visible: true }),
    ).toBeVisible()

    const phrasesTrigger = page
      .getByRole("button", { name: "KJV Words & Phrases", exact: true })
      .filter({ visible: true })
    await openAccordion(phrasesTrigger)
    await expect(
      page.getByText("in the beginning", { exact: false }).filter({ visible: true }).first(),
    ).toBeVisible()

    const strongsTrigger = page
      .getByRole("button", { name: "Strong's Dictionary", exact: true })
      .filter({ visible: true })
    await openAccordion(strongsTrigger)
    await expect(
      page
        .getByRole("button", { name: /^H\d+ \(hebrew\)$/i })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()

    const mapsTrigger = page
      .getByRole("button", { name: "Maps", exact: true })
      .filter({ visible: true })
    await openAccordion(mapsTrigger)
    await page.getByRole("textbox", { name: "Search maps" }).fill("Jerusalem")
    await page.getByRole("textbox", { name: "Search maps" }).press("Enter")
    const openMapButton = page.getByRole("button", { name: "Open Map" }).first()
    await expect(openMapButton).toBeVisible()
    await openMapButton.click()
    await expect(page.getByRole("group", { name: "Map renderer" })).toBeVisible()
    await expect(page.locator('[data-map-renderer="open-free-map"]')).toBeVisible()
    await page.getByRole("button", { name: "Leaflet", exact: true }).click()
    await expect(page.locator(".leaflet-container")).toBeVisible()
    await page.getByRole("button", { name: "Close", exact: true }).click()

    const genealogyTrigger = page
      .getByRole("button", { name: "Genealogy", exact: true })
      .filter({ visible: true })
    await openAccordion(genealogyTrigger)
    await page.getByRole("textbox", { name: "Search genealogy" }).fill("Adam")
    await page.getByRole("textbox", { name: "Search genealogy" }).press("Enter")
    await expect(page.getByRole("button", { name: "View Tree", exact: true })).toBeVisible()

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      studyDuration: performance
        .getEntriesByName("kjv:study-word-all-tools")
        .at(-1)?.duration,
    }))
    expect(layout.content).toBeLessThanOrEqual(layout.viewport + 2)
    expect(layout.studyDuration).toBeGreaterThan(0)
    expect(layout.studyDuration).toBeLessThan(60_000)
  })
})

test.describe("visual accessibility matrix", () => {
  test.use({
    viewport: { width: 1280, height: 900 },
    contextOptions: {
      forcedColors: "active",
      reducedMotion: "reduce",
    },
  })

  test("supports contrast, reduced motion, and effective 200% zoom", async ({
    page,
  }) => {
    await page.goto("/")
    await expectReaderReady(page)

    expect(
      await page.evaluate(() => ({
        forcedColors: matchMedia("(forced-colors: active)").matches,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      })),
    ).toEqual({ forcedColors: true, reducedMotion: true })

    await openMainMenuItem(page, "Settings")
    await page.getByLabel("Color Theme").click()
    await page.getByRole("option", { name: "Contrast", exact: true }).click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.readerTheme))
      .toBe("contrast")

    const reducedTransitionSeconds = await page
      .getByLabel("Open menu")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))
    expect(reducedTransitionSeconds).toBeLessThanOrEqual(0.00001)

    await page.evaluate(() => {
      document.documentElement.style.zoom = "2"
    })
    await page.getByRole("button", { name: "Genesis 1", exact: true }).click()
    await expect(page.getByLabel("Next chapter").first()).toBeVisible()
    await page.getByLabel("Next chapter").first().click()
    await expect(page.getByRole("button", { name: "Genesis 2", exact: true })).toBeVisible()
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(layout.content).toBeLessThanOrEqual(layout.viewport + 2)

    await page.emulateMedia({
      forcedColors: "none",
      reducedMotion: "reduce",
    })
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === "critical" || violation.impact === "serious",
      ),
    ).toEqual([])
  })
})

test("downloads, uses, and clears the core offline package", async ({
  page,
  context,
}) => {
  test.setTimeout(300_000)
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))
  await page.goto("/")
  await expectReaderReady(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await openMainMenuItem(page, "Download")

  const coreCard = page
    .getByText("Core Bible Data", { exact: true }).filter({ visible: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]')
  await expect(coreCard).toBeVisible()
  const downloadButton = coreCard.getByRole("button", {
    name: /^(Download Core Bible Data|Check for Missing Files)$/,
  })
  if ((await downloadButton.textContent())?.includes("Download")) {
    await downloadButton.click()
  }
  await expect(coreCard.getByText("Fully cached", { exact: true })).toBeVisible({
    timeout: 240_000,
  })

  await coreCard.getByRole("button", { name: "Refresh Bundle", exact: true }).click()
  await expect(coreCard.getByText("Up to date", { exact: false })).toBeVisible({ timeout: 240_000 })

  const offlineReadiness = await page.evaluate(async () => {
    const config = (
      globalThis as typeof globalThis & {
        KJV_ONLY_CACHE_CONFIG?: { cacheName?: string }
      }
    ).KJV_ONLY_CACHE_CONFIG
    const manifest = (await (
      await fetch("/app-shell-assets.json", { cache: "no-cache" })
    ).json()) as { assets?: string[]; offlineIconAssets?: string[] }
    const cacheName = config?.cacheName ?? ""
    const cache = await caches.open(cacheName)
    const required = [
      "/",
      "/index.html",
      ...(manifest.assets ?? []),
      ...(manifest.offlineIconAssets ?? []),
    ]
    const missing: string[] = []
    for (const url of required) {
      if (!(await cache.match(url, { ignoreVary: true }))) {
        missing.push(url)
      }
    }
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      cacheName,
      missing,
    }
  })
  expect(offlineReadiness.controlled).toBe(true)
  expect(offlineReadiness.cacheName).toMatch(/^kjv-only-cache-/)
  expect(offlineReadiness.missing).toEqual([])

  await context.setOffline(true)
  const offlineFetches = await page.evaluate(async () => {
    const manifest = (await (
      await fetch("/app-shell-assets.json")
    ).json()) as { startupAssets?: string[]; offlineIconAssets?: string[] }
    const urls = [
      "/app-cache-config.js",
      ...(manifest.startupAssets ?? []),
      ...(manifest.offlineIconAssets ?? []),
    ]
    return Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(url)
          return { url, ok: response.ok, status: response.status }
        } catch (error) {
          return {
            url,
            ok: false,
            status: 0,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }),
    )
  })
  expect(offlineFetches.every((result) => result.ok), JSON.stringify(offlineFetches)).toBe(
    true,
  )
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(5_000)
  const offlineDocument = await page.evaluate(() => ({
    rootChildren: document.getElementById("root")?.childElementCount ?? -1,
    controlled: Boolean(navigator.serviceWorker.controller),
    scripts: Array.from(document.scripts, (script) => script.src),
    stylesheets: Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      (stylesheet) => stylesheet.href,
    ),
  }))
  expect(
    offlineDocument.rootChildren,
    JSON.stringify({ browserErrors, offlineDocument }, null, 2),
  ).toBeGreaterThan(0)
  await expectReaderReady(page)
  await openMainMenuItem(page, "Download")
  const offlineCoreCard = page.getByText("Core Bible Data", { exact: true }).filter({ visible: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]')
  await expect(offlineCoreCard.getByText("Matches last known version", { exact: false })).toBeVisible()
  await expect(offlineCoreCard.getByText("Size unavailable", { exact: true })).toHaveCount(0)
  await context.setOffline(false)

  await openMainMenuItem(page, "Download")
  const refreshedCoreCard = page
    .getByText("Core Bible Data", { exact: true }).filter({ visible: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]')
  await refreshedCoreCard.getByRole("button", { name: "Clear Bundle" }).click()
  await expect(refreshedCoreCard.getByRole("button", { name: "Download Core Bible Data", exact: true })).toBeEnabled({ timeout: 180_000 })
  await expect(refreshedCoreCard.getByText("Not downloaded", { exact: true })).toBeVisible()
})
