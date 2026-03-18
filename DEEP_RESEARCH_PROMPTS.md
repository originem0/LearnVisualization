# Deep Research Prompts

这份文件不是泛泛的“搜资料关键词”，而是给 Deep Research / Claude / Gemini / ChatGPT 之类研究型模型直接使用的**任务提示词套件**。

目标只有一个：

> 为 `LearnVisualization` 抽象出一个 **Learning Site Engine（可视化学习站引擎）**，并设计一个 **Agent 作为内容生成入口**。

研究分三块：

1. 学习科学与认知机制
2. 学习站引擎 / 模板引擎架构
3. AI 驱动 / Agent 架构

---

# 使用说明

建议每次只跑一块研究，不要一锅炖。

输出时强制要求模型：

- 只保留高价值资料
- 优先论文、研究综述、大学/政府/知名研究机构资料
- 不要空泛趋势文章
- 每个结论都要回答：**这对我们的产品设计意味着什么？**

---

# Prompt 1 — 学习科学 / 认知机制 Deep Research

## 目标

研究“复杂知识为什么难学、什么样的表达结构更容易让人理解和记住”，并把结论转成可视化学习网站的产品原则。

## Prompt

```md
You are doing deep research for a product called LearnVisualization.

Product context:
- It is not a generic article site.
- It aims to teach complex knowledge (starting with LLMs) through visual explanations, concept maps, step-by-step derivations, interactive checks, and chapter-to-chapter bridges.
- The long-term goal is to abstract this into a reusable Learning Site Engine.

Your research task:
Investigate the learning-science and cognitive-science foundations that explain how people learn complex, high-element-interactivity topics, and what instructional structures best support understanding, retention, and transfer.

Focus especially on these themes:
1. Cognitive Load Theory
2. Element Interactivity
3. Worked Example Effect
4. Example-based learning
5. Generative Learning
6. Mayer’s Multimedia Learning principles
7. Signaling / Segmenting / Coherence / Contiguity principles
8. Retrieval Practice / Testing Effect
9. Concept Maps / external knowledge representations
10. Threshold Concepts
11. Mental Models / Schema Acquisition
12. Self-explanation Effect
13. Conceptual Change / misconceptions
14. Learning Progressions / scaffolding for complex topics
15. Transfer of Learning

What I need from you:
1. A synthesis of the strongest ideas, not a literature dump.
2. Distinguish well-supported findings from weaker or debated claims.
3. Explain how each principle applies specifically to an online visual learning product.
4. Translate the findings into concrete product implications.
5. Identify tensions/tradeoffs (e.g. too much interactivity can increase cognitive load).
6. Recommend a minimal set of learning principles that should become hard product rules.

Output format:
A. Executive summary (1 page)
B. Core principles table:
   - principle
   - what it means
   - why it matters for complex learning
   - product implication for LearnVisualization
   - confidence level / evidence strength
C. Anti-patterns table:
   - design mistake
   - why it hurts learning
   - what to do instead
D. A proposed “Learning Product Principles v1” list (5–12 rules)
E. Open questions / unresolved debates worth further investigation
F. Sources with short annotation for each

Requirements:
- Prioritize peer-reviewed papers, canonical researchers, meta-analyses, strong educational research, and trustworthy institutions.
- Avoid low-quality edtech fluff.
- Explicitly connect theory to product design.
- Write in a precise, non-hype style.
```

---

# Prompt 2 — Learning Site Engine / 模板引擎 Deep Research

## 目标

研究如何把“复杂知识可视化学习网站”抽象成一个可复用的引擎，而不是一个单一专题网站。

## Prompt

```md
You are doing deep research for a product architecture problem.

Context:
We currently have a website called LearnVisualization that teaches LLM concepts through:
- structured modules
- focus-question driven chapter design
- concept maps
- narrative content blocks
- interactive simulations
- validation scripts
- static export deployment

The goal is to evolve it into a reusable Learning Site Engine that can support multiple deep topics, not just LLMs.

Research question:
What architectural patterns, content modeling approaches, and authoring workflows are best for building a reusable engine for visual, modular, pedagogy-aware knowledge websites?

Investigate these themes:
1. Structured content modeling
2. Content as data / atomic content / composable content
3. Schema-driven rendering
4. Domain-specific content languages (DSLs)
5. JSON schema / typed content systems
6. Block-based authoring models
7. Graph-based curriculum modeling / prerequisite graphs
8. Learning-object models
9. Knowledge graph / concept graph representations for teaching
10. Validation pipelines for structured educational content
11. Static site / build-time generation pipelines for structured content
12. Design systems for knowledge products
13. Reusable interaction capability systems
14. Separation of engine vs course/content package
15. Human authoring ergonomics vs machine generation ergonomics

What I need from you:
1. A research synthesis about how to architect such a system.
2. A distinction between what should be “engine-level” vs “course-level”.
3. Recommendations for what data schemas are needed.
4. Recommendations for what should be declarative data vs custom code.
5. Discussion of how to model visual pedagogy, not just text content.
6. Identification of failure modes when trying to over-generalize.
7. Examples from adjacent systems (headless CMS, block editors, course platforms, documentation engines, knowledge graph systems, schema-driven UIs, educational authoring systems).

Output format:
A. Executive summary
B. Engine architecture principles
C. Proposed layered model:
   - engine layer
   - course package layer
   - module layer
   - visual layer
   - interaction layer
   - validation layer
D. Recommended schema families:
   - course schema
   - module schema
   - concept-map schema
   - interaction-capability schema
   - authoring/validation schema
E. Decision framework:
   - what must stay generic
   - what can remain topic-specific
   - what should be customizable through plugins/registry
F. Risks / anti-patterns
G. Sources with annotations

Requirements:
- Do not answer like a generic software architecture blog post.
- Tie everything back to the specific goal of a reusable, pedagogy-aware learning site engine.
- Prefer concrete modeling insights over buzzwords.
```

---

# Prompt 3 — AI 驱动 / Agent 架构 Deep Research

## 目标

研究如何让 AI / Agent 驱动这个引擎，生成高质量课程与页面，而不是生成一堆看起来像文章的垃圾内容。

## Prompt

```md
You are doing deep research for an AI-assisted educational content generation system.

Context:
We want to build an Agent that acts as the content-generation entry point for a Learning Site Engine.

The intended workflow is not “one-shot page generation.”
Instead, the system should ideally support a pipeline like:
- topic framing
- audience definition
- learning goals
- curriculum decomposition
- prerequisite graph creation
- lesson/module drafting
- concept-map generation
- interactive recommendation
- critique / QA
- human review
- publish

Research question:
How should an AI/Agent system be architected to reliably generate structured, pedagogically useful, reviewable learning-site content?

Investigate these themes:
1. Planner / writer / critic / reviser architectures
2. Multi-agent orchestration for content pipelines
3. Structured output generation (JSON schema, constrained decoding, tool calling)
4. Retrieval-grounded generation
5. Citation-aware / source-grounded writing pipelines
6. Human-in-the-loop approval gates
7. Self-critique / reflection / revision loops
8. Research synthesis pipelines
9. Curriculum planning with LLMs
10. Converting research into structured lessons
11. Evaluation of educational content quality
12. Rubrics for factuality, coherence, pedagogy, and progression
13. Agent failure modes in knowledge-product generation
14. When to use one model vs multiple specialized agents
15. Publishing workflow design for AI-generated structured content

What I need from you:
1. A proposed agent architecture for this problem.
2. Recommendations for what stages should be automated vs human-reviewed.
3. Structured output recommendations for each stage.
4. A discussion of how to minimize hallucination and shallow pedagogy.
5. A discussion of what “quality” means in this setting.
6. Suggested evaluation rubrics and approval gates.
7. Tradeoffs between single-agent and multi-agent designs.

Output format:
A. Executive summary
B. Proposed agent pipeline stages
C. For each stage:
   - goal
   - input
   - output
   - should it be structured or freeform
   - what failure modes to watch for
   - whether human review is required
D. Recommended evaluation rubric:
   - factual accuracy
   - curricular ordering
   - focus-question sharpness
   - pedagogical clarity
   - visual suitability
   - interactivity relevance
   - bridge quality between modules
E. Minimal MVP agent architecture vs long-term architecture
F. Risks / anti-patterns
G. Sources with annotations

Requirements:
- Be concrete.
- Avoid generic “AI agents are powerful” rhetoric.
- Optimize for high-quality educational product generation, not just text generation.
- Explicitly discuss human review as part of the system.
```

---

# Prompt 4 — 从研究到产品原则的综合 Prompt

## 目标

当你已经拿到前面三份 research 结果后，用这一份 prompt 做综合提炼。

## Prompt

```md
You have three research inputs:
1. learning science / cognition findings
2. learning site engine architecture findings
3. AI / agent architecture findings

Your task is to synthesize them into a product-and-system strategy for LearnVisualization evolving into a Learning Site Engine.

What I need:
1. A concise product thesis
2. A sharp definition of what this product is NOT
3. The engine principles that should become hard constraints
4. The minimum schema model required for v1
5. The minimum agent pipeline required for v1
6. A clear separation between:
   - what the engine does
   - what the content package does
   - what the agent does
   - what humans must still do
7. A pragmatic MVP plan (not a grand vision document)
8. A list of the top 5 technical/product risks

Output format:
A. Product thesis
B. Non-goals
C. Engine principles
D. MVP schema stack
E. MVP agent stack
F. Human-in-the-loop checkpoints
G. MVP roadmap in phases
H. Biggest risks and mitigations
```

---

# Prompt 5 — 第二专题压力测试 Prompt

## 目标

验证当前系统到底是“LLM 专题站模板”，还是“可复用学习站引擎”。

## Prompt

```md
I have a learning-site system originally built for explaining LLMs.
I want to test whether the system is actually reusable as a general Learning Site Engine.

Please perform a transferability stress test using one of these topics:
- PostgreSQL internals
- Causal inference
- Operating systems
- Game theory

Tasks:
1. Choose the best stress-test topic and explain why.
2. Try to map the topic into the current system assumptions:
   - course structure
   - module structure
   - concept maps
   - narrative blocks
   - interactive components
   - chapter bridges
3. Identify what transfers cleanly.
4. Identify what breaks.
5. Distinguish:
   - topic-specific assumptions hidden in the current system
   - truly reusable engine capabilities
6. Recommend what must be generalized before calling this a reusable engine.

Output format:
A. Chosen topic and rationale
B. Transferability matrix
C. What already generalizes
D. What is currently overfit to LLMs
E. Required engine upgrades before second-topic support
```

---

# 建议研究顺序

建议按这个顺序跑：

1. Prompt 1 — 学习科学 / 认知
2. Prompt 2 — 引擎架构
3. Prompt 3 — Agent 架构
4. Prompt 4 — 综合提炼
5. Prompt 5 — 第二专题压力测试

---

# 额外建议

如果 Deep Research 支持上传附件，建议把以下材料一起喂进去：

- `README.md`
- `DESIGN.md`
- `src/content/README.md`
- `src/data/narrative-block-spec.json`
- `src/lib/module-registry.ts`
- `src/components/ModuleDetail.tsx`
- `src/components/NarrativeRenderer.tsx`
- `src/data/concept-map-schemas.json`

这些文件能让研究模型更准确理解当前系统，不会把问题想得太虚。
