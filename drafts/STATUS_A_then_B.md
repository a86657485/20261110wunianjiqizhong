# A→B 回交状态（执行手）

## A 布局
- 学生题页改回「上图下题」：`.qa-stack` = `.recall-zone`（上，object-fit:contain）+ `.qa-body`（下，实色题干选项）
- 去掉半透明叠压／沉底叠加（旧 scene-fg-card 等已 inert）
- 保留全屏壳宽与地图 grid-auto-rows 铺开
- build 成功；8780 DATA_DIR=.data-test；/ 与 /teacher = 200；grade 9/9；selftest 20/20

## B 干扰项草案
- 源：`/workspace/g5-midterm/design/01_questions.json`
- SHA256（前后一致）：`50f5f9c990b9b60e7c15e0e2abbc10bb489f003c56fb134a568537dc9a547cdc`
- 草案（未应用）：
  - `drafts/DRAFT_NOT_APPLIED_single_choice_distractors_review.md`
  - `drafts/DRAFT_NOT_APPLIED_single_choice_distractors_patch.json`
- 单选类审阅 24 题；建议改 19；保留 4 + 轻软化 1（M14）；非单选 5 题不适用
- 未改 design；草案未进 public/client/dist

## 未测
- 浏览器实机视觉、Win7 Chrome 未测
