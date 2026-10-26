import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { QuizBank, QuizSnapshot } from '../src/lib/quiz/types';

let navigation = 0;
const route = (page: Page, hash: string) => page.goto(`/?reading-quiz-test=${++navigation}${hash}`);
const quizDialog = (page: Page) => page.getByRole('dialog', {name:'Quiz after reading', exact:true});
async function saved(page: Page): Promise<QuizSnapshot> {
  return page.evaluate(() => new Promise<QuizSnapshot>((resolve,reject) => {
    const request=indexedDB.open('kjv-only-quiz-v1');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result, tx=db.transaction(['sessions','attempts','readingFlows']);
      const sessions=tx.objectStore('sessions').getAll(), attempts=tx.objectStore('attempts').getAll(), flows=tx.objectStore('readingFlows').getAll();
      tx.oncomplete=()=>{db.close();resolve({sessions:sessions.result,attempts:attempts.result,readingFlows:flows.result});};
      tx.onabort=()=>{db.close();reject(tx.error);};
    };
  }));
}
async function settings(page:Page, mode:'Off'|'Chapter only'|'Chapter and milestone quizzes') {
  await route(page,'#tab=0&tabs=h&layout=Reading:GEN.1');
  await page.getByLabel('Open menu').click();
  await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Other',exact:true}).click();
  await page.getByRole('combobox',{name:'Quiz after reading',exact:true}).click();
  await page.getByRole('option',{name:mode,exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kjv-display-settings-v1')!).quizAfterReading)).toBe(mode==='Off'?'off':mode==='Chapter only'?'chapter':'milestones');
}
async function readChapter(page:Page, code:string) {
  await route(page,`#tab=0&tabs=h&layout=Reading:${code}`);
  await page.getByRole('button',{name:'Mark Read: mark chapter read',exact:true}).click();
}
async function quizHome(page:Page) {
  await route(page,'#tab=0&tabs=h&layout=Quiz:quiz');
  const quiz=page.getByRole('region',{name:'Bible quiz',exact:true}).first();
  await expect(quiz.getByRole('button',{name:'Start quiz',exact:true})).toBeVisible();
  return quiz;
}
async function finishCurrent(page:Page, quiz:ReturnType<Page['getByRole']>) {
  const bank:QuizBank=await (await page.request.get('/data/quiz-pilot-v1.json')).json();
  const state=await saved(page), flow=state.readingFlows!.at(-1)!;
  const session=state.sessions.find(s=>flow.steps.some(step=>step.sessionId===s.id)&&!s.done)!;
  // Comprehension-only fixtures use ordinary choice/text questions.
  for(let i=0;i<session.entries.length;i++) {
    const q=bank.questions.find(q=>q.id===session.entries[i].id)!;
    if(q.kind==='text'||q.kind==='memory') await quiz.getByRole('textbox',{name:q.kind==='memory'?'Verse from memory':'Your answer',exact:true}).fill(q.answer[0]);
    else {
      expect(q.kind).toBe('choice');
      const escaped=(q.answer as string).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      await quiz.getByRole('button',{name:new RegExp(`^[A-D]\\. ${escaped}$`)}).click();
    }
    await quiz.getByRole('button',{name:'Submit answer',exact:true}).click();
    await quiz.getByRole('button',{name:i===session.entries.length-1?'Finish quiz':'Next',exact:true}).click();
  }
}
test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    if(!localStorage.getItem('kjv-quiz-options-v1')) localStorage.setItem('kjv-quiz-options-v1',JSON.stringify({length:5,mode:'practice',skill:'Comprehension',difficulty:'all',readOnly:true}));
  });
});

test('reading quiz preference defaults off; chapter-only ending can resume without launching on reload',async({page})=>{
  await readChapter(page,'GEN.1');
  await expect(quizDialog(page)).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Read: mark chapter unread',exact:true})).toBeVisible();
  await settings(page,'Chapter only');
  await readChapter(page,'GEN.50');
  const dialog=quizDialog(page);
  await expect(dialog.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  await expect(dialog.locator('ol[aria-label="Reading quiz sequence"]').locator('li')).toHaveCount(1);
  const before=await saved(page);
  await dialog.getByRole('button',{name:'Finish for now',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Read: mark chapter unread',exact:true})).toBeVisible();
  await page.reload();await expect(dialog).toHaveCount(0);
  const quiz=await quizHome(page);
  await quiz.getByRole('button',{name:'Resume Genesis 50',exact:true}).click();
  await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  expect((await saved(page)).sessions.map(s=>s.id)).toEqual(before.sessions.map(s=>s.id));
});

for(const [code, scopes] of [['RUT.4',['chapter','book']],['MAL.4',['chapter','book','OT']]] as const) test(`${code} offers its canonical milestone scopes`,async({page})=>{
  await settings(page,'Chapter and milestone quizzes');
  await readChapter(page,code);
  await expect(quizDialog(page).getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  const state=await saved(page);
  expect(state.readingFlows![0].steps.map(s=>s.scope)).toEqual(scopes);
  expect(state.sessions).toHaveLength(1);
  expect(await quizDialog(page).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('Revelation sequence supports completion, skip, resume, and idempotent backup without claiming full reading',async({page})=>{
  await settings(page,'Chapter and milestone quizzes');
  await readChapter(page,'REV.22');
  const dialog=quizDialog(page), quiz=dialog.getByRole('region',{name:'Bible quiz',exact:true});
  await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  await expect(quiz.locator('ol[aria-label="Reading quiz sequence"]').locator('li')).toHaveCount(4);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kjv-read-chapters-v1')!))).toEqual(['65:21']);
  expect((await saved(page)).readingFlows![0].steps.map(s=>s.scope)).toEqual(['chapter','book','NT','bible']);
  const scan=await new AxeBuilder({page}).include('[role="dialog"]').analyze();
  expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await dialog.screenshot({path:test.info().outputPath('revelation-reading-quiz-mobile.png')});
  await finishCurrent(page,quiz);
  await expect(quiz.getByRole('button',{name:'Continue to Revelation',exact:true})).toBeVisible();
  await quiz.getByRole('button',{name:'Skip this quiz',exact:true}).click();
  await expect(quiz.getByRole('button',{name:'Continue to New Testament',exact:true})).toBeVisible();
  await quiz.getByRole('button',{name:'Skip this quiz',exact:true}).click();
  await quiz.getByRole('button',{name:'Continue to Whole Bible',exact:true}).click();
  await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  await quiz.getByRole('button',{name:'Finish for now',exact:true}).click();
  let home=await quizHome(page);
  await home.getByRole('button',{name:'Resume Whole Bible',exact:true}).click();
  await expect(home.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  const before=await saved(page);
  expect(before.readingFlows![0].steps.map(s=>s.skipped)).toEqual([false,'reader','reader',false]);
  await home.getByRole('button',{name:'Progress',exact:true}).click();
  const download=page.waitForEvent('download');await home.getByRole('button',{name:'Export progress',exact:true}).click();
  const path=await(await download).path();
  await home.getByRole('button',{name:'Reset quiz progress',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(async()=>(await saved(page)).sessions.length).toBe(0);
  for(let i=0;i<2;i++) {
    await home.getByLabel('Import quiz backup',{exact:true}).setInputFiles(path!);
    await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect.poll(async()=>(await saved(page)).readingFlows?.length).toBe(1);
  }
  expect((await saved(page)).attempts).toEqual(before.attempts);
  await expect(quizDialog(page)).toHaveCount(0);
  await settings(page,'Off');
  home=await quizHome(page); // Turning the preference off preserves manual access.
  await expect(home.getByRole('button',{name:'Resume Whole Bible',exact:true})).toBeVisible();
});

test('existing quiz is preserved and rereading does not duplicate a pending sequence',async({page})=>{
  await settings(page,'Chapter and milestone quizzes');
  const home=await quizHome(page);
  await home.getByRole('switch',{name:'Only chapters marked read',exact:true}).click();
  await home.getByRole('button',{name:'Start quiz',exact:true}).click();
  await expect(home.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  const original=(await saved(page)).sessions[0];
  await readChapter(page,'GEN.2');
  const dialog=quizDialog(page);
  await expect(dialog.getByRole('button',{name:'Start Genesis 2 quiz',exact:true})).toBeVisible();
  expect((await saved(page)).sessions).toHaveLength(1);
  await dialog.getByRole('button',{name:'Start Genesis 2 quiz',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  expect((await saved(page)).sessions.find(s=>s.id===original.id)?.entries).toEqual(original.entries);
  await dialog.getByRole('button',{name:'Finish for now',exact:true}).click();
  await page.getByRole('button',{name:'Read: mark chapter unread',exact:true}).click();
  await page.getByRole('button',{name:'Mark Read: mark chapter read',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Resume Genesis 2',exact:true})).toBeVisible();
  expect((await saved(page)).readingFlows).toHaveLength(1);
  expect((await saved(page)).sessions).toHaveLength(2);
  await dialog.getByRole('button',{name:'Dismiss sequence',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect((await saved(page)).readingFlows![0].closed).toBe(true);
  const afterDismiss=await quizHome(page);
  await expect(afterDismiss.getByRole('button',{name:'Resume Genesis 2',exact:true})).toHaveCount(0);
  await expect(afterDismiss.getByRole('button',{name:'Continue',exact:true})).toHaveCount(2);
});

test('bulk progress and storage synchronization do not launch reading quizzes',async({page,context})=>{
  await settings(page,'Chapter and milestone quizzes');
  await route(page,'#tab=0&tabs=h&layout=Reading:GEN.1');
  await page.getByLabel('Open menu').click();
  await page.getByRole('menuitem',{name:'Reading Progress',exact:true}).click();
  await page.getByRole('button').filter({has:page.getByRole('progressbar',{name:'Old Testament',exact:true})}).click();
  await page.getByRole('button').filter({has:page.getByRole('progressbar',{name:'Genesis',exact:true})}).click();
  await page.getByRole('button',{name:'Mark all complete',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kjv-read-chapters-v1')!).length)).toBe(50);
  await expect(quizDialog(page)).toHaveCount(0);
  const other=await context.newPage();
  await route(other,'#tab=0&tabs=h&layout=Reading:EXO.1');
  // Emulate a progress restoration in another window. Subscription must not launch a quiz.
  await other.evaluate(()=>localStorage.setItem('kjv-read-chapters-v1',JSON.stringify(['1:0'])));
  await expect(quizDialog(page)).toHaveCount(0);
  await expect(quizDialog(other)).toHaveCount(0);
  await page.reload();await expect(quizDialog(page)).toHaveCount(0);
});

test('version-one quiz storage upgrades without changing saved answers or rewards',async({page})=>{
  await settings(page,'Chapter only');
  await readChapter(page,'GEN.1');
  const dialog=quizDialog(page);
  await expect(dialog.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  await finishCurrent(page,dialog);
  const before=await saved(page);
  expect(before.attempts.length).toBeGreaterThan(0);
  await dialog.getByRole('button',{name:'Finish for now',exact:true}).click();
  // Recreate the previous schema in this test's isolated browser profile.
  // The plain resource navigation releases all app connections before replacement.
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async state=>{
    await new Promise<void>((resolve,reject)=>{
      const deletion=indexedDB.deleteDatabase('kjv-only-quiz-v1');
      deletion.onsuccess=()=>resolve();deletion.onerror=()=>reject(deletion.error);
    });
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('kjv-only-quiz-v1',1);
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('sessions',{keyPath:'id'});
        request.result.createObjectStore('attempts',{keyPath:'id'});
      };
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result, tx=db.transaction(['sessions','attempts'],'readwrite');
        state.sessions.forEach(s=>tx.objectStore('sessions').put(s));
        state.attempts.forEach(a=>tx.objectStore('attempts').put(a));
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onabort=()=>{db.close();reject(tx.error);};
      };
    });
  },before);
  await quizHome(page);
  const after=await saved(page);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.attempts).toEqual(before.attempts);
  expect(after.readingFlows).toEqual([]);
  await readChapter(page,'GEN.2');
  await expect(quizDialog(page).getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  expect((await saved(page)).readingFlows).toHaveLength(1);
});
