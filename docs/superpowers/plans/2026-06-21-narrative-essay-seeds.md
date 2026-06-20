# 叙事化重构 · 计划 3：Seeds

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手写 2 个种子课程（explainer + essay 各一），作为 Plan 4 生成引擎的参照样本。种子需展示两种语域的"正确 voice"、事实脊柱、主线连贯性、章节过渡，通过 Plan 1 校验器，并由用户拍板。

**Architecture:** 种子课程是**内容产物**非代码，直接写入 `courses/` 按 Plan 1 契约组织（`course.json` + `chapters/*.json` + `review/approval.json`）。每个种子需在创建过程中反复用 `scripts/validate-essay-course.mjs` 校验，确保契合 schema。种子将被 Plan 4 的 few-shot prompt 直接引用（`prompt_assets.py` 读取 JSON 转模板例子）。

**Tech Stack:** JSON 数据文件 + Plan 1 校验器（Node ESM）+ 用户协作（voice 拍板）。

## Global Constraints

- 两门课必须一门 `register: "explainer"`（技术博主解说腔）、一门 `register: "essay"`（思想随笔腔）。
- 每门课 4–6 章（取决于主题深度，不强制统一）。
- 主题选择优先模型熟悉领域（LLM、Go、Python、认知科学等），避免冷门主题增加打磨成本。
- `drivingQuestion` 必须是真实问题（非教学套话），`centralTension` 揭示真实矛盾。
- `overview.arc` 需预告完整叙事弧线（开始→转折→落点），让读者在第一章前"见到全景"。
- 章节 `role` 分配遵循 spec §4.3：`unfold`（展开脊柱）→ `deepen`（深入细节）→ `pivot`（转向/质疑）→ `converge`（收束洞见）。
- `narrative` blocks 以 `text` 为主（散文段落），`heading` 仅在真正需要结构标识时出现，`callout` 用于关键洞见/警告，`code` 用于代码示例，`quote` 用于引用。
- `highlight` 默认不加（`null`）；仅在确有价值时手动设计 `bespoke` 或 `trace` 互动。
- 每章的 `bridge` 必须连接到下一章的具体内容（不能是"下一章我们继续"这种空话）。
- `status: "published"` + `review/approval.json` 中 `approved: true` + 非空评审。
- 语言全部 `zh`（包括 code comments）。

---

## File Structure

### Explainer 种子（建议主题：LLM 推理机制 / Go 并发模型 / Python 装饰器原理）
- Create: `courses/seed-explainer/course.json`
- Create: `courses/seed-explainer/chapters/c01.json`
- Create: `courses/seed-explainer/chapters/c02.json`
- Create: `courses/seed-explainer/chapters/c03.json`
- Create: `courses/seed-explainer/chapters/c04.json`
- Create: `courses/seed-explainer/chapters/c05.json` (optional, 取决于主题)
- Create: `courses/seed-explainer/review/approval.json`

### Essay 种子（建议主题：理解的本质 / 工具塑造思维 / 抽象的代价）
- Create: `courses/seed-essay/course.json`
- Create: `courses/seed-essay/chapters/c01.json`
- Create: `courses/seed-essay/chapters/c02.json`
- Create: `courses/seed-essay/chapters/c03.json`
- Create: `courses/seed-essay/chapters/c04.json`
- Create: `courses/seed-essay/review/approval.json` (optional c05.json)

---

## Task 1: 确定种子主题与大纲

**Dependencies:** Plan 1 完成（校验器可用）。

**Non-TDD:** 这是内容设计任务，需用户协作。

- [ ] **Step 1.1: 提议 explainer 主题**

  阅读用户 memory/CLAUDE.md，识别其技术背景（Python/ops-comfortable/expects root-cause）。提议 3 个候选主题：
  
  1. **LLM 推理机制**：temperature/top-p/采样如何影响输出分布（适合后端 LLM 用户）。
  2. **Python 异步 IO**：asyncio 事件循环、协程、任务调度的底层机制（适合 Python 背景）。
  3. **Git 内部对象模型**：blob/tree/commit 如何存储、引用如何解析（适合 ops 背景）。
  
  询问用户偏好或自选主题。**等待用户确认。**

- [ ] **Step 1.2: 提议 essay 主题**

  essay 需思辨性主题（非纯技术）。提议 3 个候选：
  
  1. **抽象的代价**：抽象带来复用性，但也隐藏了真实复杂度——何时抽象是负优化？（呼应用户"根因思维"）
  2. **工具塑造思维**：不同编程语言/框架如何影响问题分解方式（"你用的锤子决定你看到的钉子"）。
  3. **理解的幻觉**：能解释 ≠ 能预测 ≠ 能迁移——真正理解的边界在哪里？（呼应用户 PERO 学习系统背景）
  
  询问用户偏好或自选主题。**等待用户确认。**

- [ ] **Step 1.3: 起草 explainer 大纲**

  确定主题后，设计：
  - `drivingQuestion`（一句话核心问题）
  - `centralTension`（核心矛盾/张力）
  - `overview.whyExists`（为什么这个主题值得存在）
  - `overview.wherePoints`（学完后能到达哪里）
  - `overview.arc`（完整叙事弧线：开始→转折→落点）
  - 4–6 章的章名 + `role` + 一句话内容摘要
  - 识别可能的 `highlight` 位置（如需代码 trace 或可视化互动）
  
  **输出草稿，等待用户反馈。**

- [ ] **Step 1.4: 起草 essay 大纲**

  同样设计 essay 的 `drivingQuestion`、`centralTension`、`overview`、章节弧线。
  
  essay 与 explainer 的差异：
  - explainer 的章节按"机制展开"组织（what → how → why → when）；
  - essay 的章节按"论证推进"组织（现象 → 追问 → 反例 → 洞见）。
  
  **输出草稿，等待用户反馈。**

---

## Task 2: 撰写 explainer 种子课程

**Dependencies:** Task 1 完成（大纲确认）。

**Non-TDD:** 内容创作，但每个 step 完成后需跑校验。

- [ ] **Step 2.1: 写 `course.json`**

  ```json
  {
    "id": "seed-explainer",
    "slug": "seed-explainer",
    "title": "[用户确认的标题]",
    "subtitle": "[副标题]",
    "topic": "[主题关键词]",
    "language": "zh",
    "status": "published",
    "register": "explainer",
    "knowledgeType": "conceptual",  // 或 procedural，视主题
    "drivingQuestion": "[从大纲复制]",
    "centralTension": "[从大纲复制]",
    "overview": {
      "whyExists": "[2-3 句，为什么这个主题值得投入时间]",
      "wherePoints": "[2-3 句,学完能做什么/理解什么]",
      "arc": "[3-5 句，完整叙事弧线预告]"
    },
    "chapters": [
      {"number": 1, "title": "[章 1 标题]", "slug": "c01"},
      {"number": 2, "title": "[章 2 标题]", "slug": "c02"},
      {"number": 3, "title": "[章 3 标题]", "slug": "c03"},
      {"number": 4, "title": "[章 4 标题]", "slug": "c04"}
      // 如需 5-6 章则继续
    ]
  }
  ```
  
  创建文件后立即跑 `node scripts/validate-essay-course.mjs courses/seed-explainer`，确保无 schema 错误。

- [ ] **Step 2.2: 写第一章 `c01.json`**

  第一章通常 `role: "unfold"`，承担"事实脊柱"展开任务。参考 spec §4.3 与 §7 防八股要求：
  - **开头不要摆拍场景**（删掉"晚上七点…最不对劲的是…"这类套路）。
  - **从真实问题/现象切入**："你可能注意到 X 行为…" / "Y 现象背后是 Z 机制…"
  - **先见树再见林**：用一个具体例子引出整体机制（worked example → generalization）。
  - **narrative blocks 以散文 `text` 为主**，heading 稀疏。
  - **code blocks 必须可运行**（Python/Go/JS 等，取决于主题）。
  - **bridge 连接下章**：不能是空话，要点出下章具体内容（"但这只是表层，X 机制的真正复杂度在 [下章主题]"）。
  
  ```json
  {
    "number": 1,
    "title": "[章名]",
    "role": "unfold",
    "narrative": [
      {"type": "text", "content": "[开头段落,引出问题]"},
      {"type": "text", "content": "[第二段,给出具体例子]"},
      {"type": "code", "language": "python", "content": "# 示例代码\n..."},
      {"type": "text", "content": "[解释例子,引出机制]"},
      {"type": "heading", "level": 2, "content": "[可选小节标题]"},
      {"type": "text", "content": "[继续论证]"},
      {"type": "callout", "variant": "insight", "content": "[关键洞见]"}
    ],
    "highlight": null,  // 或设计一个 bespoke/trace
    "bridge": "[连接下章的具体预告]"
  }
  ```
  
  写完后跑校验。

- [ ] **Step 2.3: 写第二章 `c02.json`**

  通常 `role: "deepen"`，深入第一章引出的机制细节。保持主线连贯（复现 `drivingQuestion` 的关键词/motif）。

  写完后跑校验。

- [ ] **Step 2.4: 写第三章 `c03.json`**

  可能是 `deepen` 或 `pivot`（如需引入反例/边界情况）。

  写完后跑校验。

- [ ] **Step 2.5: 写第四章 `c04.json`**

  通常 `role: "converge"`，回应 `drivingQuestion`，给出总结性洞见（但不是 bullet 总结，而是"站在更高处回看全程"的散文段）。

  最后一章的 `bridge` 可以是 `null` 或指向"下一步探索方向"。

  写完后跑校验。

- [ ] **Step 2.6: （可选）写第五/六章**

  如主题需要更多章节，继续补充 `c05.json` / `c06.json`。注意 `role` 平衡（不要全是 `deepen`）。

  写完后跑校验。

- [ ] **Step 2.7: 写 `review/approval.json`**

  ```json
  {
    "approved": true,
    "reviewer": "human+claude",
    "reviewDate": "2026-06-21",
    "comments": "Explainer seed: [主题]. Voice established via co-authoring. Passes schema validation. Ready as few-shot template.",
    "issues": []
  }
  ```

- [ ] **Step 2.8: 最终校验 + 用户审阅**

  跑 `node scripts/validate-essay-course.mjs courses/seed-explainer`，确保 `ok: true`。
  
  **邀请用户审阅全文**：是否符合"技术博主解说腔"预期、主线是否连贯、事实脊柱是否扎实。根据反馈迭代。

---

## Task 3: 撰写 essay 种子课程

**Dependencies:** Task 1 完成（大纲确认）；Task 2 可并行或串行（如用户希望先看一个种子再写另一个）。

**Non-TDD:** 内容创作 + 校验。

- [ ] **Step 3.1: 写 `course.json`**

  与 Task 2.1 类似，但 `register: "essay"` + `knowledgeType: "principled"` 或 `"conceptual"`（essay 多为思辨性主题）。

  ```json
  {
    "id": "seed-essay",
    "slug": "seed-essay",
    "title": "[用户确认的标题]",
    "subtitle": "[副标题]",
    "topic": "[主题]",
    "language": "zh",
    "status": "published",
    "register": "essay",
    "knowledgeType": "principled",
    "drivingQuestion": "[核心追问]",
    "centralTension": "[核心张力]",
    "overview": {
      "whyExists": "[为什么这个思辨值得]",
      "wherePoints": "[思考完能到达的认知位置]",
      "arc": "[论证弧线]"
    },
    "chapters": [
      {"number": 1, "title": "[章 1]", "slug": "c01"},
      {"number": 2, "title": "[章 2]", "slug": "c02"},
      {"number": 3, "title": "[章 3]", "slug": "c03"},
      {"number": 4, "title": "[章 4]", "slug": "c04"}
    ]
  }
  ```
  
  创建后跑校验。

- [ ] **Step 3.2: 写第一章 `c01.json`**

  essay 的第一章 (`role: "unfold"`) 需做到：
  - **从观察/疑问切入**（不是抽象定义）："我们常说 X，但仔细想 Y 并不成立…"
  - **呈现张力**：揭示 `centralTension` 的具体表现（不是列举，而是讲一个让人"感到不对劲"的故事/例子）。
  - **立场登场**：essay 需要一个"我"的视角（explainer 是"我们一起看"，essay 是"我认为/我疑惑"）。
  - **不堆砌术语**：essay 可以引概念，但作为"论证工具"随用随引，不作知识点罗列。
  
  ```json
  {
    "number": 1,
    "title": "[章名]",
    "role": "unfold",
    "narrative": [
      {"type": "text", "content": "[开篇疑问/观察]"},
      {"type": "text", "content": "[具体例子/故事]"},
      {"type": "text", "content": "[追问,揭示张力]"},
      {"type": "callout", "variant": "question", "content": "[关键追问]"}
    ],
    "highlight": null,
    "bridge": "[引向下章论证]"
  }
  ```
  
  写完后跑校验。

- [ ] **Step 3.3: 写第二章 `c02.json`**

  `role: "deepen"` 或 `"pivot"`（essay 的论证推进比 explainer 更非线性）。深入第一章的张力，引入新视角或反例。

  写完后跑校验。

- [ ] **Step 3.4: 写第三章 `c03.json`**

  可能是 `pivot`（转向/质疑之前的论证）或继续 `deepen`。essay 允许"自我推翻"——前面铺陈的观点在这里遇到挑战。

  写完后跑校验。

- [ ] **Step 3.5: 写第四章 `c04.json`**

  `role: "converge"`，但 essay 的收束不是"总结知识点"，而是"站在新高度重新看问题"或"承认无解但指出方向"。参考用户提供的北极星 `github.com/originem0/script_background` 的收束风格。

  写完后跑校验。

- [ ] **Step 3.6: （可选）写第五章**

  如论证需要更多空间（如引入第三个反例、或多层嵌套论证），补充 `c05.json`。

  写完后跑校验。

- [ ] **Step 3.7: 写 `review/approval.json`**

  ```json
  {
    "approved": true,
    "reviewer": "human+claude",
    "reviewDate": "2026-06-21",
    "comments": "Essay seed: [主题]. 思想随笔腔 established. 主线连贯,有立场,有张力. Passes schema. Ready as template.",
    "issues": []
  }
  ```

- [ ] **Step 3.8: 最终校验 + 用户审阅**

  跑 `node scripts/validate-essay-course.mjs courses/seed-essay`，确保 `ok: true`。
  
  **邀请用户审阅全文**：是否达到"思想随笔腔"、是否有真实张力（非装深刻）、立场是否清晰。根据反馈迭代。

---

## Task 4: 打磨与 voice 拍板

**Dependencies:** Task 2 + Task 3 完成初稿。

**Non-TDD:** 人机协作迭代。

- [ ] **Step 4.1: 交叉检查两门课的差异化**

  对比 explainer 和 essay 的语气、结构、论证方式，确保：
  - explainer 是"解说"（我们一起看机制）≠ essay 是"思考"（我带你追问）。
  - explainer 章节按机制展开 ≠ essay 章节按论证推进。
  - explainer 开头引问题+例子 ≠ essay 开头引张力+立场。
  
  **如差异不明显**，回到 Task 2/3 调整语域。

- [ ] **Step 4.2: 事实脊柱检查（防 AI 味）**

  逐章检查：
  - 是否有具体例子/代码/数据支撑（非空泛比喻）？
  - 是否有"为比喻而比喻"或硬凑金句的段落？
  - 是否点名哲学家/理论但未实质使用（充门面）？
  
  **标记可疑段落**，重写为更扎实的论证或删除。

- [ ] **Step 4.3: 主线连贯性检查**

  - `drivingQuestion` 的关键词是否在每章复现（作 motif）？
  - 每章的 `bridge` 是否真正连接到下章内容（而非空话）？
  - 最后一章是否回应了 `drivingQuestion`（converge 角色）？
  
  **如主线断裂**，补充 bridge 或调整章节内容。

- [ ] **Step 4.4: 用户 voice 拍板**

  将两门种子课完整呈现给用户（可生成 HTML preview 或直接读 JSON），询问：
  - 这两种 voice 是否符合预期的"技术博主解说腔"和"思想随笔腔"？
  - 是否有"AI 味八股"残留（装深刻/硬凑比喻/空洞术语）？
  - 是否愿意以此为模板生成其他课程？
  
  **根据反馈最终调整**，直到用户拍板"这就是我们要的 voice"。

---

## Task 5: 文档化种子用途

**Dependencies:** Task 4 完成（种子拍板）。

**Non-TDD:** 写一份简短 README。

- [ ] **Step 5.1: 创建 `courses/seeds-README.md`**

  ```markdown
  # 种子课程 (Seed Courses)
  
  本目录包含 2 个手工打造的种子课程,作为叙事化生成引擎 (Plan 4) 的 few-shot 模板。
  
  ## 种子列表
  
  - **`seed-explainer/`**: [主题] — 展示 `register: "explainer"` (技术博主解说腔) 的正确 voice、事实脊柱、章节过渡。
  - **`seed-essay/`**: [主题] — 展示 `register: "essay"` (思想随笔腔) 的立场表达、张力呈现、论证推进。
  
  ## 用途
  
  1. **Plan 4 few-shot prompt**: `agent-backend/app/prompt_assets.py` 读取种子 JSON,抽取结构+语域模式,注入生成 prompt。
  2. **质量闸基准**: `agent-backend/app/quality.py` 的 LLM 评审闸可参考种子的"事实密度"作对比基准。
  3. **前端样式开发**: Plan 5 前端阅读器开发时,种子作真实数据测试渲染效果。
  
  ## 维护
  
  种子内容不应频繁改动（改动会影响生成一致性）。如需调整 voice,应：
  1. 在种子上实验新 voice。
  2. 用新 voice 生成 1-2 门课测试效果。
  3. 确认后批量更新种子 + 重生成已有课程。
  ```

---

## Verification

每个 Task 的 step 完成后都需跑 `node scripts/validate-essay-course.mjs courses/seed-[explainer|essay]`，确保：
- `result.ok === true`
- `result.errors.length === 0`

最终检查清单：
- [ ] `courses/seed-explainer/` 通过校验，`status: "published"`, `approved: true`。
- [ ] `courses/seed-essay/` 通过校验，`status: "published"`, `approved: true`。
- [ ] 两门课的 `register` 正确（一个 `explainer`，一个 `essay`）。
- [ ] 两门课的 voice 明显差异化（用户已拍板）。
- [ ] 事实脊柱扎实（无 AI 味八股）。
- [ ] 主线连贯（`drivingQuestion` → 章节 → `converge`）。
- [ ] `courses/seeds-README.md` 已创建。

---

## Dependencies

- **Plan 1 (Data Contract)** 必须完成：`essay-course-engine.mjs` + `validate-essay-course.mjs` + TS types 可用。
- **Plan 2 (Design Document Rewrite)** 可并行或先行（不阻塞 Plan 3，但如 Plan 2 先完成，种子写作可参考新设计文档的叙事哲学）。
- **用户协作** 是本计划关键依赖：主题选择（Task 1.1-1.2）、大纲确认（Task 1.3-1.4）、voice 拍板（Task 4.4）。

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| 用户对种子不满意，反复迭代耗时 | 阻塞 Plan 4 | 在 Task 1 大纲阶段充分对齐预期；Task 2/3 逐章审阅（而非全写完再看） |
| 种子仍有 AI 味（装深刻/硬凑比喻） | Plan 4 生成质量差 | Task 4.2 专门检查事实脊柱；用户严格把关（宁可重写也不妥协） |
| 两种 voice 差异不明显 | 生成引擎无法区分语域 | Task 4.1 交叉检查；必要时参考用户提供的 `github.com/originem0/script_background` 调整 essay 腔调 |
| 主题选择过冷门，打磨成本高 | 进度延误 | Task 1.1-1.2 限定在模型熟悉领域（LLM/Go/Python/认知科学） |

---

## Out of Scope (本计划不做)

- **生成引擎开发**（属 Plan 4）：本计划只产出种子内容，不写 few-shot prompt 或生成逻辑。
- **前端阅读器**（属 Plan 5）：种子只需通过 JSON 校验，不需渲染为可视化页面（虽然可用 Plan 5 开发时作测试数据）。
- **批量迁移旧课**（属 Plan 6）：种子是新模型的模板，不涉及旧课转换。
- **Bespoke 互动组件开发**：如种子需互动，使用现有 `llm-fundamentals` 的 bespoke 组件（如 trace），不新造。

---

## Success Criteria

1. 2 个种子课程（explainer + essay）已创建，通过 Plan 1 校验器。
2. 用户拍板："这两种 voice 就是我们要的，可以作为生成模板"。
3. 事实脊柱扎实，无明显 AI 味八股。
4. 主线连贯，章节过渡自然。
5. `courses/seeds-README.md` 记录了种子用途与维护原则。
6. Plan 4 可直接读取种子 JSON 作 few-shot 例子。
