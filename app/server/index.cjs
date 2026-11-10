'use strict';
/**
 * 五年级《身边的算法》期中 · 算法嘉年华·站点通行证
 * 默认 PORT=8780；DATA_DIR 默认 ./data；勿占用 8766。
 * 命题版本锁定：2026-11-09-midterm-v1.4.2
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { isIP } = require('node:net');
const { DatabaseSync } = require('node:sqlite');
const { loadPaper, buildClientPaper } = require('./paper.cjs');
const { gradeSet, isAnswered, mainPercent, challengeBonus } = require('./grade.cjs');

const BASE = path.join(__dirname, '..');
const CLASSES = ['501', '502', '503', '504'];
const APP_ID = 'g5-midterm-carnival-2026';
const DEFAULT_PORT = 8780;

function fail(status, message, code) {
  throw Object.assign(new Error(message), { status, code });
}

function isPrivateAddress(address) {
  if (!address) return false;
  const ip = address.replace(/^::ffff:/i, '').split('%')[0].toLowerCase();
  if (!isIP(ip)) return false;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  if (parts.some((p) => p > 255)) return false;
  return (
    parts[0] === 127 ||
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

function emptyProgress(paper) {
  const stageAnswers = {};
  for (const s of paper.stages) {
    stageAnswers[s.stageId] = {};
  }
  return {
    currentStage: 1,
    stagesCompleted: [],
    stageAnswers,
    draftAnswers: {},
    mainSubmitted: false,
    challengeSubmitted: false,
    firstSubmitMain: null,
    firstSubmitChallenge: null,
    recentSubmitMain: null,
    recentSubmitChallenge: null,
    historyMain: [],
    historyChallenge: [],
    startedAt: null,
    lastActiveAt: null,
    challengeSkipped: false,
  };
}

function createService(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(BASE, 'data');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  const paper = options.paper || loadPaper();
  const clientPaper = buildClientPaper(paper);
  const qById = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
  const stageById = Object.fromEntries(paper.stages.map((s) => [s.stageId, s]));
  const mainQs = paper.questions.filter((q) => q.section === 'main');
  const challengeQs = paper.questions.filter((q) => q.section === 'challenge');
  const scoring = paper.scoring;

  const rosterPath =
    options.rosterPath ||
    process.env.ROSTER_PATH ||
    path.join(BASE, 'roster', 'roster.json');
  const rosterSource = options.roster || JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const roster = Array.isArray(rosterSource)
    ? rosterSource
    : (rosterSource.classes || []).flatMap((g) =>
        g.students.map((s) => ({ ...s, classId: g.id }))
      );

  const db = new DatabaseSync(path.join(dataDir, 'carnival.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY, classId TEXT NOT NULL, name TEXT NOT NULL, manual INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS states(studentId TEXT PRIMARY KEY, json TEXT NOT NULL, lastSync TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(studentId TEXT NOT NULL, eventId TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(studentId, eventId));`);

  const rosterIds = new Set();
  const insertStudent = db.prepare(
    'INSERT INTO students VALUES(?,?,?,0) ON CONFLICT(id) DO UPDATE SET classId=excluded.classId,name=excluded.name,manual=0'
  );
  for (const student of roster) {
    if (
      !student.id ||
      !CLASSES.includes(String(student.classId)) ||
      typeof student.name !== 'string' ||
      !student.name.trim() ||
      rosterIds.has(String(student.id))
    ) {
      throw new Error('名单中的班级、学生标识或姓名不完整或重复');
    }
    rosterIds.add(String(student.id));
    insertStudent.run(String(student.id), String(student.classId), student.name.trim());
  }

  const now = () => new Date().toISOString();

  function studentById(id) {
    return db.prepare('SELECT id,classId,name,manual FROM students WHERE id=?').get(String(id || ''));
  }

  function allStudents() {
    return db
      .prepare('SELECT id,classId,name,manual FROM students ORDER BY classId,rowid')
      .all()
      .filter((s) => rosterIds.has(s.id) || s.manual);
  }

  function classes() {
    return CLASSES.map((id) => ({
      id,
      students: allStudents()
        .filter((s) => s.classId === id)
        .map(({ id: sid, name, classId: cid }) => ({ id: sid, name, classId: cid })),
    }));
  }

  function recordFor(id) {
    const row = db.prepare('SELECT * FROM states WHERE studentId=?').get(id);
    if (!row) return { state: null, lastSync: null, entered: false };
    return { state: JSON.parse(row.json), lastSync: row.lastSync, entered: true };
  }

  function save(id, state) {
    state.lastActiveAt = now();
    if (!state.startedAt) state.startedAt = state.lastActiveAt;
    db.prepare(
      'INSERT INTO states VALUES(?,?,?) ON CONFLICT(studentId) DO UPDATE SET json=excluded.json,lastSync=excluded.lastSync'
    ).run(id, JSON.stringify(state), state.lastActiveAt);
    return state;
  }

  function ensureState(id) {
    const rec = recordFor(id);
    if (rec.state) return rec.state;
    return emptyProgress(paper);
  }

  function stageAnsweredCount(state, stageId) {
    const stage = stageById[stageId];
    if (!stage) return { answeredCount: 0, questionCount: 0 };
    const answers = Object.assign({}, state.draftAnswers || {}, (state.stageAnswers || {})[stageId] || {});
    let answered = 0;
    for (const qid of stage.questionIds) {
      if (isAnswered(answers[qid], qById[qid])) answered += 1;
    }
    return { answeredCount: answered, questionCount: stage.questionIds.length };
  }

  function unlockedStageIds(state) {
    const completed = new Set(state.stagesCompleted || []);
    const out = [];
    for (const s of paper.stages) {
      if (s.unlockRule === 'start') {
        out.push(s.stageId);
        continue;
      }
      if (s.stageId === 'gate_bonus') {
        const mains = paper.stages.filter((x) => x.required);
        if (mains.every((m) => completed.has(m.stageId))) out.push(s.stageId);
        continue;
      }
      const prev = paper.stages.find((x) => x.order === s.order - 1);
      if (prev && completed.has(prev.stageId)) out.push(s.stageId);
    }
    return out;
  }

  function publicProgress(state) {
    const unlocked = unlockedStageIds(state);
    const stageProgress = paper.stages.map((s) => {
      const c = stageAnsweredCount(state, s.stageId);
      return {
        stageId: s.stageId,
        stage: s.stage,
        stageName: s.stageName,
        answeredCount: c.answeredCount,
        questionCount: c.questionCount,
        completed: (state.stagesCompleted || []).includes(s.stageId),
        unlocked: unlocked.includes(s.stageId),
        required: !!s.required,
      };
    });
    const mainDone = paper.stages.filter((s) => s.required).every((s) => (state.stagesCompleted || []).includes(s.stageId));
    return {
      currentStage: state.currentStage,
      stagesCompleted: state.stagesCompleted || [],
      stageProgress,
      unlockedStageIds: unlocked,
      mainReady: mainDone,
      mainSubmitted: !!state.mainSubmitted,
      challengeSubmitted: !!state.challengeSubmitted,
      challengeSkipped: !!state.challengeSkipped,
      firstSubmitMain: state.firstSubmitMain
        ? {
            percent: state.firstSubmitMain.percent,
            correct: state.firstSubmitMain.correct,
            total: state.firstSubmitMain.total,
            at: state.firstSubmitMain.at,
          }
        : null,
      firstSubmitChallenge: state.firstSubmitChallenge
        ? {
            bonus: state.firstSubmitChallenge.bonus,
            correct: state.firstSubmitChallenge.correct,
            total: state.firstSubmitChallenge.total,
            at: state.firstSubmitChallenge.at,
          }
        : null,
      draftAnswers: state.draftAnswers || {},
      startedAt: state.startedAt,
      lastActiveAt: state.lastActiveAt,
    };
  }

  function teacherGuard(req) {
    const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/i, '');
    if (!isPrivateAddress(ip) && ip !== '127.0.0.1' && ip !== '::1') {
      fail(403, '教师大屏仅限本机或局域网访问');
    }
  }

  function checkOrigin(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, '请从本课堂网址直接操作');
    if (req.headers.origin) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        fail(403, '来源网址无效');
      }
      if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) {
        fail(403, '请从本课堂网址直接操作');
      }
    }
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > 2e6) {
          reject(Object.assign(new Error('请求过大'), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(Object.assign(new Error('JSON 无效'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  function json(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  }

  function teacherData(classId) {
    const students = allStudents().filter((s) => !classId || s.classId === classId);
    const rows = students.map((s) => {
      const rec = recordFor(s.id);
      const st = rec.state;
      const prog = st ? publicProgress(st) : null;
      const first = st && st.firstSubmitMain;
      const ch = st && st.firstSubmitChallenge;
      const byLesson = {};
      const byStage = {};
      if (first && first.detail) {
        for (const d of first.detail) {
          const L = 'L' + d.lesson;
          if (!byLesson[L]) byLesson[L] = { correct: 0, total: 0 };
          byLesson[L].total += 1;
          if (d.correct) byLesson[L].correct += 1;
          if (!byStage[d.stageId]) byStage[d.stageId] = { correct: 0, total: 0 };
          byStage[d.stageId].total += 1;
          if (d.correct) byStage[d.stageId].correct += 1;
        }
      }
      return {
        id: s.id,
        classId: s.classId,
        name: s.name,
        entered: !!rec.entered,
        stagesCompleted: prog ? prog.stagesCompleted.length : 0,
        mainPercent: first ? first.percent : null,
        challengeBonus: ch ? ch.bonus : null,
        mainSubmitted: !!(st && st.mainSubmitted),
        challengeSubmitted: !!(st && st.challengeSubmitted),
        byLesson,
        byStage,
        lastActiveAt: st ? st.lastActiveAt : null,
      };
    });
    const entered = rows.filter((r) => r.entered).length;
    const submitted = rows.filter((r) => r.mainSubmitted).length;
    const withPercent = rows.filter((r) => r.mainPercent != null);
    const avg =
      withPercent.length === 0
        ? null
        : Math.round(withPercent.reduce((a, r) => a + r.mainPercent, 0) / withPercent.length);
    return {
      appId: APP_ID,
      paperVersion: paper.version,
      classId: classId || null,
      denominator: students.length,
      entered,
      notEntered: students.length - entered,
      mainSubmitted: submitted,
      avgMainPercent: avg,
      students: rows,
      stages: paper.stages.map((s) => ({
        stageId: s.stageId,
        stageName: s.stageName,
        questionCount: s.questionIds.length,
        required: !!s.required,
      })),
      passLine: null,
      updatedAt: now(),
    };
  }

  async function handleApi(req, res, route, url) {
    checkOrigin(req);

    if (route.startsWith('/api/teacher')) teacherGuard(req);

    if (req.method === 'GET' && route === '/api/config') {
      return json(res, 200, {
        appId: APP_ID,
        shell: paper.shell,
        version: paper.version,
        passLine: null,
        suggestedMinutes: 30,
        classes: CLASSES,
      });
    }

    if (req.method === 'GET' && route === '/api/roster') {
      return json(res, 200, { classes: classes(), total: rosterIds.size });
    }

    if (req.method === 'GET' && route === '/api/paper') {
      // student-safe paper (no answers)
      return json(res, 200, clientPaper);
    }

    if (req.method === 'GET' && route === '/api/state') {
      const sid = url.searchParams.get('studentId');
      const row = studentById(sid);
      if (!row) fail(404, '学生不存在');
      const state = ensureState(row.id);
      return json(res, 200, {
        student: { id: row.id, classId: row.classId, name: row.name },
        progress: publicProgress(state),
      });
    }

    if (req.method === 'GET' && route === '/api/teacher') {
      return json(res, 200, teacherData(url.searchParams.get('classId')));
    }

    if (req.method === 'POST' && route === '/api/login') {
      const body = await readBody(req);
      let row = null;
      if (body.studentId) {
        row = studentById(body.studentId);
      } else if (body.classId && body.name) {
        row = allStudents().find(
          (s) => s.classId === String(body.classId) && s.name === String(body.name).trim()
        );
      }
      if (!row && body.classId && body.name && body.manual) {
        // allow manual name into class
        const id = 'manual-' + String(body.classId) + '-' + Buffer.from(String(body.name).trim()).toString('hex').slice(0, 16);
        db.prepare(
          'INSERT INTO students VALUES(?,?,?,1) ON CONFLICT(id) DO UPDATE SET classId=excluded.classId,name=excluded.name,manual=1'
        ).run(id, String(body.classId), String(body.name).trim());
        row = studentById(id);
      }
      if (!row) fail(404, '找不到该学生');
      let state = ensureState(row.id);
      if (!recordFor(row.id).entered) {
        state = save(row.id, state);
      } else {
        state = save(row.id, state);
      }
      return json(res, 200, {
        student: { id: row.id, classId: row.classId, name: row.name },
        progress: publicProgress(state),
        paper: clientPaper,
      });
    }

    if (req.method === 'POST' && route === '/api/answer') {
      // save draft answer within a stage (no grading feedback that leaks)
      const body = await readBody(req);
      const row = studentById(body.studentId);
      if (!row) fail(404, '学生不存在');
      const q = qById[body.questionId];
      if (!q) fail(404, '题目不存在');
      const unlocked = unlockedStageIds(ensureState(row.id));
      if (!unlocked.includes(q.stageId)) fail(403, '该站点尚未解锁');
      const state = ensureState(row.id);
      if (!state.draftAnswers) state.draftAnswers = {};
      state.draftAnswers[q.id] = body.answer;
      state.currentStage = q.stage;
      save(row.id, state);
      return json(res, 200, { ok: true, progress: publicProgress(state) });
    }

    if (req.method === 'POST' && route === '/api/stage/submit') {
      const body = await readBody(req);
      const row = studentById(body.studentId);
      if (!row) fail(404, '学生不存在');
      const stage = stageById[body.stageId];
      if (!stage) fail(404, '站点不存在');
      const state = ensureState(row.id);
      const unlocked = unlockedStageIds(state);
      if (!unlocked.includes(stage.stageId)) fail(403, '该站点尚未解锁');

      // merge drafts into stage answers
      if (!state.stageAnswers[stage.stageId]) state.stageAnswers[stage.stageId] = {};
      const merged = Object.assign({}, state.stageAnswers[stage.stageId]);
      for (const qid of stage.questionIds) {
        if (state.draftAnswers && state.draftAnswers[qid] !== undefined) {
          merged[qid] = state.draftAnswers[qid];
        }
        if (body.answers && body.answers[qid] !== undefined) {
          merged[qid] = body.answers[qid];
        }
      }
      // require all answered
      for (const qid of stage.questionIds) {
        if (!isAnswered(merged[qid], qById[qid])) {
          fail(400, '本关还有题目未作答');
        }
      }
      state.stageAnswers[stage.stageId] = merged;
      if (!state.stagesCompleted.includes(stage.stageId)) {
        state.stagesCompleted.push(stage.stageId);
      }
      // advance currentStage hint
      const next = paper.stages.find((s) => s.order === stage.order + 1);
      if (next) state.currentStage = next.stage;
      save(row.id, state);
      // Overpass feedback: ONLY approved clearFeedback — no answers
      return json(res, 200, {
        ok: true,
        stageId: stage.stageId,
        stageClearFeedback: stage.clearFeedback,
        progress: publicProgress(state),
      });
    }

    if (req.method === 'POST' && route === '/api/main/submit') {
      const body = await readBody(req);
      const row = studentById(body.studentId);
      if (!row) fail(404, '学生不存在');
      const state = ensureState(row.id);
      const mains = paper.stages.filter((s) => s.required);
      for (const s of mains) {
        if (!state.stagesCompleted.includes(s.stageId)) fail(400, '请先完成主卷七站');
      }
      const answers = {};
      for (const s of mains) {
        Object.assign(answers, state.stageAnswers[s.stageId] || {});
      }
      const graded = gradeSet(mainQs, answers);
      const percent = mainPercent(graded.correct, scoring.main.questionCount);
      const snapshot = {
        at: now(),
        percent,
        correct: graded.correct,
        total: graded.total,
        detail: graded.detail,
        answers,
      };
      if (!state.firstSubmitMain) {
        state.firstSubmitMain = snapshot;
      }
      state.recentSubmitMain = snapshot;
      state.historyMain = (state.historyMain || []).concat([{ at: snapshot.at, percent, correct: graded.correct }]);
      state.mainSubmitted = true;
      save(row.id, state);
      return json(res, 200, {
        ok: true,
        first: !state.historyMain || state.historyMain.length <= 1,
        percent: state.firstSubmitMain.percent,
        correct: state.firstSubmitMain.correct,
        total: state.firstSubmitMain.total,
        recentPercent: percent,
        progress: publicProgress(state),
      });
    }

    if (req.method === 'POST' && route === '/api/challenge/submit') {
      const body = await readBody(req);
      const row = studentById(body.studentId);
      if (!row) fail(404, '学生不存在');
      const state = ensureState(row.id);
      const mains = paper.stages.filter((s) => s.required);
      if (!mains.every((s) => state.stagesCompleted.includes(s.stageId))) {
        fail(400, '请先完成主卷七站');
      }
      const bonusStage = stageById.gate_bonus;
      if (!state.stageAnswers[bonusStage.stageId]) state.stageAnswers[bonusStage.stageId] = {};
      const merged = Object.assign({}, state.stageAnswers[bonusStage.stageId]);
      for (const qid of bonusStage.questionIds) {
        if (state.draftAnswers && state.draftAnswers[qid] !== undefined) merged[qid] = state.draftAnswers[qid];
        if (body.answers && body.answers[qid] !== undefined) merged[qid] = body.answers[qid];
      }
      for (const qid of bonusStage.questionIds) {
        if (!isAnswered(merged[qid], qById[qid])) fail(400, '挑战关还有题目未作答');
      }
      state.stageAnswers[bonusStage.stageId] = merged;
      if (!state.stagesCompleted.includes(bonusStage.stageId)) {
        state.stagesCompleted.push(bonusStage.stageId);
      }
      const graded = gradeSet(challengeQs, merged);
      const bonus = challengeBonus(
        graded.correct,
        scoring.challengePointsPerCorrect,
        scoring.challengeMaxBonus
      );
      const snapshot = {
        at: now(),
        bonus,
        correct: graded.correct,
        total: graded.total,
        detail: graded.detail,
        answers: merged,
      };
      if (!state.firstSubmitChallenge) state.firstSubmitChallenge = snapshot;
      state.recentSubmitChallenge = snapshot;
      state.historyChallenge = (state.historyChallenge || []).concat([
        { at: snapshot.at, bonus, correct: graded.correct },
      ]);
      state.challengeSubmitted = true;
      save(row.id, state);
      return json(res, 200, {
        ok: true,
        bonus: state.firstSubmitChallenge.bonus,
        correct: state.firstSubmitChallenge.correct,
        total: state.firstSubmitChallenge.total,
        recentBonus: bonus,
        progress: publicProgress(state),
        stageClearFeedback: bonusStage.clearFeedback,
      });
    }

    if (req.method === 'POST' && route === '/api/challenge/skip') {
      const body = await readBody(req);
      const row = studentById(body.studentId);
      if (!row) fail(404, '学生不存在');
      const state = ensureState(row.id);
      state.challengeSkipped = true;
      save(row.id, state);
      return json(res, 200, { ok: true, progress: publicProgress(state) });
    }

    fail(404, '接口不存在');
  }

  function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return (
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
        '.map': 'application/json',
      }[ext] || 'application/octet-stream'
    );
  }

  function sendFile(res, filePath) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-cache' });
    res.end(data);
    return true;
  }

  const distDir = path.join(BASE, 'client', 'dist');
  const publicDir = path.join(BASE, 'public');

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
      let route = decodeURIComponent(url.pathname);
      if (route.length > 1 && route.endsWith('/')) route = route.slice(0, -1);

      if (route.startsWith('/api/')) {
        return await handleApi(req, res, route, url);
      }

      // static assets
      const safeJoin = (root, rel) => {
        const p = path.normalize(path.join(root, rel));
        if (!p.startsWith(root)) return null;
        return p;
      };

      if (route.startsWith('/assets/')) {
        const p1 = safeJoin(distDir, route);
        const p2 = safeJoin(publicDir, route);
        if (p1 && sendFile(res, p1)) return;
        if (p2 && sendFile(res, p2)) return;
      }

      // SPA routes
      const spa = new Set(['/', '/teacher', '/index.html', '/teacher.html', '/map', '/stage', '/result']);
      if (spa.has(route) || route.startsWith('/stage/') || route === '/teacher/') {
        const index = path.join(distDir, 'index.html');
        if (sendFile(res, index)) return;
        // fallback minimal HTML if not built yet
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!doctype html><meta charset=utf-8><title>算法嘉年华</title><p>请先构建客户端：cd client && npm install && npm run build</p>'
        );
        return;
      }

      const fromDist = safeJoin(distDir, route);
      if (fromDist && sendFile(res, fromDist)) return;
      const fromPub = safeJoin(publicDir, route);
      if (fromPub && sendFile(res, fromPub)) return;

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } catch (err) {
      const status = err.status || 500;
      json(res, status, { error: err.message || '服务器错误', code: err.code || null });
    }
  });

  function listen(port = Number(process.env.PORT) || DEFAULT_PORT) {
    return new Promise((resolve) => {
      server.listen(port, '0.0.0.0', () => {
        console.log(`[${APP_ID}] 命题 ${paper.version}`);
        console.log(`学生端： http://127.0.0.1:${port}/`);
        console.log(`教师大屏： http://127.0.0.1:${port}/teacher （免密，仅局域网）`);
        console.log(`DATA_DIR=${dataDir}`);
        resolve(server);
      });
    });
  }

  return { server, listen, paper, clientPaper, db, dataDir };
}

if (require.main === module) {
  createService().listen().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { createService };
