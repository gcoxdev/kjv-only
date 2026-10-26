import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { QuizBank, QuizQuestion, QuizSnapshot } from "../src/lib/quiz/types";

async function quizPanel(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#tab=0&tabs=h&layout=Quiz:quiz');
  const quiz = page.getByRole('region', { name: 'Bible quiz', exact: true }).first();
  await expect(quiz.getByRole('button', { name: 'Start quiz', exact: true })).toBeVisible();
  return quiz;
}
async function readData(page: Page): Promise<QuizSnapshot> {
  return page.evaluate(() => new Promise<QuizSnapshot>((resolve, reject) => {
    const request = indexedDB.open('kjv-only-quiz-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['sessions', 'attempts']);
      const sessions = tx.objectStore('sessions').getAll(), attempts = tx.objectStore('attempts').getAll();
      tx.oncomplete = () => { db.close(); resolve({ sessions: sessions.result, attempts: attempts.result }); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}
async function importPracticeSession(page: Page, quiz: ReturnType<Page['getByRole']>, bank: QuizBank, questions: QuizQuestion[], id: string) {
  const time=Date.now();
  const fixture:QuizSnapshot={sessions:[{id,bank:bank.version,label:'Reviewed exercise verification',mode:'practice',index:0,done:false,created:time,updated:time,owner:null,leaseUntil:0,
    entries:questions.map(q=>{
      const initial=['family','match'].includes(q.kind)?q.slots!.map(()=>''):['order','timeline'].includes(q.kind)?[...(q.answer as string[])].reverse():'';
      return {id:q.id,version:q.version,answer:structuredClone(initial),initial,choices:q.choices,submitted:false,assisted:false,skipped:false,help:'none'};
    })}],attempts:[]};
  const backup={type:'kjv-only-quiz',schema:1,bank:bank.version,exported:new Date(time).toISOString(),...fixture};
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles({name:`${id}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async()=> (await readData(page)).sessions.some(s=>s.id===id)).toBe(true);
  await quiz.getByRole('button',{name:'Start',exact:true}).click();
  await quiz.getByRole('button',{name:'Continue',exact:true}).click();
}
async function openJaredFamilyExercise(page: Page, quiz: ReturnType<Page['getByRole']>) {
  const bank:QuizBank=await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  // Reference display tests use this passage, regardless of which other family
  // exercises the normal session selector would choose or exclude for overlap.
  await importPracticeSession(page,quiz,bank,[bank.questions.find(q=>q.id==='genealogy-tree')!],'jared-reference');
}
async function solveCurrent(page: Page, quiz: ReturnType<Page['getByRole']>) {
  const data = await readData(page), session = data.sessions.find(s => !s.done)!;
  const entry = session.entries[session.index];
  const bank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const q = bank.questions.find((q: { id: string }) => q.id === entry.id);
  if(q.kind === 'text' || q.kind === 'memory') await quiz.getByLabel('Your answer', { exact: true }).fill(q.answer[0]);
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
  return q;
}

for (const width of [390, 1280]) test(`review schedule updates across time and survives resume at ${width}px`, async ({page}) => {
  const time = Date.now(), day = 86_400_000;
  await page.clock.setFixedTime(new Date(time));
  const quiz = await quizPanel(page, width);
  const bank: QuizBank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const reviewed = bank.questions.find(q => q.id === 'psalm-recall')!;
  const missed = bank.questions.find(q => q.id === '08-1-4')!;
  const fixture: QuizSnapshot = {sessions: [], attempts: []};
  for (const [i, q] of [reviewed, missed].entries()) {
    const id = `scheduled-${i}`, timestamp = i === 0 ? time - day + 120_000 : time - 1000;
    const answer = i === 0 ? q.answer[0] : q.choices.find(c => c !== q.answer)!;
    fixture.sessions.push({id, bank:bank.version, label:'Review schedule fixture', mode:'practice', index:0, done:true, created:timestamp, updated:timestamp, owner:null, leaseUntil:0,
      entries:[{id:q.id,version:q.version,answer,initial:'',choices:q.choices,submitted:true,assisted:false,skipped:false,help:'none'}]});
    fixture.attempts.push({id:`${id}:${q.id}`,session:id,qid:q.id,objective:q.objective,version:q.version,answer,correct:i===0,assisted:false,skipped:false,time:timestamp,points:i===0?({Easy:10,Medium:20,Hard:30}[q.difficulty]):0});
  }
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles({name:'schedule.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'kjv-only-quiz',schema:1,bank:bank.version,...fixture}))});
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  const card = quiz.locator('[data-slot=card]').filter({has:page.getByText('Review schedule',{exact:true})});
  const count = (label:string) => card.getByText(label,{exact:true}).locator('..');
  await expect(count('Due now')).toHaveText('1Due now');
  await expect(count('Due in next 7 days')).toHaveText('1Due in next 7 days');
  await card.locator('summary').click();
  await expect(card).toContainText('Next review:');
  await expect(card).toContainText('Review a missed answer');
  // Returning from another app/window refreshes eligibility without a reload.
  await page.clock.setFixedTime(new Date(time + 180_000));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(count('Due now')).toHaveText('2Due now');
  await expect(count('Due in next 7 days')).toHaveText('0Due in next 7 days');
  await card.getByRole('button',{name:'Practice due items',exact:true}).click();
  const session = (await readData(page)).sessions.find(s => !s.done)!;
  expect(session.entries).toHaveLength(2);
  for (let i=0;i<2;i++) {
    await solveCurrent(page,quiz);
    await quiz.getByRole('button',{name:i===1?'Finish quiz':'Next',exact:true}).click();
  }
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(card).toContainText('You’re caught up on scheduled reviews.');
  await expect(card.getByRole('button',{name:'Practice due items',exact:true})).toBeDisabled();
  const saved = await readData(page);
  expect(saved.attempts.filter(a => a.reviewScheduleVersion === 2)).toHaveLength(2);
  await page.reload();
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(card).toContainText('You’re caught up on scheduled reviews.');
  expect((await readData(page)).attempts).toEqual(saved.attempts);
  expect(await quiz.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const scan = await new AxeBuilder({page}).include('[aria-label="Bible quiz"]').analyze();
  expect(scan.violations.filter(v => ['serious','critical'].includes(v.impact??''))).toEqual([]);
  await card.screenshot({path:test.info().outputPath(`review-schedule-${width}.png`)});
});

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
  const count=(await readData(page)).sessions.find(s=>!s.done)!.entries.length;
  for(let i=0;i<count;i++) {
    const question=await solveCurrent(page,quiz);
    if(i===0) {
      const reference=question.refs[0];
      await quiz.getByRole('button',{name:reference.label,exact:true}).hover();
      await expect(page.locator('[data-slot=popover-content]')).toContainText(reference.verses[0].text);await page.keyboard.press('Escape');
    }
    await quiz.getByRole('button',{name:i===count-1?'Finish quiz':'Next',exact:true}).click();
  }
  await expect(quiz.getByText('Session complete',{exact:true})).toBeVisible();
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();await expect(quiz.getByText('Your learning progress',{exact:true})).toBeVisible();
  expect(await quiz.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).include('[aria-label="Bible quiz"]').analyze();expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await sidebar.getByRole('button',{name:'Sidebar Home',exact:true}).click();await sidebar.getByRole('button',{name:'Quiz',exact:true}).click();await quiz.getByRole('button',{name:'Progress',exact:true}).click();expect((await readData(page)).attempts).toHaveLength(count);
  await page.screenshot({path:test.info().outputPath(`quiz-${width}.png`),fullPage:true});
});

test('takeover makes the other view read-only and importing twice is idempotent',async({page,context})=>{
  const quiz=await quizPanel(page);await quiz.getByRole('button',{name:'Map',exact:true}).click();
  const second=await context.newPage();const other=await quizPanel(second);
  await other.getByRole('button',{name:'Continue',exact:true}).click();await second.getByRole('button',{name:'Confirm',exact:true}).click();await expect(quiz.getByText('This session is open in another view. Your answers are protected.')).toBeVisible();
  await expect(quiz.getByRole('button', {name:'Submit answer',exact:true})).toBeDisabled();
  const count=(await readData(second)).sessions.find(s=>!s.done)!.entries.length;
  for(let i=0;i<count;i++) {
    await solveCurrent(second,other);
    await other.getByRole('button',{name:i===count-1?'Finish quiz':'Next',exact:true}).click();
  }
  const result=await readData(second);expect(result.attempts).toHaveLength(count);
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
    await expect.poll(async()=> (await readData(second)).attempts.length).toBe(count);
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

test('large-bank browsing pages results, searches all questions, and opens chapter progress on demand', async ({page}) => {
  const quiz = await quizPanel(page, 390);
  await quiz.getByRole('button', {name:'Questions', exact:true}).click();
  const results = quiz.getByRole('list', {name:'Question results'});
  const pages = quiz.getByRole('navigation', {name:'Question pages'});
  await expect(results.getByRole('listitem')).toHaveCount(25);
  await expect(pages).toContainText('Questions 1–25 of 8986');
  await expect(pages.getByRole('button', {name:'Previous', exact:true})).toBeDisabled();
  await pages.getByRole('button', {name:'Next', exact:true}).click();
  await expect(pages).toContainText('Questions 26–50 of 8986');
  await expect(results.getByRole('listitem')).toHaveCount(25);

  // An objective near the end of the bank must be searchable from any page.
  const search = quiz.getByRole('textbox', {name:'Search questions'});
  await search.fill('66-21-10');
  await expect(results.getByRole('listitem')).toHaveCount(1);
  await expect(pages).toContainText('Questions 1–1 of 1');
  await results.locator('summary').click();
  await expect(results).toContainText("The overcomer inherits all things as God's son");
  await expect(results.getByRole('button', {name:'Revelation 21:7–8', exact:true})).toBeVisible();
  await search.fill('no-such-question-xyz');
  await expect(results.getByRole('listitem')).toHaveCount(0);
  await expect(pages).toContainText('No questions match your search.');
  await expect(pages.getByRole('button', {name:'Next', exact:true})).toBeDisabled();
  await search.fill('');
  await expect(pages).toContainText('Questions 1–25 of 8986');

  await quiz.getByRole('button', {name:'Progress', exact:true}).click();
  const explorer = quiz.locator('[aria-label="Mastery explorer"]');
  await expect(explorer.locator('ul li')).toHaveCount(0);
  await explorer.locator('[data-mastery-scope="NT"] > summary').click();
  await explorer.locator('[data-mastery-scope="book:65"] > summary').click();
  const chapter = explorer.locator('[data-mastery-scope="chapter:65:21"]');
  await chapter.locator(':scope > summary').click();
  await chapter.locator('summary').filter({hasText:/^Objectives/}).click();
  await expect(chapter.locator('li')).toHaveCount(10);
  await expect(chapter).toContainText('What does the great voice from heaven announce');
  await chapter.locator(':scope > summary').click();
  await expect(explorer.locator('ul li')).toHaveCount(0);
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
    const request=indexedDB.open('kjv-only-quiz-v1');
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
  await openJaredFamilyExercise(page,quiz);
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
  await openJaredFamilyExercise(page,quiz);
  await quiz.getByRole('button',{name:'Read passage / hint',exact:true}).click();
  const table=quiz.locator('[data-tool-reference-display="table"]');
  await expect(table).toContainText('Jared');
  await table.getByRole('button',{name:'Context',exact:true}).click();
  await expect(table.locator('[data-context-line="surrounding"]')).toHaveCount(2);
  await expect(table.getByRole('button',{name:'Open',exact:true})).toBeVisible();
});

for (const sample of [
  { book: 'Numbers', chapter: '13', count: 8, prefix: '04-13-' },
  { book: 'Obadiah', chapter: '1', count: 6, prefix: '31-1-' },
  { book: 'Malachi', chapter: '4', count: 4, prefix: '39-4-' },
  { book: 'Zechariah', chapter: '14', count: 8, prefix: '38-14-' },
]) test(`${sample.book} expanded chapter coverage is selectable and uses shared KJV evidence`,async({page})=>{
  const quiz=await quizPanel(page);
  await expect(quiz).toContainText('8980 objectives');
  await quiz.getByRole('combobox',{name:'Book',exact:true}).click();
  await page.getByRole('option',{name:sample.book,exact:true}).click();
  await quiz.getByRole('combobox',{name:'Chapter',exact:true}).click();
  await page.getByRole('option',{name:sample.chapter,exact:true}).click();
  await expect(quiz).toContainText(`Up to ${sample.count} questions`);
  await quiz.getByRole('button',{name:'Start quiz',exact:true}).click();
  await expect(quiz).toContainText(`${sample.book} ${sample.chapter} · Question 1 of ${sample.count}`);
  const saved=(await readData(page)).sessions[0];
  expect(saved.entries).toHaveLength(sample.count);
  expect(saved.entries.every(e=>e.id.startsWith(sample.prefix))).toBe(true);
  await solveCurrent(page,quiz);
  await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
  await quiz.getByRole('region',{name:'Answer feedback'}).getByRole('button',{name:new RegExp(`${sample.book} ${sample.chapter}:`)}).first().hover();
  const preview=page.locator('[data-slot=popover-content]');
  await expect(preview.locator('[data-context-primary=true]').first()).toBeVisible();
});

for (const sample of [
  { book: 'Ruth', chapter: '4', count: 1, exercise: '08-4-8' },
  { book: 'Nehemiah', chapter: '9', count: 1, exercise: '16-9-11' },
  { book: 'Mark', chapter: '4', count: 1, exercise: '41-4-8' },
  { book: 'Ephesians', chapter: '6', count: 2, exercise: '49-6-8' },
  { book: '1 Thessalonians', chapter: '4', count: 2, exercise: '52-4-6' },
  { book: 'Hebrews', chapter: '11', count: 1, exercise: '58-11-6' },
]) test(`${sample.book} chapter exercises grade and save on a narrow screen`,async({page})=>{
  const quiz=await quizPanel(page,390);
  for (const [label,value] of [['Book',sample.book],['Chapter',sample.chapter],['Difficulty','Hard']]) {
    await quiz.getByRole('combobox',{name:label,exact:true}).click();
    await page.getByRole('option',{name:value,exact:true}).click();
  }
  await quiz.getByRole('button',{name:'Start quiz',exact:true}).click();
  const saved=(await readData(page)).sessions[0];
  expect(saved.entries).toHaveLength(sample.count);
  expect(saved.entries.some(e=>e.id===sample.exercise)).toBe(true);
  for(let i=0;i<sample.count;i++) {
    await solveCurrent(page,quiz);
    await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
    await quiz.getByRole('button',{name:i===sample.count-1?'Finish quiz':'Next',exact:true}).click();
  }
  await expect(quiz.getByText('Session complete',{exact:true})).toBeVisible();
  const finished=await readData(page);
  expect(finished.attempts).toHaveLength(sample.count);
  expect(finished.attempts.every(a=>a.correct&&!a.assisted)).toBe(true);
  await page.reload();
  await expect(quiz.getByRole('button',{name:'Start quiz',exact:true})).toBeVisible();
  expect((await readData(page)).attempts).toEqual(finished.attempts);
});

test('broader connections respect scope and keep progress outside chapter objectives', async ({page}) => {
  const quiz = await quizPanel(page, 390);
  await quiz.getByRole('combobox', {name:'Scope', exact:true}).click();
  await page.getByRole('option', {name:'Whole Bible', exact:true}).click();
  await quiz.getByRole('combobox', {name:'Question set', exact:true}).click();
  await page.getByRole('option', {name:'Broader connections', exact:true}).click();
  await quiz.getByRole('combobox', {name:'Skill', exact:true}).click();
  await page.getByRole('option', {name:'Bible structure', exact:true}).click();
  await expect(quiz.getByText('Up to 5 questions.', {exact:false})).toBeVisible();
  await quiz.getByRole('button', {name:'Start quiz', exact:true}).click();
  const selected = (await readData(page)).sessions.find(s => !s.done)!;
  expect(selected.label).toBe("Whole Bible · connections sample");
  // The Gospel openings and ordering exercises share evidence. Five candidates
  // therefore produce four questions without disclosing each other's answers.
  const selectedIds = selected.entries.map(e => e.id);
  expect(selectedIds).toHaveLength(4);
  expect(selectedIds).toEqual(expect.arrayContaining(['bible-order','law-order','connections-numbers-camps-and-offering-groups']));
  expect(selectedIds.filter(id => ['connections-nt-gospel-openings','gospel-order'].includes(id))).toHaveLength(1);
  for (let i = 0; i < 4; i++) {
    await solveCurrent(page, quiz);
    await quiz.getByRole('button', {name:i === 3 ? 'Finish quiz' : 'Next', exact:true}).click();
  }
  await quiz.getByRole('button', {name:'Progress', exact:true}).click();
  const explorer = quiz.locator('[aria-label="Mastery explorer"]');
  await explorer.locator('summary').filter({hasText:/^Whole Bible broader connections/}).click();
  await expect(explorer.locator('li')).toHaveCount(22);
  await expect(explorer.locator('li').filter({hasText:'Learned'})).toHaveCount(1);
  await explorer.locator('[data-mastery-scope="OT"] > summary').click();
  await explorer.locator('summary').filter({hasText:/^Old Testament broader connections/}).click();
  await explorer.locator('[data-mastery-scope="NT"] > summary').click();
  await explorer.locator('summary').filter({hasText:/^New Testament broader connections/}).click();
  await explorer.locator('[data-mastery-scope="book:3"] > summary').click();
  await explorer.locator('summary').filter({hasText:/^Numbers broader connections/}).click();
  await expect(explorer.locator('li').filter({hasText:'Learned'})).toHaveCount(4);
  await explorer.locator('[data-mastery-scope="book:0"] > summary').click();
  const chapter = explorer.locator('[data-mastery-scope="chapter:0:1"]');
  await chapter.locator(':scope > summary').click();
  await chapter.locator('summary').filter({hasText:/^Objectives/}).click();
  await expect(chapter.getByText('Arrange the first five books in their KJV order.', {exact:false})).toHaveCount(0);
  await quiz.getByRole('button', {name:'Start', exact:true}).click();
  await quiz.getByRole('combobox', {name:'Scope', exact:true}).click();
  await page.getByRole('option', {name:'New Testament', exact:true}).click();
  await quiz.getByRole('combobox', {name:'Difficulty', exact:true}).click();
  await page.getByRole('option', {name:'Medium', exact:true}).click();
  await expect(quiz.getByText('Up to 1 question.', {exact:false})).toBeVisible();
  await quiz.getByRole('button', {name:'Start quiz', exact:true}).click();
  expect((await readData(page)).sessions.find(s => !s.done)!.entries.map(e => e.id)).toEqual(['connections-nt-gospel-openings']);
  await solveCurrent(page, quiz);
  await expect(quiz.getByRole('region', {name:'Answer feedback'})).toContainText('Correct');
  await quiz.getByRole('button', {name:'Finish quiz', exact:true}).click();
  await quiz.getByRole('button', {name:'Start another quiz', exact:true}).click();
  await quiz.getByRole('combobox', {name:'Difficulty', exact:true}).click();
  await page.getByRole('option', {name:'Mixed difficulty', exact:true}).click();
  await quiz.getByRole('combobox', {name:'Scope', exact:true}).click();
  await page.getByRole('option', {name:'Book', exact:true}).click();
  await expect(quiz.getByRole('button', {name:'Start quiz', exact:true})).toBeDisabled();
  await quiz.getByRole('combobox', {name:'Scope', exact:true}).click();
  await page.getByRole('option', {name:'Chapter', exact:true}).click();
  await expect(quiz.getByRole('combobox', {name:'Question set', exact:true})).toHaveCount(0);
  await quiz.getByRole('combobox', {name:'Skill', exact:true}).click();
  await page.getByRole('option', {name:'All skills', exact:true}).click();
  await expect(quiz.getByRole('button', {name:'Start quiz', exact:true})).toBeEnabled();
  expect(await quiz.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const sample of [
  { book: 'Ruth', skill: 'Event sequence', id: 'connections-ruth' },
  { book: 'John', skill: 'Vocabulary', id: 'connections-explained-terms' },
  { book: 'Revelation', skill: 'Passage comprehension', id: 'connections-revelation-promises' },
  { book: 'Habakkuk', skill: 'Passage comprehension', id: 'connections-habakkuk-responses' },
  { book: 'Philemon', skill: 'People and family', id: 'connections-philemon-people' },
]) test(`reviewed book connection works and resumes on mobile: ${sample.book}`, async ({page}) => {
  const quiz = await quizPanel(page, 390);
  const bank:QuizBank=await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const question=bank.questions.find(q=>q.id===sample.id)!;
  expect(question.book).toBe(sample.book);
  expect(question.scopeLevel).toBe('book');
  // Exercise rendering/resume uses a fixed reviewed question. Filtering and
  // overlap-aware selection are covered separately as each book's pool grows.
  await importPracticeSession(page,quiz,bank,[question],`book-${sample.id}`);
  expect((await readData(page)).sessions.find(s => !s.done)!.entries.map(e => e.id)).toEqual([sample.id]);
  await solveCurrent(page, quiz);
  await expect(quiz.getByRole('region', {name:'Answer feedback'})).toContainText('Correct');
  expect(await quiz.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const saved = await readData(page);
  expect(saved.attempts).toHaveLength(1);
  await page.reload();
  await quiz.getByRole('button', {name:'Continue', exact:true}).click();
  if (await page.getByRole('dialog').isVisible()) await page.getByRole('button', {name:'Confirm', exact:true}).click();
  await expect(quiz.getByRole('region', {name:'Answer feedback'})).toContainText('Correct');
  await quiz.getByRole('button', {name:'Finish quiz', exact:true}).click();
  await expect(quiz.getByText('Session complete', {exact:true})).toBeVisible();
  expect((await readData(page)).attempts).toEqual(saved.attempts);
});

test('each family tree displays its own starting ancestor on mobile', async ({page}) => {
  const quiz = await quizPanel(page,390);
  const bank:QuizBank=await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  await importPracticeSession(page,quiz,bank,bank.questions.filter(q=>q.kind==='family'),'all-family-roots');
  const session = (await readData(page)).sessions.find(s => !s.done)!;
  const roots: Record<string,string> = {'08-4-8':'Boaz','connections-levi-priestly-line':'Levi','genealogy-tree':'Jared','connections-adam-seth-line':'Adam','connections-cain-descendant-line':'Cain','connections-shem-descendant-line':'Shem','connections-abraham-judah-line':'Abraham','connections-david-judah-kings-line':'David'};
  expect(session.entries.map(e => e.id).sort()).toEqual(Object.keys(roots).sort());
  for (let i=0;i<session.entries.length;i++) {
    const id = session.entries[i].id;
    await expect(quiz.locator('[data-slot=quiz-family-root]')).toHaveText(roots[id]);
    if (id === 'connections-levi-priestly-line') await expect(quiz.getByRole('combobox')).toHaveCount(5);
    await solveCurrent(page,quiz);
    await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
    await quiz.getByRole('button',{name:i===session.entries.length-1?'Finish quiz':'Next',exact:true}).click();
  }
  expect((await readData(page)).attempts.every(a => a.correct)).toBe(true);
  expect(await quiz.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('alternate recall preserves existing credit, deduplicates progress, and survives backup import', async ({page}) => {
  const quiz = await quizPanel(page, 390);
  const bank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const q = bank.questions.find((q: {id: string}) => q.id === '08-1-4');
  const time = Date.now() - 2 * 86_400_000;
  const original: QuizSnapshot = {
    sessions: [{id:'old-ruth-session',bank:bank.version,label:'Existing Ruth practice',mode:'practice',index:0,done:true,created:time,updated:time,owner:null,leaseUntil:0,
      entries:[{id:q.id,version:q.version,answer:q.answer,initial:'',choices:q.choices,submitted:true,assisted:false,skipped:false,help:'none'}]}],
    attempts:[{id:`old-ruth-session:${q.id}`,session:'old-ruth-session',qid:q.id,objective:q.objective,version:q.version,answer:q.answer,correct:true,assisted:false,skipped:false,time,points:10}],
  };
  await page.evaluate(data => new Promise<void>((resolve,reject) => {
    const request = indexedDB.open('kjv-only-quiz-v1');
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['sessions','attempts'],'readwrite');
      for (const s of data.sessions) tx.objectStore('sessions').put(s);
      for (const a of data.attempts) tx.objectStore('attempts').put(a);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }), original);
  await page.reload();
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(quiz).toContainText('8980 available objectives');
  await quiz.getByRole('button',{name:'Practice due items',exact:true}).click();
  expect((await readData(page)).sessions.find(s => !s.done)!.entries.map(e => e.id)).toEqual(['08-1-4-recall']);
  await solveCurrent(page,quiz);
  await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
  await quiz.getByRole('button',{name:'Finish quiz',exact:true}).click();
  const result = await readData(page);
  expect(result.attempts.map(a => a.points).sort((a,b) => a-b)).toEqual([5,10]);
  expect(new Set(result.attempts.map(a => a.objective)).size).toBe(1);
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  const skills = quiz.locator('[data-slot=card]').filter({hasText:'Skills and difficulty'});
  await expect(skills).toContainText('Passage comprehension: 1 learned');
  const download = page.waitForEvent('download');
  await quiz.getByRole('button',{name:'Export progress',exact:true}).click();
  const path = await (await download).path();
  await quiz.getByRole('button',{name:'Reset quiz progress',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async () => (await readData(page)).attempts.length).toBe(0);
  for (let i=0;i<2;i++) {
    await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles(path!);
    await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect.poll(async () => (await readData(page)).attempts.length).toBe(2);
  }
  expect((await readData(page)).attempts.reduce((sum,a) => sum+a.points,0)).toBe(15);
  expect(await quiz.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('difficulty corrections retain old backup rewards and resume an older session', async ({page}) => {
  const quiz = await quizPanel(page,390);
  const bank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const oldQuestion = bank.questions.find((q: {id:string}) => q.id === '03-19-5');
  const pendingQuestion = bank.questions.find((q: {id:string}) => q.id === '66-21-7');
  expect(oldQuestion.difficulty).toBe('Easy');
  expect(pendingQuestion.difficulty).toBe('Easy');
  const time = Date.now() - 2 * 86_400_000;
  const original: QuizSnapshot = {
    sessions: [
      {id:'old-hard-completed',bank:bank.version,label:'Previously completed Hard question',mode:'practice',index:0,done:true,created:time,updated:time,owner:null,leaseUntil:0,
        entries:[{id:oldQuestion.id,version:1,answer:oldQuestion.answer,initial:'',choices:oldQuestion.choices,submitted:true,assisted:false,skipped:false,help:'none'}]},
      {id:'old-hard-pending',bank:bank.version,label:'Previously started Hard question',mode:'practice',index:0,done:false,created:time,updated:time,owner:null,leaseUntil:0,
        entries:[{id:pendingQuestion.id,version:1,answer:'',initial:'',choices:pendingQuestion.choices,submitted:false,assisted:false,skipped:false,help:'none'}]},
    ],
    attempts:[{id:`old-hard-completed:${oldQuestion.id}`,session:'old-hard-completed',qid:oldQuestion.id,objective:oldQuestion.objective,version:1,answer:oldQuestion.answer,correct:true,assisted:false,skipped:false,time,points:30}],
  };
  const backup = {type:'kjv-only-quiz',schema:1,bank:bank.version,exported:new Date(time).toISOString(),...original};
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  for (let i=0;i<2;i++) {
    await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles({name:'old-hard-progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect.poll(async () => (await readData(page)).attempts.map(a => a.points)).toEqual([30]);
  }
  await quiz.getByRole('button',{name:'Start',exact:true}).click();
  await quiz.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(quiz.getByText('Easy',{exact:true})).toBeVisible();
  await solveCurrent(page,quiz);
  await quiz.getByRole('button',{name:'Finish quiz',exact:true}).click();
  const completed = await readData(page);
  expect(completed.attempts.find(a => a.qid === oldQuestion.id)?.points).toBe(30);
  expect(completed.attempts.find(a => a.qid === pendingQuestion.id)?.points).toBe(10);
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  const download = page.waitForEvent('download');
  await quiz.getByRole('button',{name:'Export progress',exact:true}).click();
  const path = await (await download).path();
  await quiz.getByRole('button',{name:'Reset quiz progress',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async () => (await readData(page)).attempts.length).toBe(0);
  for (let i=0;i<2;i++) {
    await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles(path!);
    await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect.poll(async () => (await readData(page)).attempts.reduce((sum,a) => sum+a.points,0)).toBe(40);
  }
  expect(await quiz.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const width of [390,1280]) test(`regional quiz maps work with keyboard and equivalent answers offline at ${width}px`, async ({page,context}) => {
  test.setTimeout(180_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const quiz = await quizPanel(page,width);
  const bank:QuizBank = await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const maps = bank.questions.filter(q=>q.kind==='map');
  expect(maps).toHaveLength(12);
  // Import a deterministic unfinished session to exercise every real map, including
  // related maps that the normal selector intentionally separates across sessions.
  await importPracticeSession(page,quiz,bank,maps,'all-map-frames');
  await context.setOffline(true);
  const seen=new Set<string>();
  for (let i=0;i<maps.length;i++) {
    const q=maps[i], answerIndex=q.choices.indexOf(String(q.answer));
    const svg=quiz.locator('svg[role=group]');
    await expect(svg).toBeVisible();
    const marker=svg.getByRole('button',{name:q.mapLabels![answerIndex],exact:true});
    const choice=quiz.getByRole('button',{name:`${q.answer}. ${q.mapLabels![answerIndex].slice(4)}`,exact:true});
    await expect(marker).toHaveAttribute('aria-pressed','false');
    await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeDisabled();
    const region=q.mapRegion??'north-aegean';
    if (!seen.has(region)) {
      seen.add(region);
      await svg.screenshot({path:test.info().outputPath(`map-${region}-${width}.png`)});
      const box=(await svg.boundingBox())!;
      const boxes=await svg.locator('[role=button]').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}));
      for(const r of boxes) {
        expect(r.width).toBeGreaterThanOrEqual(24);
        expect(r.left).toBeGreaterThanOrEqual(box.x);
        expect(r.right).toBeLessThanOrEqual(box.x+box.width);
        expect(r.top).toBeGreaterThanOrEqual(box.y);
        expect(r.bottom).toBeLessThanOrEqual(box.y+box.height);
      }
      const scan=await new AxeBuilder({page}).include('[aria-label="Bible quiz"]').analyze();
      expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
    }
    if (i%2===0) {await marker.focus();await page.keyboard.press(i%4===0?'Enter':'Space');}
    else await choice.click();
    await expect(marker).toHaveAttribute('aria-pressed','true');
    await expect(choice).toHaveAttribute('aria-pressed','true');
    await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeEnabled();
    await quiz.getByRole('button',{name:'Submit answer',exact:true}).click();
    await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
    await expect(marker).toHaveAttribute('aria-disabled','true');
    await expect(marker).toHaveAttribute('tabindex','-1');
    expect(await quiz.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await quiz.getByRole('button',{name:i===maps.length-1?'Finish quiz':'Next',exact:true}).click();
  }
  expect(seen.size).toBe(6);
  const result=await readData(page);
  expect(result.attempts).toHaveLength(maps.length);
  expect(result.attempts.every(a=>a.correct&&!a.assisted)).toBe(true);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});

test('Genesis book family practice includes the growing cross-chapter pool',async({page})=>{
  const quiz=await quizPanel(page,390);
  for (const [label,option] of [['Scope','Book'],['Book','Genesis'],['Question set','Broader connections'],['Skill','People and family']]) {
    await quiz.getByRole('combobox',{name:label,exact:true}).click();
    await page.getByRole('option',{name:option,exact:true}).click();
  }
  await expect(quiz).toContainText('Up to 2 questions');
  await quiz.getByRole('button',{name:'Start quiz',exact:true}).click();
  const session=(await readData(page)).sessions.find(s=>!s.done)!;
  expect(session.entries.length).toBeGreaterThan(0);
  expect(session.entries.every(e=>['connections-genesis-wives','connections-abraham-judah-line'].includes(e.id))).toBe(true);
  for(let i=0;i<session.entries.length;i++) {
    await solveCurrent(page,quiz);
    await expect(quiz.getByRole('region',{name:'Answer feedback'})).toContainText('Correct');
    await quiz.getByRole('button',{name:i===session.entries.length-1?'Finish quiz':'Next',exact:true}).click();
  }
  expect(await quiz.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
