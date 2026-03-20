# LearnVisualization

复杂知识学习引擎。把复杂知识转化成可被理解、可被穿透、可被迁移的学习体验。

线上地址：<https://visualize.sharonzhou.site>

## 技术栈

- Next.js 14（静态导出 `output: 'export'`）
- React 18 + TypeScript
- Tailwind CSS（`darkMode: 'class'`）
- Python agent-backend（零第三方依赖）

## 项目结构

```txt
courses/               课程包（主内容源）
  llm-fundamentals/    LLM 原理课程（published，含手写交互组件）
  postgresql-internals/  PostgreSQL 原理（draft，含手写交互组件）
  git-internals/       Git 内部原理（AI 生成）
  ...                  更多 AI 生成课程
agent-backend/         课程生成后端
  app/pipeline.py      生成管线（plan → compose → validate → export → build）
  app/prompt_assets.py 提示词工程
  app/quality.py       内容规范化 + 质量检查
  app/provider.py      LLM API 客户端
engine/                课程包编译引擎
src/
  app/                 路由与页面
  components/          页面组件
    interactive/       27 个手写交互组件（llm/pg 课程专用）
    InteractionRenderer.tsx  数据驱动通用交互渲染器（AI 生成课程用）
  lib/module-registry.ts  交互组件白名单
design/                设计规范（5 份文件）
```

## 课程生成架构

```txt
用户输入 topic
    ↓
[输入门控] 规则校验 + LLM 主题验证/规范化/语义去重
    ↓
[Plan] LLM 生成课程计划（模块大纲、知识类型、认知层级）
    ↓
[Compose] 并发生成模块内容（3 worker 线程）+ 交互数据（JSON）
    ↓
[Validate] 引擎校验 + 质量检查
    ↓
[Export] 写入 generated/ → 自动 promote 到 courses/ → npm run build
```

核心设计：**交互组件不生成代码，生成数据**。5 种通用渲染器（compare/trace/simulate/classify/rebuild）根据 JSON 数据渲染交互 UI。

## 资源限制

- 每日生成上限：10 次
- 课程总数上限：50 门（courses/ + generated/）
- 模块并发度：3
- 输入校验：最少 2 字符、不接受乱码/聊天语句、LLM 验证有效性

## 开发

```bash
npm install
npm run dev
```

```bash
npm test    # node:test + python unittest
```

## 校验与构建

```bash
npm run check   # 内容、registry、结构、authoring 校验
npm run build   # prebuild 校验 + Next.js 构建 + prerender smoke check
```

## Agent Backend

```bash
cd agent-backend
python3 -m app.main   # http://127.0.0.1:8081
```

主要端点：

- `POST /jobs/course-generation` — 创建课程生成任务
- `GET /jobs` — 列出所有任务
- `GET /jobs/{id}` — 查询任务状态
- `POST /jobs/{id}/cancel` — 取消任务
- `POST /jobs/{id}/retry` — 重试失败任务
- `GET /courses` — 列出已有课程
- `POST /courses/{slug}/delete` — 删除课程

## 部署

nginx 直接服务 `out/` 目录，agent-backend 通过 `/api/agent/` 反向代理。

```bash
npm run build
# out/ 刷新即上线
```

## 设计原则

核心设计约束见 `DESIGN.md` + `design/` 目录。

- 学习科学驱动（Merrill 五原则、认知负荷理论、必要难度）
- AI 辅助生成，人类把关质量
- 焦点问题驱动，概念关系可视化
- 数据驱动交互（不生成代码，生成结构化数据）
- 静态导出，客户端自适应
