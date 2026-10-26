import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuizBank } from "@/lib/quiz/data";
import { applyQuizAction, filterQuizQuestions } from "@/lib/quiz/engine";
import { DEFAULT_QUIZ_OPTIONS, enqueueReadingQuiz, newReadingQuizFlow, nextReadingQuizStep, parseQuizPracticeOptions, prepareReadingQuizStep, readingQuizFilters, readingQuizScopes, skipReadingQuizStep, validReadingFlows } from "@/lib/quiz/reading";
import { parseQuizBackup, validSnapshot } from "@/lib/quiz/storage";
import { parseReaderDisplaySettings } from "@/lib/reader-persistence";
import type { QuizReadingRequest, QuizSnapshot } from "@/lib/quiz/types";

const bank = parseQuizBank(JSON.parse(readFileSync("public/data/quiz-pilot-v1.json", "utf8")));
const request: QuizReadingRequest = { id: "reading-request", bookIndex: 65, chapterIndex: 21, mode: "milestones" };
const empty = (): QuizSnapshot => ({ sessions: [], attempts: [], readingFlows: [] });
function complete(state: QuizSnapshot, sessionId: string) {
  const index = state.sessions.findIndex(s => s.id === sessionId);
  for (const entry of state.sessions[index].entries) {
    const q = bank.questions.find(q => q.id === entry.id)!;
    const result = applyQuizAction(bank, state.sessions[index], state.attempts, { type: "submit", qid: q.id, answer: q.kind === "text" ? q.answer[0] : q.answer });
    state.sessions[index] = result.session; state.attempts = result.attempts;
  }
  const result = applyQuizAction(bank, state.sessions[index], state.attempts, { type: "finish" });
  state.sessions[index] = result.session; state.attempts = result.attempts;
}

describe("quizzes after explicit reading milestones", () => {
  it("defaults to off and preserves only supported preferences", () => {
    expect(parseReaderDisplaySettings(null).quizAfterReading).toBe("off");
    for (const quizAfterReading of ["off", "chapter", "milestones"] as const) expect(parseReaderDisplaySettings({ quizAfterReading }).quizAfterReading).toBe(quizAfterReading);
    expect(parseReaderDisplaySettings({ quizAfterReading: "all" }).quizAfterReading).toBe("off");
    expect(parseQuizPracticeOptions({ length: 999, difficulty: "Impossible", skill: "other", mode: "unknown", readOnly: "true" })).toEqual(DEFAULT_QUIZ_OPTIONS);
  });
  it("offers the correct canonical boundaries without assuming earlier chapters were read", () => {
    expect(readingQuizScopes(0, 0, "milestones")).toEqual(["chapter"]);
    expect(readingQuizScopes(0, 49, "milestones")).toEqual(["chapter", "book"]);
    expect(readingQuizScopes(38, 3, "milestones")).toEqual(["chapter", "book", "OT"]);
    expect(readingQuizScopes(65, 21, "milestones")).toEqual(["chapter", "book", "NT", "bible"]);
    expect(readingQuizScopes(64, 0, "milestones")).toEqual(["chapter", "book"]); // Jude is not the testament boundary.
    expect(readingQuizScopes(65, 21, "chapter")).toEqual(["chapter"]);
    expect(readingQuizScopes(65, 21, "off")).toEqual([]);
    for (const [b,c] of [[-1,0],[66,0],[65,22],[0,-1],[0,0.5],[1.5,0]]) expect(() => readingQuizScopes(b,c,"milestones")).toThrow();
  });
  it("deduplicates pending requests across windows while permitting a later reread", () => {
    const state = empty();
    const first = enqueueReadingQuiz(state, request, DEFAULT_QUIZ_OPTIONS);
    expect(first.created).toBe(true);
    expect(enqueueReadingQuiz(state, {...request,id:"other-window"}, DEFAULT_QUIZ_OPTIONS)).toMatchObject({created:false,flow:first.flow});
    first.flow.closed = true;
    expect(enqueueReadingQuiz(state, request, DEFAULT_QUIZ_OPTIONS).created).toBe(false);
    expect(enqueueReadingQuiz(state, {...request,id:"reread"}, DEFAULT_QUIZ_OPTIONS).created).toBe(true);
    expect(state.readingFlows).toHaveLength(2);
  });
  it("saves four ordered scope sessions and respects the marked-read filter at every level", () => {
    const state = empty(), read = new Set(["65:21"]);
    const { flow } = enqueueReadingQuiz(state, request, {...DEFAULT_QUIZ_OPTIONS, readOnly:true, length:5, mode:"assessment"});
    for (let i=0;i<4;i++) {
      expect(nextReadingQuizStep(flow,state.sessions)).toBe(i);
      const sessionId = prepareReadingQuizStep(bank,state,flow,i,"owner",read)!;
      expect(prepareReadingQuizStep(bank,state,flow,i,"another-owner",read)).toBe(sessionId);
      const session = state.sessions.find(s=>s.id===sessionId)!;
      expect(session.mode).toBe("assessment");
      expect(session.entries.length).toBeLessThanOrEqual(5);
      const eligible = new Set(filterQuizQuestions(bank,readingQuizFilters(flow,flow.steps[i].scope),read).map(q=>q.id));
      expect(session.entries.every(e=>eligible.has(e.id))).toBe(true);
      expect(session.entries.every(e=>bank.questions.find(q=>q.id===e.id)!.contexts.every(c=>c.book==="Revelation"&&c.chapter===22))).toBe(true);
      complete(state,sessionId);
      expect(validSnapshot(state,bank)).toBe(true);
      expect(() => prepareReadingQuizStep(bank,state,flow,i,"owner",read)).toThrow(/changed/);
    }
    expect(nextReadingQuizStep(flow,state.sessions)).toBe(-1);
    const rewarded = state.attempts.filter(a=>a.points>=10).map(a=>a.objective);
    expect(new Set(rewarded).size).toBe(rewarded.length);
    expect(parseQuizBackup({type:"kjv-only-quiz",schema:1,bank:bank.version,...state},bank).readingFlows).toEqual(state.readingFlows);
  });
  it("skips empty scopes without broadening filters or inventing attempts", () => {
    const state=empty(), {flow}=enqueueReadingQuiz(state,request,{...DEFAULT_QUIZ_OPTIONS,readOnly:true});
    expect(prepareReadingQuizStep(bank,state,flow,0,"owner",new Set())).toBeNull();
    expect(flow.steps.every(step=>step.skipped==="empty")).toBe(true);
    expect(state.sessions).toEqual([]);expect(state.attempts).toEqual([]);
    expect(validSnapshot(state,bank)).toBe(true);
  });
  it("skips a pending level and preserves partial sessions without marking unanswered items wrong", () => {
    const state=empty(), {flow}=enqueueReadingQuiz(state,request,DEFAULT_QUIZ_OPTIONS);
    skipReadingQuizStep(state,flow,0,"owner");
    const id=prepareReadingQuizStep(bank,state,flow,1,"owner",new Set())!;
    expect(() => skipReadingQuizStep(state,flow,1,"other-owner")).toThrow(/open elsewhere/);
    const saved=structuredClone(state.sessions[0].entries);
    skipReadingQuizStep(state,flow,1,"owner");
    expect(state.sessions[0]).toMatchObject({id,done:false,owner:null});
    expect(state.sessions[0].entries).toEqual(saved);expect(state.attempts).toEqual([]);
    expect(nextReadingQuizStep(flow,state.sessions)).toBe(2);
    expect(() => skipReadingQuizStep(state,flow,1,"owner")).toThrow(/changed/);
    expect(validSnapshot(state,bank)).toBe(true);
  });
  it("validates imported queues and keeps old backups valid", () => {
    expect(validReadingFlows(undefined,[])).toBe(true);
    const flow=newReadingQuizFlow(request,DEFAULT_QUIZ_OPTIONS);
    expect(validReadingFlows([flow],[])).toBe(true);
    for (const patch of [{bookIndex:90},{chapterIndex:22},{mode:"off"},{options:{...DEFAULT_QUIZ_OPTIONS,length:200}},{steps:[]},{steps:[...flow.steps].reverse()},{closed:"yes"}]) expect(validReadingFlows([{...flow,...patch}],[])).toBe(false);
    expect(validReadingFlows([flow,flow],[])).toBe(false);
    const invalid=structuredClone(flow);invalid.steps[1].skipped="reader";
    expect(validReadingFlows([invalid],[])).toBe(false);
    invalid.steps[0].sessionId="missing";
    expect(validReadingFlows([invalid],[])).toBe(false);
    expect(parseQuizBackup({type:"kjv-only-quiz",schema:1,bank:bank.version,sessions:[],attempts:[]},bank).sessions).toEqual([]);
  });
});
