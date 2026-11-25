# 验收脚本

只读冒烟默认打正式实例；写操作脚本请指向隔离实例（自备 `DATA_DIR`），不要对正式库运行。

## 依赖

```bash
npm install          # playwright 1.65；浏览器用本机 Chrome / Edge
```

## 脚本

| 脚本 | 用途 | 默认目标 | 是否写库 |
| --- | --- | --- | --- |
| `lan-endpoints.mjs` | 学生端 / 教师屏 / 静态资源 / 全部 GET 接口 | `http://127.0.0.1:8780` | 否（`WRITE=1` 时写测试实例，38 项） |
| `edge-smoke.mjs` | Edge 通道只读冒烟 | 正式实例 | 否 |
| `teacher-delete.mjs` | 清除成绩 / 移除手动学生 | `http://10.9.129.17:8899` | 是 |
| `teacher-leaderboard.mjs` | 排行榜、排序、名次、搜索联动 | `http://10.9.129.17:8899` | 是（造 15 份成绩） |

## 用法

```bash
# 只读冒烟正式实例
node lan-endpoints.mjs
node edge-smoke.mjs

# 写操作专项：先起隔离实例
cd app && PORT=8899 DATA_DIR=./.data-qa node --no-warnings server/index.cjs
cd ../qa && BASE=http://127.0.0.1:8899 node teacher-delete.mjs
BASE=http://127.0.0.1:8899 node teacher-leaderboard.mjs
```

报告与截图（`*-report.json`、`shots-*/`）不纳入版本库。
