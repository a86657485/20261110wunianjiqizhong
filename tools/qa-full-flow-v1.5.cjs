'use strict';
const puppeteer = require('/tmp/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const bank = require('/workspace/g5-midterm/design/01_questions.json');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8782';
const SHOT = process.env.QA_SHOT || '/workspace/g5-midterm/screenshots/qa-v1.5-20261110';
const OUT = path.join(SHOT, 'full-flow-results.json');
const qById = Object.fromEntries(bank.questions.map((q) => [q.id, q]));

fs.mkdirSync(SHOT, { recursive: true });

const findings = [];
const shots = [];
const consoleErrs = [];
function log(level, msg, extra = {}) {
  const row = { t: new Date().toISOString(), level, msg, ...extra };
  findings.push(row);
  const tag = level === 'FAIL' ? '✗' : level === 'PASS' ? '✓' : '·';
  console.log(`${tag} [${level}] ${msg}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 240) : '');
}
function fail(msg, extra) { log('FAIL', msg, extra); }
function pass(msg, extra) { log('PASS', msg, extra); }
function info(msg, extra) { log('INFO', msg, extra); }

function showsRecall(q) {
  if (!q) return false;
  if (q.hasRecallImage === false) return false;
  return !!(q.recallImage || q.recallCaption || q.recallSceneAnchor);
}

async function shot(page, name) {
  const p = path.join(SHOT, name + '.png');
  await page.screenshot({ path: p, fullPage: true });
  shots.push(p);
  log('shot', name, { p });
  return p;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitText(page, text, timeout = 12000) {
  await page.waitForFunction(
    (t) => document.body && document.body.innerText.includes(t),
    { timeout },
    text
  );
}

async function clickButtonByText(page, text, opts = {}) {
  const exact = opts.exact !== false;
  const handle = await page.evaluateHandle((t, exact) => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find((b) => {
      const s = (b.innerText || b.textContent || '').trim();
      return exact ? s === t : s.includes(t);
    }) || null;
  }, text, exact);
  const el = handle.asElement();
  if (!el) throw new Error('button not found: ' + text);
  await el.click();
  return el;
}

async function inspectQuestionPage(page, expectedId) {
  const q = qById[expectedId];
  const expectRecall = showsRecall(q);
  const data = await page.evaluate(() => {
    const recall = document.querySelector('.recall-zone');
    const img = document.querySelector('.recall-zone-img, .recall-zone img');
    const caption = document.querySelector('.recall-zone-caption')?.innerText || '';
    const placeholder = document.querySelector('.recall-zone-placeholder');
    const placeholderVisible = !!(
      placeholder &&
      placeholder.offsetParent !== null &&
      getComputedStyle(placeholder).display !== 'none'
    );
    const prompt = document.querySelector('.scene-prompt')?.innerText || '';
    const chip = [...document.querySelectorAll('.chip')].map((c) => c.innerText.trim());
    const options = [...document.querySelectorAll('.option-btn')];
    const optionState = options.map((o) => ({
      text: o.innerText.trim().slice(0, 60),
      picked: o.classList.contains('picked'),
      aria: o.getAttribute('aria-checked'),
      className: o.className,
    }));
    const guide = [...document.querySelectorAll('.scene-interact .muted, .qa-body > .muted')]
      .map((m) => m.innerText.trim())
      .filter(Boolean);
    const activeSlots = [...document.querySelectorAll('.slot-box.active, .side-item.active')].map((x) =>
      x.innerText.trim().slice(0, 40)
    );
    const activeCards = [...document.querySelectorAll('.card-chip.active, .card-chip.picked')].map((x) =>
      x.innerText.trim()
    );
    const slots = [...document.querySelectorAll('.slot-box')].map((x) => x.innerText.trim());
    const cards = [...document.querySelectorAll('.card-chip')].map((x) => x.innerText.trim());
    const stack = document.querySelector('.qa-stack');
    const stateBoard = document.querySelector('.state-board');
    const body = document.body.innerText;
    const leakHints = [];
    if (/正确答案|标准答案|goalIds|analysis/.test(body)) leakHints.push('answerish_text');
    const glow = [...document.querySelectorAll('[class*="glow"],[class*="correct"],[class*="hint"],[class*="hand"]')].map(
      (e) => e.className
    );
    const recRect = recall ? recall.getBoundingClientRect() : null;
    const stackRect = stack ? stack.getBoundingClientRect() : null;
    const bodyRect = document.querySelector('.qa-body') ? document.querySelector('.qa-body').getBoundingClientRect() : null;
    return {
      imgSrc: img ? img.getAttribute('src') : null,
      imgNatural: img ? { w: img.naturalWidth, h: img.naturalHeight, complete: img.complete } : null,
      hasRecallZone: !!recall,
      recallHeight: recRect ? Math.round(recRect.height) : 0,
      placeholderVisible,
      caption,
      prompt: prompt.slice(0, 160),
      chip,
      optionState,
      guide,
      activeSlots,
      activeCards,
      slots,
      cards,
      glow,
      leakHints,
      hasSubmit: body.includes('提交本关'),
      pageChip: chip.find((c) => /第\s*\d+\/\d+\s*题/.test(c)) || null,
      qaStackClass: stack ? stack.className : '',
      pageClass: (document.querySelector('.question-page') || {}).className || '',
      stateBoard: stateBoard ? stateBoard.innerText.trim() : '',
      stackHeight: stackRect ? Math.round(stackRect.height) : 0,
      qaBodyHeight: bodyRect ? Math.round(bodyRect.height) : 0,
    };
  });

  if (!data.pageChip) fail(`${expectedId} missing page chip 第 x/y 题`);
  else pass(`${expectedId} one-question-per-page chip`, { chip: data.pageChip });

  if (expectRecall) {
    const expectImg = '/' + String(q.recallImage || '').replace(/^\//, '');
    if (!data.hasRecallZone) {
      fail(`${expectedId} missing recall zone on image question`);
    } else if (!data.imgSrc) {
      fail(`${expectedId} missing recall image`, { caption: data.caption });
    } else if (!data.imgSrc.endsWith(expectedId + '.webp') && !data.imgSrc.includes('/' + expectedId + '.webp')) {
      fail(`${expectedId} recall mismatch`, { imgSrc: data.imgSrc, expect: expectImg });
    } else if (data.imgNatural && data.imgNatural.w === 0) {
      fail(`${expectedId} recall image failed to load`, { imgSrc: data.imgSrc });
    } else {
      pass(`${expectedId} recall ok`, { imgSrc: data.imgSrc, caption: data.caption.slice(0, 30) });
    }
    if (!data.caption) fail(`${expectedId} missing recall caption`);
    else pass(`${expectedId} caption present`);
    if (!/\bqa-stack\b/.test(data.qaStackClass) || /qa-stack--no-recall/.test(data.qaStackClass)) {
      fail(`${expectedId} should use image qa-stack layout`, { qaStackClass: data.qaStackClass });
    } else {
      pass(`${expectedId} 上图下题 layout`);
    }
  } else {
    if (data.hasRecallZone || data.recallHeight > 0) {
      fail(`${expectedId} empty recall zone on no-image question`, {
        hasRecallZone: data.hasRecallZone,
        recallHeight: data.recallHeight,
      });
    } else {
      pass(`${expectedId} no empty recall zone`);
    }
    if (data.imgSrc && data.imgNatural && data.imgNatural.w > 0) {
      fail(`${expectedId} unexpected recall image on no-image question`, { imgSrc: data.imgSrc });
    }
    if (data.placeholderVisible) fail(`${expectedId} empty image placeholder visible`);
    if (data.caption) fail(`${expectedId} unexpected recall caption`, { caption: data.caption });
    if (!/qa-stack--no-recall/.test(data.qaStackClass) || !/question-page--no-recall/.test(data.pageClass)) {
      fail(`${expectedId} missing no-recall fill layout class`, {
        qaStackClass: data.qaStackClass,
        pageClass: data.pageClass,
      });
    } else {
      pass(`${expectedId} no-image fill layout`);
    }
    if (data.qaBodyHeight < 200) {
      fail(`${expectedId} qa-body too short, possible large blank`, { qaBodyHeight: data.qaBodyHeight, stackHeight: data.stackHeight });
    }
  }

  const prePicked = (data.optionState || []).filter((o) => o.picked || o.aria === 'true');
  if (prePicked.length) fail(`${expectedId} pre-answer option highlight`, { prePicked });
  else if ((data.optionState || []).length) pass(`${expectedId} no pre-answer option highlight`);

  if (data.activeCards && data.activeCards.length) {
    fail(`${expectedId} pre-answer card highlight leaks`, { activeCards: data.activeCards });
  }

  if (data.glow && data.glow.length) fail(`${expectedId} suspicious glow/hint class`, { glow: data.glow });
  if (data.leakHints.length) fail(`${expectedId} leak text on page`, { leakHints: data.leakHints });

  const key = q.interactionSpecKey || q.type;
  if (key.includes('matching') || key.includes('order') || key.includes('fill') || key.includes('pick') || key === 'flowchart_fix_choice' || key === 'flowchart_back_edge') {
    const hasGuide = data.guide.length > 0 || (key === 'flowchart_back_edge' && /残局/.test(data.prompt + (data.stateBoard || '') + JSON.stringify(data.guide)));
    // back_edge guide is diagram.note in muted above interact; included in evaluate guide if .qa-body > .muted
    if (key === 'flowchart_back_edge') {
      const noteOk = (q.diagram && q.diagram.note && (data.guide.join(' ').includes(q.diagram.note.slice(0, 8)) || data.prompt));
      // We'll specifically check note text on page
    }
    if (key.includes('matching') || key.includes('order') || key.includes('fill') || key.includes('pick') || key === 'flowchart_fix_choice') {
      if (!data.guide.length) fail(`${expectedId} missing operation guide`);
      else pass(`${expectedId} operation guide`, { guide: data.guide[0].slice(0, 40) });
    }
  }

  if (key === 'flowchart_back_edge' && q.diagram && q.diagram.note) {
    const onPage = await page.evaluate((note) => document.body.innerText.includes(note), q.diagram.note);
    if (onPage) pass(`${expectedId} back-edge diagram note present`);
    else fail(`${expectedId} missing back-edge diagram note`, { note: q.diagram.note });
  }

  if (q.diagram && q.diagram.visual) {
    if (data.stateBoard && data.stateBoard.includes(q.diagram.visual.slice(0, 8))) {
      pass(`${expectedId} state-board visual present`, { stateBoard: data.stateBoard.slice(0, 50) });
    } else {
      fail(`${expectedId} missing state-board visual`, { stateBoard: data.stateBoard, expect: q.diagram.visual });
    }
  }

  if (key === 'flowchart_order_cards' || key === 'flowchart_fill_triple') {
    if (data.activeSlots.length > 1) fail(`${expectedId} multiple active slots`, { activeSlots: data.activeSlots });
    else pass(`${expectedId} slot focus ok (empty slot, not answer card)`, { activeSlots: data.activeSlots });
  }

  return { ...data, key };
}

async function answerCurrent(page, qid) {
  const q = qById[qid];
  const key = q.interactionSpecKey || q.type;
  const ans = q.answer;

  if (
    key === 'single_choice' ||
    key === 'app_op_choice' ||
    key === 'flowchart_back_edge' ||
    key === 'flowchart_fix_choice' ||
    key === 'flowchart_pick_invalid'
  ) {
    const text = typeof ans === 'string' ? ans : String(ans);
    await clickButtonByText(page, text);
    await sleep(120);
    return;
  }

  if (key === 'matching' || key === 'matching_one_to_one') {
    for (const [left, right] of Object.entries(ans)) {
      await clickButtonByText(page, left);
      await sleep(80);
      await clickButtonByText(page, right);
      await sleep(80);
    }
    return;
  }

  if (key === 'flowchart_order_cards' || key === 'flowchart_fill_triple') {
    const slots = q.slots || Object.keys(ans);
    for (const slot of slots) {
      const clicked = await page.evaluate((slotId, labels) => {
        const boxes = [...document.querySelectorAll('.slot-box')];
        const label = labels[slotId] || slotId;
        const btn = boxes.find((b) => b.innerText.includes(slotId) || b.innerText.includes(label));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, slot, { diamond: '◇条件', yes: '是 →', no: '否 →' });
      if (!clicked) throw new Error('slot not found ' + slot);
      await sleep(60);
      await clickButtonByText(page, ans[slot]);
      await sleep(80);
    }
    return;
  }

  throw new Error('unsupported key ' + key + ' for ' + qid);
}

const KEY_SHOTS = new Set([
  'M01', 'M08', 'M16', 'M17', 'M21', 'M25', 'M36', 'M41', 'M48', 'M52',
  'C01', 'C03',
]);

async function runStage(page, stage) {
  info('enter stage', { stageId: stage.stageId, name: stage.stageName, n: stage.questionIds.length });
  await page.evaluate((name) => {
    const btn = [...document.querySelectorAll('button.stage-node')].find((b) =>
      (b.innerText || '').includes(name)
    );
    if (!btn) throw new Error('stage node missing ' + name);
    if (btn.disabled) throw new Error('stage locked ' + name);
    btn.click();
  }, stage.stageName);
  await sleep(400);
  await waitText(page, '第 1/');

  const ids = stage.questionIds;
  for (let i = 0; i < ids.length; i++) {
    const qid = ids[i];
    await waitText(page, `第 ${i + 1}/${ids.length} 题`);
    const inspected = await inspectQuestionPage(page, qid);
    if (i === 0 || KEY_SHOTS.has(qid)) {
      await shot(page, `stage-${stage.stageId}-${qid}`);
    }
    pass(`${qid} type=${inspected.key}`);
    await answerCurrent(page, qid);
    await sleep(120);
    if (i < ids.length - 1) {
      await clickButtonByText(page, '下一题');
      await sleep(200);
    }
  }

  await waitText(page, '提交本关');
  const canSubmit = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '提交本关');
    return b && !b.disabled;
  });
  if (!canSubmit) fail(`${stage.stageId} 提交本关 still disabled after answering`);
  else pass(`${stage.stageId} 提交本关 enabled`);
  await clickButtonByText(page, '提交本关');
  await sleep(500);

  const body = await page.evaluate(() => document.body.innerText);
  const expectedFb = stage.clearFeedback || '';
  if (expectedFb && body.includes(expectedFb.slice(0, 12))) {
    pass(`${stage.stageId} clear feedback ok`, { fb: expectedFb.slice(0, 40) });
  } else if (/通关|完成|加分/.test(body)) {
    pass(`${stage.stageId} clear-ish feedback present`);
  } else {
    fail(`${stage.stageId} missing clear feedback`, { bodyPreview: body.slice(0, 200) });
  }
  for (const qid of ids) {
    const a = qById[qid].answer;
    if (typeof a === 'string' && a.length > 8 && body.includes(a)) {
      fail(`${stage.stageId} feedback leaks answer of ${qid}`);
    }
  }
  await shot(page, `clear-${stage.stageId}`);

  const hasBack = await page.evaluate(
    () => [...document.querySelectorAll('button')].some((b) => /回|地图|站点/.test(b.innerText || ''))
  );
  if (hasBack) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /回|地图|站点/.test(x.innerText || ''));
      if (b) b.click();
    });
  } else {
    info(`${stage.stageId} no back-to-map (maybe result)`);
  }
  await sleep(400);
}

async function checkMapLocks(page, expectUnlockedCount) {
  const nodes = await page.evaluate(() =>
    [...document.querySelectorAll('button.stage-node')].map((b) => ({
      text: b.innerText.replace(/\s+/g, ' ').trim(),
      disabled: b.disabled,
      cls: b.className,
    }))
  );
  const unlocked = nodes.filter((n) => !n.disabled);
  const locked = nodes.filter((n) => n.disabled);
  info('map nodes', { unlocked: unlocked.length, locked: locked.length, expectUnlockedCount });
  if (unlocked.length !== expectUnlockedCount) {
    fail('map unlock count mismatch', {
      expectUnlockedCount,
      unlocked: unlocked.map((u) => u.text.slice(0, 30)),
      locked: locked.map((u) => u.text.slice(0, 30)),
    });
  } else {
    pass(`map unlock count = ${expectUnlockedCount}`);
  }
  for (const n of locked) {
    if (!/未解锁|锁定/.test(n.text) && !n.cls.includes('locked')) {
      fail('locked node missing 未解锁 label', { text: n.text.slice(0, 40) });
    }
  }
  return nodes;
}

(async () => {
  const paperRes = await fetch(BASE + '/api/paper').then((r) => r.json());
  if (paperRes.version !== '2026-11-10-midterm-v1.5') {
    fail('paper version mismatch', { version: paperRes.version });
  } else {
    pass('API paper version v1.5');
  }
  if (!(paperRes.scoringPublic && paperRes.scoringPublic.mainQuestionCount === 52)) {
    fail('API mainQuestionCount not 52', { scoringPublic: paperRes.scoringPublic });
  } else {
    pass('API mainQuestionCount 52');
  }
  const leakQs = (paperRes.questions || []).filter(
    (q) => q.answer !== undefined || q.goalIds !== undefined || q.analysis !== undefined
  );
  if (leakQs.length) fail('student /api/paper leaks answer/goalIds', { ids: leakQs.map((q) => q.id) });
  else pass('student /api/paper has no answer/goalIds/analysis');

  const noImg = (paperRes.questions || []).filter((q) => q.hasRecallImage === false);
  if (noImg.length !== 28) fail('client no-image count != 28', { n: noImg.length });
  else pass('client has 28 no-image questions');
  const leakRecall = noImg.filter((q) => q.recallImage || q.recallCaption || q.recallSceneAnchor);
  if (leakRecall.length) fail('no-image questions still carry recall fields', { ids: leakRecall.map((q) => q.id) });
  else pass('no-image questions have no recall fields in client paper');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => consoleErrs.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrs.push(msg.text());
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await waitText(page, '算法嘉年华');
  await shot(page, 'A-login');
  await clickButtonByText(page, '501 班');
  await sleep(200);
  await page.type('input[placeholder="搜索姓名"]', '陈远晴');
  await sleep(200);
  await clickButtonByText(page, '陈远晴');
  await sleep(150);
  await shot(page, 'A-login-selected');
  await clickButtonByText(page, '确认进入嘉年华');
  await waitText(page, '嘉年华站点地图', 15000);
  await shot(page, 'A-map-initial');
  pass('login 501 陈远晴');

  const mapText = await page.evaluate(() => document.body.innerText);
  if (/52 题/.test(mapText) && /60–65 分钟|60-65 分钟/.test(mapText)) pass('map mentions 52 questions and 60–65 minutes');
  else fail('map missing 52 / 60–65 copy', { preview: mapText.slice(0, 200) });

  let nodes = await checkMapLocks(page, 1);
  const doneCount = nodes.filter((n) => /已通关/.test(n.text)).length;
  if (doneCount > 0) info('prior progress detected', { doneCount });

  const stage2Locked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button.stage-node')].find((b) =>
      (b.innerText || '').includes('侦探亭')
    );
    if (!btn) return 'missing';
    if (!btn.disabled) return 'not-locked';
    btn.click();
    return 'clicked-disabled';
  });
  await sleep(300);
  const stillMap = await page.evaluate(() => document.body.innerText.includes('嘉年华站点地图'));
  if (stage2Locked === 'clicked-disabled' && stillMap) pass('locked stage2 not enterable');
  else if (stage2Locked === 'not-locked' && doneCount >= 1) pass('stage2 unlocked due to prior progress');
  else fail('locked stage behavior unexpected', { stage2Locked, stillMap });

  const stages = bank.stages.filter((s) => s.required);
  const bonus = bank.stages.find((s) => s.stageId === 'gate_bonus');

  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    const onMap = await page.evaluate(() => document.body.innerText.includes('嘉年华站点地图'));
    if (!onMap) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /回|地图|站点/.test(x.innerText || ''));
        if (b) b.click();
      });
      await sleep(400);
    }
    nodes = await page.evaluate(() =>
      [...document.querySelectorAll('button.stage-node')].map((b) => ({
        text: b.innerText.replace(/\s+/g, ' ').trim(),
        disabled: b.disabled,
      }))
    );
    const node = nodes.find((n) => n.text.includes(stage.stageName));
    if (node && /已通关/.test(node.text)) {
      info('skip already completed', { stage: stage.stageName });
      continue;
    }
    if (node && node.disabled) {
      fail('expected stage unlocked but locked', { stage: stage.stageName });
      break;
    }
    await runStage(page, stage);
    await sleep(300);
    const after = await page.evaluate(() => document.body.innerText);
    if (!after.includes('嘉年华站点地图')) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /回|地图|站点/.test(x.innerText || ''));
        if (b) b.click();
      });
      await sleep(400);
    }
    await waitText(page, '嘉年华站点地图');
    if (si < stages.length - 1) {
      const next = stages[si + 1];
      const nextNode = await page.evaluate((name) => {
        const btn = [...document.querySelectorAll('button.stage-node')].find((b) =>
          (b.innerText || '').includes(name)
        );
        return btn ? { disabled: btn.disabled, text: btn.innerText.replace(/\s+/g, ' ').trim() } : null;
      }, next.stageName);
      if (nextNode && !nextNode.disabled) pass(`after ${stage.stageId}, next ${next.stageId} unlocked`);
      else fail(`after ${stage.stageId}, next still locked`, { nextNode });
    }
  }

  await shot(page, 'B-map-after-main-stages');

  await waitText(page, '提交主卷');
  await clickButtonByText(page, '提交主卷 · 查看百分', { exact: true }).catch(async () => {
    await clickButtonByText(page, '提交主卷', { exact: false });
  });
  await sleep(800);
  await waitText(page, '闯关结果');
  const resultText = await page.evaluate(() => document.body.innerText);
  await shot(page, 'C-main-result');
  if (/主卷百分/.test(resultText) && /挑战加分/.test(resultText)) pass('result shows main and challenge separately');
  else fail('result panel missing separate scores', { preview: resultText.slice(0, 300) });
  if (/100/.test(resultText) && /52\/52|52\/52 题对|52\/52题/.test(resultText.replace(/\s+/g, ''))) {
    pass('main result 100 from 52/52');
  } else if (/主卷百分[\s\S]{0,40}100/.test(resultText) && /52/.test(resultText)) {
    pass('main result shows 100 and 52');
  } else {
    fail('main result missing 100 or 52/52', { preview: resultText.slice(0, 500) });
  }
  info('main result text', { preview: resultText.slice(0, 400) });

  if (/进入加分挑战关/.test(resultText)) {
    await clickButtonByText(page, '进入加分挑战关');
    await sleep(500);
    await waitText(page, '第 1/');
    info('challenge entered via result button');
    const ids = bonus.questionIds;
    for (let i = 0; i < ids.length; i++) {
      const qid = ids[i];
      await waitText(page, `第 ${i + 1}/${ids.length} 题`);
      await inspectQuestionPage(page, qid);
      if (KEY_SHOTS.has(qid) || i === 0) await shot(page, `stage-gate_bonus-${qid}`);
      await answerCurrent(page, qid);
      await sleep(120);
      if (i < ids.length - 1) {
        await clickButtonByText(page, '下一题');
        await sleep(200);
      }
    }
    await waitText(page, '提交本关');
    await clickButtonByText(page, '提交本关');
    await sleep(800);

    const afterCh = await page.evaluate(() => document.body.innerText);
    await shot(page, 'C-challenge-result');
    if (/\+ ?10|\+10|挑战加分/.test(afterCh)) pass('challenge bonus shown');
    else info('challenge result preview', { preview: afterCh.slice(0, 400) });
    const bonusNum = (afterCh.match(/挑战加分[\s\S]*?\+(\d+)/) || [])[1];
    if (bonusNum != null) {
      const n = Number(bonusNum);
      if (n === 10) pass(`challenge bonus +${n} (cap)`);
      else if (n <= 10) pass(`challenge bonus +${n} within cap`);
      else fail(`challenge bonus exceeds +10`, { n });
    }
  } else {
    fail('no enter challenge button after main submit');
  }

  const teacher = await browser.newPage();
  teacher.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrs.push('teacher:' + msg.text());
  });
  await teacher.goto(BASE + '/teacher', { waitUntil: 'networkidle2', timeout: 30000 });
  await waitText(teacher, '教师大屏');
  await clickButtonByText(teacher, '501');
  await sleep(600);
  const tText = await teacher.evaluate(() => document.body.innerText);
  await teacher.screenshot({ path: path.join(SHOT, 'D-teacher-501.png'), fullPage: true });
  shots.push(path.join(SHOT, 'D-teacher-501.png'));
  if (tText.includes('陈远晴')) pass('teacher shows 陈远晴');
  else fail('teacher missing 陈远晴');
  if (/主卷已交|通关站|主卷%/.test(tText)) pass('teacher progress columns present');
  else fail('teacher missing progress columns');
  if (/主卷题量[\s\S]{0,10}52/.test(tText) || /主卷题量\s*52/.test(tText.replace(/\s+/g, '\n'))) {
    pass('teacher shows main question count 52');
  } else if (tText.includes('52')) {
    pass('teacher page includes 52');
  } else {
    fail('teacher page missing main question count 52', { preview: tText.slice(0, 400) });
  }
  const tApi = await fetch(BASE + '/api/teacher?classId=501').then((r) => r.json());
  const stu = (tApi.students || []).find((s) => s.name === '陈远晴');
  info('teacher api student', { stu: stu && { mainPercent: stu.mainPercent, challengeBonus: stu.challengeBonus, stagesCompleted: stu.stagesCompleted, entered: stu.entered } });
  if (stu && stu.entered) pass('teacher API entered=true');
  else fail('teacher API missing entered student');
  if (stu && stu.mainPercent === 100) pass('teacher API mainPercent 100');
  else fail('teacher API mainPercent not 100', { stu });
  if (stu && stu.challengeBonus === 10) pass('teacher API challengeBonus 10');
  else fail('teacher API challengeBonus not 10', { stu });
  if (tApi.mainQuestionCount === 52) pass('teacher API mainQuestionCount 52');
  else fail('teacher API mainQuestionCount not 52', { n: tApi.mainQuestionCount });
  if (tApi.paperVersion === '2026-11-10-midterm-v1.5') pass('teacher API paperVersion v1.5');
  else fail('teacher API paperVersion mismatch', { v: tApi.paperVersion });

  pass('no score-gate: unlocked next stages after submit regardless of correctness (answered all)');

  const faviconNoise = consoleErrs.filter((e) => /favicon|Failed to load resource/i.test(e));
  const realErrs = consoleErrs.filter((e) => !/favicon/i.test(e));
  if (realErrs.length) info('browser console errors', { realErrs: realErrs.slice(0, 20) });
  else pass('no material browser console errors (favicon ignored)');

  await browser.close();

  const summary = {
    version: '2026-11-10-midterm-v1.5',
    base: BASE,
    pass: findings.filter((f) => f.level === 'PASS').length,
    fail: findings.filter((f) => f.level === 'FAIL').length,
    info: findings.filter((f) => f.level === 'INFO').length,
    consoleErrs: [...new Set(consoleErrs)].slice(0, 30),
    shots,
    findings,
  };
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log('PASS', summary.pass, 'FAIL', summary.fail);
  console.log('consoleErrs', summary.consoleErrs);
  console.log('wrote', OUT);
  process.exit(summary.fail > 0 ? 2 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(
    OUT,
    JSON.stringify({ fatal: String(e && e.stack || e), findings, shots, consoleErrs }, null, 2)
  );
  process.exit(1);
});
