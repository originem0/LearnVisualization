# LearnVisualization

一个以**可视化学习**为核心的 LLM 原理网站，围绕 token、embedding、注意力、Transformer、训练、对齐、Prompt、scaling、涌现与上下文窗口，做成可读、可看、可交互的静态站点。

线上地址：<https://visualize.sharonzhou.site>

## 技术栈

- Next.js 14
- React 18
- Tailwind CSS
- 静态导出（`output: 'export'`）

## 项目结构

```txt
src/
  app/                 路由与页面
  components/          页面组件与交互组件
  content/zh/          中文内容源（project / categories / modules）
  data/                narrative spec / concept map schemas
  lib/                 数据读取、类型、标签、registry
scripts/               内容校验、结构校验、脚手架
```

## 内容系统

当前站点为 **zh-only**。

模块内容拆分在：

```txt
src/content/zh/modules/
  s01.json
  ...
  s12.json
```

每个模块包含：

- `opening`
- `quote`
- `keyInsight`
- `narrative[]`
- `logicChain`
- `examples`
- `counterexamples`
- `pitfalls`
- `bridgeTo`

叙事 block 规范见：

- `src/data/narrative-block-spec.json`

内容作者说明见：

- `src/content/README.md`

## 开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

## 校验与构建

内容和结构校验：

```bash
npm run check
```

完整构建：

```bash
npm run build
```

构建链包含：

- content completeness
- registry / concept-map schema checks
- split-content structure checks
- narrative authoring checks
- prerender smoke checks

## 新增模块

使用脚手架：

```bash
node scripts/new-module.mjs --id 13 --category frontier --title "你的标题" --subtitle "你的副标题"
```

之后还需要：

1. 填真实内容
2. 在 `src/data/concept-map-schemas.json` 增加概念图 schema
3. 在 `src/lib/module-registry.ts` 里接入交互组件
4. 再跑一次 `npm run check`

## 部署

当前部署方式是：nginx 直接服务仓库中的 `out/`。

所以发布流程就是：

```bash
npm run build
```

构建成功后，`out/` 刷新即上线，**不需要 reload nginx**。

## 设计原则

核心设计约束来自：

- `DESIGN.md`

重点不是术语堆砌，而是：

- 焦点问题驱动
- 概念关系可视化
- 分步理解
- 自己动手验证
- 模块间自然桥接
