import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { parseQuizBank } from "@/lib/quiz/data";
import { DAY, quizObjectives, quizStats } from "@/lib/quiz/engine";
import { masteryCounts, quizCompletionBadges, quizMasteryScope, quizMasteryTree, type QuizCoverageRelease } from "@/lib/quiz/mastery";
import { QUIZ_COVERAGE_RELEASES } from "@/lib/quiz/releases";
import type { QuizAttempt, QuizQuestion } from "@/lib/quiz/types";

const bank = parseQuizBank(JSON.parse(readFileSync('public/data/quiz-pilot-v1.json','utf8')));
const objectives = quizObjectives(bank.questions), release = QUIZ_COVERAGE_RELEASES[0];
const time = Date.UTC(2026,9,1);
const attempt = (q: QuizQuestion, patch: Partial<QuizAttempt> = {}): QuizAttempt => ({id:`${q.id}-first`,session:'first',qid:q.id,objective:q.objective,version:q.version,answer:q.answer,correct:true,assisted:false,skipped:false,time,points:10,...patch});
const learned = objectives.map(q=>attempt(q));
const mastered = learned.concat(objectives.map(q=>attempt(q,{id:`${q.id}-second`,session:'second',time:time+7*DAY})));

describe('mastery scopes and versioned release badges',()=>{
  it('freezes a complete, unique release manifest with valid scope membership',()=>{
    const entries=Object.entries(release.groups).flatMap(([scope,items])=>items.map(([id,version])=>({scope,id,version})));
    expect(entries).toHaveLength(8965);
    expect(new Set(entries.map(e=>e.id)).size).toBe(entries.length);
    const byId=new Map(objectives.map(q=>[q.objective,q]));
    for(const e of entries){expect(byId.get(e.id)?.version).toBe(e.version);expect(quizMasteryScope(byId.get(e.id)!)).toBe(e.scope);}
    expect(createHash('sha256').update(JSON.stringify(release)).digest('hex')).toBe('7be67a97ff0f00c0eed579eb1086342fd9f9f417639d24c0e75afe09e516f6e8');
  });
  it('counts each objective once overall and includes every child plus broader connections',()=>{
    const root=quizMasteryTree(bank);
    expect(root.objectives).toHaveLength(8980);expect(new Set(root.objectives.map(q=>q.objective)).size).toBe(8980);
    expect([root.coveredChapters,root.totalChapters]).toEqual([1189,1189]);
    expect(root.children.map(t=>t.totalChapters)).toEqual([929,260]);
    for(const testament of root.children) for(const book of testament.children){
      expect(book.coveredChapters).toBe(book.totalChapters);
      expect(book.objectives.length).toBe(book.own.length+book.children.reduce((n,c)=>n+c.objectives.length,0));
    }
  });
  it('moves cross-context vocabulary to the smallest eligible broader scope',()=>{
    const get=(id:string)=>bank.questions.find(q=>q.id===id)!;
    expect(quizMasteryScope(get('ephah'))).toBe('OT');expect(quizMasteryScope(get('hin'))).toBe('OT');
    expect(quizMasteryScope(get('vocab-publican'))).toBe('book:41');
    expect(quizMasteryScope(get('connections-vocabulary-by-and-by'))).toBe('NT');
  });
  it('never awards an empty or incomplete-coverage scope',()=>{
    expect(quizCompletionBadges([release],[])).toEqual([]);
    const q=objectives[0];const partial:QuizCoverageRelease={id:'partial',label:'Partial',groups:{'chapter:0:1':[[q.objective,q.version]]}};
    const result=quizCompletionBadges([partial],[attempt(q)]);
    expect(result.map(b=>b.scope)).toEqual(['chapter:0:1']);
    expect(quizCompletionBadges([{...partial,groups:{'book:0':[[q.objective,q.version]]}}],[attempt(q)])).toEqual([]);
  });
  it('requires all objectives and keeps broader objectives out of chapter awards',()=>{
    const missing=objectives.find(q=>q.scopeLevel==='book'&&q.book==='Genesis')!;
    const awards=quizCompletionBadges([release],learned.filter(a=>a.objective!==missing.objective));
    expect(awards.some(b=>b.scope==='chapter:0:1')).toBe(true);
    expect(awards.some(b=>['book:0','OT','bible'].includes(b.scope))).toBe(false);
    expect(awards.some(b=>b.scope==='NT')).toBe(true);
  });
  it('awards learned and delayed mastery independently without duplicate alternate-form credit',()=>{
    expect(quizCompletionBadges([release],learned)).toHaveLength(1189+66+2+1);
    const awards=quizCompletionBadges([release],mastered);
    expect(awards).toHaveLength(2*(1189+66+2+1));
    expect(awards.find(b=>b.scope==='bible'&&b.kind==='Mastered')).toMatchObject({earnedAt:time+7*DAY,objectiveCount:8965});
    const alternate=bank.questions.find(q=>q.id!==q.objective)!;
    expect(quizCompletionBadges([release],[...mastered,attempt(alternate)])).toEqual(awards);
    expect(quizCompletionBadges([release],mastered.map(a=>({...a,session:'same'}))).every(b=>b.kind==='Learned')).toBe(true);
    expect(quizCompletionBadges([release],mastered.map(a=>({...a,time:a.time===time?time:time+7*DAY-1}))).every(b=>b.kind==='Learned')).toBe(true);
  });
  it('ignores assisted, skipped, wrong and mismatched-version evidence',()=>{
    for(const patch of [{assisted:true},{skipped:true},{correct:false},{version:2}]) expect(quizCompletionBadges([release],learned.map(a=>({...a,...patch})))).toEqual([]);
  });
  it('retains old release badges after added content and later mistakes',()=>{
    const extended=structuredClone(release);extended.id='next';extended.groups['chapter:0:1'].push(['new-objective',1]);
    const bad=attempt(objectives[0],{id:'late-mistake',session:'third',correct:false,time:time+9*DAY});
    const awards=quizCompletionBadges([release,extended],[...mastered,bad]);
    expect(awards.filter(b=>b.release===release.id)).toEqual(quizCompletionBadges([release],mastered));
    expect(awards.some(b=>b.release==='next'&&['chapter:0:1','book:0','OT','bible'].includes(b.scope))).toBe(false);
    expect(masteryCounts(objectives,quizStats(bank,[...mastered,bad],time+10*DAY))).toMatchObject({learned:8980,mastered:8980});
  });
  it('does not change badge requirements when viewing a skill or difficulty subset',()=>{
    const subset=objectives.filter(q=>q.skill==='Vocabulary'&&q.difficulty==='Easy');
    const stats=quizStats(bank,subset.map(q=>attempt(q)),time);
    expect(masteryCounts(subset,stats).learned).toBe(subset.length);
    expect(masteryCounts(objectives,stats).learned).toBeLessThan(8965);
    expect(quizCompletionBadges([release],subset.map(q=>attempt(q))).some(b=>b.scope==='bible')).toBe(false);
    expect(BIBLE_BOOKS).toHaveLength(66);
  });
});
