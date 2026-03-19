# Agent Backend (MVP Skeleton)

这是 `Learning Site Engine` 的最小独立后端骨架。

目标不是现在就做成复杂 multi-agent 平台，而是先把边界立住：

- Frontend：只负责展示
- Engine：负责 schema / validate / compile
- Agent Backend：负责 research / planning / generation / critique / review workflow

## 为什么单独存在

因为下面这些东西不应该继续塞在前端或静态构建流程里：

- provider keys / secrets
- 长流程任务状态
- research / fetch / retry / caching
- topic framing / curriculum planning / module composition
- critique / review gate

## 当前骨架包含

- `pyproject.toml`：Python 服务依赖声明（FastAPI / Pydantic）
- `app/models.py`：核心输入输出模型
- `app/workflow.py`：工作流阶段定义
- `app/main.py`：最小 API 入口（health / workflow / dry-run framing）
- `.env.example`：配置占位

## 设计原则

1. Workflow-first, agent-assisted, human-gated
2. 输出结构化对象，不输出自由散文作为主交付
3. 任何阶段都允许失败重试
4. 最终产物仍然要落回 course package

## 当前不是

- 还不是可直接生产课程的完整服务
- 还没接模型调用
- 还没接队列 / 数据库 / review UI

它现在的价值是：

> 把 Agent 从“文档中的概念”变成“仓库里的独立后端边界”。
