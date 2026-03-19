# Agent Backend (MVP Skeleton)

这是 `Learning Site Engine` 的最小独立后端骨架。

当前版本优先目标不是“框架漂亮”，而是：

> **在这台机器上真的能跑起来。**

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

其中 `module-composition/dry-run`：
- 对 `PostgreSQL Internals` 可以直接返回仓库中现有模块 JSON 草案
- 对通用 topic 会返回一个结构化模块模板

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
- export course package 写回
- validate/build 自动串联

它现在的价值是：

> 把 Agent 从“设计文档里的概念”推进成“可本地跑、可吐结构化草案的独立后端边界”。
