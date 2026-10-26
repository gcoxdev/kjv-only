import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { QuizBank, QuizSnapshot } from '../src/lib/quiz/types';

async function openQuiz(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#tab=0&tabs=h&layout=Quiz:quiz');
  const quiz = page.getByRole('region', { name: 'Bible quiz', exact: true }).first();
  await expect(quiz.getByRole('button', { name: 'Practice verse memory', exact: true })).toBeVisible();
  return quiz;
}
async function data(page: Page): Promise<QuizSnapshot> {
  return page.evaluate(() => new Promise<QuizSnapshot>((resolve, reject) => {
    const request = indexedDB.open('kjv-only-quiz-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['sessions', 'attempts']);
      const sessions = tx.objectStore('sessions').getAll(), attempts = tx.objectStore('attempts').getAll();
      tx.oncomplete = () => { db.close(); resolve({ sessions: sessions.result, attempts: attempts.result }); };
      tx.onabort = () => reject(tx.error);
    };
  }));
}
for (const width of [390, 1280]) {
  test(`optional verse memory saves exact wording and assisted credit at ${width}px`, async ({ page }) => {
    let quiz = await openQuiz(page, width);
    const bank: QuizBank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
    await quiz.getByRole('button', { name: 'Practice verse memory', exact: true }).click();
    const input = quiz.getByRole('textbox', { name: 'Verse from memory', exact: true });
    await expect(input).toBeVisible();
    const session = (await data(page)).sessions[0];
    expect(session.entries.every(e => bank.questions.find(q => q.id === e.id)?.kind === 'memory')).toBe(true);
    const q = bank.questions.find(q => q.id === session.entries[0].id)!;
    const text = q.answer[0].toUpperCase().replace(/[.,;:!?]/g, '') + '  ';
    await input.fill(text);
    await expect(quiz.getByRole('button', { name: 'Save & leave' })).toBeEnabled();
    await quiz.getByRole('button', { name: 'Save & leave' }).click();
    await page.reload();
    quiz = page.getByRole('region', { name: 'Bible quiz', exact: true }).first();
    await quiz.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(quiz.getByRole('textbox', { name: 'Verse from memory' })).toHaveValue(text);
    await expect(quiz.getByRole('button', { name: 'Submit answer' })).toBeEnabled();
    await quiz.getByRole('button', { name: 'Submit answer' }).click();
    await expect.poll(async () => (await data(page)).attempts.length).toBe(1);
    expect((await data(page)).attempts[0]).toMatchObject({ correct: true, assisted: false, points: q.difficulty === 'Medium' ? 20 : 30 });
    await quiz.getByRole('button', { name: 'Next', exact: true }).click();
    await quiz.getByRole('button', { name: 'Reveal answer', exact: true }).click();
    const second = bank.questions.find(q => q.id === session.entries[1].id)!;
    await quiz.getByRole('textbox', { name: 'Verse from memory' }).fill(second.answer[0]);
    await expect(quiz.getByRole('button', { name: 'Submit answer' })).toBeEnabled();
    await quiz.getByRole('button', { name: 'Submit answer' }).click();
    await expect.poll(async () => (await data(page)).attempts.length).toBe(2);
    expect((await data(page)).attempts.find(a => a.qid === second.id)).toMatchObject({ correct: true, assisted: true, points: 0 });
    expect((await new AxeBuilder({ page }).include('[aria-label="Bible quiz"]').analyze()).violations).toEqual([]);
  });

  test(`complete book ordering supports direct placement and saved progress at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    const quiz = await openQuiz(page, width);
    const bank: QuizBank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
    await quiz.getByRole('button', { name: 'Whole Bible · 66 books', exact: true }).click();
    await expect(quiz.getByRole('combobox', { name: 'Book to move' })).toBeVisible();
    expect((await data(page)).sessions[0].entries).toHaveLength(1);
    await expect(quiz.locator('ol li')).toHaveCount(66);
    await quiz.getByRole('spinbutton', { name: 'Move to position' }).fill('67');
    await expect(quiz.getByRole('button', { name: 'Move book', exact: true })).toBeDisabled();
    for (let i = 0; i < bank.books.length; i++) {
      await quiz.getByRole('combobox', { name: 'Book to move' }).click();
      await page.getByRole('option', { name: bank.books[i], exact: true }).click();
      await quiz.getByRole('spinbutton', { name: 'Move to position' }).fill(String(i + 1));
      const move = quiz.getByRole('button', { name: 'Move book', exact: true });
      if (await move.isEnabled()) {
        await move.click();
        await expect(quiz.getByRole('button', { name: 'Submit answer' })).toBeEnabled();
      }
    }
    await expect.poll(async () => (await data(page)).sessions[0].entries[0].answer).toEqual(bank.books);
    await quiz.getByRole('button', { name: 'Save & leave' }).click();
    await quiz.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(quiz.locator('ol li').first()).toContainText('Genesis');
    await expect(quiz.locator('ol li').last()).toContainText('Revelation');
    await quiz.getByRole('button', { name: 'Submit answer' }).click();
    await expect(quiz.getByRole('button', { name: 'Finish quiz', exact: true })).toBeEnabled();
    await quiz.getByRole('button', { name: 'Finish quiz', exact: true }).click();
    await expect(quiz).toContainText('1 / 1 correct');
    expect((await data(page)).attempts[0]).toMatchObject({ qid: 'book-order-bible', correct: true, points: 30 });
    await quiz.getByRole('button', { name: 'Start another quiz' }).click();
    await quiz.getByRole('button', { name: 'Progress', exact: true }).click();
    const mastery = quiz.getByLabel('Mastery explorer', { exact: true });
    await mastery.getByRole('combobox', { name: 'Mastery exercise set' }).click();
    await page.getByRole('option', { name: 'Optional book ordering', exact: true }).click();
    await expect(mastery).toContainText('0/3 mastered');
    await expect(mastery).toContainText('1/3 learned');
    await mastery.getByRole('combobox', { name: 'Mastery exercise set' }).click();
    await page.getByRole('option', { name: 'Core quizzes', exact: true }).click();
    await expect(mastery).toContainText('0/8965 learned');
  });
}
