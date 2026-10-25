import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { QuizSnapshot } from "../src/lib/quiz/types";

async function quizPanel(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#tab=0&tabs=h&layout=Quiz:quiz');
  const quiz = page.getByRole('region', { name: 'Bible quiz', exact: true }).first();
  await expect(quiz.getByRole('button', { name: 'Start quiz', exact: true })).toBeVisible();
  return quiz;
}
async function readData(page: Page): Promise<QuizSnapshot> {
  return page.evaluate(() => new Promise<QuizSnapshot>((resolve, reject) => {
    const request = indexedDB.open('kjv-only-quiz-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['sessions', 'attempts']);
      const sessions = tx.objectStore('sessions').getAll(), attempts = tx.objectStore('attempts').getAll();
      tx.oncomplete = () => { db.close(); resolve({ sessions: sessions.result, attempts: attempts.result }); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}
async function solveCurrent(page: Page, quiz: ReturnType<Page['getByRole']>) {
  const data = await readData(page), session = data.sessions.find(s => !s.done)!;
  const entry = session.entries[session.index];
  const bank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const q = bank.questions.find((q: { id: string }) => q.id === entry.id);
  if(q.kind === 'text') await quiz.getByLabel('Your answer', { exact: true }).fill(q.answer[0]);
  else if(q.kind === 'choice') await quiz.getByRole('button', { name: new RegExp(`^[A-D]\\. ${q.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
  else if(q.kind === 'map') await quiz.locator('svg [role=button]').filter({hasText:q.answer}).click();
  else if(q.kind === 'family' || q.kind === 'match') {
    for(let i=0;i<q.answer.length;i++) { await quiz.getByRole('combobox').nth(i).click(); await page.getByRole('option', { name:q.answer[i], exact:true }).click(); }
  } else {
    for(let target=0;target<q.answer.length;target++) {
      const list=quiz.locator('ol li');
      // Find the current card by its exact body text; each move persists immediately.
      let from=(await list.allTextContents()).findIndex(t=>t.includes(q.answer[target]));
      while(from>target){await quiz.getByRole('button',{name:`Move ${q.answer[target]} up`,exact:true}).click();await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeEnabled();from--;}
    }
  }
  await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeEnabled();
  await quiz.getByRole('button',{name:'Submit answer',exact:true}).click();
  await expect(quiz.getByRole('button',{name:/^(Next|Finish quiz)$/})).toBeEnabled();
}

test('panel Home opens Quiz, answers persist across reload, and navigation restores', async ({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#tab=0&tabs=h&layout=Study:picker');
  await page.getByRole('region',{name:'Panel Home panel',exact:true}).getByRole('button',{name:'Quiz',exact:true}).click();
  const quiz=page.getByRole('region',{name:'Bible quiz',exact:true}).first();
  await quiz.getByRole('button',{name:'Start quiz',exact:true}).click();
  await solveCurrent(page,quiz);
  const before=await readData(page);expect(before.attempts).toHaveLength(1);
  await page.reload();await expect(quiz.getByRole('button',{name:'Continue',exact:true})).toBeVisible();await quiz.getByRole('button',{name:'Continue',exact:true}).click();
  // Reload leaves a short-lived ownership lease; explicit takeover is safe if needed.
  if(await page.getByRole('dialog').isVisible())await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(quiz.getByRole('region',{name:'Answer feedback'})).toBeVisible();
  expect((await readData(page)).attempts).toHaveLength(1);
  const scan=await new AxeBuilder({page}).include('[aria-label="Bible quiz"]').analyze();
  expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  expect(errors).toEqual([]);
});

for(const width of [390,1280]) test(`sidebar quiz, interactive controls, evidence and progress at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/#tab=0&tabs=h&layout=Genesis%201:GEN.1');
  if(width<768)await page.getByRole('button',{name:'Toggle Sidebar',exact:true}).click();
  const sidebar=page.getByRole('region',{name:'Study sidebar',exact:true});
  await sidebar.getByRole('button',{name:'Quiz',exact:true}).click();
  const quiz=sidebar.getByRole('region',{name:'Bible quiz',exact:true});
  await expect(quiz.getByRole('button',{name:'Start quiz',exact:true})).toBeVisible();
  await quiz.getByRole('button',{name:'Family tree',exact:true}).click();
  await solveCurrent(page,quiz);await quiz.getByRole('button',{name:'Genesis 5:18–25',exact:true}).hover();
  await expect(page.locator('[data-slot=popover-content]')).toContainText('Jared');await page.keyboard.press('Escape');
  await quiz.getByRole('button',{name:'Finish quiz',exact:true}).click();await expect(quiz.getByText('Session complete',{exact:true})).toBeVisible();
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();await expect(quiz.getByText('Your learning progress',{exact:true})).toBeVisible();
  expect(await quiz.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).include('[aria-label="Bible quiz"]').analyze();expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await sidebar.getByRole('button',{name:'Sidebar Home',exact:true}).click();await sidebar.getByRole('button',{name:'Quiz',exact:true}).click();await quiz.getByRole('button',{name:'Progress',exact:true}).click();expect((await readData(page)).attempts).toHaveLength(1);
  await page.screenshot({path:test.info().outputPath(`quiz-${width}.png`),fullPage:true});
});

test('takeover makes the other view read-only and importing twice is idempotent',async({page,context})=>{
  const quiz=await quizPanel(page);await quiz.getByRole('button',{name:'Map',exact:true}).click();
  const second=await context.newPage();const other=await quizPanel(second);
  await other.getByRole('button',{name:'Continue',exact:true}).click();await second.getByRole('button',{name:'Confirm',exact:true}).click();await expect(quiz.getByText('This session is open in another view. Your answers are protected.')).toBeVisible();
  await expect(quiz.getByRole('button', {name:'Submit answer',exact:true})).toBeDisabled();
  await solveCurrent(second,other);await other.getByRole('button',{name:'Finish quiz',exact:true}).click();
  const result=await readData(second);expect(result.attempts).toHaveLength(1);
  await other.getByRole('button', {name:'Progress',exact:true}).click();
  const downloadPromise=second.waitForEvent('download');
  await other.getByRole('button', {name:'Export progress',exact:true}).click();
  const backupPath=await (await downloadPromise).path();
  expect(backupPath).toBeTruthy();
  await other.getByRole('button', {name:'Reset quiz progress',exact:true}).click();
  await second.getByRole('button', {name:'Confirm',exact:true}).click();
  await expect.poll(async()=> (await readData(second)).attempts.length).toBe(0);
  for(let i=0;i<2;i++) {
    await other.getByLabel('Import quiz backup', {exact:true}).setInputFiles(backupPath!);
    await second.getByRole('button', {name:'Confirm',exact:true}).click();
    await expect.poll(async()=> (await readData(second)).attempts.length).toBe(1);
  }
  const imported=await readData(second);
  expect(imported.attempts[0].points).toBe(result.attempts[0].points);
  await second.close();
});

test('assessment defers credit and quiz questions stay usable without a network',async({page,context})=>{
  const quiz=await quizPanel(page);
  await quiz.getByRole('combobox',{name:'Mode',exact:true}).click();await page.getByRole('option',{name:'Assessment · feedback at end',exact:true}).click();
  await quiz.getByRole('combobox',{name:'Questions',exact:true}).click();await page.getByRole('option',{name:'5',exact:true}).click();
  await quiz.getByRole('button',{name:'Start quiz',exact:true}).click();
  await context.setOffline(true);
  // Skip is also a persisted first submission; assessment credit waits for Finish.
  for(let i=0;i<5;i++){await quiz.getByRole('button',{name:'Skip',exact:true}).click();await expect(quiz.getByRole('button',{name:i===4?'Finish quiz':'Next',exact:true})).toBeEnabled();expect((await readData(page)).attempts).toHaveLength(0);await quiz.getByRole('button',{name:i===4?'Finish quiz':'Next',exact:true}).click();}
  await expect(quiz.getByText('Session complete',{exact:true})).toBeVisible();expect((await readData(page)).attempts).toHaveLength(5);
  await context.setOffline(false);
});

for (const example of ['Ordering', 'Timeline', 'Short answer']) test(`${example} controls grade and persist every selected exercise`, async ({page})=>{
  const quiz=await quizPanel(page,390);
  await quiz.getByRole('button',{name:example,exact:true}).click();
  const count=(await readData(page)).sessions[0].entries.length;
  for(let i=0;i<count;i++) {
    await solveCurrent(page,quiz);
    await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
    await quiz.getByRole('button',{name:i===count-1?'Finish quiz':'Next',exact:true}).click();
  }
  await expect(quiz.getByText('Session complete',{exact:true})).toBeVisible();
  expect((await readData(page)).attempts.every(a=>a.correct)).toBe(true);
});

test('damaged progress is preserved for export and can be reset explicitly',async({page})=>{
  const quiz=await quizPanel(page);
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('kjv-only-quiz-v1',1);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('sessions','readwrite');
      tx.objectStore('sessions').put({id:'damaged-session',bank:'unknown'});
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
    };
  }));
  await page.reload();
  await expect(quiz.getByRole('alert')).toContainText('incompatible or damaged');
  expect((await readData(page)).sessions).toHaveLength(1);
  const exported=page.waitForEvent('download');
  await quiz.getByRole('button',{name:'Export backup',exact:true}).click();
  expect((await exported).suggestedFilename()).toBe('kjv-quiz-progress.json');
  await quiz.getByRole('button',{name:'Reset quiz progress',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(quiz.getByRole('button',{name:'Start quiz',exact:true})).toBeVisible();
  expect((await readData(page)).sessions).toHaveLength(0);
});

test('reference display setting offers Popover and Dialog and preserves the selection', async ({page})=>{
  await quizPanel(page);
  await page.getByLabel('Open menu').click();
  await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Other',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reference popover',exact:true})).toContainText('Popover');
  await page.getByRole('button',{name:'Reference dialog',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kjv-display-settings-v1')??'{}').toolReferenceDisplayMode)).toBe('dialog');
  await page.reload();
  await page.getByRole('tab',{name:'Other',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reference dialog',exact:true})).toHaveAttribute('aria-pressed','true');
});

for(const mobile of [false,true]) test(`quiz uses shared reference dialog with context and Open (${mobile?'touch':'desktop'})`,async({browser})=>{
  const context=await browser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:mobile?390:1280,height:900},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.setItem('kjv-display-settings-v1',JSON.stringify({toolReferenceDisplayMode:'dialog'})));
  await page.goto(`${test.info().project.use.baseURL ?? 'http://127.0.0.1:4176'}/#tab=0&tabs=h&layout=Quiz:quiz`);
  const quiz=page.getByRole('region',{name:'Bible quiz',exact:true}).first();
  await quiz.getByRole('button',{name:'Family tree',exact:true}).click();
  await quiz.getByRole('button',{name:'Read passage / hint',exact:true}).click();
  const reference=quiz.getByRole('button',{name:'Genesis 5:18–25',exact:true});
  if(mobile) await reference.tap(); else await reference.click();
  const dialog=page.getByRole('dialog',{name:'Genesis 5:18–25',exact:true});
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('Jared');
  await expect(dialog.locator('[data-context-line="surrounding"]')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Context',exact:true}).click();
  await expect(dialog.locator('[data-context-line="surrounding"]')).toHaveCount(2);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await reference.click();await expect(dialog).toBeVisible();
  const scan=await new AxeBuilder({page}).include('[data-slot="dialog-content"]').analyze();
  expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await dialog.getByRole('button',{name:'Open',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(()=>page.url()).toMatch(/GEN\.5/);
  await context.close();
});

test('quiz references use table mode with expandable context',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kjv-display-settings-v1',JSON.stringify({toolReferenceDisplayMode:'table'})));
  const quiz=await quizPanel(page);
  await quiz.getByRole('button',{name:'Family tree',exact:true}).click();
  await quiz.getByRole('button',{name:'Read passage / hint',exact:true}).click();
  const table=quiz.locator('[data-tool-reference-display="table"]');
  await expect(table).toContainText('Jared');
  await table.getByRole('button',{name:'Context',exact:true}).click();
  await expect(table.locator('[data-context-line="surrounding"]')).toHaveCount(2);
  await expect(table.getByRole('button',{name:'Open',exact:true})).toBeVisible();
});
