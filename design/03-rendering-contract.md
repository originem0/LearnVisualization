# 03. 渲染契约 — 不同知识怎么呈现

> 这份文件定义前端渲染引擎如何呈现 narrative essay 课程内容。它是 UI 工程师的约束文档。

---

## 一、核心原则：Prose-First 渲染

渲染引擎的任务是让叙事自然流动，而非执行固定的教学流水线。

**设计目标**：
- 阅读体验接近长文，不是"教程块的堆叠"
- 可视化作为叙事的有机部分，不是插入的"交互环节"
- 保持连续性，避免认知中断

---

## 二、章节渲染（Essay-Course）

### 布局原则
- **中心列宽 65ch**（optimal line length for reading）
- **narrative blocks 连续流动**，无硬分段或阶段标记
- **highlight 作为 float aside 或 fullbleed section**，不打断主线叙事

### Block 类型

#### 基础叙事块
- `text`: 段落，直接渲染，支持多段合并
- `heading`: h2/h3，自动生成锚点用于跳转
- `code`: syntax highlighted，支持 `lang` 属性，行号可选
- `callout`: 侧边注或高亮框，用于非关键信息
- `quote`: blockquote + cite，用于引用

#### 扩展块（保留语义但淡化结构）
- `comparison`: 双栏对比，视口窄时自动堆叠
- `steps`: 可交互推进的步骤序列，用户控制节奏
- `diagram`: 居中块，带可选 label

### Highlight 渲染

Highlights 是定制可视化，嵌入叙事中特定位置：

- **`bespoke`**: 手工组件（如 `LLMVisualizer`, `PostgresIndexTree`）
  - 渲染为 fullbleed section（打破列宽限制）
  - 带可选的交互控制面板
  - 不打断段落编号或叙事流

- **`trace`**: 代码执行 trace 可视化（通用组件）
  - 渲染为 float aside（桌面端）或 inline block（移动端）
  - 状态表 + 当前步高亮 + 上下步导航
  - 与相关 code block 空间邻近

---

## 三、渲染约束（认知负荷原则）

基于 Mayer 多媒体学习原则，确保可视化辅助而非干扰阅读：

1. **空间邻近**：相关的 code 和 text 必须在同一屏内
2. **时间连续**：highlight 出现时机与叙事提及同步
3. **适度原则**：避免装饰性可视化，每个 highlight 必须服务于理解
4. **用户控制**：可交互的 highlight 允许暂停、回放、跳过

---

## 四、响应式策略

| 断点 | 布局变化 |
|------|---------|
| < 640px (mobile) | 单栏，highlight 转为 inline block |
| 640-1024px (tablet) | 中心列 + 折叠侧边 TOC |
| 1024-1280px (laptop) | 中心列 + float aside highlights |
| > 1280px (desktop) | 中心列 + float aside + 浮动 TOC |

---

## 五、设计语言

### 排版
- 正文：16px / 1.75 行高 / 最大宽度 65ch
- 标题：不超过 3 级（h1 页标题、h2 小节、h3 子节）
- 代码：14px / monospace / 行号可选

### 色彩语义
| 用途 | 色彩 | 说明 |
|------|------|------|
| 代码/技术 | slate-50 / slate-200 | code 块、trace 块 |
| 强调/洞察 | emerald-50 / emerald-200 | keyInsight、callout |
| 引用 | gray-100 | quote 块 |
| 交互/行动 | blue-500 / blue-600 | 按钮、链接、进度 |

### 动效原则
- 最小化动画，只在用户操作时响应
- highlight 展开/折叠：0.2s ease
- 代码高亮变化：0.15s
- 不使用装饰性动画
