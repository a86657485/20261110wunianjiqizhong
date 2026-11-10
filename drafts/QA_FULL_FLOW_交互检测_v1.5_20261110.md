# 五年级期中「算法嘉年华」全流程交互控件检测报告（v1.5）

- **检测日期**：2026-11-10（Asia/Shanghai）
- **命题版本**：`2026-11-10-midterm-v1.5`
- **环境**：学生端 `http://127.0.0.1:8782/` · 教师屏 `/teacher` · `DATA_DIR=/tmp/g5-midterm-v15-data`
- **账号**：501 · 陈远晴（检测前使用全新临时 DATA_DIR）
- **方法**：`/usr/bin/google-chrome` + `puppeteer-core` 真点 UI（脚本 `tools/qa-full-flow-v1.5.cjs`）；辅 `/api/paper` `/api/teacher` 校验。未调用 computerUse / 子代理。
- **自动化结果摘要**：PASS **366** / FAIL **0**（结果 `screenshots/qa-v1.5-20261110/full-flow-results.json`）
- **截图目录**：`/workspace/g5-midterm/screenshots/qa-v1.5-20261110/`
- **阻断 FAIL**：无

---

## 总评

**全流程可走通：登录→七站（每站先原带图题、再该课不带图增补题）逐题作答→过关反馈→主卷交卷 52/52＝100→挑战加分 +10→教师屏均 PASS。**

- 带图题（M01–M24、C01–C05）维持上图下题（`.qa-stack`），回忆图路径与题号一一对应且可加载。
- 不带图题（M25–M52）不渲染回忆区、无空图占位、无回忆标题；题干与选项在 `.qa-stack--no-recall` 内铺满。
- M36／M48／M52 分别按 `flowchart_order_cards`／`flowchart_fill_triple`／`flowchart_back_edge` 呈现控件级引导；未作答前不给单个待选项金边／小手；排序／填槽焦点在空槽而非答案卡。
- 学生 API 无 `answer`／`goalIds`／`analysis`。过关反馈仅为 `stages[].clearFeedback`。
- 教师屏命题 `2026-11-10-midterm-v1.5`，主卷题量 **52**，陈远晴：进入是、通关站 8、主卷% 100、挑战 +10，分课 L1–L7 题量为 7/7、7/7、7/7、7/7、7/7、8/8、9/9。

无阻断级缺陷。

---

## 按站 PASS/FAIL

| 站 | stageId | 题号 | 控件覆盖 | 回忆／布局 | 引导/焦点 | 过关反馈 | 结果 |
|---|---|---|---|---|---|---|---|
| 登录与地图 | — | — | 选班/姓名；仅第1站可进 | 地图文案「主卷 52 题，建议用时约 60–65 分钟」 | 锁站点不进 | — | **PASS** |
| 第1站 点心站 | gate_l1 | M01–M03＋M25–M28（7） | 带图单选／应用／连线＋不带图单选 | 前3题上图下题；后4题无空图 | 连线引导；选项无预高亮；M26／M28 有状态微表 | 「点心站通关！下一站：侦探亭。」 | **PASS** |
| 第2站 侦探亭 | gate_l2 | M04–M06＋M29–M32（7） | 应用／连线／单选＋不带图单选 | 前3题上图下题；后4题无空图 | 无预高亮 | 「侦探亭通关！下一站：汉诺塔实验室。」 | **PASS** |
| 第3站 汉诺塔 | gate_l3 | M07–M09＋M33–M36（7） | 应用／排序／单选＋不带图单选／**M36 排序** | 前3题上图下题；后4题无空图；M36 有状态微表 | 「先点空位再点卡片」；焦点落在空槽①，不点亮答案卡 | 「汉诺塔实验室通关！下一站：奇趣游园会。」 | **PASS** |
| 第4站 奇趣游园会 | gate_l4 | M10–M12＋M37–M40（7） | 应用／连线／单选＋不带图单选 | 前3题上图下题；后4题无空图 | 无预高亮 | 「奇趣游园会通关！下一站：生活算法站。」 | **PASS** |
| 第5站 生活算法站 | gate_l5 | M13–M15＋M41–M44（7） | 应用／单选＋不带图单选 | 前3题上图下题；后4题无空图；M41 有价格微表 | 无预高亮 | 「生活算法站通关！下一站：分支岛。」 | **PASS** |
| 第6站 分支岛 | gate_l6 | M16–M19＋M45–M48（8） | 挑无效／填三槽／单选＋**M48 填三槽** | 前4题上图下题；后4题无空图 | M48 引导「点选空位…是／否出口」；焦点在◇条件空位 | 「分支岛通关！下一站：莲花山小交警。」 | **PASS** |
| 第7站 莲花山 | gate_l7 | M20–M24＋M49–M52（9） | 应用／回边／单选＋**M52 回边** | 前5题上图下题；后4题无空图；M52 有残局 note | 回边题有 diagram.note；无预高亮 | 「莲花山通关！…可交卷…或进加分挑战关。」 | **PASS** |
| 主卷交卷 | — | 52 题 | 提交主卷 · 查看百分 | — | 结果页主卷／挑战分开展示 | 主卷百分 **100**（52/52） | **PASS** |
| 加分挑战 | gate_bonus | C01–C05 | 单选×4／flowchart_fix_choice | 五题均上图下题 | C03 引导「点选应如何改正」；无预高亮 | 挑战加分 **+10**（5/5，封顶+10）· 综合分 110 | **PASS** |
| 教师屏 | /teacher | — | 班筛选／刷新／进度表／主卷题量 52 | — | — | 陈远晴：进入是、通关站8、主卷%100、挑战+10 | **PASS** |
| 学生 API | /api/paper | 57 | 字段剥离 | 28 题 `hasRecallImage=false` 且无回忆字段 | — | 0 题含 answer／goalIds／analysis | **PASS** |

---

## 关键截图（绝对路径）

| 检查项 | 路径 |
|---|---|
| 带图上图下题（M01） | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/stage-gate_l1-M01.png` |
| 不带图无空图铺满（M25） | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/stage-gate_l1-M25.png` |
| M36 排序引导＋状态微表 | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/stage-gate_l3-M36.png` |
| M48 填三槽引导 | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/stage-gate_l6-M48.png` |
| M52 回边引导 | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/stage-gate_l7-M52.png` |
| 主卷结果 100（52/52） | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/C-main-result.png` |
| 挑战结果 +10 | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/C-challenge-result.png` |
| 教师屏计分 | `/workspace/g5-midterm/screenshots/qa-v1.5-20261110/D-teacher-501.png` |

---

## 控件全测清单

| 交互键 | 题例 | 真点结果 |
|---|---|---|
| `single_choice` | M01 等带图＋M25–M35／M37–M47／M49–M51＋C01/C02/C04/C05 | PASS：点选后 `picked`，未选前选项均等无高亮 |
| `app_op_choice` | M02, M04, M07, M10, M13, M20 | PASS |
| `matching_one_to_one` | M03, M11 | PASS |
| `matching` | M05 | PASS |
| `flowchart_order_cards` | M08（带图）、**M36**（不带图） | PASS：槽①默认焦点→点卡入槽；M36 展示状态微表 |
| `flowchart_pick_invalid` | M16 | PASS |
| `flowchart_fill_triple` | M17（带图）、**M48**（不带图） | PASS：◇/是/否 三槽补全 |
| `flowchart_back_edge` | M21（带图）、**M52**（不带图） | PASS：残局 note 在场，选项无预高亮 |
| `flowchart_fix_choice` | C03 | PASS |

---

## 引导 · 焦点 · 剧情（专项）

| 检查项 | 结论 |
|---|---|
| 一题一页 · 带图上图下题 | PASS（`.qa-stack`：回忆区在上、题干+控件在下） |
| 不带图无空图铺满 | PASS：无 `.recall-zone`／占位／caption；`.qa-stack--no-recall`；单选题选项纵向铺满 |
| 回忆图与题号 | PASS：29/29 带图题为 `/assets/recall/{Mxx\|Cxx}.webp`，naturalWidth>0 |
| 操作引导对准当前控件 | PASS：连线／排序／填槽／挑无效／改错／回边残局说明均在场 |
| 焦点不泄答案 | PASS：未作答前无 `.picked`／无 correct/glow/hand 类；排序／填槽焦点在**空槽**而非答案卡 |
| 过关反馈不泄题 | PASS：仅 `clearFeedback` 鼓励语 |
| 答完解锁、不因分数卡关 | PASS |
| 先挑战不自动交主卷 | 本跑走「先交主卷再挑战」；该口径已由 `npm run selftest` 覆盖（challenge-first +10 后 mainSubmitted 仍为假） |

---

## 缺陷与观察（按严重度）

### 阻断 / 高 / 中
无。

### 低（打磨，不挡考）

| # | 严重度 | 描述 | 证据 | 建议（不强制） |
|---|---|---|---|---|
| L1 | Low | `favicon.ico` 404，控制台一条 Failed to load resource | `http://127.0.0.1:8782/favicon.ico` | 放一枚 favicon 或忽略 |
| L2 | Low | 排序／填槽类不带图题（如 M36／M48）在高屏上，加宽后的槽位与卡片下方仍有留白（控件不宜再纵向拉伸） | `stage-gate_l3-M36.png`、`stage-gate_l6-M48.png` | 可择机加轻量残局示意图，但不补空图区 |
| L3 | Low | 末题「提交本关」禁用态仍呈实心主色（opacity 降低） | M36／M48／M52 截图 | 禁用态可改为描边按钮，减少「能点」错觉 |

---

## 未测

| 项 | 说明 |
|---|---|
| **Win7 Chrome 实机** | **未测**。构建 target es2019／cssTarget chrome87；待机房验收 |
| 读屏／无障碍专项 | 未做 |
| 8766／8809／8829／`启动课堂.command`／真实班级数据 | 未碰；本跑端口 **8782**、临时 DATA_DIR |

## 自测对照

- `npm run test:grade`：11/11 通过（52/52→100、39/52→75、挑战 +2／+10、M36／M48／M52 判分）
- `npm run selftest`：37/37 通过（含先挑战不自动交主卷、典型百分 75、教师屏 52）
