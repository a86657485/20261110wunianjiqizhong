# A 布局落地状态（DRAFT 配套记录）

- 时间：Asia/Shanghai
- 目标：学生题页改回「上图下题」；保留全屏少空白；去掉半透明叠压／沉底叠加
- 改动文件：
  - `app/client/src/components/RecallPanel.jsx`
  - `app/client/src/components/QuestionView.jsx`
  - `app/client/src/styles.css`
- 结构：`.qa-stack` > `.recall-zone`（上图 contain）+ `.qa-body`（题干＋交互）
- design／计分／美术未改
