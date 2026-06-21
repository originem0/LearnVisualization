# 05. 平台架构 — 引擎、前端、后端分工

> 这份文件定义系统边界和数据流。谁负责什么，数据怎么流，错误怎么处理。

---

## 一、三层架构

```
┌─────────────────────────────────────────────────┐
│                  课程数据层                        │
│  essay: course.json + chapters/ + review/         │
│  legacy: course.json + modules/ + visuals/        │
│  纯 JSON，无逻辑，可版本控制                        │
└────────────────────┬────────────────────────────┘
                     │ 读取
┌────────────────────▼────────────────────────────┐
│                  引擎层 (Node.js)                  │
│  加载 → 校验 → 编译 → 输出运行时对象                │
│  engine/course-package-engine.mjs                 │
└────────────────────┬────────────────────────────┘
                     │ 提供编译结果
┌────────────────────▼────────────────────────────┐
│               前端层 (Next.js SSG)                 │
│  course-package-adapter.ts → React cache           │
│  → ModuleRenderer → 静态 HTML                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│             Agent 后端 (Python)                    │
│  LLM 调用 → 结构化输出 → 校验 → 导出到课程数据层     │
│  独立进程，不参与前端构建                             │
└─────────────────────────────────────────────────┘
```

---

## 二、双引擎并存（迁移期）

在 narrative-essay 模型迁移期间，系统同时支持两套引擎：

- **旧引擎**：`engine/course-package-engine.mjs` — 12-module 模型（遗留课程）
- **新引擎**：`engine/essay-course-engine.mjs` — essay-course 模型（新课程）
- **路由判断**：前端通过包形状判断走哪条渲染路径
  - 存在 `chapters/` 且 `course.json.chapters` 为数组 → 调用新引擎 + EssayChapterRenderer
  - 否则调用旧引擎 + ModuleRenderer
- **数据隔离**：两类课程的数据 schema 互不干扰，可独立演进
- **公开策略**：essay 课程默认公开；legacy 只公开精选课程

---

## 四、各层职责

### 课程数据层
- **是什么**：纯 JSON 文件，遵循 `02-content-model.md` 定义的 schema
- **谁写入**：Agent 后端（自动生成）或人工作者
- **约束**：所有写入必须通过引擎校验后才能合并到主分支

### 引擎层
- **是什么**：Node.js 模块，负责加载、校验、编译课程包
- **输入**：磁盘上的课程 JSON 文件
- **输出**：CompiledCoursePackage（解析引用、生成运行时映射）
- **校验内容**：
  - 结构完整性（文件存在、ID 匹配、编号连续）
  - 内容完整性（必选字段、narrative 块合法性）
  - 注册表一致性（视觉/交互引用可解析）
  - 脚手架标记（`_scaffold: true` 阻止发布）
  - 审批状态（发布需要 approved: true）
- **不做**：教学质量判断（那是 quality.py 和人工审核的事）

### 前端层
- **是什么**：Next.js 静态导出，构建时调用引擎获取数据
- **渲染契约**：遵循 `03-rendering-contract.md`
- **组件白名单**：`module-registry.ts` 控制允许加载的交互组件
- **客户端状态**：无。公开静态课程站，所有用户看相同内容，不跟踪个人学习状态
- **不做**：数据校验（引擎已做）、内容生成（Agent 的事）

### Agent 后端
- **是什么**：Python HTTP 服务，零外部依赖（标准库 + urllib）
- **管线**：clarify → contract gate → plan → compose → validate → export → review → promote/build
- **LLM 接入**：OpenAI 兼容 API（base_url + api_key），支持运行时热切换（runtime-config.json + 设置面板）
- **约束来源**：学习科学理论编码进 prompt（Merrill、Bloom、Sweller、Bjork、Mayer、Novak），不依赖 quality check 阻断
- **垃圾清理**：启动时自动清理 staging 残留、过期 failed/cancelled job、已 promote 的 generated 副本
- **并发控制**：npm build 全局锁防止并发写坏 out/；compose 阶段串行生成章节，保证叙事连续
- **不做**：前端渲染、静态构建（但触发构建）

---

## 五、数据流

### 生成流（Agent → 课程）

```
POST /clarify/start {topic: "..."}
  → LLM 生成第一问
POST /clarify/respond {conversationId, answer}
  → LLM 追问或合成 contract
POST /jobs/course-generation {topic: "...", contract: {...}}
  → plan 阶段: LLM 生成 spine（核心论点）+ 4-6 章标题 → normalize → 保存 artifact
  → compose 阶段: 串行生成各章（后章引用前章摘要） → essay_schema.py normalize → checkpoint
  → validate 阶段: 新引擎校验 + LLM judge 质量打分
  → export 阶段: 写入 generated/{slug}/
  → 等待人工审核
  → POST /jobs/{id}/review {approved: true}
  → promote: 复制到 courses/{slug}/
```

### 构建流（课程 → 网站）
```
npm run check     — 引擎校验所有课程包
npm run build     — Next.js 静态构建
  → generateStaticParams() 遍历公开课程
  → essay 课程生成 chapter 路由
  → legacy 课程生成 module 路由
  → 按包形状选择 EssayChapterRenderer 或 ModuleRenderer
  → 输出 out/ 静态文件
```

### 学习流（用户 → 客户端）
```
用户访问 /zh/courses/{slug}/{chapterOrModuleId}
  → 加载静态 HTML + JS bundle
  → 渲染课程内容（所有用户相同）
  → 无个人状态跟踪
```

---

## 六、错误处理策略

| 场景 | 处理方式 |
|------|---------|
| LLM 返回非法 JSON | provider.py 抛出 ProviderError，compose 阶段标记失败，可重试 |
| LLM 输出缺少非核心字段 | normalize 层填充 fallback 默认值，不拒绝 |
| LLM 输出包含未知字段/类型 | normalize 层透传保留，前端 fallback 渲染 |
| clarification LLM 不可用 | 前端不得用固定问卷替代 contract；提示配置/重试 |
| 单章节生成失败 | chapter checkpoint 保存已完成章节，错误信息指向失败 chapter |
| 引擎校验失败 | essay schema error 阻止 export，warning 进入 review |
| 并发 npm build | 全局 _build_lock 串行化，后到的 build 跳过 |
| 进程崩溃留下锁文件 | job_store 文件锁检测残留 PID，进程已死则清除 |
| staging 目录泄漏 | validate 异常时清理；启动时 cleanup_stale_data 全量扫描 |
| 构建时课程包损坏 | prebuild check 仅对已知块类型校验，未知类型跳过 |
| 客户端 localStorage 损坏 | 降级为默认掌握度，不影响内容可读性 |

---

## 七、安全约束

1. **路径验证**：所有 slug 参数必须匹配 `^[a-z0-9-]+$`，阻止路径遍历
2. **API 密钥**：不写入版本控制（.env 在 .gitignore 中），不在响应中暴露
3. **命令执行**：用列表形式（非字符串拼接）调用子进程
4. **超时控制**：所有 subprocess 和 HTTP 请求有硬超时上限
5. **原子写入**：所有文件写入使用 tempfile + rename，防止半写

---

## 八、未来演进方向

### 短期（不改架构）
- ~~Agent 后端换用 FastAPI~~ 当前手写路由 + 全局异常捕获已基本够用
- ~~文件锁换 SQLite~~ 已实现 PID 检测的死锁防护
- essay 章节阅读体验继续打磨（目录、长文排版、少量高光）
- 公开课程治理：legacy 白名单、essay publish 审核

### 中期（小改架构）
- review UI 独立化
- seed examples 按 register 扩充

### 长期（重构架构）
- 从纯静态导出升级为 ISR（增量静态再生成），支持动态课程
- Agent 后端接入真正的任务队列（Redis/PostgreSQL）
- 学习数据上报 + 课程效果分析
