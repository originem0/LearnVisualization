# LearnVisualization

复杂知识学习引擎。把复杂知识转化成可被理解、可被穿透、可被迁移的学习体验。

线上地址：<https://visualize.sharonzhou.site>

## 技术栈

- Next.js 14（静态导出）
- React 18 + TypeScript
- Tailwind CSS
- Python agent-backend（零依赖 dev server）

## 项目结构

```txt
courses/             课程包（主内容源）
  llm-fundamentals/  LLM 原理课程（published）
  postgresql-internals/  PostgreSQL 内部原理（draft）
agent-backend/       课程生成后端（topic → curriculum → export → promote）
engine/              引擎边界与架构说明
research/            研究与设计输入文档
scripts/             内容校验、结构校验、脚手架、nginx 规则生成
src/
  app/               路由与页面
  components/        页面组件与交互组件
  data/              narrative spec / concept map schemas
  lib/               数据读取、类型、schema、adapter
```

## 内容系统

当前站点为 **zh-only**，支持多课程。

首页 `/zh/` 是课程总入口，列出所有课程。每个课程在 `/zh/courses/{slug}/` 下有独立的首页、模块页、知识地图和时间线。

每个课程包结构：

```txt
courses/{slug}/
  course.json          课程元数据、目标、分类、模块图
  modules/             模块定义（s01.json, s02.json, ...）
  visuals/             概念图数据
  interactions/        交互组件映射
  review/approval.json 人工审核通过记录
```

叙事 block 规范：`src/data/narrative-block-spec.json`

内容作者说明：`src/content/README.md`

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
npm run check   # 内容、registry、结构、authoring 校验（覆盖所有课程）
npm run build   # prebuild 校验 + Next.js 构建 + prerender smoke check
```

## Agent Backend

课程生成后端，支持 topic framing → curriculum planning → module composition → export → promote 工作流。

```bash
cd agent-backend
python3 -m app.main   # http://127.0.0.1:8081
```

主要端点：

- `POST /topic-classification/dry-run` — 主题类型分类
- `POST /curriculum-planning/dry-run` — 按主题类型生成课程骨架
- `POST /export-course-package/write` — 导出到 generated/
- `POST /promote-course-package/dry-run` — 预检晋升
- `POST /promote-course-package/write` — 晋升到 courses/

生成的内容标记 `_scaffold: true`，并写出 `review/approval.json` 占位文件。没有人工审核通过记录的包，`promote` 会直接拒绝。

## 部署

nginx 直接服务 `out/` 目录。

```bash
npm run build
# out/ 刷新即上线，不需要 reload nginx
```

旧 URL 重定向规则：

```bash
node scripts/generate-nginx-redirects.mjs > nginx-redirects.conf
# 在 nginx server block 中 include 即可获得 301 重定向
```

## 设计原则

核心设计约束见 `DESIGN.md`。

- 焦点问题驱动
- 概念关系可视化
- 分步理解
- 自己动手验证
- 模块间自然桥接
