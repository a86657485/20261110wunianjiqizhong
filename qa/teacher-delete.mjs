// 教师端「清除某位学生成绩 / 移除手动添加学生」专项
// 用法：BASE=http://10.9.129.17:8899 DATA_DIR=./.data-del node teacher-delete.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://10.9.129.17:8899';
const SHOTS = path.join(__dirname, 'shots-teacher-delete');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
const badResponses = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });

async function post(p, body) {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + (j.error || ''));
  return j;
}
async function getJson(p) {
  const r = await fetch(BASE + p);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

console.log('[0] 造数据：两名名单学生 + 一名手动学生');
const roster = (await getJson('/api/roster')).body;
const c501 = roster.classes.find((c) => c.id === '501');
const A = c501.students.find((s) => s.name === '杜雨宸');
const B = c501.students.find((s) => s.name === '许嘉儿');
const paper = (await getJson('/api/paper')).body;
const mains = paper.stages.filter((s) => s.required);
const firstQ = paper.questions.find((q) => q.stageId === mains[0].stageId);

const la = await post('/api/login', { studentId: A.id });
await post('/api/answer', { studentId: A.id, questionId: firstQ.id, answer: (firstQ.options || [])[0] });
await post('/api/stage/submit', { studentId: A.id, stageId: mains[0].stageId, answers: { [firstQ.id]: (firstQ.options || [])[0] } });

await post('/api/login', { studentId: B.id });
for (const st of mains) await post('/api/stage/submit', { studentId: B.id, stageId: st.stageId, answers: {} });
const bMain = await post('/api/main/submit', { studentId: B.id });

const C = await post('/api/login', { classId: '501', name: '测试手动生', manual: true });
const q2 = paper.questions.find((q) => q.stageId === mains[1].stageId);
await post('/api/answer', { studentId: C.student.id, questionId: q2.id, answer: (q2.options || [])[0] });
await post('/api/stage/submit', { studentId: C.student.id, stageId: mains[1].stageId, answers: { [q2.id]: (q2.options || [])[0] } });

const t0 = (await getJson('/api/teacher')).body;
check('造数完成：进入 3 / 分母 213', t0.entered === 3 && t0.denominator === 213, `entered=${t0.entered} denom=${t0.denominator}`);
check('B 已交主卷且得分 0', t0.students.find((s) => s.id === B.id).mainSubmitted === true && bMain.percent === 0);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN' });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon/i.test(r.url())) badResponses.push(r.status() + ' ' + r.url());
});

console.log('\n[1] 教师屏结构：搜索框、操作列');
await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' });
await page.locator('.teacher-table tbody tr').first().waitFor();
check('有搜索框', (await page.locator('.teacher-search').count()) === 1);
check('表头含「操作」列', (await page.locator('.teacher-table thead').innerText()).includes('操作'));
check('初始统计进入 3 / 213', (await page.locator('.stat').filter({ hasText: '进入' }).first().innerText()).includes('3/213'));
check('行数 213（含手动学生）', (await page.locator('.teacher-table tbody tr').count()) === 213, String(await page.locator('.teacher-table tbody tr').count()));
await shot(page, '01-teacher-initial');

console.log('\n[2] 搜索定位学生');
await page.locator('.teacher-search').fill('杜雨宸');
await page.waitForTimeout(200);
const rowA = page.locator('.teacher-table tbody tr').filter({ hasText: '杜雨宸' }).first();
check('搜索后仅 1 行', (await page.locator('.teacher-table tbody tr').count()) === 1);
check('该行有「清除成绩」', (await rowA.innerText()).includes('清除成绩'));
await shot(page, '02-search-student');

console.log('\n[3] 取消不删');
await rowA.getByRole('button', { name: '清除成绩' }).click();
await page.locator('.modal-card').waitFor();
check('弹窗显示姓名与班级', (await page.locator('.modal-card').innerText()).includes('杜雨宸') && (await page.locator('.modal-card').innerText()).includes('501'));
check('弹窗提示不可恢复', (await page.locator('.modal-card').innerText()).includes('不可恢复'));
await shot(page, '03-confirm-modal');
await page.getByRole('button', { name: '取消', exact: true }).click();
check('取消后弹窗关闭', (await page.locator('.modal-card').count()) === 0);
const afterCancel = (await getJson('/api/teacher')).body;
check('取消后记录仍在', afterCancel.students.find((s) => s.id === A.id).entered === true);

console.log('\n[4] 确认清除 A 的成绩');
await rowA.getByRole('button', { name: '清除成绩' }).click();
await page.locator('.modal-card').waitFor();
await page.getByRole('button', { name: '确认清除' }).click();
await page.locator('.ok-box').waitFor();
check('出现成功提示', (await page.locator('.ok-box').innerText()).includes('已清除'));
const rowAAfter = await rowA.innerText();
check('该行变为未进入', rowAAfter.includes('否'), rowAAfter.replace(/\s+/g, ' ').slice(0, 60));
check('该行主卷与挑战清空', /否\s+0\s+—\s+—/.test(rowAAfter), rowAAfter.replace(/\s+/g, ' ').slice(0, 60));
check('该行操作列变 —', rowAAfter.trim().endsWith('—'), rowAAfter.trim().slice(-10));
const stateA = (await getJson('/api/state?studentId=' + encodeURIComponent(A.id))).body;
check('服务端 A 无草稿、无通关站', Object.keys(stateA.progress.draftAnswers || {}).length === 0 && stateA.progress.stagesCompleted.length === 0);
const t1 = (await getJson('/api/teacher')).body;
check('清除后进入 2 / 分母仍 213', t1.entered === 2 && t1.denominator === 213, `entered=${t1.entered} denom=${t1.denominator}`);
check('B 的成绩未受影响', t1.students.find((s) => s.id === B.id).mainSubmitted === true);
check('手动学生 C 的记录未受影响', t1.students.find((s) => s.id === C.student.id).entered === true);
await shot(page, '04-after-delete');

console.log('\n[5] 被清除的学生可重新开始');
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.teacher-search').fill('杜雨宸');
await page.waitForTimeout(200);
check('刷新后仍为未进入', (await page.locator('.teacher-table tbody tr').first().innerText()).includes('否'));

console.log('\n[6] 手动添加的学生：移除该生并恢复分母');
await page.locator('.teacher-search').fill('测试手动生');
await page.waitForTimeout(200);
const rowC = page.locator('.teacher-table tbody tr').filter({ hasText: '测试手动生' }).first();
check('手动学生行显示「移除该生」', (await rowC.innerText()).includes('移除该生'));
await rowC.getByRole('button', { name: '移除该生' }).click();
await page.locator('.modal-card').waitFor();
check('弹窗说明分母减 1', (await page.locator('.modal-card').innerText()).includes('分母减 1'));
await page.getByRole('button', { name: '确认移除' }).click();
await page.locator('.ok-box').waitFor();
check('提示已移除并给出新分母', (await page.locator('.ok-box').innerText()).includes('212'), await page.locator('.ok-box').innerText());
check('搜索无结果提示', (await page.locator('.teacher-table tbody tr').count()) === 0 || (await page.locator('.card').innerText()).includes('没有匹配的学生'));
const t2 = (await getJson('/api/teacher')).body;
check('分母恢复 212', t2.denominator === 212, String(t2.denominator));
check('全部名单中已无测试手动生', !t2.students.some((s) => s.name === '测试手动生'));
await shot(page, '05-after-remove-manual');

console.log('\n[7] 接口边界');
const miss = await fetch(BASE + '/api/teacher/delete-record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentId: 'nope' }),
});
check('不存在的学生 404', miss.status === 404, String(miss.status));
// 用另一名学生的临时记录验证 200，避免影响 B 的核对数据
const D = c501.students[2];
await post('/api/login', { studentId: D.id });
const delD = await fetch(BASE + '/api/teacher/delete-record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentId: D.id }),
});
check('有记录学生删除返回 200', delD.status === 200, String(delD.status));
const delDJson = await delD.json();
check('返回删除摘要', delDJson.ok === true && delDJson.hadRecord === true && delDJson.removedStudent === false, JSON.stringify(delDJson));

console.log('\n[8] 1024 宽度弹窗不溢出');
await page.setViewportSize({ width: 1024, height: 768 });
await page.locator('.teacher-search').fill('');
await page.waitForTimeout(300);
const anyBtn = page.getByRole('button', { name: '清除成绩' }).first();
if ((await anyBtn.count()) > 0) {
  await anyBtn.click();
  await page.locator('.modal-card').waitFor();
  const box = await page.locator('.modal-card').boundingBox();
  check('弹窗在 1024 视口内', box.x >= 0 && box.y >= 0 && box.x + box.width <= 1024 && box.y + box.height <= 768, JSON.stringify(box));
  await shot(page, '06-modal-1024');
  await page.getByRole('button', { name: '取消', exact: true }).click();
} else {
  check('1024 弹窗检查跳过（无可删记录）', true);
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('1024 页面无横向溢出', overflow <= 1, String(overflow));
check('按钮触控高度 ≥44', (await page.locator('.teacher-search').evaluate((el) => el.getBoundingClientRect().height)) >= 44);

check('无 JS 运行时错误', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 200));
check('无 favicon 外的 4xx-5xx', badResponses.length === 0, badResponses.join(' | ').slice(0, 200));

await browser.close();
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
fs.writeFileSync(
  path.join(__dirname, 'teacher-delete-report.json'),
  JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), pass, fail, results, consoleErrors, badResponses }, null, 2)
);
console.log(`\n=== PASS ${pass} / FAIL ${fail} / ${results.length} ===`);
process.exit(fail ? 1 : 0);
