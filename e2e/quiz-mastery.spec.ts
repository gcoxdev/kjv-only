import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { QuizBackup, QuizBank, QuizQuestion, QuizSession, QuizSnapshot } from '../src/lib/quiz/types';

async function saved(page:Page):Promise<QuizSnapshot> {
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('kjv-only-quiz-v1');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction(['sessions','attempts']);
      const s=tx.objectStore('sessions').getAll(),a=tx.objectStore('attempts').getAll();
      tx.oncomplete=()=>{db.close();resolve({sessions:s.result,attempts:a.result});};
      tx.onabort=()=>{db.close();reject(tx.error);};
    };
  }));
}
function judeBackup(bank:QuizBank):QuizBackup {
  const questions=bank.questions.filter(q=>q.id===q.objective&&q.book==='Jude'&&['chapter','book'].includes(q.scopeLevel));
  const first=Date.now()-10*86400000, second=first+7*86400000;
  const correctAnswer=(q:QuizQuestion)=>q.kind==='text'?q.answer[0]:q.answer;
  const session=(id:string,time:number,qs:QuizQuestion[],wrong=false):QuizSession=>({id,bank:bank.version,label:'Jude saved progress',mode:'practice',index:0,done:true,created:time,updated:time,owner:null,leaseUntil:0,
    entries:qs.map(q=>({id:q.id,version:q.version,answer:wrong?q.choices.find(c=>c!==q.answer)!:correctAnswer(q),initial:Array.isArray(correctAnswer(q))?correctAnswer(q):'',choices:q.choices,submitted:true,assisted:false,skipped:false,help:'none'}))});
  const wrong=questions.find(q=>q.kind==='choice')!;
  const sessions=[session('jude-first',first,questions),session('jude-second',second,questions),session('jude-later-mistake',Date.now()-86400000,[wrong],true)];
  return {type:'kjv-only-quiz',schema:1,bank:bank.version,exported:new Date().toISOString(),sessions,attempts:sessions.flatMap((s,i)=>s.entries.map(e=>{
    const q=questions.find(q=>q.id===e.id)!;
    return {id:`${s.id}:${e.id}`,session:s.id,qid:e.id,objective:q.objective,version:q.version,answer:e.answer,correct:i!==2,assisted:false,skipped:false,time:s.created,points:i===2?0:i===1?5:{Easy:10,Medium:20,Hard:30}[q.difficulty]};
  }))};
}
for(const width of [390,1280]) test(`mastery hierarchy and release badges restore, filter and practice at ${width}px`,async({page,context})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/#tab=0&tabs=h&layout=Quiz:quiz');
  const quiz=page.getByRole('region',{name:'Bible quiz',exact:true}).first();
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  const explorer=quiz.locator('[aria-label="Mastery explorer"]'),badges=quiz.locator('[aria-label="Completion badges"]');
  await expect(explorer).toContainText('1189/1189');
  await expect(explorer.locator('[data-mastery-scope]')).toHaveCount(2);
  await expect(badges).toContainText('0 Learned badges · 0 Mastered badges');
  const bank:QuizBank=await(await page.request.get('/data/quiz-pilot-v1.json')).json(),backup=judeBackup(bank);
  await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles({name:'jude.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(badges.getByRole('listitem')).toHaveCount(4);
  await expect(badges).toContainText('Jude · Mastered');
  await expect(badges).toContainText('Jude 1 · Learned');
  await expect(badges).toContainText('October 2026');
  await explorer.locator('[data-mastery-scope="NT"] > summary').click();
  const jude=explorer.locator('[data-mastery-scope="book:64"]');
  await jude.locator(':scope > summary').click();
  await expect(jude.locator(':scope > summary')).toContainText('10/10 mastered');
  await expect(jude).toContainText('1 due for review');
  await jude.locator('summary').filter({hasText:/^Jude broader connections/}).click();
  await expect(jude.locator('li')).toHaveCount(3);
  const chapter=jude.locator('[data-mastery-scope="chapter:64:1"]');
  await chapter.locator(':scope > summary').click();
  await chapter.locator('summary').filter({hasText:/^Objectives/}).click();
  await expect(chapter.locator('li')).toHaveCount(7);
  const scan=await new AxeBuilder({page}).include('[aria-label="Mastery explorer"]').include('[aria-label="Completion badges"]').analyze();
  expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  expect(await quiz.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const longBook=explorer.locator('[data-mastery-scope="book:52"]');
  await longBook.locator(':scope > summary').click();
  await longBook.locator('[data-mastery-scope="chapter:52:1"] > summary').click();
  expect(await quiz.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await longBook.locator(':scope > summary').click();
  await explorer.getByText("Mastery explorer",{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:test.info().outputPath(`mastery-${width}.png`)});
  await explorer.getByRole('combobox',{name:'Mastery difficulty'}).click();
  await page.getByRole('option',{name:'Hard',exact:true}).click();
  await expect(badges.getByRole('listitem')).toHaveCount(4);
  await jude.getByRole('button',{name:'Practice Jude',exact:true}).click();
  await expect(quiz.getByRole('button',{name:'Submit answer',exact:true})).toBeVisible();
  const practice=(await saved(page)).sessions.find(s=>!s.done)!;
  expect(practice.entries.length).toBeGreaterThan(0);
  for(const e of practice.entries) expect(bank.questions.find(q=>q.id===e.id)).toMatchObject({book:'Jude',difficulty:'Hard'});
  await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  const download=page.waitForEvent('download');await quiz.getByRole('button',{name:'Export progress',exact:true}).click();
  const path=await(await download).path();const before=await saved(page);
  await quiz.getByRole('button',{name:'Reset quiz progress',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(badges).toContainText('0 Learned badges · 0 Mastered badges');
  for(let i=0;i<2;i++){
    await quiz.getByLabel('Import quiz backup',{exact:true}).setInputFiles(path!);
    await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(badges.getByRole('listitem')).toHaveCount(4);
  }
  expect((await saved(page)).attempts).toEqual(before.attempts);
  await page.reload();await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(badges.getByRole('listitem')).toHaveCount(4);
  await badges.getByRole('combobox',{name:'Badge level'}).click();await page.getByRole('option',{name:'Book',exact:true}).click();
  await badges.getByRole('combobox',{name:'Badge achievement'}).click();await page.getByRole('option',{name:'Mastered',exact:true}).click();
  await expect(badges.getByRole('listitem')).toHaveCount(1);
  await expect(badges).toContainText('Jude · Mastered');
  await context.setOffline(true);
  await quiz.getByRole('button',{name:'Start',exact:true}).click();await quiz.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(badges).toContainText('Jude · Mastered');
});
