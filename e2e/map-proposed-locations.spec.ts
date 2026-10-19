import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

async function openEmmaus(page: Page) {
  await page.route("https://tiles.openfreemap.org/styles/bright", route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f5f2ec" } }],
  } }));
  await page.route(/https:\/\/.*tile\.(openstreetmap|opentopomap)\.org\//, route => route.fulfill({ contentType: "image/png", body: tile }));
  await page.goto("/#tab=0&tabs=h&layout=Luke%2024:LUK.24");
  await page.getByLabel("Luke 24 panel", { exact: true }).locator('[data-verse-number="13"]').last()
    .getByRole("button", { name: "Details for Emmaus", exact: true }).click();
  await page.getByRole("button", { name: "Open Map", exact: true }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.locator("[data-map-zoom]")).toBeVisible();
  return dialog;
}

for (const renderer of ["OpenFreeMap", "Leaflet"]) {
  test(`focuses alternatives and restores the overview in ${renderer}`, async ({ page }) => {
    const dialog = await openEmmaus(page);
    await dialog.getByRole("button", { name: renderer, exact: true }).click();
    const camera = dialog.locator("[data-map-zoom]");
    const locations = dialog.getByRole("button", { name: "Proposed locations (6)", exact: true });
    const popup = page.getByRole("dialog", { name: "Multiple proposed locations", exact: true });
    const confidence = dialog.getByRole("status", { name: "Location confidence" });
    await expect(confidence).toHaveText("6 proposed sites · Select one for confidence");
    await expect.poll(async () => Number(await camera.getAttribute("data-map-zoom"))).toBeLessThan(15);
    await dialog.getByRole("button", { name: "Hide areas", exact: true }).click();
    await locations.click();
    await expect(popup.getByRole("link")).toHaveCount(0);
    await expect(popup.getByRole("button", { name: /^Qalunya Confidence:/ })).toHaveAccessibleName("Qalunya Confidence: ≈34%");
    await expect(popup.getByRole("button", { name: "Artas", exact: true })).toHaveAccessibleDescription("Confidence: <10%");
    await popup.getByRole("button", { name: /^Emmaus Nicopolis Confidence:/ }).click();
    await expect(popup).not.toBeVisible();
    await expect(locations).toBeFocused();
    await expect(camera).toHaveAttribute("data-map-zoom", "15");
    await expect(confidence).toHaveText("Emmaus Nicopolis · Confidence: ≈24%");
    const focused = JSON.parse((await camera.getAttribute("data-map-center"))!) as number[];
    expect(focused[0]).toBeCloseTo(34.989458, 4);
    expect(focused[1]).toBeCloseTo(31.8393, 4);
    await expect(dialog.getByRole("button", { name: "Hide areas", exact: true })).toHaveAttribute("aria-pressed", "true");

    const other = renderer === "Leaflet" ? "OpenFreeMap" : "Leaflet";
    await dialog.getByRole("button", { name: other, exact: true }).click();
    await expect(camera).toHaveAttribute("data-map-zoom", "15");
    await dialog.getByRole("combobox", { name: "Map style", exact: true }).click();
    await page.getByRole("option", { name: "Topographic", exact: true }).click();
    await expect(camera).toHaveAttribute("data-map-zoom", "15");
    const switched = JSON.parse((await camera.getAttribute("data-map-center"))!) as number[];
    expect(switched[0]).toBeCloseTo(focused[0], 4);
    expect(switched[1]).toBeCloseTo(focused[1], 4);
    await expect(confidence).toHaveText("Emmaus Nicopolis · Confidence: ≈24%");
    await locations.click();
    await expect(popup.getByRole("button", { name: /^Emmaus Nicopolis Confidence:/ })).toHaveAttribute("aria-current", "location");
    await popup.getByRole("button", { name: "Show all locations", exact: true }).click();
    await expect(confidence).toHaveText("6 proposed sites · Select one for confidence");
    await expect.poll(async () => Number(await camera.getAttribute("data-map-zoom"))).toBeLessThan(15);

    await locations.click();
    await popup.getByRole("button", { name: /^Qalunya Confidence:/ }).click();
    await expect(confidence).toHaveText("Qalunya · Confidence: ≈34%");
    await expect(camera).toHaveAttribute("data-map-zoom", "15");
    const qalunya = JSON.parse((await camera.getAttribute("data-map-center"))!) as number[];
    expect(qalunya[0]).toBeCloseTo(35.16419, 4);
    await dialog.getByRole("button", { name: "Recenter", exact: true }).click();
    await expect(confidence).toHaveText("6 proposed sites · Select one for confidence");
    await expect.poll(async () => Number(await camera.getAttribute("data-map-zoom"))).toBeLessThan(15);
    await locations.click();
    await expect(popup.locator('[aria-current="location"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(popup).not.toBeVisible();
    await expect(dialog).toBeVisible();
  });
}

for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
  test(`locations stay compact and accessible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const dialog = await openEmmaus(page);
    const map = dialog.locator('[data-map-renderer="open-free-map"]');
    const before = (await map.boundingBox())!;
    expect(before.height).toBeGreaterThan(viewport.height < 500 ? 100 : 300);
    await dialog.getByRole("button", { name: "Proposed locations (6)", exact: true }).click();
    const popup = page.getByRole("dialog", { name: "Multiple proposed locations", exact: true });
    await expect(popup).toBeVisible();
    const box = (await popup.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect((await map.boundingBox())!.height).toBeCloseTo(before.height, 0);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).include('[data-slot="popover-content"]').analyze();
    expect(results.violations.filter(item => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    await expect(popup.getByRole("link")).toHaveCount(0);
    await page.screenshot({ path: `design/map-proposed-locations-popup-${viewport.width}.png` });
    await popup.getByRole("button", { name: /^Abu Ghosh Confidence:/ }).click();
    await expect(dialog.locator("[data-map-zoom]")).toHaveAttribute("data-map-zoom", "15");
    await expect(dialog.getByRole("status", { name: "Location confidence" })).toHaveText("Abu Ghosh · Confidence: <10%");
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `design/map-proposed-locations-${viewport.width}.png` });
  });
}

test("older offline map metadata remains usable without the optional locations control", async ({ page }) => {
  await page.route("**/maps/data/map.json", async route => {
    const response = await route.fetch();
    const entries = await response.json();
    for (const entry of entries) {
      delete entry.identifications;
    }
    await route.fulfill({ json: entries });
  });
  const dialog = await openEmmaus(page);
  await expect(dialog.getByRole("button", { name: /^Proposed locations/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Recenter", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("status", { name: "Location confidence" })).toHaveText("Confidence unavailable");
});
