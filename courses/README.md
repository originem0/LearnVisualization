# Courses

主内容源目录。每个子目录是一个独立课程包。

```txt
courses/
  llm-fundamentals/       LLM 原理课程（published，12 模块）
  postgresql-internals/   PostgreSQL 内部原理（draft，6 模块）
  git-internals/          精选 legacy 课程
  claude-code/            精选 legacy 课程
  course-*/               历史 AI 生成 legacy 包，默认不公开
```

新生成课程使用 essay-course 结构：

```txt
{slug}/
  course.json             课程 spine：drivingQuestion、centralTension、overview、chapters
  chapters/               章节内容（c01.json, c02.json, ...）
  review/approval.json    人工审核记录
```

legacy 课程包结构：

```txt
{slug}/
  course.json             课程元数据、分类、模块图
  modules/                模块内容（s01.json, s02.json, ...）
  visuals/                概念图数据
  interactions/           交互组件映射
  review/approval.json    人工审核通过记录（published 必需，promote 门禁读取）
```

新课程可以通过 agent-backend 的 promote 链路从 `agent-backend/generated/` 晋升到这里。

校验命令 `npm run check` 会自动遍历所有课程包。draft 课程的 registry 校验降级为 warning。公开静态路由只包含 essay 课程和精选 legacy 课程：`llm-fundamentals`、`postgresql-internals`、`git-internals`、`claude-code`。
