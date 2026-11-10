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

## 未测 / 已知限制

| 项 | 说明 |
| --- | --- |
| 浏览器手测全 UI | 需打开 http://127.0.0.1:8780/ 走登录→地图→一题一页 |
| Win7 Chrome 实机 | 构建 target es2019／cssTarget chrome87；待机房验收 |
| 回忆插图真图 | 现为色块占位 + `recallCaption`（v1.4.2 文案）；路径 `assets/recall/` |
| 读屏／无障碍专项 | 未做 |
| 不占用 8766 | 已用 8780 + 独立 DATA_DIR |

## 防泄题核对（实现侧）

- 未作答选项：仅默认灰边；选中后品牌色描边，无黄框／发光／小手指向正确项
- 过关反馈：只渲染服务端下发的 `stages[].clearFeedback`（v1.4.2）
- `recallCaption`：来自题库字段，不本地改写
