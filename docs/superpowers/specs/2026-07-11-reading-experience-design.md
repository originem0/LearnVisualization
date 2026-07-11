# Essay 课程阅读体验重做（Reading Experience）设计

日期：2026-07-11
状态：已实施（2026-07-11）
分支：reading-experience

## 背景与诊断

用户要求从产品经理角度优化生成课程的阅读体验（标题、段落、排版、页面布局、UI），以简洁明晰为主，参考著名读物风格。实地审视渲染链（EssayChapterRenderer / NarrativeRenderer / globals.css 的 prose-custom / 课程首页 / EssaySidebar / course layout）后确认七个问题：

1. **正文栏太宽**：章节文章 `max-w-[54rem]`（864px），16px 字号下约 52 汉字/行；中文长文舒适线长为 30-40 字/行（得到、微信读书、纽时中文网均在此区间）。
2. **三种语义块视觉同形**：quote / callout / bridge 全部渲染为"左边线 + 缩进"，读者无法区分机器担保的真实引文与作者强调。
3. **CSS 特异性打架**：`.prose-custom h2 { font-size: 1.15rem }` 压过组件的 `text-xl`，章内标题实际 18.4px，与正文层级拉不开。
4. **role 文案泄漏**：章节页头展示 AI 内部的章节任务书（"建立核心认知冲突：证明……"），是舞台指令不是读者导语。
5. **课程首页 hero 用 96 字驱动问题当 text-5xl 大标题**，课程真名只在页头小字。
6. **两种语域无视觉区分**：随笔与技术解说同一套 sans + 同版式，产品核心概念"语域"在视觉上隐形。
7. **手机无章节导航**：侧栏 `xl:` 起才显示，移动端章间跳转只能滚到底。

另有本会话踩到的 UX 债：失败任务的"重试"按钮未说明其复用语义（研究/规划缓存 + 已过章节保留），用户误以为只能全量重新生成。

## 已确认取向（与用户确认）

- 范围：**只改 essay 课程**（新管线产物，含 essay 与 explainer 两语域）；legacy 四门手写课不动。
- **思想随笔语域换衬线**：系统衬线栈，不引 webfont。

## 设计

### 1. 双语域版式（核心）

| | 思想随笔（register=essay） | 技术解说（register=explainer） |
|---|---|---|
| 参照 | 纽时中文 / 读库 | Stripe Docs / 阮一峰 |
| 正文字体 | 系统衬线栈 `"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif` | 现有 sans 栈 |
| 字号/行高 | 17.5px / 1.95 | 16px / 1.8 |
| 正文测宽 | 40rem（约 36 字/行） | 42rem；code/diagram/comparison/steps 块可外溢至 52rem（Tufte 式宽块） |

实现：EssayChapterRenderer 依据 `register`（course 级字段，已在 EssayCourse 数据里）给 article 挂 `register-essay` / `register-explainer` 类，globals.css 定义两组正文规则。零字体下载（macOS 宋体 / Windows 中易宋体 / 安卓多数有 Noto Serif CJK，缺失时回退系统 serif）。

### 2. 三种语义块分家

- **quote**：大号衬线 + 悬挂式大引号装饰（伪元素）+ cite 出处行；cite 可点，点击平滑滚动到章末参考资料区（逐条锚链需按标题匹配、脆，不做）。这是全站唯一机器担保逐字真实的内容，视觉要兑现这个承诺。
- **callout**：去左边线，改浅色背景圆角卡（panel 底 + 微量强调色），与引文彻底区分。
- **bridge**：移出正文流样式，渲染为章末"过渡段"——居中细分隔线 + 衬线引导句，衔接下方"下一章"卡片。

### 3. 修 CSS 打架与标题层级

删除/让位 `.prose-custom` 中与组件类冲突的 h2/h3 字号规则。层级：章题 28-32px；章内小标题 20px semibold；正文 17.5px（essay）/16px（explainer）——三档拉开。

### 4. 章节页头

- 删除 role 展示。
- 页头元信息行：`c01 · 第 1/5 章 · 约 N 分钟`（阅读时长 = 正文字符数 ÷ 400/分钟，向上取整）。
- 顶部 2px 阅读进度条（客户端滚动监听小组件，仅章节页）。

### 5. 课程首页 hero 重排

- `title` 升为 h1（3xl-4xl），`subtitle` 跟随。
- `drivingQuestion` 降为引题块：衬线、约 20px、有留白，不再是 5xl 的墙。
- "旅程"列表优先显示 `overview.arc[index]`，回退 `chapter.role`（当前顺序反了）。

### 6. 移动端章节条

`<xl` 时章节文章顶部渲染紧凑导航条：`← c02/5 · 当前章题 →`（前后章链接 + 位置指示）；底部前后章卡片保留。

### 7. 顺手修：重试按钮语义

GenerateForm 失败卡片："重试"按钮文案改为"重试（复用研究与规划）"，卡片加一句说明（如"重试将从失败阶段继续，已完成的研究、规划与章节不会重跑"）。

### 8. 不做什么

字号调节器；阅读主题切换（暗色已有）；行内脚注上标；legacy 课程；任何新依赖或 webfont 下载；服务端改动（纯前端 + CSS）。

## 数据结构变更

无。全部为渲染层改动（组件 + CSS），复用现有 `register` / `sources` / `bridge` / `overview.arc` 字段。

## 测试与验证

- `npx tsc --noEmit`、`npm run check`、`npm run build`（prerender smoke）全绿
- 引擎与后端测试不受影响（不动数据结构）
- 构建后人工目检：nietzsche-open（essay 语域）章节页 + 课程首页，光/暗两态；若有 explainer 语域生成课一并对比；移动宽度（<xl）检查章节条
- 重点检查项：衬线在暗色下的笔画对比度、引文块与 callout 的区分度、36 字/行的实际测宽
