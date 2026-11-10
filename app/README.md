# 五年级《身边的算法》期中 · 算法嘉年华·站点通行证

命题版本：**2026-11-09-midterm-v1.4.2**（只读自 `/workspace/g5-midterm/design/`，勿改题库）。

## 启动

```bash
cd /workspace/g5-midterm/app
npm install          # 会顺带安装 client 依赖
npm run build        # 构建学生端 / 教师大屏 SPA
DATA_DIR=./data PORT=8780 npm start
```

- 学生端：http://127.0.0.1:8780/
- 教师大屏：http://127.0.0.1:8780/teacher （免密，仅本机/局域网）
- 默认端口 **8780**；**不要**占用在线课堂 **8766**
- 可用临时目录：`DATA_DIR=./.data-test PORT=8780 npm start`

## 自测

```bash
npm run test:grade   # 判分与白名单
npm run selftest     # API 一条龙（临时 DATA_DIR）
```

详见 `SELFTEST.md`。

## 目录摘要

```
app/
  server/index.cjs    # HTTP API + 静态托管
  server/paper.cjs    # 加载 v1.4.2 并剥离 serverOnly 字段
  server/grade.cjs    # 服务端判分
  client/             # Vite + React 18（es2019，兼顾较旧 Chrome）
  roster/roster.json  # 501–504 名单
  data/               # 默认 DATA_DIR（sqlite）
  public/assets/recall/  # 回忆插图占位（可后换真图）
```

## 产品口径（已实现）

- 7 站主卷 + 可选挑战；答完解锁，不因分数卡关；`passLine=null`
- 主卷百分 = round(首答正确/24×100)；挑战每对 +2、满分 +10
- 一题一页；未作答选项零高亮；过关反馈仅用 `stages[].clearFeedback`
- 学生端不下发 answer／goalIds／analysis／remix／recallImagePrompt 等
