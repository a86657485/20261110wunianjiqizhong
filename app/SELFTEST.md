# 自测记录 · g5-midterm carnival

命题：`2026-11-10-midterm-v1.5`  
时区标签：Asia/Shanghai  
记录时间：2026-11-10（Asia/Shanghai）

## 已测

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 命题版本加载 | PASS | `paper.version === 2026-11-10-midterm-v1.5` |
| 学生端字段白名单 | PASS | 无 answer／goalIds／analysis／recallImagePrompt；不带图题无回忆字段 |
| 判分：单选全文 / 连线 / 排序 / fill_triple+acceptAlternate / M36·M48·M52 | PASS | `npm run test:grade` **11/11** |
| 主卷百分 round | PASS | 52/52→100；39/52→75；26/52→50；40/52→77 |
| 挑战加分 | PASS | 每对 +2，封顶 +10 |
| API 一条龙：登录→7 站（含增补题）→主卷 100／典型 75→挑战 +10→教师屏 | PASS | `npm run selftest` **37/37** |
| 过关反馈为短鼓励语、无泄题 | PASS | 例：「点心站通关！下一站：侦探亭。」 |
| 构建 `npm run build` | PASS | Vite es2019／cssTarget chrome87 产出 client/dist |
| 服务启动 | PASS | 全流程检测用 **8782** + `DATA_DIR=/tmp/g5-midterm-v15-data`（8780 已被占用，未抢课堂端口） |

## 浏览器全流程（v1.5，按老师常驻）

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 全流程交互与控件检测 | PASS **366** / FAIL **0** | 报告 `drafts/QA_FULL_FLOW_交互检测_v1.5_20261110.md`；截图 `screenshots/qa-v1.5-20261110/` |
| 学生一条龙＋教师屏 | 登录→7站（原带图+增补）→交主卷→挑战 | 主卷按 52 题计分 |
| 焦点／过关不泄答案 | 未作答无预高亮；引导不点亮正确项 | API 无 answer／goalIds／analysis |
| 回忆与题对应 | 带图题图文对应；不带图题无空图、无泄题 | M36／M48／M52 控件级引导 |

## 未测 / 已知限制

| 项 | 说明 |
| --- | --- |
| Win7 Chrome 实机 | 构建 target es2019／cssTarget chrome87；待机房验收 |
| 回忆插图真图质量 | 路径 `assets/recall/` 仅 M01–M24、C01–C05；增补题不配图 |
| 读屏／无障碍专项 | 未做 |
| 不占用 8766 | 已用 8780 + 独立 DATA_DIR |

## 防泄题核对（实现侧）

- 未作答选项：仅默认灰边；选中后品牌色描边，无黄框／发光／小手指向正确项
- 过关反馈：只渲染服务端下发的 `stages[].clearFeedback`
- `recallCaption`：来自题库字段，不本地改写；不带图题不渲染回忆区
