'use strict';
/**
 * API smoke selftest against an ephemeral DATA_DIR + random port.
 */
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createService } = require('./index.cjs');

function req(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://127.0.0.1:' + port,
          Host: '127.0.0.1:' + port,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g5mid-'));
  const svc = createService({ dataDir: tmp });
  const port = 18780 + Math.floor(Math.random() * 200);
  await new Promise((resolve) => svc.server.listen(port, '127.0.0.1', resolve));

  const logs = [];
  function ok(name, cond, detail) {
    logs.push({ name, pass: !!cond, detail: detail || '' });
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
  }

  try {
    const cfg = await req(port, 'GET', '/api/config');
    ok('config version', cfg.json.version === '2026-11-10-midterm-v1.5', cfg.json.version);
    ok('config mainQuestionCount 52', cfg.json.mainQuestionCount === 52, String(cfg.json.mainQuestionCount));

    const paper = await req(port, 'GET', '/api/paper');
    const hasAnswer = (paper.json.questions || []).some((q) => q.answer != null || q.goalIds);
    ok('paper strips answers/goalIds', !hasAnswer);
    ok('paper version v1.5', paper.json.version === '2026-11-10-midterm-v1.5', paper.json.version);
    ok(
      'paper mainQuestionCount 52',
      paper.json.scoringPublic && paper.json.scoringPublic.mainQuestionCount === 52,
      String(paper.json.scoringPublic && paper.json.scoringPublic.mainQuestionCount)
    );
    const clientMain = (paper.json.questions || []).filter((q) => q.section === 'main');
    const clientCh = (paper.json.questions || []).filter((q) => q.section === 'challenge');
    ok('client paper 52 main + 5 challenge', clientMain.length === 52 && clientCh.length === 5, clientMain.length + '+' + clientCh.length);
    const noRecallOk = clientMain
      .filter((q) => q.hasRecallImage === false)
      .every((q) => !q.recallImage && !q.recallCaption && !q.recallSceneAnchor);
    ok('no-image items have no recall fields', noRecallOk);
    const stageCounts = (paper.json.stages || [])
      .map((s) => s.stageId + ':' + s.questionIds.length)
      .join(',');
    ok(
      'stage sizes 7,7,7,7,7,8,9 + bonus 5',
      stageCounts === 'gate_l1:7,gate_l2:7,gate_l3:7,gate_l4:7,gate_l5:7,gate_l6:8,gate_l7:9,gate_bonus:5',
      stageCounts
    );

    const roster = await req(port, 'GET', '/api/roster');
    const s0 = roster.json.classes[0].students[0];

    const login = await req(port, 'POST', '/api/login', { studentId: s0.id });
    ok('login', login.status === 200 && login.json.student.name === s0.name);

    const stages = login.json.paper.stages.filter((s) => s.required);
    // Use real answers from server-side paper via grading module path — load design
    const full = require('./paper.cjs').loadPaper();
    const fullById = Object.fromEntries(full.questions.map((q) => [q.id, q]));

    for (const stage of stages) {
      const answers = {};
      for (const qid of stage.questionIds) {
        answers[qid] = fullById[qid].answer;
        await req(port, 'POST', '/api/answer', {
          studentId: s0.id,
          questionId: qid,
          answer: answers[qid],
        });
      }
      const sub = await req(port, 'POST', '/api/stage/submit', {
        studentId: s0.id,
        stageId: stage.stageId,
        answers,
      });
      ok(
        'stage ' + stage.stageId,
        sub.status === 200 && typeof sub.json.stageClearFeedback === 'string',
        sub.json.stageClearFeedback
      );
      ok(
        'feedback no answer leak ' + stage.stageId,
        !/正确选项|答案是|应选/.test(sub.json.stageClearFeedback || '')
      );
    }

    // Challenge-first on another student: entering/submitting challenge must NOT auto-submit main
    const s1 =
      roster.json.classes[0].students.find((s) => s.id !== s0.id) ||
      (roster.json.classes[1] && roster.json.classes[1].students[0]);
    ok('challenge-first peer student', !!s1, s1 && s1.name);
    await req(port, 'POST', '/api/login', { studentId: s1.id });
    for (const stage of stages) {
      const answers = {};
      for (const qid of stage.questionIds) {
        answers[qid] = fullById[qid].answer;
        await req(port, 'POST', '/api/answer', {
          studentId: s1.id,
          questionId: qid,
          answer: answers[qid],
        });
      }
      await req(port, 'POST', '/api/stage/submit', {
        studentId: s1.id,
        stageId: stage.stageId,
        answers,
      });
    }
    const beforeCh = (await req(port, 'POST', '/api/login', { studentId: s1.id })).json.progress;
    ok('challenge-first mainReady', !!beforeCh.mainReady);
    ok('challenge-first not yet mainSubmitted', !beforeCh.mainSubmitted && !beforeCh.firstSubmitMain);

    const bonusEarly = full.stages.find((s) => s.stageId === 'gate_bonus');
    const earlyAnswers = {};
    for (const qid of bonusEarly.questionIds) {
      earlyAnswers[qid] = fullById[qid].answer;
      await req(port, 'POST', '/api/answer', {
        studentId: s1.id,
        questionId: qid,
        answer: earlyAnswers[qid],
      });
    }
    const chEarly = await req(port, 'POST', '/api/challenge/submit', {
      studentId: s1.id,
      answers: earlyAnswers,
    });
    ok('challenge-first challenge +10', chEarly.status === 200 && chEarly.json.bonus === 10, String(chEarly.json && chEarly.json.bonus));
    ok(
      'challenge-first no auto main submit',
      !!(chEarly.json.progress && !chEarly.json.progress.mainSubmitted && !chEarly.json.progress.firstSubmitMain)
    );
    const mainLater = await req(port, 'POST', '/api/main/submit', { studentId: s1.id });
    ok('challenge-first main submit later', mainLater.status === 200 && mainLater.json.percent === 100);

    // Typical first-answer percent: 39/52 → 75 (third student, independent of s0/s1 perfect runs)
    const s2 = roster.json.classes[0].students.find((s) => s.id !== s0.id && (!s1 || s.id !== s1.id));
    ok('typical-score peer student', !!s2, s2 && s2.name);
    await req(port, 'POST', '/api/login', { studentId: s2.id });
    let typicalLeft = 39;
    for (const stage of stages) {
      const answers = {};
      for (const qid of stage.questionIds) {
        const q = fullById[qid];
        if (typicalLeft > 0) {
          answers[qid] = q.answer;
          typicalLeft -= 1;
        } else if (q.answer && typeof q.answer === 'object') {
          const wrong = {};
          Object.keys(q.answer).forEach((k) => {
            wrong[k] = '__wrong__';
          });
          answers[qid] = wrong;
        } else {
          answers[qid] = '__wrong__';
        }
        await req(port, 'POST', '/api/answer', {
          studentId: s2.id,
          questionId: qid,
          answer: answers[qid],
        });
      }
      await req(port, 'POST', '/api/stage/submit', {
        studentId: s2.id,
        stageId: stage.stageId,
        answers,
      });
    }
    const typMain = await req(port, 'POST', '/api/main/submit', { studentId: s2.id });
    ok(
      'typical first-answer 39/52 → 75',
      typMain.status === 200 && typMain.json.percent === 75 && typMain.json.correct === 39 && typMain.json.total === 52,
      JSON.stringify({ percent: typMain.json.percent, correct: typMain.json.correct, total: typMain.json.total })
    );

    const main = await req(port, 'POST', '/api/main/submit', { studentId: s0.id });
    ok('main submit 100', main.status === 200 && main.json.percent === 100 && main.json.total === 52, String(main.json.percent) + '/' + String(main.json.total));

    const bonus = full.stages.find((s) => s.stageId === 'gate_bonus');
    const canswers = {};
    for (const qid of bonus.questionIds) {
      canswers[qid] = fullById[qid].answer;
      await req(port, 'POST', '/api/answer', {
        studentId: s0.id,
        questionId: qid,
        answer: canswers[qid],
      });
    }
    const ch = await req(port, 'POST', '/api/challenge/submit', {
      studentId: s0.id,
      answers: canswers,
    });
    ok('challenge +10', ch.status === 200 && ch.json.bonus === 10, String(ch.json.bonus));

    const teacher = await req(port, 'GET', '/api/teacher?classId=' + (s0.classId || '501'));
    ok('teacher entered', teacher.status === 200 && teacher.json.entered >= 1);
    ok('teacher mainQuestionCount 52', teacher.json.mainQuestionCount === 52, String(teacher.json.mainQuestionCount));
    const t0 = (teacher.json.students || []).find((s) => s.id === s0.id);
    ok('teacher s0 100 + challenge later', t0 && t0.mainPercent === 100, t0 && String(t0.mainPercent));
    const t2 = (teacher.json.students || []).find((s) => s2 && s.id === s2.id);
    ok('teacher typical 75', t2 && t2.mainPercent === 75, t2 && String(t2.mainPercent));

    const failed = logs.filter((l) => !l.pass);
    console.log('---');
    console.log('passed', logs.length - failed.length, '/', logs.length);
    if (failed.length) process.exitCode = 1;
  } finally {
    svc.server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
