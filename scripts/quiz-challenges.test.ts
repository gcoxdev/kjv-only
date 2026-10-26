import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIBLE_BOOKS } from '@/lib/bible-books';
import { parseQuizBank } from '@/lib/quiz/data';
import { applyQuizAction, createQuizSession, filterQuizQuestions, gradeQuizAnswer, normalizeMemoryAnswer, quizStats, selectQuizQuestions, validQuizAnswer } from '@/lib/quiz/engine';
import { validSnapshot, parseQuizBackup } from '@/lib/quiz/storage';
import { QUIZ_COVERAGE_RELEASES } from '@/lib/quiz/releases';
import type { QuizFilters } from '@/lib/quiz/types';

const bank = parseQuizBank(JSON.parse(readFileSync('public/data/quiz-pilot-v1.json', 'utf8')));
const memory = bank.questions.filter(q => q.kind === 'memory');
const orders = bank.questions.filter(q => q.practiceSet === 'book-order');
const now = 1_790_000_000_000;
const filters: QuizFilters = { scope: 'bible', book: 'Genesis', chapter: 1, skill: 'all', difficulty: 'all', readOnly: false };

describe('optional memory and complete book order', () => {
  it('publishes complete KJV verses and canonical lists outside the frozen core release', () => {
    expect(memory).toHaveLength(12); expect(orders).toHaveLength(3);
    for (const q of memory) {
      expect(q.answer).toEqual([q.refs[0].verses[0].text]);
      expect(q.refs[0].verses).toHaveLength(1);
      expect(validQuizAnswer(q, q.answer[0])).toBe(true);
    }
    const names = BIBLE_BOOKS.map(b => b.name);
    expect(orders.map(q => q.answer)).toEqual([names.slice(0, 39), names.slice(39), names]);
    const core = new Set(Object.values(QUIZ_COVERAGE_RELEASES[0].groups).flat().map(([id]) => id));
    expect([...memory, ...orders].every(q => !core.has(q.objective))).toBe(true);
  });
  it('does not introduce optional exercises through normal scope or reading filters', () => {
    for (const scope of ['chapter', 'book', 'OT', 'NT', 'bible'] as const) {
      const pool = filterQuizQuestions(bank, { ...filters, scope }, new Set());
      expect(pool.length).toBeGreaterThan(0); expect(pool.every(q => !q.practiceSet)).toBe(true);
    }
    expect(filterQuizQuestions(bank, filters, new Set())).toHaveLength(8971);
  });
  it('requires exact words and order while tolerating formatting, not synonyms', () => {
    const q = memory.find(q => q.id === 'memory-01-1-1')!;
    expect(gradeQuizAnswer(q, ' IN THE BEGINNING,\nGOD CREATED THE HEAVEN AND THE EARTH! ')).toBe(true);
    for (const value of ['In the beginning God created the heavens and the earth.', 'In the beginning God made the heaven and the earth.', 'God created the heaven and the earth.', 'In the beginning God created the earth and the heaven.']) expect(gradeQuizAnswer(q, value)).toBe(false);
    expect(gradeQuizAnswer(q, q.answer)).toBe(false);
    expect(normalizeMemoryAnswer('“God’s” — word')).toBe('gods word');
    expect(validQuizAnswer(q, 'a'.repeat(501))).toBe(false);
  });
  it('keeps memory evidence and conflicting ordering exercises out of the same session', () => {
    for (const q of [...memory, ...orders]) {
      const conflicts = bank.questions.filter(other => q.conflicts.includes(other.id));
      for (const other of conflicts) {
        expect(selectQuizQuestions(bank, [q, other], [], 2, () => 0.5)).toHaveLength(1);
        expect(selectQuizQuestions(bank, [other, q], [], 2, () => 0.5)).toHaveLength(1);
      }
    }
  });
  it('preserves 66-book arrangements through save and backup validation', () => {
    const q = orders.find(q => q.scopeLevel === 'bible')!;
    const session = createQuizSession(bank, [q], 'Whole Bible order', 'practice', 'test', now);
    expect(validQuizAnswer(q, session.entries[0].answer)).toBe(true);
    expect(gradeQuizAnswer(q, session.entries[0].answer)).toBe(false);
    const result = applyQuizAction(bank, session, [], { type: 'submit', qid: q.id, answer: q.answer }, now + 1);
    const snapshot = { sessions: [result.session], attempts: result.attempts };
    expect(validSnapshot(snapshot, bank)).toBe(true);
    expect(parseQuizBackup({ type: 'kjv-only-quiz', schema: 1, bank: bank.version, exported: new Date(now).toISOString(), ...snapshot }, bank).attempts).toHaveLength(1);
    expect(validQuizAnswer(q, Array(66).fill('Genesis'))).toBe(false);
  });
  it('tracks memory credit and assisted answers with the existing reward and review rules', () => {
    const q = memory[0], session = createQuizSession(bank, [q], 'Memory', 'practice', 'test', now);
    const success = applyQuizAction(bank, session, [], { type: 'submit', qid: q.id, answer: q.answer[0] }, now + 1);
    expect(success.attempts[0]).toMatchObject({ correct: true, assisted: false, points: 20 });
    expect(quizStats(bank, success.attempts, now + 2).get(q.objective)?.learned).toBe(true);
    const helped = applyQuizAction(bank, session, [], { type: 'help', qid: q.id, help: 'passage' }, now + 1);
    const result = applyQuizAction(bank, helped.session, [], { type: 'submit', qid: q.id, answer: q.answer[0] }, now + 2);
    expect(result.attempts[0]).toMatchObject({ correct: true, assisted: true, points: 0 });
  });
  it('rejects optional content with invalid kinds, multiple memory answers, or incomplete book lists', () => {
    const mutations = [
      (q: Record<string, unknown>) => { q.practiceSet = 'unknown'; },
      (q: Record<string, unknown>) => { q.answer = ['first', 'second']; },
      (q: Record<string, unknown>) => { q.kind = 'text'; },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(bank); const q = copy.questions.find(q => q.id === memory[0].id)!;
      mutate(q); expect(() => parseQuizBank(copy)).toThrow();
    }
    const copy = structuredClone(bank); copy.questions.find(q => q.id === orders[0].id)!.answer = ['Genesis'];
    expect(() => parseQuizBank(copy)).toThrow();
  });
});
