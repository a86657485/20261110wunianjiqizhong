// 局域网全端可达性检查：学生端、教师屏、静态资源与全部 API
// 用法：node lan-endpoints.mjs                              （默认查 8780 正式实例，只读）
//       BASE=http://10.9.129.17:8899 WRITE=1 node lan-endpoints.mjs  （查测试实例，含登录写操作）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://10.9.129.17:8780';
const WRITE = process.env.WRITE === '1';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
}

async function get(p) {
  const r = await fetch(BASE + p);
  const text = await r.text();
  return { status: r.status, text, type: r.headers.get('content-type') || '' };
}

async function post(p, body) {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, text };
}

console.log('目标：' + BASE + (WRITE ? '（含写操作）' : '（只读）'));

// 1. 页面与静态资源
const student = await get('/');
check('学生端 / 200', student.status === 200, String(student.status));
check('学生端是 SPA 入口', /<div id="root">/.test(student.text));
const js = student.text.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
const css = student.text.match(/\/assets\/index-[A-Za-z0-9_-]+\.css/);
check('学生端引用构建 JS', !!js, js && js[0]);
check('学生端引用构建 CSS', !!css, css && css[0]);
if (js) {
  const r = await get(js[0]);
  check('JS 资源 200 且体积正常', r.status === 200 && r.text.length > 50000, `${r.status} ${(r.text.length / 1024).toFixed(0)}KB`);
}
if (css) {
  const r = await get(css[0]);
  check('CSS 资源 200', r.status === 200, `${r.status} ${r.text.length}B`);
}
const teacher = await get('/teacher');
check('教师大屏 /teacher 200', teacher.status === 200, String(teacher.status));
check('教师大屏是同一 SPA 入口', /<div id="root">/.test(teacher.text));
for (const p of ['/stage/gate_l1', '/teacher/']) {
  const r = await get(p);
  check(`SPA 子路由 ${p} 200`, r.status === 200, String(r.status));
}
const favicon = await get('/favicon.ico');
check('favicon 状态（404 属已知低优先）', favicon.status === 200 || favicon.status === 404, String(favicon.status));

// 2. 只读 API
const config = await get('/api/config');
check('/api/config 200', config.status === 200, String(config.status));
const cfg = JSON.parse(config.text);
check('/api/config 含命题版本', !!cfg.version, String(cfg.version));
check('/api/config 主卷题量 52', cfg.mainQuestionCount === 52, String(cfg.mainQuestionCount));
check('/api/config 班级数 4', Array.isArray(cfg.classes) && cfg.classes.length === 4, String((cfg.classes || []).length));

const roster = await get('/api/roster');
check('/api/roster 200', roster.status === 200, String(roster.status));
const rosterData = JSON.parse(roster.text);
const total = rosterData.total;
const flat = [];
for (const c of rosterData.classes || []) for (const s of c.students || []) flat.push(s);
check('/api/roster 总数与明细一致', total === flat.length, `${total} vs ${flat.length}`);
check('/api/roster 名单非空（≥200）', total >= 200, String(total));
check('/api/roster 明细行数一致', flat.length === total, String(flat.length));
check('/api/roster 不含答案字段', !/"answer"/.test(roster.text));

const paper = await get('/api/paper');
check('/api/paper 200', paper.status === 200, String(paper.status));
const paperData = JSON.parse(paper.text);
check('/api/paper 57 题', paperData.questions.length === 57, String(paperData.questions.length));
check('/api/paper 8 站', paperData.stages.length === 8, String(paperData.stages.length));
check('/api/paper 防泄题（无 answer/analysis/goalIds）', !/"answer"|"analysis"|"goalIds"/.test(paper.text));

const teacherApi = await get('/api/teacher');
check('/api/teacher 200', teacherApi.status === 200, String(teacherApi.status));
const tj = JSON.parse(teacherApi.text);
check('/api/teacher 分母与名单一致', tj.denominator === total, `${tj.denominator} vs ${total}`);
check('/api/teacher 明细行数与分母一致', Array.isArray(tj.students) && tj.students.length === tj.denominator, String((tj.students || []).length));
check('/api/teacher 不含逐题答案', !JSON.stringify(tj).includes('"answer"'));

const first = flat[0];
const state = await get('/api/state?studentId=' + encodeURIComponent(first.id));
check('/api/state 200', state.status === 200, String(state.status));
const sj = JSON.parse(state.text);
check('/api/state 返回学生信息', !!sj.student && sj.student.id === first.id, sj.student && sj.student.name);
check('/api/state 返回 8 站进度', !!sj.progress && sj.progress.stageProgress.length === 8, String(sj.progress && sj.progress.stageProgress.length));
check('/api/state 8 站全部解锁', sj.progress.stageProgress.every((x) => x.unlocked));
check('/api/state 含只读字段（无答案）', !/"answer"/.test(state.text));

// 3. 写操作（仅测试实例）
if (WRITE) {
  const login = await post('/api/login', { classId: first.classId, name: first.name });
  check('/api/login 200', login.status === 200, String(login.status));
  const lj = JSON.parse(login.text);
  check('/api/login 返回学生与题库', !!lj.student && !!lj.paper, lj.student && lj.student.name);
  const sid = lj.student.id;
  const q1 = lj.paper.questions[0];
  const pick = (q1.options || q1.cards || [])[0];
  const ans = await post('/api/answer', { studentId: sid, questionId: q1.id, answer: pick });
  check('/api/answer 200', ans.status === 200, String(ans.status));
  const st = await post('/api/stage/submit', {
    studentId: sid,
    stageId: q1.stageId,
    answers: { [q1.id]: pick },
  });
  check('/api/stage/submit 200（只答 1 题也可交）', st.status === 200, String(st.status));
  const bad = await post('/api/answer', { studentId: 'not-exist', questionId: q1.id, answer: 'x' });
  check('非法学生返回 4xx 而非 5xx', bad.status >= 400 && bad.status < 500, String(bad.status));
  const relogin = await post('/api/login', { studentId: sid });
  check('/api/login（凭 ID 重登）200', relogin.status === 200, String(relogin.status));
}

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
const reportName = WRITE ? 'lan-endpoints-write-report.json' : 'lan-endpoints-report.json';
fs.writeFileSync(
  path.join(__dirname, reportName),
  JSON.stringify({ base: BASE, write: WRITE, ranAt: new Date().toISOString(), pass, fail, results }, null, 2)
);
console.log(`\n合计 ${results.length} 项：PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
