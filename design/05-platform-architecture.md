# 05. 平台架构 — 引擎、前端、后端分工

> 这份文件定义系统边界和数据流。谁负责什么，数据怎么流，错误怎么处理。

---

## 一、三层架构

```
┌─────────────────────────────────────────────────┐
│                  课程数据层                        │
│  courses/{slug}/course.json + modules/ + visuals/ │
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

## 二、各层职责

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
- **客户端状态**：localStorage 存储掌握度和练习历史
- **不做**：数据校验（引擎已做）、内容生成（Agent 的事）

### Agent 后端
- **是什么**：Python HTTP 服务，零外部依赖（标准库 + urllib）
- **管线**：plan → compose → validate → export → review
- **LLM 接入**：OpenAI 兼容 API（base_url + api_key）
- **约束来源**：`04-agent-contract.md` 编码进 prompt 和 quality check
- **不做**：前端渲染、静态构建

---

## 三、数据流

### 生成流（Agent → 课程）
```
POST /jobs/course-generation {topic: "..."}
  → plan 阶段: LLM 生成课程计划 → normalize → 保存 artifact
  → compose 阶段: 逐模块 LLM 生成 → normalize → checkpoint
  → validate 阶段: 引擎校验 + 质量检查 → 阻塞性问题则失败
  → export 阶段: 写入 generated/{slug}/
  → 等待人工审核
  → POST /jobs/{id}/review {approved: true}
  → promote: 复制到 courses/{slug}/
```

### 构建流（课程 → 网站）
```
npm run check     — 引擎校验所有课程包
npm run build     — Next.js 静态构建
  → generateStaticParams() 遍历所有课程 × 模块
  → 每个模块页调用引擎获取 CompiledCoursePackage
  → ModuleRenderer 根据 moduleKind + knowledgeTypes 选择布局
  → 输出 out/ 静态文件
```

### 学习流（用户 → 客户端）
```
用户访问 /zh/courses/{slug}/{moduleId}
  → 加载静态 HTML + JS bundle
  → 读取 localStorage 获取掌握度状态
  → 根据掌握度决定脚手架级别和条件内容
  → 用户完成练习 → 更新掌握度 → 写回 localStorage
  → 间隔复习提示（基于半衰期公式）
```

---

## 四、错误处理策略

| 场景 | 处理方式 |
|------|---------|
| LLM 返回非法 JSON | provider.py 抛出 ProviderError，compose 阶段标记失败，可重试 |
| LLM 输出不符合 schema | quality.py normalize 阶段修正（类型别名映射）或拒绝 |
| 单模块生成失败 | 模块级 checkpoint 保存已完成模块，重试只重做失败模块 |
| 引擎校验失败 | validate 阶段报告具体错误，阻止 export |
| 质量检查发现阻塞问题 | 阻止 export，返回问题列表供 Agent/人工修复 |
| 构建时课程包损坏 | prebuild check 失败，构建中止 |
| 客户端 localStorage 损坏 | 降级为默认掌握度，不影响内容可读性 |

---

## 五、安全约束

1. **路径验证**：所有 slug 参数必须匹配 `^[a-z0-9-]+$`，阻止路径遍历
2. **API 密钥**：不写入版本控制（.env 在 .gitignore 中），不在响应中暴露
3. **命令执行**：用列表形式（非字符串拼接）调用子进程
4. **超时控制**：所有 subprocess 和 HTTP 请求有硬超时上限
5. **原子写入**：所有文件写入使用 tempfile + rename，防止半写

---

## 六、未来演进方向

### 短期（不改架构）
- Agent 后端换用 FastAPI（消除手写路由和错误处理的脆弱性）
- 文件锁换 SQLite（消除死锁风险）
- 添加 Zod 运行时类型校验到 TypeScript/Python 边界

### 中期（小改架构）
- 客户端掌握度系统上线（localStorage + 条件渲染）
- 概念图从装饰升级为可交互导航
- 交互组件根据 moduleKind 自动匹配（替代手动 componentHint）

### 长期（重构架构）
- 从纯静态导出升级为 ISR（增量静态再生成），支持动态课程
- Agent 后端接入真正的任务队列（Redis/PostgreSQL）
- 学习数据上报 + 课程效果分析
