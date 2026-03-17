# Task: Build PERO Learn — Knowledge Visualization Site

## Goal
Build a Next.js static site that visualizes structured learning progress. The design must closely match https://learn.shareai.run/zh/timeline/ in look and feel.

## Reference Site Design (key patterns to replicate)
- **Framework**: Next.js 15 App Router + Tailwind CSS
- **Layout**: Sticky header (h-14) + sidebar (w-56, sticky) + main content
- **Timeline**: Vertical timeline with colored dots (h-10 w-10 rounded-full), connecting lines (w-0.5), and cards
- **Cards**: rounded-xl border, p-4 sm:p-5, hover:border change, scroll-triggered fade-in animation (translateX(30px) → 0)
- **Color categories**: blue/emerald/purple/amber/red with matching badges (rounded-full px-2.5 py-0.5)
- **Progress bars**: h-1.5 rounded-full inside zinc-100/zinc-800 container
- **Bar chart**: Horizontal bars at bottom showing metrics per module
- **Dark mode**: Toggle via class on <html>, localStorage persistence, check on load before render
- **Typography**: system-ui font, h1=text-3xl font-bold, cards text-base/text-lg, quotes italic text-sm text-zinc-500
- **Sidebar**: Category groups with colored dots (h-2 w-2), module links with hover states

## PERO-specific additions (beyond reference site)
- **Phase badge** on each card: Shows PERO learning phase (P0 定位 / P1 启动 / P2 编码 / P3 参考 / P4 检索 / ✓ 已完成)
- **Weakness indicator**: Red badge with count if weaknesses > 0
- **Feynman test badge**: 🧪 通过/未通过 if tested
- **Current module highlight**: Pulsing ring animation on the active module's dot
- **Expandable detail panel** in each card: Click to reveal concept list, weaknesses, key insights

## Module Detail Pages
Each module should have its own page at `/m/[id]` with:
- Full concept map (text-based for now, list of concepts with relationships)
- Logic chain (step-by-step reasoning)
- Key examples and counterexamples
- Weakness details
- Feynman test results
- Navigation to prev/next module

## Data Structure
All data comes from `/src/data/state.json`. The site reads this JSON and renders everything.

```json
{
  "project": {
    "title": "LLM 原理与实践",
    "goal": "理解 Transformer 架构如何实现语言理解与生成，并能运用于实际任务",
    "type": "mixed",
    "startDate": "2026-03-10"
  },
  "categories": [
    { "id": "foundations", "name": "基础概念", "color": "blue" },
    { "id": "architecture", "name": "架构原理", "color": "emerald" },
    { "id": "training", "name": "训练机制", "color": "purple" },
    { "id": "application", "name": "应用实践", "color": "amber" },
    { "id": "frontier", "name": "前沿探索", "color": "red" }
  ],
  "modules": [
    {
      "id": 1,
      "title": "Token 与词表",
      "subtitle": "从文本到离散符号",
      "category": "foundations",
      "phase": "completed",
      "concepts": {
        "learned": 4, "total": 4,
        "items": [
          { "name": "字符级 vs 词级分词", "status": "mastered" },
          { "name": "BPE 算法", "status": "mastered" },
          { "name": "WordPiece 与 SentencePiece", "status": "mastered" },
          { "name": "特殊 token（CLS/SEP/PAD）", "status": "mastered" }
        ]
      },
      "weaknesses": [],
      "feynman": { "tested": true, "passed": true, "notes": "能清晰解释 BPE 合并规则和词表大小对下游的影响" },
      "quote": "语言模型的世界从分词器开始",
      "keyInsight": "BPE 在频率和粒度之间找到平衡——高频词完整保留，低频词拆成子词片段",
      "logicChain": [
        "原始文本无法直接输入模型",
        "需要将文本切分为离散 token",
        "BPE 从字符级开始，迭代合并最高频 pair",
        "词表大小控制粒度：太小→序列太长，太大→稀疏覆盖",
        "最终每个 token 对应一个整数 ID"
      ],
      "examples": ["'unhappiness' → ['un', 'happiness'] 或 ['un', 'happ', 'iness']，取决于词表"],
      "counterexamples": ["字符级分词保留所有信息但序列过长，注意力复杂度 O(n²) 爆炸"]
    },
    {
      "id": 2,
      "title": "Embedding 空间",
      "subtitle": "从符号到语义向量",
      "category": "foundations",
      "phase": "completed",
      "concepts": {
        "learned": 5, "total": 5,
        "items": [
          { "name": "Embedding 矩阵查表", "status": "mastered" },
          { "name": "向量空间语义相似度", "status": "mastered" },
          { "name": "正弦位置编码", "status": "mastered" },
          { "name": "可学习位置编码", "status": "mastered" },
          { "name": "RoPE 旋转位置编码", "status": "mastered" }
        ]
      },
      "weaknesses": [],
      "feynman": { "tested": true, "passed": true, "notes": "能解释为什么需要位置编码以及三种方案的取舍" },
      "quote": "相似的含义在向量空间中靠得更近",
      "keyInsight": "Token ID 经过 embedding 矩阵映射到高维向量；位置编码赋予模型序列顺序感知",
      "logicChain": [
        "Token ID 是离散整数，没有语义信息",
        "Embedding 矩阵将 ID 映射到 d 维连续向量",
        "训练中向量位置自动编码语义关系",
        "Transformer 是排列不变的，需要额外注入位置信息",
        "位置编码（正弦/可学习/RoPE）叠加到 embedding 上"
      ],
      "examples": ["king - man + woman ≈ queen 展示了 embedding 空间的线性结构"],
      "counterexamples": ["One-hot 编码维度等于词表大小，无法表达语义相似度"]
    },
    {
      "id": 3,
      "title": "注意力机制",
      "subtitle": "加权聚合的艺术",
      "category": "architecture",
      "phase": "retrieval",
      "concepts": {
        "learned": 6, "total": 6,
        "items": [
          { "name": "Query-Key-Value 三元组", "status": "mastered" },
          { "name": "Scaled Dot-Product Attention", "status": "mastered" },
          { "name": "Softmax 归一化", "status": "mastered" },
          { "name": "多头注意力", "status": "weak", "note": "concat 后投影矩阵的作用还不够清晰" },
          { "name": "因果遮罩（Causal Mask）", "status": "mastered" },
          { "name": "注意力复杂度分析", "status": "mastered" }
        ]
      },
      "weaknesses": [
        { "point": "多头注意力 concat 后投影矩阵的作用说不清楚", "rootCause": "抽象层级错误", "status": "active" }
      ],
      "feynman": { "tested": true, "passed": false, "notes": "基本机制解释清楚，但多头合并后的线性投影解释卡壳" },
      "quote": "注意力的本质是 Query 和 Key 的相似度驱动 Value 的加权聚合",
      "keyInsight": "多头注意力让模型在不同子空间同时捕捉不同类型的关系模式",
      "logicChain": [
        "每个 token 生成 Q、K、V 三个向量",
        "Q·K^T / √d_k 计算注意力分数",
        "Softmax 归一化为概率分布",
        "用概率分布对 V 加权求和，得到输出",
        "多头：在 h 个子空间并行执行上述过程",
        "Concat 所有头的输出，再做一次线性投影"
      ],
      "examples": ["'The cat sat on the mat because it was tired' — 'it' 对 'cat' 的注意力权重最高"],
      "counterexamples": ["RNN 的隐藏状态是序列压缩的瓶颈，注意力机制绕过了这个限制"]
    },
    {
      "id": 4,
      "title": "Transformer 结构",
      "subtitle": "编码器与解码器的协奏",
      "category": "architecture",
      "phase": "encoding",
      "current": true,
      "concepts": {
        "learned": 3, "total": 7,
        "items": [
          { "name": "编码器-解码器架构", "status": "mastered" },
          { "name": "残差连接", "status": "mastered" },
          { "name": "层归一化", "status": "mastered" },
          { "name": "FFN 前馈网络", "status": "learning" },
          { "name": "Pre-Norm vs Post-Norm", "status": "not-started" },
          { "name": "交叉注意力", "status": "not-started" },
          { "name": "Decoder-only 架构", "status": "not-started" }
        ]
      },
      "weaknesses": [
        { "point": "交叉注意力与自注意力的信息流方向混淆", "rootCause": "概念关系未建立", "status": "active" },
        { "point": "Pre-Norm vs Post-Norm 的训练稳定性差异", "rootCause": "前知识不足", "status": "active" }
      ],
      "feynman": { "tested": false },
      "quote": "残差连接和层归一化是深层网络的生命线",
      "keyInsight": null,
      "logicChain": [
        "输入经过自注意力层捕捉 token 间关系",
        "残差连接保留原始信息，避免梯度消失",
        "层归一化稳定每层输出的分布",
        "FFN 对每个位置独立做非线性变换",
        "（学习中...）"
      ],
      "examples": [],
      "counterexamples": []
    },
    {
      "id": 5,
      "title": "预训练目标",
      "subtitle": "自监督学习的巧妙设计",
      "category": "training",
      "phase": "not-started",
      "concepts": { "learned": 0, "total": 5, "items": [] },
      "weaknesses": [],
      "feynman": { "tested": false },
      "quote": "预测下一个 token——简单目标蕴含深刻的语言结构",
      "keyInsight": null,
      "logicChain": [],
      "examples": [],
      "counterexamples": []
    },
    {
      "id": 6,
      "title": "损失与优化",
      "subtitle": "梯度如何塑造语言能力",
      "category": "training",
      "phase": "not-started",
      "concepts": { "learned": 0, "total": 6, "items": [] },
      "weaknesses": [],
      "feynman": { "tested": false },
      "quote": "交叉熵度量预测分布与真实分布之间的信息差距",
      "keyInsight": null,
      "logicChain": [],
      "examples": [],
      "counterexamples": []
    },
    {
      "id": 7,
      "title": "微调与对齐",
      "subtitle": "从通用到可控",
      "category": "application",
      "phase": "not-started",
      "concepts": { "learned": 0, "total": 8, "items": [] },
      "weaknesses": [],
      "feynman": { "tested": false },
      "quote": "RLHF 让模型学会在人类偏好的空间中导航",
      "keyInsight": null,
      "logicChain": [],
      "examples": [],
      "counterexamples": []
    },
    {
      "id": 8,
      "title": "Prompt Engineering",
      "subtitle": "用自然语言编程",
      "category": "application",
      "phase": "not-started",
      "concepts": { "learned": 0, "total": 5, "items": [] },
      "weaknesses": [],
      "feynman": { "tested": false },
      "quote": "好的 prompt 是给模型搭建正确的思维脚手架",
      "keyInsight": null,
      "logicChain": [],
      "examples": [],
      "counterexamples": []
    },
    {
      "id": 9,
      "title": "Scaling Laws",
      "subtitle": "规模的力量与极限",
      "category": "frontier",
      "phase": "not-started",
      "concepts": { "learned": 0, "total": 4, "items": [] },
      "weaknesses": [],
      "feynman": { "tested": false },
      "quote": "参数、数据、算力——三者遵循优雅的幂律关系",
      "keyInsight": null,
      "logicChain": [],
      "examples": [],
      "counterexamples": []
    },
    {
      "id": 10,
      "title": "涌现与推理",
      "subtitle": "量变何时引发质变",
      "category": "frontier",
      "phase": "not-started",
      "concepts": { "learned": 0, "total": 4, "items": [] },
      "weaknesses": [],
      "feynman": { "tested": false },
      "quote": "规模足够大时，模型展现出未被显式训练的能力",
      "keyInsight": null,
      "logicChain": [],
      "examples": [],
      "counterexamples": []
    }
  ]
}
```

## Technical Requirements
1. **Next.js 15** with App Router, TypeScript
2. **Tailwind CSS v4** (or v3 if simpler)
3. **Static export**: Set `output: 'export'` in next.config, base path `/learn`
4. Pages: `/` (timeline, default), `/m/[id]` (module detail)
5. **Language**: Chinese (lang="zh")
6. **No external dependencies** beyond Next.js + Tailwind. No D3, no chart libs — use pure CSS for bars.
7. Components: Header, Sidebar, TimelineCard, BarChart, ModuleDetail, ConceptList, WeaknessList
8. Scroll-triggered fade-in animation using IntersectionObserver
9. Dark mode with localStorage persistence
10. Responsive (mobile: sidebar hidden, cards stack)

## Deployment
- Static output goes to `./out/`
- Will be served at `https://sharonzhou.site/learn/` via nginx
- basePath in next.config.js must be `/learn`

## Build & Verify
After building, run `npx next build` and verify `./out/` contains the static files.
Make sure `./out/index.html` loads correctly.

## Important
- Match the reference site's visual quality as closely as possible
- Use CSS variables for theming (--color-bg, --color-text, etc.)
- Every module card should be virtually identical in structure to the reference site's cards
- The detail pages should feel polished, not placeholder
