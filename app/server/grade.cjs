'use strict';
/**
 * Server-side grading for midterm carnival stages.
 * No answer leakage — only used after submit.
 */

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeMatching(map) {
  if (!map || typeof map !== 'object') return null;
  const out = {};
  for (const k of Object.keys(map).sort()) {
    out[k] = map[k];
  }
  return out;
}

function gradeOne(question, studentAnswer) {
  const key = question.interactionSpecKey || question.type;
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return { correct: false, reason: 'empty' };
  }

  switch (key) {
    case 'single_choice':
    case 'app_op_choice':
    case 'flowchart_pick_invalid':
    case 'flowchart_back_edge':
    case 'flowchart_fix_choice': {
      const ok = String(studentAnswer) === String(question.answer);
      return { correct: ok };
    }
    case 'matching':
    case 'matching_one_to_one': {
      const a = normalizeMatching(studentAnswer);
      const b = normalizeMatching(question.answer);
      return { correct: deepEqual(a, b) };
    }
    case 'flowchart_order_cards':
    case 'flowchart_fill_triple': {
      const a = normalizeMatching(studentAnswer);
      const primary = normalizeMatching(question.answer);
      if (deepEqual(a, primary)) return { correct: true };
      if (question.acceptAlternate) {
        const alt = normalizeMatching(question.acceptAlternate);
        if (deepEqual(a, alt)) return { correct: true };
      }
      return { correct: false };
    }
    default: {
      // fallback: string equality or object equality
      if (typeof question.answer === 'string') {
        return { correct: String(studentAnswer) === question.answer };
      }
      return { correct: deepEqual(normalizeMatching(studentAnswer), normalizeMatching(question.answer)) };
    }
  }
}

function isAnswered(answer, question) {
  if (answer === undefined || answer === null || answer === '') return false;
  const key = question.interactionSpecKey || question.type;
  if (key === 'matching' || key === 'matching_one_to_one' || key === 'flowchart_order_cards' || key === 'flowchart_fill_triple') {
    if (typeof answer !== 'object') return false;
    const need = question.left
      ? question.left.length
      : question.slots
        ? question.slots.length
        : 0;
    const filled = Object.keys(answer).filter((k) => answer[k] != null && answer[k] !== '').length;
    return need > 0 ? filled >= need : filled > 0;
  }
  return true;
}

function gradeSet(questions, answersMap) {
  let correct = 0;
  const detail = [];
  for (const q of questions) {
    const ans = answersMap[q.id];
    const g = gradeOne(q, ans);
    if (g.correct) correct += 1;
    detail.push({ id: q.id, correct: !!g.correct, lesson: q.lesson, type: q.type, stageId: q.stageId });
  }
  return { correct, total: questions.length, detail };
}

function mainPercent(correctCount, total) {
  if (!total) return 0;
  return Math.round((correctCount / total) * 100);
}

function challengeBonus(correctCount, pointsPer, maxBonus) {
  const raw = correctCount * pointsPer;
  return Math.min(raw, maxBonus);
}

module.exports = {
  gradeOne,
  gradeSet,
  isAnswered,
  mainPercent,
  challengeBonus,
};
