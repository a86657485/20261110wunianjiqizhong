'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPaper } = require('./paper.cjs');
const { gradeOne, gradeSet, mainPercent, challengeBonus, isAnswered } = require('./grade.cjs');

const paper = loadPaper();
assert.equal(paper.version, '2026-11-09-midterm-v1.4.2');
const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));

test('single_choice full-text equality', () => {
  const q = byId.M01;
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(gradeOne(q, '只有写出程序代码才叫算法').correct, false);
});

test('matching one-to-one', () => {
  const q = byId.M03;
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(gradeOne(q, {}).correct, false);
});

test('flowchart_fill_triple accepts alternate', () => {
  const q = byId.M17;
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(gradeOne(q, q.acceptAlternate).correct, true);
  assert.equal(gradeOne(q, { diamond: '积分＞80', yes: '升级', no: '不升级' }).correct, false);
});

test('flowchart_order_cards', () => {
  const q = byId.M08;
  assert.equal(gradeOne(q, q.answer).correct, true);
});

test('isAnswered for matching requires all left', () => {
  const q = byId.M03;
  assert.equal(isAnswered({ [q.left[0]]: q.right[0] }, q), false);
  assert.equal(isAnswered(q.answer, q), true);
});

test('main percent rounding', () => {
  assert.equal(mainPercent(24, 24), 100);
  assert.equal(mainPercent(18, 24), 75);
  assert.equal(mainPercent(0, 24), 0);
});

test('challenge bonus capped at 10', () => {
  assert.equal(challengeBonus(5, 2, 10), 10);
  assert.equal(challengeBonus(3, 2, 10), 6);
});

test('perfect main set grades 24', () => {
  const main = paper.questions.filter((q) => q.section === 'main');
  const answers = {};
  for (const q of main) answers[q.id] = q.answer;
  const g = gradeSet(main, answers);
  assert.equal(g.correct, 24);
});

test('client paper strips answers', () => {
  const { buildClientPaper } = require('./paper.cjs');
  const client = buildClientPaper(paper);
  for (const q of client.questions) {
    assert.equal(q.answer, undefined);
    assert.equal(q.goalIds, undefined);
    assert.equal(q.analysis, undefined);
    assert.equal(q.recallImagePrompt, undefined);
  }
  // clearFeedback present for stages (v1.4.2 short encouraging)
  assert.ok(client.stages[0].clearFeedback.indexOf('通关') >= 0);
  assert.ok(!/正确选项|正确答案/.test(client.stages.map((s) => s.clearFeedback).join('')));
});
