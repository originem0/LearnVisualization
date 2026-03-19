# Agent Backend (MVP Skeleton)

这是 `Learning Site Engine` 的最小独立后端骨架。

当前版本优先目标不是“框架漂亮”，而是：

> **在这台机器上真的能跑起来，并且能把一条最小生成链路串通。**

因此现在采用的是 **Python 标准库零依赖 dev server**，先把后端边界、端点和结构化输出能力立住，再决定后续是否切到 FastAPI / queue / DB。

## 边界

- Frontend：只负责展示
- Engine：负责 schema / validate / compile
- Agent Backend：负责 research / planning / generation / critique / review workflow

## 当前可用端点

- `GET /health`
- `GET /workflow`
- `POST /topic-framing/dry-run`
- `POST /curriculum-planning/dry-run`
- `POST /draft-course-package/dry-run`
- `POST /module-composition/dry-run`
- `POST /export-course-package/dry-run`
- `POST /export-course-package/write`
- `POST /validate-build/dry-run`

### 目前已经打通的最小闭环

1. 输入 topic
2. 产出 framing / curriculum / module draft
3. 导出 course package 到 `agent-backend/generated/<slug>/`
4. 对导出目录做结构检查
5. 对整个 repo 触发 `npm run check` / `npm run build`

## 运行

```bash
cd agent-backend
python3 -m app.main
```

默认监听：`127.0.0.1:8081`

## 设计原则

1. Workflow-first, agent-assisted, human-gated
2. 优先输出结构化对象，不用自由散文充当主交付
3. 每一阶段都允许失败重试
4. 最终产物要落回 course package

## 现在还没有

- 真实模型调用
- provider secrets 管理
- 队列 / 数据库 / review UI
- course package 正式写回 `courses/`
- 与前端 runtime 的自动接线

它现在的价值是：

> 把 Agent 从“设计文档里的概念”推进成“可本地跑、可导出、可校验的独立后端边界”。
