# 五年级期中「算法嘉年华」全流程交互控件检测报告

- **检测日期**：2026-11-10（Asia/Shanghai）
- **命题版本**：`2026-11-09-midterm-v1.4.2`（未升 v1.4.3，未改题库）
- **环境**：学生端 `http://127.0.0.1:8780/` · 教师屏 `/teacher` · `DATA_DIR=.data-test`
- **账号**：501 · 陈远晴（检测前清空 states 后重跑）
- **方法**：`/usr/bin/google-chrome` + `puppeteer-core` 真点 UI；辅 `/api/paper` `/api/teacher` 校验
- **自动化结果摘要**：PASS **145** / FAIL **0**（脚本 `/tmp/qa-full-flow.cjs`，结果 `screenshots/qa-20261110/full-flow-results.json`）
- **截图目录**：`/workspace/g5-midterm/screenshots/qa-20261110/`

---

## 总评

**全流程可走通：登录→七站逐题作答→过关反馈→主卷交卷→挑战加分→教师屏均 PASS；回忆图 Mxx/Cxx 与题号一一对应；单选／连线／排序／挑无效卡／填三槽／回边选择等控件均可操作；未作答前选项无高亮泄答案；学生 API 无 `answer`／`goalIds`。** 无阻断级缺陷。仅有低优先级打磨项（favicon 404、回忆标题胶囊叠在图角、末题「提交本关」禁用态仍呈实心主色）。

---

## 按站 PASS/FAIL

| 站 | stageId | 题号 | 控件覆盖 | 回忆图 | 引导/焦点 | 过关反馈 | 结果 |
|---|---|---|---|---|---|---|---|
| 登录与地图 | — | — | 选班/姓名；仅第1站可进；锁站点不进 | — | 地图说明「答完解锁、不因分数卡关」；锁态文案「未解锁」 | — | **PASS** |
| 第1站 点心站 | gate_l1 | M01–M03 | single_choice / app_op_choice / matching_one_to_one | M01–M03.webp | 连线引导「先左后右」；选项无预高亮 | 「点心站通关！下一站：侦探亭。」无答案泄露 | **PASS** |
| 第2站 侦探亭 | gate_l2 | M04–M06 | app_op_choice / matching / single_choice | M04–M06.webp | 连线引导在场；无预高亮 | 「侦探亭通关！下一站：汉诺塔实验室。」 | **PASS** |
| 第3站 汉诺塔 | gate_l3 | M07–M09 | app_op_choice / flowchart_order_cards / single_choice | M07–M09.webp | 「先点空位再点卡片」；焦点落在空槽①，不点亮答案卡 | 「汉诺塔实验室通关！下一站：奇趣游园会。」 | **PASS** |
| 第4站 奇趣游园会 | gate_l4 | M10–M12 | app_op_choice / matching_one_to_one / single_choice | M10–M12.webp | 四对连线引导清晰 | 「奇趣游园会通关！下一站：生活算法站。」 | **PASS** |
| 第5站 生活算法站 | gate_l5 | M13–M15 | app_op_choice / single_choice×2 | M13–M15.webp | 无预高亮 | 「生活算法站通关！下一站：分支岛。」 | **PASS** |
| 第6站 分支岛 | gate_l6 | M16–M19 | flowchart_pick_invalid / flowchart_fill_triple / single_choice×2 | M16–M19.webp | 挑无效卡引导；填三槽焦点在◇条件空位 | 「分支岛通关！下一站：莲花山小交警。」 | **PASS** |
| 第7站 莲花山 | gate_l7 | M20–M24 | app_op_choice / flowchart_back_edge / single_choice×3 | M20–M24.webp | 回边题有 diagram.note；无预高亮 | 「莲花山通关！…可交卷…或进加分挑战关。」 | **PASS** |
| 主卷交卷 | — | 24 题 | 提交主卷 · 查看百分 | — | 结果页主卷／挑战分开展示 | 主卷百分 100（24/24） | **PASS** |
| 加分挑战 | gate_bonus | C01–C05 | single_choice×4 / flowchart_fix_choice | C01–C05.webp | 结果页「进入加分挑战关」直达；无预高亮 | 挑战加分 **+10**（5/5，封顶+10）· 综合分 110 | **PASS** |
| 教师屏 | /teacher | — | 班筛选／刷新／进度表 | — | — | 陈远晴：进入是、通关站8、主卷%100、挑战+10、分课 L1–L7 全对 | **PASS** |
| 学生 API | /api/paper | 29 | 字段剥离 | recall 保留 | — | 0 题含 answer／goalIds／analysis | **PASS** |

---

## 控件全测清单

| 交互键 | 题例 | 真点结果 |
|---|---|---|
| `single_choice` | M01, M06, M09, M12, M14, M15, M18, M19, M22–M24, C01/C02/C04/C05 | PASS：点选后 `picked`，未选前四选项均等无高亮 |
| `app_op_choice` | M02, M04, M07, M10, M13, M20 | PASS |
| `matching_one_to_one` | M03, M11 | PASS：左→右配对，可清除 |
| `matching` | M05 | PASS（右列含干扰「循环条件」） |
| `flowchart_order_cards` | M08 | PASS：槽①默认焦点→点卡入槽 |
| `flowchart_pick_invalid` | M16 | PASS：点选不能入菱形的卡 |
| `flowchart_fill_triple` | M17 | PASS：◇/是/否 三槽补全 |
| `flowchart_back_edge` | M21 | PASS |
| `flowchart_fix_choice` | C03 | PASS |

---

## 引导 · 焦点 · 剧情（专项）

| 检查项 | 结论 |
|---|---|
| 一题一页 · 上图下题 | PASS（`.qa-stack`：回忆区在上、题干+控件在下） |
| 回忆图与题号 | PASS：29/29 为 `/assets/recall/{Mxx\|Cxx}.webp`，naturalWidth>0 |
| 回忆标题 | PASS：`recallCaption` 展示；样式为图区左上角胶囊（见低优项） |
| 操作引导对准当前控件 | PASS：连线／排序／填槽／挑无效均有 `.muted` 操作说明 |
| 焦点不泄答案 | PASS：未作答前无 `.picked`／无 correct/glow/hand 类；排序／填槽焦点在**空槽**而非答案卡 |
| 过关反馈不泄题 | PASS：仅 `clearFeedback` 鼓励语；页面未出现标准答案全文 |
| 进度芯片 | PASS：站内「已答 x/y」+「第 i/n 题」 |
| 不用分卡关 | PASS：答完即解锁下一站（本跑全对，解锁逻辑与分数无关的规格在地图文案与代码 `unlockRule` 一致） |
| 无填空残留 | PASS：卷面无填空题型；交互为点选／配对／入槽 |

---

## 缺陷与观察（按严重度）

### 阻断 / 高 / 中
无。

### 低（打磨，不挡考）

| # | 严重度 | 描述 | 证据 | 建议（不强制改库） |
|---|---|---|---|---|
| L1 | Low | `favicon.ico` 404，控制台一条 Failed to load resource | 网络抓取 `http://127.0.0.1:8780/favicon.ico` | 放一枚 favicon 或忽略 |
| L2 | Low | 回忆标题 `position:absolute` 叠在插图左上角，视觉上像「小按钮」而非图下说明 | `styles.css` `.recall-zone-caption`；截图 `stage-gate_l1-M01.png` 等 | 可改为图下方居中小字，避免遮挡画面 |
| L3 | Low | 末题「提交本关」在未答满时虽 `disabled`，仍用实心 `btn-primary` 橙色，易误以为可点 | QuestionView 末题按钮；对比答满前后 | disabled 时降为 ghost／降不透明度 |

---

## Top3（若只改三处）

1. **无必须改的功能缺陷**——全流程与控件已达标。
2. 若有余力：回忆标题改为图下说明（L2），减少「这是不是可点按钮」的误读。
3. 若有余力：禁用态「提交本关」弱化样式（L3）；顺手补 favicon（L1）。

---

## 关键截图

| 场景 | 路径 |
|---|---|
| 登录 | `screenshots/qa-20261110/A-login.png` |
| 地图仅第1站可进 | `screenshots/qa-20261110/A-map-initial.png` |
| 单选 M01 | `screenshots/qa-20261110/stage-gate_l1-M01.png` |
| 连线 M03 | `screenshots/qa-20261110/stage-gate_l1-M03.png` |
| 排序入槽 M08 | `screenshots/qa-20261110/stage-gate_l3-M08.png` |
| 填三槽 M17 | `screenshots/qa-20261110/stage-gate_l6-M17.png` |
| 过关反馈 | `screenshots/qa-20261110/clear-gate_l1.png` |
| 主卷结果 | `screenshots/qa-20261110/C-main-result.png` |
| 挑战后结果 +10 | `screenshots/qa-20261110/C-challenge-result.png` |
| 教师屏 501 | `screenshots/qa-20261110/D-teacher-501.png` |
| 自动化明细 | `screenshots/qa-20261110/full-flow-results.json` |

---

## 结论

**建议可进入课堂联调／试考**（v1.4.2）。本次未升版、未改题库。低优三项可择机 UI 打磨，不影响计分、解锁、泄题安全与教师诊断。
