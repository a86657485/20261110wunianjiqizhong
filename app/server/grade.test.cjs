'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPaper } = require('./paper.cjs');
const { gradeOne, gradeSet, mainPercent, challengeBonus, isAnswered } = require('./grade.cjs');

const paper = loadPaper();
assert.equal(paper.version, '2026-11-10-midterm-v1.5');
assert.equal(paper.scoring.main.questionCount, 52);
assert.equal(paper.scoring.challenge.questionCount, 5);
const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
const mainQs = paper.questions.filter((q) => q.section === 'main');
const challengeQs = paper.questions.filter((q) => q.section === 'challenge');
assert.equal(mainQs.length, 52);
assert.equal(challengeQs.length, 5);

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

test('main percent rounding uses 52', () => {
  assert.equal(mainPercent(52, 52), 100);
  assert.equal(mainPercent(39, 52), 75);
  assert.equal(mainPercent(26, 52), 50);
  assert.equal(mainPercent(40, 52), 77);
  assert.equal(mainPercent(0, 52), 0);
});

test('challenge bonus +2 and capped at 10', () => {
  assert.equal(challengeBonus(1, 2, 10), 2);
  assert.equal(challengeBonus(5, 2, 10), 10);
  assert.equal(challengeBonus(3, 2, 10), 6);
});

test('perfect main set grades 52/52 → 100', () => {
  const answers = {};
  for (const q of mainQs) answers[q.id] = q.answer;
  const g = gradeSet(mainQs, answers);
  assert.equal(g.correct, 52);
  assert.equal(g.total, 52);
  assert.equal(mainPercent(g.correct, paper.scoring.main.questionCount), 100);
});

test('typical first-answer set grades 39/52 → 75', () => {
  const answers = {};
  mainQs.forEach((q, i) => {
    if (i < 39) answers[q.id] = q.answer;
    else if (typeof q.answer === 'string') answers[q.id] = '__wrong__';
    else answers[q.id] = {};
  });
  const g = gradeSet(mainQs, answers);
  assert.equal(g.correct, 39);
  assert.equal(mainPercent(g.correct, paper.scoring.main.questionCount), 75);
});

test('M36 / M48 / M52 grade by interaction', () => {
  assert.equal(gradeOne(byId.M36, byId.M36.answer).correct, true);
  assert.equal(gradeOne(byId.M48, byId.M48.answer).correct, true);
  assert.equal(gradeOne(byId.M48, byId.M48.acceptAlternate).correct, true);
  assert.equal(gradeOne(byId.M52, byId.M52.answer).correct, true);
  assert.equal(gradeOne(byId.M52, '接到「结束」').correct, false);
});

test('client paper strips answers and flags no-recall items', () => {
  const { buildClientPaper } = require('./paper.cjs');
  const client = buildClientPaper(paper);
  assert.equal(client.version, '2026-11-10-midterm-v1.5');
  assert.equal(client.scoringPublic.mainQuestionCount, 52);
  for (const q of client.questions) {
    assert.equal(q.answer, undefined);
    assert.equal(q.goalIds, undefined);
    assert.equal(q.analysis, undefined);
    assert.equal(q.recallImagePrompt, undefined);
  }
  const m25 = client.questions.find((q) => q.id === 'M25');
  assert.equal(m25.hasRecallImage, false);
  assert.equal(m25.recallImage, undefined);
  assert.equal(m25.recallCaption, undefined);
  const m01 = client.questions.find((q) => q.id === 'M01');
  assert.ok(m01.recallImage);
  assert.ok(client.stages[0].clearFeedback.indexOf('通关') >= 0);
  assert.ok(!/正确选项|正确答案/.test(client.stages.map((s) => s.clearFeedback).join('')));
  const counts = Object.fromEntries(
    client.stages.map((s) => [s.stageId, s.questionIds.length])
  );
  assert.deepEqual(counts, {
    gate_l1: 7,
    gate_l2: 7,
    gate_l3: 7,
    gate_l4: 7,
    gate_l5: 7,
    gate_l6: 8,
    gate_l7: 9,
    gate_bonus: 5,
  });
});
