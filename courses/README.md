# Courses

主内容源目录。每个子目录是一个独立课程包。

```txt
courses/
  llm-fundamentals/       LLM 原理课程（published，12 模块）
  postgresql-internals/   PostgreSQL 内部原理（draft，6 模块）
```

每个课程包结构：

```txt
{slug}/
  course.json             课程元数据、分类、模块图
  modules/                模块内容（s01.json, s02.json, ...）
  visuals/                概念图数据
  interactions/           交互组件映射
  review/approval.json    人工审核通过记录（published 必需，promote 门禁读取）
```

新课程可以通过 agent-backend 的 promote 链路从 `agent-backend/generated/` 晋升到这里。

校验命令 `npm run check` 会自动遍历所有课程包。draft 课程的 registry 校验降级为 warning。
