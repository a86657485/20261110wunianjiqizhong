// Edge（Chromium 内核）真机冒烟：只读访问正式实例，不登录、不写数据
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://10.9.129.17:8780';
const SHOTS = path.join(__dirname, 'shots-edge');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN' });
const page = await ctx.newPage();
const errors = [];
const badResponses = [];
page.on('console', (m) => {
  // 资源类 404 的通用文案不含 URL，统一交给 badResponses 判定
  if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon/i.test(r.url())) badResponses.push(r.status() + ' ' + r.url());
});

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
check('Edge 学生端打开', (await page.locator('.login-hero h1').innerText()).includes('算法嘉年华'));
check('Edge 班级按钮 4 个', (await page.locator('.class-pill').count()) === 4, String(await page.locator('.class-pill').count()));
const names = await page.locator('.name-btn').count();
check('Edge 默认班名单可见', names > 0 && names <= 60, String(names));
await page.getByPlaceholder('搜索姓名').fill('杜');
await page.waitForTimeout(300);
const searched = await page.locator('.name-btn').count();
check('Edge 搜索姓名生效', searched > 0 && searched < names, `${searched}/${names}`);
await page.screenshot({ path: path.join(SHOTS, 'edge-login.png'), fullPage: true });

await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' });
await page.locator('.teacher-table tbody tr').first().waitFor();
const rows = await page.locator('.teacher-table tbody tr').count();
const apiTeacher = await page.evaluate(async (base) => (await fetch(base + '/api/teacher')).json(), BASE);
check('Edge 教师屏表格行数与分母一致', rows === apiTeacher.denominator, `${rows} vs ${apiTeacher.denominator}`);
const statText = await page.locator('.card').filter({ has: page.locator('.stat-row') }).first().innerText();
check('Edge 教师屏显示同分母', statText.includes('/' + apiTeacher.denominator), statText.replace(/\n+/g, ' | '));
await page.screenshot({ path: path.join(SHOTS, 'edge-teacher.png'), fullPage: true });

check('Edge 无 JS 运行时错误', errors.length === 0, errors.join(' | ').slice(0, 200));
check('Edge 无资源/接口 4xx-5xx（favicon 除外）', badResponses.length === 0, badResponses.join(' | ').slice(0, 200));

await browser.close();
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
fs.writeFileSync(
  path.join(__dirname, 'edge-smoke-report.json'),
  JSON.stringify({ browser: 'msedge', base: BASE, ranAt: new Date().toISOString(), pass, fail, results, errors }, null, 2)
);
console.log(`\n=== PASS ${pass} / FAIL ${fail} / ${results.length} ===`);
process.exit(fail ? 1 : 0);
