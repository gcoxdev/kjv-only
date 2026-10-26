import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { QuizBackup, QuizBank, QuizQuestion, QuizSession, QuizSnapshot } from '../src/lib/quiz/types';
const day = 86_400_000;
async function saved(page: Page): Promise<QuizSnapshot> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('kjv-only-quiz-v1'); r.onerror = () => reject(r.error);
    r.onsuccess = () => { const db = r.result, tx = db.transaction(['sessions', 'attempts']);
      const sessions = tx.objectStore('sessions').getAll(), attempts = tx.objectStore('attempts').getAll();
      tx.oncomplete = () => { db.close(); resolve({ sessions: sessions.result, attempts: attempts.result }); }; tx.onabort = () => reject(tx.error);
    };
  }));
}
function fixture(bank: QuizBank, now: number): QuizBackup {
  const vocab = bank.questions.filter(q => q.skill === 'Vocabulary' && q.kind === 'choice').slice(0, 5);
  const session = (id: string, time: number, qs: QuizQuestion[], wrong = false, done = true): QuizSession => ({ id, bank: bank.version, label: done ? 'Saved vocabulary progress' : 'Reward verification', mode: 'practice', index: 0, done, created: time, updated: time, owner: null, leaseUntil: 0,
    entries: qs.map(q => ({ id: q.id, version: q.version, answer: !done ? '' : wrong ? q.choices.find(c => c !== q.answer)! : q.answer, initial: '', choices: q.choices, submitted: done, assisted: false, skipped: false, help: 'none' })) });
  const sessions = [session('vocab-first', now - 12 * day, vocab), session('vocab-review', now - 3 * day, [vocab[0]]), session('vocab-wrong1', now - 2 * day, [vocab[0]], true), session('vocab-wrong2', now - day, [vocab[0]], true), session('new-quiz', now, [bank.questions[0]], false, false)];
  return { type: 'kjv-only-quiz', schema: 1, bank: bank.version, exported: new Date(now).toISOString(), sessions, attempts: sessions.filter(s => s.done).flatMap((s, i) => s.entries.map(e => {
    const q = bank.questions.find(q => q.id === e.id)!;
    return { id: `${s.id}:${e.id}`, session: s.id, qid: q.id, objective: q.objective, version: q.version, answer: e.answer, correct: i < 2, assisted: false, skipped: false, time: s.created, points: i === 0 ? { Easy: 10, Medium: 20, Hard: 30 }[q.difficulty] : i === 1 ? 5 : 0, reviewScheduleVersion: 2 };
  })) };
}
for (const width of [390, 1280]) test(`quiz rewards are optional, restore and respect motion at ${width}px`, async ({ page, context }) => {
  const now = new Date(2026, 9, 26, 12).getTime();
  await page.clock.setFixedTime(new Date(now));
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
  await page.goto('/#tab=0&tabs=h&layout=Quiz:quiz');
  const quiz = page.getByRole('region', { name: 'Bible quiz', exact: true }).first();
  await quiz.getByRole('button', { name: 'Progress', exact: true }).click();
  const rewards = quiz.getByLabel('Practice rewards', { exact: true });
  const streakSwitch = rewards.getByRole('switch', { name: 'Show quiz practice streak', exact: true });
  await expect(streakSwitch).not.toBeChecked();
  await expect(rewards.getByRole('switch', { name: 'Quiz completion celebrations', exact: true })).not.toBeChecked();
  await expect(rewards.getByRole('region', { name: 'Quiz practice streak' })).toHaveCount(0);
  const bank: QuizBank = await (await page.request.get('/data/quiz-pilot-v1.json')).json(), backup = fixture(bank, now);
  await quiz.getByLabel('Import quiz backup', { exact: true }).setInputFiles({ name: 'rewards.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(async () => (await saved(page)).attempts.length).toBe(8);
  await streakSwitch.check();
  await rewards.getByRole('switch', { name: 'Quiz completion celebrations', exact: true }).check();
  await expect(rewards.getByRole('region', { name: 'Quiz practice streak' })).toContainText('3 days current · 3 best · 4 practiced');
  await expect(page.locator('.confetti-piece')).toHaveCount(0);
  await rewards.locator('summary').filter({ hasText: /^Skill milestones$/ }).click();
  const vocabulary = rewards.getByRole('region', { name: 'Vocabulary milestones', exact: true });
  await expect(vocabulary).toContainText('5/146 learned · 1/146 mastered');
  await expect(vocabulary).toContainText('5 learned');
  await expect(vocabulary).toContainText('1 mastered');
  expect((await new AxeBuilder({ page }).include('[aria-label="Practice rewards"]').analyze()).violations).toEqual([]);
  expect(await rewards.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await rewards.getByText('Practice rewards', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath(`rewards-${width}.png`) });
  // Preferences synchronize to another view without changing progress.
  const other = await context.newPage();
  await other.goto('/#tab=0&tabs=h&layout=Quiz:quiz');
  const otherQuiz = other.getByRole('region', { name: 'Bible quiz', exact: true }).first();
  await otherQuiz.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(otherQuiz.getByRole('switch', { name: 'Show quiz practice streak', exact: true })).toBeChecked();
  await otherQuiz.getByRole('switch', { name: 'Show quiz practice streak', exact: true }).uncheck();
  await expect(streakSwitch).not.toBeChecked();
  await streakSwitch.check(); await other.close();
  await quiz.getByRole('button', { name: 'Start', exact: true }).click();
  await quiz.getByRole('button', { name: 'Continue', exact: true }).click();
  await quiz.getByRole('button', { name: /^[A-D]\. God$/, exact: true }).click();
  await quiz.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await quiz.getByRole('button', { name: 'Finish quiz', exact: true }).click();
  await expect(quiz).toContainText('Well done! 1 objective recalled without help · 1 newly learned · 0 newly mastered.');
  await expect(page.locator('.confetti-piece')).toHaveCount(width === 390 ? 0 : 64);
  if (width !== 390) { await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(page.locator('.confetti-piece')).toHaveCount(0); }
  const completed = await saved(page);
  await page.reload();
  await quiz.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(rewards.getByRole('region', { name: 'Quiz practice streak' })).toContainText('4 days current · 4 best · 5 practiced');
  await expect(quiz.getByText(/Well done!/)).toHaveCount(0);
  await expect(page.locator('.confetti-piece')).toHaveCount(0);
  expect((await saved(page)).attempts).toEqual(completed.attempts);
  // The same switches are available in Settings → Other.
  await page.getByLabel('Open menu').click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Other', exact: true }).click();
  const otherTab = page.getByRole('tabpanel', { name: 'Other', exact: true });
  await expect(otherTab.getByRole('switch', { name: 'Show quiz practice streak', exact: true })).toBeChecked();
  await otherTab.getByRole('switch', { name: 'Quiz completion celebrations', exact: true }).uncheck();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kjv-quiz-rewards-v1')!).celebrations)).toBe(false);
});
