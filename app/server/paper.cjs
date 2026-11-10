'use strict';
/**
 * Load midterm paper (v1.5) and strip server-only fields for students.
 */
const fs = require('node:fs');
const path = require('node:path');

const DESIGN_JSON =
  process.env.PAPER_JSON ||
  path.join(__dirname, '..', '..', 'design', '01_questions.json');

const CLIENT_ALLOW = new Set([
  'id',
  'section',
  'type',
  'lesson',
  'lessonTitle',
  'prompt',
  'options',
  'left',
  'right',
  'slots',
  'cards',
  'diagram',
  'appRef',
  'interactionSpecKey',
  'hasRecallImage',
  'estimatedMinutes',
  'stage',
  'stageId',
  'stageName',
  'recallSceneAnchor',
  'recallCaption',
  'recallImage',
  'recallImageMaxWidthPx',
  'recallImageAnimated',
]);

function loadPaper() {
  const raw = JSON.parse(fs.readFileSync(DESIGN_JSON, 'utf8'));
  if (raw.version !== '2026-11-10-midterm-v1.5') {
    console.warn('[paper] unexpected version:', raw.version);
  }
  return raw;
}

function clientQuestion(q) {
  const out = {};
  for (const key of CLIENT_ALLOW) {
    if (Object.prototype.hasOwnProperty.call(q, key) && q[key] !== undefined) {
      out[key] = q[key];
    }
  }
  return out;
}

function publicStages(stages) {
  return (stages || []).map((s) => ({
    order: s.order,
    stage: s.stage,
    stageId: s.stageId,
    stageName: s.stageName,
    lesson: s.lesson,
    questionIds: s.questionIds.slice(),
    suggestedMinutes: s.suggestedMinutes,
    unlockRule: s.unlockRule,
    clearFeedback: s.clearFeedback,
    required: !!s.required,
  }));
}

function buildClientPaper(paper) {
  return {
    version: paper.version,
    shell: paper.shell,
    paperType: paper.paperType,
    scoringPublic: {
      mode: paper.scoring.mode,
      passLine: paper.scoring.passLine,
      mainFullScore: paper.scoring.main.fullScore,
      mainQuestionCount: paper.scoring.main.questionCount,
      challengePointsPerCorrect: paper.scoring.challengePointsPerCorrect,
      challengeMaxBonus: paper.scoring.challengeMaxBonus,
      stageUnlockIndependentOfScore: paper.scoring.stageUnlockIndependentOfScore,
    },
    stages: publicStages(paper.stages),
    questions: paper.questions.map(clientQuestion),
  };
}

module.exports = {
  DESIGN_JSON,
  loadPaper,
  clientQuestion,
  buildClientPaper,
  publicStages,
};
