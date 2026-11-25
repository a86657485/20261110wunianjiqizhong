// 教师端排行榜与字段排序专项
// 用法：BASE=http://10.9.129.17:8899 node teacher-leaderboard.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// 兼容两种目录：工作区（repo/current/design）与仓库根（design）
const PAPER_PATH = [
  path.join(ROOT, 'repo/current/design/01_questions.json'),
  path.join(ROOT, 'design/01_questions.json'),
].find((f) => fs.existsSync(f));
const PAPER = JSON.parse(fs.readFileSync(PAPER_PATH, 'utf8'));
const Q = Object.fromEntries(PAPER.questions.map((q) => [q.id, q]));
const BASE = process.env.BASE || 'http://10.9.129.17:8899';
const SHOTS = path.join(__dirname, 'shots-leaderboard');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
const badResponses = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true });

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
  return (await fetch(BASE + p)).json();
}

const mains = PAPER.stages.filter((s) => s.required);
const bonus = PAPER.stages.find((s) => !s.required && s.stageId === 'gate_bonus');

async function seed(id, mode) {
  await post('/api/login', { studentId: id });
  let budget = mode === 'half' ? 26 : Infinity;
  for (const st of mains) {
    const answers = {};
    for (const qid of st.questionIds) {
      if (mode === 'zero') break;
      if (mode === 'half' && budget <= 0) break;
      const q = Q[qid];
      if (!q) continue;
      answers[qid] = q.answer;
      if (mode === 'half') budget -= 1;
    }
    await post('/api/stage/submit', { studentId: id, stageId: st.stageId, answers });
  }
  const main = await post('/api/main/submit', { studentId: id });
  if (mode === 'full-bonus') {
    const ans = {};
    for (const qid of bonus.questionIds) ans[qid] = Q[qid].answer;
    await post('/api/challenge/submit', { studentId: id, answers: ans });
  } else {
    await post('/api/challenge/skip', { studentId: id });
  }
  return main;
}

console.log('[0] 造 15 份成绩：110 / 100 / 100 / 50 / 11 个 0 分');
const roster = await getJson('/api/roster');
const c501 = roster.classes.find((c) => c.id === '501');
const s1 = c501.students.find((s) => s.name === '杜雨宸');
const s2 = c501.students.find((s) => s.name === '许嘉儿');
const s3 = c501.students.find((s) => s.name === '陈远晴');
const rest = c501.students.filter((s) => ![s1.id, s2.id, s3.id].includes(s.id));
const s4 = rest[0];
const zeros = rest.slice(1, 12);

const m1 = await seed(s1.id, 'full-bonus');
const m2 = await seed(s2.id, 'full');
const m3 = await seed(s3.id, 'half');
const m4 = await seed(s4.id, 'full');
for (const z of zeros) await seed(z.id, 'zero');
check('A 主卷 100 + 挑战 10', m1.percent === 100, JSON.stringify(m1));
check('B 主卷 100', m2.percent === 100, String(m2.percent));
check('C 主卷 50（只答 26 题）', m3.percent === 50, String(m3.percent));
check('D 主卷 100（与 B 并列）', m4.percent === 100, String(m4.percent));

const teacher = await getJson('/api/teacher');
const scored = teacher.students.filter((s) => s.mainPercent != null);
check('已交主卷 15 人', scored.length === 15, String(scored.length));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon/i.test(r.url())) badResponses.push(r.status() + ' ' + r.url());
});

const LB = '.lb-card';
const LB_ROWS = LB + ' .lb-table tbody tr';
const headBtn = (label) => page.locator(LB + ' .lb-sort').filter({ hasText: label }).first();
async function rowCells(i) {
  return page.locator(LB_ROWS).nth(i).locator('td').allInnerTexts();
}

await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' });
await page.locator(LB_ROWS).first().waitFor();

console.log('\n[1] 排行榜基础结构');
check('有排行榜卡片', (await page.locator(LB).count()) === 1);
check('标题为「排行榜」', (await page.locator(LB + ' .lb-head h3').innerText()).trim() === '排行榜');
const note = await page.locator(LB + ' .lb-head').innerText();
check('说明统计口径 15 人', note.includes('已交主卷 15 人'), note.replace(/\n/g, ' '));
check('默认只看前 10 行', (await page.locator(LB_ROWS).count()) === 10, String(await page.locator(LB_ROWS).count()));
check('默认有展开按钮', (await page.locator(LB + ' .lb-toggle').innerText()).includes('展开全部 15 人'));
const first = await rowCells(0);
check('第一名：杜雨宸 100 +10 = 110', first[2] === '杜雨宸' && first[5] === '110' && first[4] === '+10', first.join(' | '));
const ranks = [];
for (let i = 0; i < 10; i += 1) ranks.push((await rowCells(i))[0]);
check('名次同分并列（1,2,2,4,5...）', ranks.slice(0, 4).join(',') === '1,2,2,4', ranks.join(','));
await shot(page, '01-default');

console.log('\n[2] 展开 / 收起');
await page.locator(LB + ' .lb-toggle').click();
check('展开后 15 行', (await page.locator(LB_ROWS).count()) === 15, String(await page.locator(LB_ROWS).count()));
check('按钮变为收起', (await page.locator(LB + ' .lb-toggle').innerText()).includes('收起'));
await shot(page, '02-expanded');
await page.locator(LB + ' .lb-toggle').click();
check('收起后回到 10 行', (await page.locator(LB_ROWS).count()) === 10);

console.log('\n[3] 按主卷% 排序');
await headBtn('主卷%').click();
const pcts = [];
for (let i = 0; i < 10; i += 1) pcts.push(Number((await rowCells(i))[3]));
check('主卷% 降序单调不增', pcts.every((v, i) => i === 0 || pcts[i - 1] >= v), pcts.join(','));
check('降序箭头 ▼', (await headBtn('主卷%').innerText()).includes('▼'));
await headBtn('主卷%').click();
const pctsAsc = [];
for (let i = 0; i < 10; i += 1) pctsAsc.push(Number((await rowCells(i))[3]));
check('再次点击转升序', pctsAsc.every((v, i) => i === 0 || pctsAsc[i - 1] <= v), pctsAsc.join(','));
check('升序箭头 ▲', (await headBtn('主卷%').innerText()).includes('▲'));
check('升序首行为 0 分', pctsAsc[0] === 0, String(pctsAsc[0]));
await shot(page, '03-sort-main-asc');

console.log('\n[4] 按挑战加分排序');
await headBtn('挑战+').click();
const bonusCol = [];
for (let i = 0; i < 10; i += 1) bonusCol.push((await rowCells(i))[4]);
check('挑战+ 降序首行 +10', bonusCol[0] === '+10', bonusCol.join(','));
check('未参加挑战显示 —', bonusCol.filter((v) => v === '—').length >= 9, bonusCol.join(','));

console.log('\n[5] 按姓名排序（拼音）');
await headBtn('姓名').click();
const names = [];
for (let i = 0; i < 10; i += 1) names.push((await rowCells(i))[2]);
const expected = scored
  .map((s) => s.name)
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  .slice(0, 10);
check('姓名升序与拼音一致', JSON.stringify(names) === JSON.stringify(expected), names.join(',') + ' vs ' + expected.join(','));
// 名次需按 15 人全量核对：默认只显示 10 行，按姓名排序后两个并列第 2 名未必同时在首屏
await page.locator(LB + ' .lb-toggle').click();
await page.waitForTimeout(200);
const rankAfterNameSort = [];
for (let i = 0; i < 15; i += 1) rankAfterNameSort.push((await rowCells(i))[0]);
const rankCount = rankAfterNameSort.reduce((m, r) => ({ ...m, [r]: (m[r] || 0) + 1 }), {});
const rankExpected = { 1: 1, 2: 2, 4: 1, 5: 11 };
check(
  '改排序不改名次（15 人全量：1×1、2×2、4×1、5×11）',
  JSON.stringify(rankCount) === JSON.stringify(rankExpected),
  rankAfterNameSort.join(',') + ' → ' + JSON.stringify(rankCount)
);
await page.locator(LB + ' .lb-toggle').click();
await page.waitForTimeout(200);

console.log('\n[6] 按班级与通关站排序');
await headBtn('班').click();
const classes = [];
for (let i = 0; i < 10; i += 1) classes.push((await rowCells(i))[1]);
check('班级列均为 501', classes.every((c) => c === '501'), classes.join(','));
await headBtn('通关站').click();
const stagesCol = [];
for (let i = 0; i < 10; i += 1) stagesCol.push((await rowCells(i))[6]);
check('通关站降序首行为 7/7', stagesCol[0] === '7/7', stagesCol.join(','));

console.log('\n[7] 搜索与班级筛选联动');
await page.locator('.teacher-search').fill('许嘉儿');
await page.waitForTimeout(300);
check('搜索后排行榜 1 行', (await page.locator(LB_ROWS).count()) === 1, String(await page.locator(LB_ROWS).count()));
const oneRow = await rowCells(0);
check('搜索命中者名次仍为 2', oneRow[0] === '2' && oneRow[2] === '许嘉儿', oneRow.join(' | '));
check('说明标注已筛选', (await page.locator(LB + ' .lb-head').innerText()).includes('已筛选「许嘉儿」'));
await shot(page, '04-search');
await page.locator('.teacher-search').fill('');
await page.waitForTimeout(300);

await page.getByRole('button', { name: '502', exact: true }).click();
await page.waitForTimeout(400);
check('切到 502 后排行榜为空态', (await page.locator(LB).innerText()).includes('还没有学生交主卷'));
const emptyRows = await page.locator(LB_ROWS).count();
check('502 排行榜 0 行', emptyRows === 0, String(emptyRows));
await page.getByRole('button', { name: '全年级', exact: true }).click();
await page.waitForTimeout(400);
check('切回全年级恢复 10 行', (await page.locator(LB_ROWS).count()) === 10);

console.log('\n[8] 1024 宽度与稳定性');
await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(300);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('1024 页面无横向溢出', overflow <= 1, String(overflow));
const lbBox = await page.locator(LB).boundingBox();
check('排行榜卡片在视口宽度内', lbBox.x >= 0 && lbBox.x + lbBox.width <= 1024, JSON.stringify(lbBox));
await shot(page, '05-1024');
check('无 JS 运行时错误', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 200));
check('无 favicon 外的 4xx-5xx', badResponses.length === 0, badResponses.join(' | ').slice(0, 200));

await browser.close();
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
fs.writeFileSync(
  path.join(__dirname, 'teacher-leaderboard-report.json'),
  JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), pass, fail, results, consoleErrors, badResponses }, null, 2)
);
console.log(`\n=== PASS ${pass} / FAIL ${fail} / ${results.length} ===`);
process.exit(fail ? 1 : 0);
