import { expect, test } from "@playwright/test";

const limitMessage = "Search limit reached: 500 verses loaded. More matches may exist. Narrow the book scope or make your search more specific.";

for (const { mode, width } of [
  { mode: "Smart", width: 375 },
  { mode: "Regular expression", width: 1280 },
  { mode: "Contains any", width: 1280 },
  { mode: "Contains all", width: 375 },
]) {
  test(`explains the result cap and allows refinement in ${mode} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open search", exact: true }).click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    if (mode.startsWith("Contains")) {
      const words = page.getByLabel("Words", { exact: true });
      await words.fill("the");
      await page.getByRole("button", { name: "the", exact: true }).click();
    } else {
      await page.getByLabel(mode === "Smart" ? "Word or phrase" : "Regular expression", { exact: true }).fill("the");
    }
    await page.getByLabel("Run Bible search").click();
    const notice = page.getByText(limitMessage, { exact: true });
    await expect(notice).toBeVisible();
    await expect(page.getByText("500 matching verses loaded", { exact: true })).toBeVisible();
    await expect(page.getByText("Page 1 of 10", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refine search", exact: true })).toBeVisible();
    expect(await notice.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Page 2 of 10", { exact: true })).toBeVisible();
    await expect(notice).toBeVisible();
    await page.getByRole("button", { name: "Refine search", exact: true }).click();
    await expect(page.getByRole("button", { name: "Scope • 66/66 books", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Smart", exact: true }).click();
    await page.getByLabel("Word or phrase").fill("sheperd");
    await page.getByLabel("Run Bible search").click();
    await expect(page.getByText("Psalm 23:1", { exact: true })).toBeVisible();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Refine search", exact: true })).toHaveCount(0);
  });
}
