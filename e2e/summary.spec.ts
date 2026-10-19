import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openSummary(page: Page, width: number, bootstrap = false) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(bootstrap ? "/" : "/#tab=0&tabs=h&layout=Genesis%201:GEN.1");
  if (bootstrap) await page.getByRole("button", { name: "Genesis 1", exact: true }).click();
  await expect(page.getByRole("region", { name: "Genesis 1 panel", exact: true })).toBeVisible();
  if (width < 768) await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  const sidebar = page.getByRole("region", { name: "Study sidebar", exact: true });
  await sidebar.getByRole("button", { name: "Tools", exact: true }).click();
  const triggers = sidebar.locator('[data-slot="accordion-trigger"]');
  await expect(triggers.nth(0)).toHaveText("Summary");
  await expect(triggers.nth(1)).toHaveText("Cross References");
  await sidebar.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(sidebar.getByRole("article", { name: "Genesis 1 summary", exact: true })).toBeVisible();
  return sidebar;
}

for (const width of [390, 1280]) {
  test.describe(`${width}px layout`, () => {
    test.use({ hasTouch: width < 768, isMobile: width < 768 });
    test(`summaries, book navigation, and Scripture references at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const sidebar = await openSummary(page, width);
      await expect(sidebar.getByRole("heading", { name: "God creates the heaven and the earth", exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath("summary-chapter.png") });
      await sidebar.getByRole("button", { name: "Next summary chapter", exact: true }).click();
      await expect(sidebar.getByRole("article", { name: "Genesis 2 summary", exact: true })).toBeVisible();
      await sidebar.getByRole("button", { name: "Follow reader", exact: true }).click();
      await expect(sidebar.getByRole("article", { name: "Genesis 1 summary", exact: true })).toBeVisible();

      await sidebar.getByRole("tab", { name: "Book", exact: true }).click();
      await expect(sidebar.getByRole("article", { name: "Genesis book summary", exact: true })).toBeVisible();
      await sidebar.getByRole("combobox", { name: "Summary book", exact: true }).click();
      await expect(page.getByRole("option")).toHaveCount(66);
      await page.getByRole("option", { name: "Psalms", exact: true }).click();
      await expect(sidebar.getByRole("article", { name: "Psalms book summary", exact: true })).toBeVisible();
      await sidebar.getByRole("tab", { name: "Chapter", exact: true }).click();
      await sidebar.getByRole("combobox", { name: "Summary chapter", exact: true }).click();
      await page.getByRole("option", { name: "119", exact: true }).click();
      const psalm = sidebar.getByRole("article", { name: "Psalm 119 summary", exact: true });
      await expect(psalm).toBeVisible();
      await expect(psalm.getByRole("button", { name: /^Psalm 119:/ })).toHaveCount(6);

      await sidebar.getByRole("tab", { name: "Bible", exact: true }).click();
      await expect(sidebar.getByRole("heading", { name: "Old Testament", exact: true })).toBeVisible();
      await expect(sidebar.getByRole("heading", { name: "New Testament", exact: true })).toBeAttached();
      expect(await sidebar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).include('[aria-label="Whole Bible summary"]').analyze();
      expect(accessibility.violations).toEqual([]);
      await sidebar.getByRole("button", { name: "Psalm 23:1-6", exact: true }).click();
      if (width < 768) {
        // Touch previews offer an explicit Open action; desktop clicks open directly.
        const popover = page.locator('[data-slot="popover-content"]').filter({ hasText: "shepherd" });
        await expect(popover).toBeVisible();
        await popover.getByRole("button", { name: "Open", exact: true }).click();
      }
      await expect(page.getByRole("region", { name: "Psalm 23 panel", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

test("Summary also works in a Tools panel and follows chapter changes", async ({ page }) => {
  await page.goto("/#tab=0&tabs=h&layout=Study:h50(GEN.1;tools)");
  const panel = page.getByRole("region", { name: "Tools panel", exact: true });
  await panel.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(panel.getByRole("article", { name: "Genesis 1 summary", exact: true })).toBeVisible();
  await page.getByRole("region", { name: "Genesis 1 panel", exact: true }).getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(panel.getByRole("article", { name: "Genesis 2 summary", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Collapse All", exact: true }).click();
  await expect(panel.getByRole("article")).toHaveCount(0);
  await panel.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(panel.getByRole("article", { name: "Genesis 2 summary", exact: true })).toBeVisible();
});

test("all summary collections are included in the offline app shell", async ({ page, context }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_PREVIEW, "Requires production service worker");
  await openSummary(page, 1280);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const chapterAssets = await page.evaluate(async () => {
    const manifest = await (await fetch("/app-shell-assets.json")).json() as { assets: string[] };
    return manifest.assets.filter(url => /\/\d{2}-[^/]+\.js$/.test(url));
  });
  expect(chapterAssets).toHaveLength(66);
  await expect.poll(() => page.evaluate(async (urls) => {
    const found = await Promise.all(urls.map(url => caches.match(url)));
    return found.every(Boolean);
  }, chapterAssets)).toBe(true);
  // Complete the reader-data cache, as Core Bible Data does. The initial online
  // read can finish before the service worker takes control of the page.
  await page.evaluate(async () => {
    for (const url of ["/data/kjv-manifest.json", "/data/kjv-bootstrap.json", "/data/kjv-compact-v1.json"]) {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Could not download ${url}`);
      await response.arrayBuffer();
    }
  });
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/data/kjv-compact-v1.json")))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  const sidebar = page.getByRole("region", { name: "Study sidebar", exact: true });
  await sidebar.getByRole("button", { name: "Tools", exact: true }).click();
  const summary = sidebar.getByRole("button", { name: "Summary", exact: true });
  if (await summary.getAttribute("aria-expanded") !== "true") await summary.click();
  await sidebar.getByRole("combobox", { name: "Summary book", exact: true }).click();
  await page.getByRole("option", { name: "Revelation", exact: true }).click();
  await sidebar.getByRole("combobox", { name: "Summary chapter", exact: true }).click();
  await page.getByRole("option", { name: "22", exact: true }).click();
  await expect(sidebar.getByRole("article", { name: "Revelation 22 summary", exact: true })).toBeVisible();
  await sidebar.getByRole("tab", { name: "Book", exact: true }).click();
  await expect(sidebar.getByRole("article", { name: "Revelation book summary", exact: true })).toBeVisible();
  await sidebar.getByRole("tab", { name: "Bible", exact: true }).click();
  await expect(sidebar.getByRole("article", { name: "Whole Bible summary", exact: true })).toBeVisible();
});


test("Summary can browse the entire Bible while the verse corpus is still loading", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/data\/kjv(?:-compact-v1)?\.json(?:\?.*)?$/, async route => { await held; await route.abort(); });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const sidebar = await openSummary(page, 1280, true);
    await sidebar.getByRole("tab", { name: "Bible", exact: true }).click();
    await expect(sidebar.getByRole("heading", { name: "New Testament", exact: true })).toBeAttached();
    await sidebar.getByRole("tab", { name: "Chapter", exact: true }).click();
    await sidebar.getByRole("combobox", { name: "Summary book" }).click();
    await expect(page.getByRole("option")).toHaveCount(66);
    await page.getByRole("option", { name: "Revelation", exact: true }).click();
    await sidebar.getByRole("combobox", { name: "Summary chapter" }).click();
    await page.getByRole("option", { name: "22", exact: true }).click();
    await expect(sidebar.getByRole("article", { name: "Revelation 22 summary" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { release(); }
});
