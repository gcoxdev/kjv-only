import { expect, test, type Page } from "@playwright/test"

async function openReader(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Genesis 1", exact: true }).click()
  await expect(page.getByLabel("Next chapter", { exact: true }).first()).toBeEnabled()
}

test("reader tooltips stay open at trigger edges and support keyboard dismissal", async ({ page }) => {
  await openReader(page)

  const checkHover = async (buttonLabel: string, tooltipLabel: string, edge: "top" | "bottom") => {
    await page.mouse.move(600, 400)
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0)
    const button = page.getByLabel(buttonLabel, { exact: true }).first()
    const trigger = button.locator('xpath=ancestor-or-self::*[@data-slot="tooltip-trigger"][1]')
    const bounds = await trigger.boundingBox()
    if (!bounds) throw new Error(`Tooltip trigger is not visible: ${buttonLabel}`)

    // Observe the entire stationary hover, including the opening animation.
    // A single toBeVisible assertion can pass between repeated closes.
    await page.evaluate(() => {
      document.body.dataset.tooltipCloseCount = "0"
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.oldValue !== null && (record.target as Element).matches('[data-slot="tooltip-content"]')) {
            document.body.dataset.tooltipCloseCount = String(Number(document.body.dataset.tooltipCloseCount) + 1)
          }
        }
      })
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-open"],
      })
      document.addEventListener("tooltip-probe-stop", () => observer.disconnect(), { once: true })
    })
    try {
      await page.mouse.move(bounds.x + bounds.width / 2, edge === "top" ? bounds.y + 1 : bounds.y + bounds.height - 1)
      const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: tooltipLabel })
      await expect(tooltip).toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(1000)
      await expect(tooltip).toHaveAttribute("data-open", "")
      await expect(page.locator("body")).toHaveAttribute("data-tooltip-close-count", "0")
    } finally {
      await page.evaluate(() => document.dispatchEvent(new Event("tooltip-probe-stop")))
    }
  }

  await checkHover("Open menu", "Open menu", "bottom")
  await checkHover("Open reference command", "Open references", "bottom")
  await checkHover("Open search", "Search", "bottom")
  await checkHover("Next chapter", "Next chapter", "top")
  await expect(page.getByRole("button", { name: "Previous chapter", exact: true }).first()).toBeDisabled()
  await checkHover("Previous chapter", "Previous chapter", "top")
  await page.getByRole("button", { name: "Next chapter", exact: true }).first().click()
  await expect(page.getByRole("button", { name: "Previous chapter", exact: true }).first()).toBeEnabled()
  await checkHover("Previous chapter", "Previous chapter", "top")
  await page.getByRole("button", { name: "Previous chapter", exact: true }).first().click()
  await expect(page.getByRole("button", { name: "Previous chapter", exact: true }).first()).toBeDisabled()
  await checkHover("Previous chapter", "Previous chapter", "top")
  await checkHover("Show audio", "Show audio", "top")

  await page.getByRole("button", { name: "Show audio", exact: true }).first().click()
  await checkHover("Play audio", "Play audio", "top")
  await checkHover("Audio playback speed", "Audio playback speed", "top")

  await page.mouse.move(600, 400)
  const menu = page.getByRole("button", { name: "Open menu", exact: true })
  await menu.focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Open menu" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0)
  await expect(menu).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menu")).toBeVisible()
})

test("touch opens the menu without leaving a tooltip behind", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    baseURL: test.info().project.use.baseURL,
  })
  try {
    const page = await context.newPage()
    await openReader(page)
    await page.getByRole("button", { name: "Open menu", exact: true }).tap()
    await expect(page.getByRole("menu")).toBeVisible()
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})
