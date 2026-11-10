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
    ok('config version', cfg.json.version === '2026-11-09-midterm-v1.4.2', cfg.json.version);

    const paper = await req(port, 'GET', '/api/paper');
    const hasAnswer = (paper.json.questions || []).some((q) => q.answer != null || q.goalIds);
    ok('paper strips answers/goalIds', !hasAnswer);

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

    const main = await req(port, 'POST', '/api/main/submit', { studentId: s0.id });
    ok('main submit 100', main.status === 200 && main.json.percent === 100, String(main.json.percent));

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
