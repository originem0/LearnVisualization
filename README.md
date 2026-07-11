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
  llm-fundamentals/    精选 legacy 课程（published，含手写交互组件）
  postgresql-internals/  精选 legacy 课程（draft，含手写交互组件）
  git-internals/       精选 legacy 课程
  claude-code/         精选 legacy 课程
  course-*/            旧 AI 生成 legacy 课程（保留校验，默认不公开路由）
agent-backend/         课程生成后端
  app/pipeline.py      essay 生成管线（plan → compose → validate → export）
  app/essay_prompts.py contract-first essay prompt
  app/essay_quality.py 本地章节质量门槛
  app/provider.py      LLM API 客户端
engine/                课程包编译引擎
  course-package-engine.mjs  legacy module-course 引擎
  essay-course-engine.mjs    essay-course 引擎
fixtures/              生成种子与测试夹具
src/
  app/                 路由与页面
  components/          页面组件
    interactive/       27 个手写交互组件（llm/pg 课程专用）
    essay/             essay 课程目录与章节渲染
    InteractionRenderer.tsx  trace 等少量通用高光渲染器
  lib/module-registry.ts  交互组件白名单
design/                设计规范（5 份文件）
```

## 课程生成架构

```txt
用户输入 topic
    ↓
[Clarification] LLM 多轮澄清，提出候选 contract（固定问卷不能替代）
    ├─ 收束差异现象：相比什么不同、哪种条件下失效、直觉与现实哪里冲突
    ├─ 标注问题框定：gap / model_mismatch / system_paradox + 系统目标 + 模型缺口
    ├─ 每轮提问附可点选的候选回答，评审打回的追问基于评审发现生成
    ├─ 异族 LLM 评审契约实质（挡空洞契约），不过则继续追问
    └─ 通过时产出 teachingHooks（具体教学抓手），约束下游生成
    ↓
[User Confirmation] 用户确认候选 contract 后，/jobs/course-generation 才能提交
    ↓
[输入门控] 规则校验 + LLM 主题验证/规范化/语义去重
    ↓
[Research] 搜索+抓取源材料（wiki zh/en + DuckDuckGo），萃取证据库
    ├─ quote 逐字子串机器校验，编造引文直接丢弃
    └─ 可用证据 < 12 条则任务失败（宁缺毋滥）
    ↓
[Plan] LLM 生成 essay spine + 4-6 章章节弧线；factSpine/每章 evidenceIds 必须挂到证据库
    ↓
[Compose] 串行生成 chapter，后章接收前章结尾；章节携带本章证据全文，quote 保真机器校验，judge 走异族 judge_model
    ↓
[Verify] 全课终检：quote/sources/factSpine 机械复查 + 课程级收束评审
    ↓
[Validate] essay 引擎校验 + 本地质量检查
    ↓
[Export] 写入 generated/
    ↓
[Auto-publish] 机器防线全过后自动 promote 到 courses/ → npm run build 成功后才完成
    ↓
[人工策展] 在线上通读成品；不满意则删除课程或重新生成（人类判断后移，不取消）
```

核心设计：**新生成课程是 contract-first narrative essay**。生成结果只包含 `course.json`、`chapters/cNN.json`、`review/approval.json`；不再生成 `modules/`、`visuals/`、`interactions/`。旧 legacy 课程仍可渲染，但公开路由只保留精选课程。生成是开卷的：research 阶段建立带出处的证据库，写作与评审都对着证据进行，发布由机器防线把关（引文逐字校验、证据锚定、交叉评审、全课终检），人工判断保留为发布后的策展——读线上成品，不满意删除或重生成。

## 资源限制

- 每日生成上限：10 次
- 单一调用方每日生成上限：5 次（按管理员 token hash / client identity 计）
- 课程总数上限：50 门（courses/ + generated/）
- 章节生成并发度：1（保证叙事连续）
- 输入校验：最少 2 字符、不接受乱码/聊天语句；LLM 主题验证不可用时不跳过门控

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

危险 POST 接口默认需要独立管理员 token。必须设置 `AGENT_ADMIN_TOKEN`，`AGENT_SETTINGS_PASSWORD` 只用于 LLM 设置面板，不能复用为管理员 token。前端会在首次需要时提示输入，并通过 `X-Agent-Admin-Token` 发送；token 只保存在当前页面内存中。

LLM 配置支持 per-stage 模型：`model`（写作）、`fallback_model`（兜底）、`research_model`（研究，可选）、`clarify_model`（澄清对话，建议强推理模型）、`judge_model`（评审，建议与写作模型异族）。每个 job 的抓取原文保存在 `agent-backend/jobs/<id>/research_sources/` 供审计。

主要端点：

- `POST /api/clarify/start` — 开始澄清
- `POST /api/clarify/respond` — 继续澄清；服务端 gate 通过后返回候选 `contract`，用户确认后才进入生成
- `POST /jobs/course-generation` — 创建课程生成任务
- `GET /jobs` — 列出所有任务
- `GET /jobs/{id}` — 查询任务状态
- `POST /jobs/{id}/cancel` — 取消任务
- `POST /jobs/{id}/retry` — 重试失败任务
- `POST /jobs/{id}/review` — 审核；批准后发布课程并同步构建静态站，构建失败会回滚发布
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
- contract-first：没有澄清契约就不生成；契约必须包含差异现象和问题框定
- 主线问题驱动，章节之间必须有连续叙事
- 交互只作为必要高光，不再为每章强制生成
- 静态导出，客户端自适应
