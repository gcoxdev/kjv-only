import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

for (const mode of ["compact", "legacy manifest", "missing compact", "invalid compact", "no worker"] as const) {
  test(`loads the complete Bible with ${mode}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const requests: string[] = []
    const errors: string[] = []
    context.on("request", request => requests.push(new URL(request.url()).pathname))
    page.on("pageerror", error => errors.push(error.message))
    if (mode === "legacy manifest") {
      await page.route("**/data/kjv-manifest.json", async route => {
        const response = await route.fetch()
        const manifest = await response.json()
        delete manifest.compact
        await route.fulfill({ json: manifest })
      })
    }
    if (mode === "missing compact" || mode === "invalid compact") {
      await page.route("**/data/kjv-compact-v1.json", route => mode === "missing compact"
        ? route.fulfill({ status: 404, body: "Not found" })
        : route.fulfill({ json: { format: "kjv-token-dictionary", schemaVersion: 2, books: [], tokenTable: [] } }))
    }
    if (mode === "no worker") await page.addInitScript(() => {
      Object.defineProperty(window, "Worker", { value: undefined })
    })

    await page.goto("/")
    await page.getByRole("button", { name: "Genesis 1", exact: true }).click()
    await expect(page.getByRole("region", { name: "Genesis 1 panel", exact: true }).getByText("In the beginning God created the heaven and the earth.", { exact: false })).toBeVisible()
    await expect(page.getByLabel("Next chapter").first()).toBeEnabled()
    await page.getByLabel("Open reference command").click()
    await page.getByPlaceholder("Type references like John 3:16; Romans 8:1-2").fill("Revelation 22:21")
    await page.getByRole("option", { name: "Open in New Tab Revelation 22:21", exact: true }).click()
    await expect(page.getByRole("region", { name: "Revelation 22 panel", exact: true }).getByText("The grace of our Lord Jesus Christ be with you all. Amen.", { exact: false })).toBeVisible()
    expect(errors).toEqual([])
    if (mode === "compact" || mode === "no worker") {
      expect(requests).toContain("/data/kjv-compact-v1.json")
      expect(requests).not.toContain("/data/kjv.json")
    } else {
      expect(requests).toContain("/data/kjv.json")
    }
  })
}
