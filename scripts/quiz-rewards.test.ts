import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseQuizBank } from '@/lib/quiz/data';
import { applyQuizAction, createQuizSession, DAY, quizStats } from '@/lib/quiz/engine';
import { quizCompletionReward, quizPracticeStreak, quizRewardMilestones } from '@/lib/quiz/rewards';
import { parseQuizRewardPreferences } from '@/lib/quiz/reward-preferences';
import type { QuizAttempt, QuizQuestion } from '@/lib/quiz/types';
const bank = parseQuizBank(JSON.parse(readFileSync('public/data/quiz-pilot-v1.json', 'utf8')));
const date = (day: number, hour = 12) => new Date(2026, 2, day, hour).getTime();
const attempt = (time: number, patch: Partial<QuizAttempt> = {}): QuizAttempt => ({ id: `a-${time}`, session: `s-${time}`, qid: bank.questions[0].id, objective: bank.questions[0].objective, version: 1, answer: 'God', correct: true, assisted: false, skipped: false, points: 10, time, ...patch });
const answer = (q: QuizQuestion) => q.kind === 'text' || q.kind === 'memory' ? q.answer[0] : q.answer;

describe('quiz encouragement rewards', () => {
  it('keeps both preferences opt-in and rejects truthy non-booleans', () => {
    for (const input of [null, {}, { showStreak: 'true', celebrations: 1 }]) expect(parseQuizRewardPreferences(input)).toEqual({ showStreak: false, celebrations: false });
    expect(parseQuizRewardPreferences({ showStreak: true, celebrations: true, extra: 'ignored' })).toEqual({ showStreak: true, celebrations: true });
  });
  it('counts one answered practice day, including wrong or assisted answers but not skips or drafts', () => {
    const history = [attempt(date(7)), attempt(date(7), { id: 'same-day' }), attempt(date(8), { correct: false }), attempt(date(9), { assisted: true }), attempt(date(10), { skipped: true, answer: '' })];
    expect(quizPracticeStreak(history, date(10))).toEqual({ current: 3, best: 3, totalDays: 3, practicedToday: false });
    expect(quizPracticeStreak([...history, attempt(date(10), { answer: '' }), attempt(date(10), { answer: ['', ''] }), attempt(date(11)), attempt(NaN)], date(10))).toEqual(quizPracticeStreak(history, date(10)));
  });
  it('uses local calendar days across midnight, month boundaries, and daylight saving', () => {
    const history = [attempt(date(7, 23)), attempt(date(8, 1)), attempt(date(9, 1))];
    expect(quizPracticeStreak(history, date(9, 2))).toMatchObject({ current: 3, best: 3, practicedToday: true });
    const dates = [new Date(2026, 1, 28, 23).getTime(), new Date(2026, 2, 1, 1).getTime()];
    expect(quizPracticeStreak(dates.map(t => attempt(t)), dates[1])).toMatchObject({ current: 2 });
  });
  it('preserves best streak and total days after a break or replayed duplicate history', () => {
    const history = [attempt(date(1)), attempt(date(2)), attempt(date(3)), attempt(date(7)), attempt(date(8))];
    expect(quizPracticeStreak(history, date(10))).toEqual({ current: 0, best: 3, totalDays: 5, practicedToday: false });
    expect(quizPracticeStreak([...history, ...history, attempt(date(10))], date(10))).toEqual({ current: 1, best: 3, totalDays: 6, practicedToday: true });
  });
  it('deduplicates alternate forms and retains skill milestones after mistakes', () => {
    const q = bank.questions.find(q => q.id === '08-1-4')!;
    const alt = bank.questions.find(q => q.objective === q.id && q.kind === 'memory')!;
    const make = (question: QuizQuestion, time: number, patch: Partial<QuizAttempt> = {}) => attempt(time, { qid: question.id, objective: question.objective, answer: answer(question), ...patch });
    const history = [make(q, date(1)), make(q, date(9), { qid: '08-1-4-recall' }), make(q, date(10), { correct: false }), make(alt, date(1))];
    const milestones = quizRewardMilestones(bank.questions, quizStats(bank, history, date(10)));
    expect(milestones.find(g => g.id === q.skill)).toMatchObject({ learned: 2, mastered: 1, learnedTarget: 1, masteredTarget: 1, nextLearned: 5 });
    expect(milestones.find(g => g.id === 'Memory')).toMatchObject({ learned: 1, mastered: 0 });
    expect(quizRewardMilestones(bank.questions, quizStats(bank, history.map(a => ({ ...a, assisted: true })))).every(g => g.learnedTarget === 0)).toBe(true);
  });
  it('reports a finished practice session without granting credit again', () => {
    const q = bank.questions[0], session = createQuizSession(bank, [q], 'Reward fixture', 'practice', 'owner', date(1));
    const submitted = applyQuizAction(bank, session, [], { type: 'submit', qid: q.id, answer: answer(q) }, date(1));
    expect(quizCompletionReward(bank, submitted.session, submitted.attempts)).toBeNull();
    const result = applyQuizAction(bank, submitted.session, submitted.attempts, { type: 'finish' }, date(1));
    const original = JSON.stringify(result);
    expect(quizCompletionReward(bank, result.session, result.attempts, date(1))).toEqual({ sessionId: session.id, recalled: 1, learned: 1, mastered: 0 });
    expect(JSON.stringify(result)).toBe(original);
  });
  it('recognizes delayed mastery and excludes assisted, skipped, or incorrect session outcomes', () => {
    const q = bank.questions[0], session = createQuizSession(bank, [q], 'Reward fixture', 'assessment', 'owner', date(9));
    const old = attempt(date(1), { qid: q.id, objective: q.objective });
    const submitted = applyQuizAction(bank, session, [old], { type: 'submit', qid: q.id, answer: answer(q) }, date(9));
    const result = applyQuizAction(bank, submitted.session, submitted.attempts, { type: 'finish' }, date(9));
    expect(date(9) - date(1)).toBeGreaterThan(7 * DAY);
    expect(quizCompletionReward(bank, result.session, result.attempts, date(9))).toMatchObject({ recalled: 1, learned: 0, mastered: 1 });
    for (const patch of [{ assisted: true }, { skipped: true }, { correct: false }]) expect(quizCompletionReward(bank, result.session, result.attempts.map(a => a.session === session.id ? { ...a, ...patch } : a), date(9))).toBeNull();
  });
  it('does not claim mastery earned in another panel while an older session remained open', () => {
    const q = bank.questions[0], session = createQuizSession(bank, [q], 'Older session', 'practice', 'owner', date(1));
    session.done = true;
    const history = [attempt(date(1), { session: session.id }), attempt(date(9), { session: 'other-panel' })];
    expect(quizCompletionReward(bank, session, history, date(10))).toMatchObject({ recalled: 1, learned: 1, mastered: 0 });
  });
});
