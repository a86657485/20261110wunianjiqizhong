# 自测记录 · g5-midterm carnival

命题：`2026-11-09-midterm-v1.4.2`  
时区标签：Asia/Shanghai  
记录时间：2026-11-09 约 23:15（Asia/Shanghai）

## 已测

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 命题版本加载 | PASS | `paper.version === 2026-11-09-midterm-v1.4.2` |
| 学生端字段白名单 | PASS | 无 answer／goalIds／analysis／recallImagePrompt |
| 判分：单选全文 / 连线 / 排序 / fill_triple+acceptAlternate | PASS | `npm run test:grade` 9/9 |
| 主卷百分 round | PASS | 24/24→100；18/24→75 |
| 挑战加分封顶 +10 | PASS | |
| API 一条龙：登录→7 站→主卷 100→挑战 +10→教师屏 | PASS | `npm run selftest` 20/20 |
| 过关反馈为 v1.4.2 短鼓励语、无泄题 | PASS | 例：「点心站通关！下一站：侦探亭。」 |
| 构建 `npm run build` | PASS | Vite es2019 产出 client/dist |
| 服务启动 8780 | PASS | 见下方演示地址 |

## 浏览器全流程（2026-11-10，按老师新常驻）

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 全流程交互与控件检测 | PASS 145 / FAIL 0 | Chrome+puppeteer 真点；报告 `drafts/QA_FULL_FLOW_交互检测_20261110.md`；截图 `screenshots/qa-20261110/` |
| 学生一条龙＋教师屏 | PASS | 登录→7站→主卷100→挑战+10→教师屏 501 陈远晴 |
| 焦点／过关不泄答案 | PASS | 未作答无预高亮；API 无 answer／goalIds／analysis |
| 回忆与题对应 | PASS | 29/29 recall 路径与题号一致且可加载 |

## 未测 / 已知限制

| 项 | 说明 |
| --- | --- |
| Win7 Chrome 实机 | 构建 target es2019／cssTarget chrome87；待机房验收 |
| 回忆插图真图质量 | 路径 `assets/recall/` 可加载；部分仍可能为占位/简图，待美术补齐 |
| 读屏／无障碍专项 | 未做 |
| 不占用 8766 | 已用 8780 + 独立 DATA_DIR |

## 防泄题核对（实现侧）

- 未作答选项：仅默认灰边；选中后品牌色描边，无黄框／发光／小手指向正确项
- 过关反馈：只渲染服务端下发的 `stages[].clearFeedback`（v1.4.2）
- `recallCaption`：来自题库字段，不本地改写
