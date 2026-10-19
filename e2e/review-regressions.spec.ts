import { expect, test, type Page } from "@playwright/test";

async function openNotes(page: Page) {
  await page.goto('/#tab=0&tabs=h&layout=Notes:notes');
  await expect(page.getByRole('button', { name: 'New General', exact: true }).filter({ visible: true }).first()).toBeVisible();
}
async function saveNote(page: Page, title: string) {
  await page.getByRole('button', { name: 'New General', exact: true }).filter({ visible: true }).first().click();
  await page.getByPlaceholder('Note title').fill(title);
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
}
test('notes created in two open windows survive edits and reloads', async ({ page, context }) => {
  const other = await context.newPage();
  await openNotes(page); await openNotes(other);
  await saveNote(page, 'Window A note');
  await saveNote(other, 'Window B note');
  const titles = () => page.evaluate(() => JSON.parse(localStorage.getItem('kjv-reader-notes-v1') ?? '[]').map((x: { title: string }) => x.title).sort());
  await expect.poll(titles).toEqual(['Window A note', 'Window B note']);
  await page.reload();
  await expect.poll(titles).toEqual(['Window A note', 'Window B note']);
  await other.close();
});

test('bookmark edits in two windows preserve both records and recover invalid input', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('kjv-reader-bookmarks-v1', JSON.stringify([
    { id: 'a', type: 'chapter', scope: { type: 'chapter', bookIndex: 0, chapterIndex: 0 }, label: 'Bookmark A', note: '', createdAt: 1, updatedAt: 1 },
    { id: 'b', type: 'chapter', scope: { type: 'chapter', bookIndex: 0, chapterIndex: 1 }, label: 'Bookmark B', note: '', createdAt: 1, updatedAt: 1 },
    { invalid: 'preserve me' },
  ])));
  await page.goto('/#tab=0&tabs=h&layout=Bookmarks:bookmarks');
  await page.reload();
  const other = await context.newPage();
  await other.goto('/#tab=0&tabs=h&layout=Bookmarks:bookmarks');
  for (const [target, label] of [[page, 'A'], [other, 'B']] as const) {
    await target.getByRole('button', { name: `Edit Bookmark ${label}`, exact: true }).click();
    await target.getByLabel('Bookmark label', { exact: true }).fill(`Updated ${label}`);
    await target.getByRole('button', { name: 'Save', exact: true }).click();
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kjv-reader-bookmarks-v1') ?? '[]').map((x: { label: string }) => x.label).sort())).toEqual(['Updated A', 'Updated B']);
  expect(await page.evaluate(() => localStorage.getItem('kjv-reader-bookmarks-v1.recovered'))).toContain('preserve me');
  await other.close();
});

test('theme is applied before the application loads and honors explicit light mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/assets/index-*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});


test('read progress from two windows merges and unmarking stays synchronized', async ({ page, context }) => {
  const other = await context.newPage();
  await page.goto('/#tab=0&tabs=h&layout=Genesis:GEN.1');
  await other.goto('/#tab=0&tabs=h&layout=Genesis:GEN.2');
  await page.getByRole('button', { name: 'Mark chapter read', exact: true }).click();
  await other.getByRole('button', { name: 'Mark chapter read', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kjv-read-chapters-v1') ?? '[]').sort())).toEqual(['0:0', '0:1']);
  await page.getByRole('button', { name: 'Mark chapter unread', exact: true }).click();
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem('kjv-read-chapters-v1') ?? '[]'))).toEqual(['0:1']);
  await other.close();
});


test('display settings and theme synchronize without overwriting other window preferences', async ({ page, context }) => {
  const other = await context.newPage();
  for (const target of [page, other]) {
    await target.goto('/');
    await target.getByLabel('Open menu').click();
    await target.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Increase font size', exact: true }).click();
  await expect(other.getByText('20px', { exact: true })).toBeVisible();
  await other.getByRole('switch', { name: 'Dark Mode', exact: true }).check();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await other.getByRole('tab', { name: 'Other', exact: true }).click();
  const slider = other.getByRole('slider', { name: 'Context verses before and after' });
  await slider.press('Home'); await slider.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kjv-display-settings-v1') ?? '{}'))).toMatchObject({ fontSize: 20, contextVerseCount: 2 });
  await other.close();
});

test.describe('panel failures', () => {
  test.use({ serviceWorkers: 'block' });
  test('a failed panel chunk leaves the reader and other panels usable', async ({ page }) => {
  await page.route(/\/assets\/notes-page-[^/]+\.js$/, route => route.abort());
  await page.goto('/#tab=0&tabs=h&layout=Study:h50(GEN.1;notes)');
  await expect(page.getByText('This panel hit a problem', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Genesis 1 panel', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByText('The application could not finish loading. Reload to try again.', { exact: true })).toHaveCount(0);
});

});
