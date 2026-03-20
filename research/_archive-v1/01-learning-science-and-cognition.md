# 01. Learning Science & Cognition

> 目标：回答一个问题——**为什么复杂知识需要“可视化 + 分步 + 外显结构 + 交互验证”的学习产品，而不是普通文章站。**

---

## 一、结论先行

如果一句话总结这一轮学习科学 research：

**LearnVisualization 这类产品的价值，不在“把知识做漂亮”，而在“把高元素交互性的复杂知识，转化成工作记忆可承受、可组织、可回忆的学习过程”。**

也就是说，它的底层逻辑不是内容营销，而是：

- 降低 extraneous load（无关认知负荷）
- 管理 intrinsic load（任务本身复杂度）
- 促进 schema formation（形成结构化知识）
- 支持 retrieval（回忆与提取）
- 促进 transfer（迁移而不是死记）

这直接支持我们把系统设计成：

- 焦点问题驱动
- 概念图先于长文
- worked example / steps 必须存在
- 章节之间必须有桥接
- 交互必须服务理解，而不是装饰

---

## 二、最关键的学习科学原则

## 1. Cognitive Load Theory 不是锦上添花，是底盘

复杂主题最难的地方，不在信息量大，而在：

**多个概念之间存在高元素交互性（element interactivity）**。

像 LLM、操作系统、因果推断这种主题，都不是“记几个定义”就行，而是要同时理解：

- 组件是什么
- 组件之间怎么影响
- 信息怎么流动
- 顺序为什么这样安排
- 局部机制怎样变成系统行为

这类知识一旦直接扔进长文章里，读者工作记忆很容易爆掉。

### 产品启示

- 我们不能默认用户能在纯文本里自己拼出系统结构
- 复杂主题必须先外显关系结构，再进入局部推导
- 任何视觉元素如果不能减轻 extraneous load，就是噪声

### 对产品的硬约束

1. 每章必须有单一焦点问题
2. 每章必须先给全貌结构（概念图/关系图）
3. 长文本必须被分段，不能一坨到底
4. 步骤型机制必须拆成离散 step，而不是大段解释

---

## 2. Worked Example Effect：先给完整推演，再让用户自己做

worked examples 的核心不是“多举例子”，而是：

**让学习者看到完整的解法或推导路径，从而减少在早期阶段无意义地消耗认知资源。**

这和你的站高度一致。

你现在最值钱的内容，不是概念定义，而是：

- BPE 合并过程
- QKV → 分数 → Softmax → 聚合
- Block 内信息流
- 模糊 prompt → 强 prompt

这些本质上都是 worked examples。

### 产品启示

- 对复杂主题，定义应该滞后，推导应该前置
- `steps` block 不是补充，而是核心 block
- 初学者阶段优先给完整推演，不要过早要求用户自己“想通”

### 对产品的硬约束

1. 每章至少一个 worked example / step-by-step visual sequence
2. steps 中每一步只允许一个关键变化，不要多变量一起变
3. step 的 visual 必须比 prose 更能承担理解任务

---

## 3. Multimedia Learning：图文不是并排摆就叫多媒体学习

Mayer 的多媒体学习原则里，对你最重要的不是 12 条全背，而是这几条：

- **Coherence**：去掉不必要内容
- **Signaling**：明确告诉用户现在看什么
- **Segmenting**：拆成用户可控制节奏的段
- **Spatial contiguity**：相关文字和视觉要靠近
- **Pre-training**：复杂系统前要先让用户知道关键部件

### 产品启示

- 图不是插图，图和解释必须彼此咬合
- 页面里最危险的不是少，而是多余
- 标题、标签、卡片标题、步骤编号都属于 signaling
- 交互最好让用户自己控制节奏，而不是自动播放

### 对产品的硬约束

1. 视觉块附近必须就地解释，不能远距离跳读
2. 对复杂机制，优先用户点击下一步，而不是自动动画
3. callout / label / route 面板都必须承担“指向重点”的作用
4. 不为“酷”增加动画，只保留帮助理解的动态反馈

---

## 4. Concept Maps 的价值：让关系结构外显

concept map 的核心价值，不是“更好看”，而是：

**把本来要在脑中组织的关系，提前外显到页面上。**

这对高复杂度主题极其重要。

从已有研究看，概念图的效果并不是无条件的：

- prior knowledge 会影响效果
- 图太复杂会增加负担
- 仅“看图”不一定比主动构图更强
- 但结构清晰的 concept map 能显著帮助学习者建立语义组织

### 产品启示

- 概念图必须控制复杂度，不是节点越多越好
- 同一章的 concept map 要服务焦点问题，而不是概念全收录
- 将来如果可能，用户自己构图 / 调整图，会比只看图更强

### 对产品的硬约束

1. 每章 concept map 只展示核心关系，不追求百科全图
2. 图的复杂度必须和用户前置知识匹配
3. 概念图应支持后续主动回忆 / 自测，而不是只做展示

---

## 5. Retrieval Practice：看懂不等于学会

retrieval practice 研究最关键的一点：

**主动回忆通常比重复阅读更能提升长期保持。**

但 applied classroom review 也提醒了一个重要边界：

- retrieval practice 相比“重复学习/无活动”通常有效
- 但和一些更强学习活动相比，不一定总是稳赢
- 所以它不是唯一策略，而是应和其他结构化学习活动结合

### 产品启示

- 站点不能永远停留在“用户看完就走”
- 后续版本必须加入轻量 retrieval 机制
- retrieval 不一定是考试，可以是：
  - 填空
  - 预测下一步
  - 自己复述机制
  - 从图中找缺失节点

### 对产品的硬约束

1. 每 1–2 个模块应有一次轻量主动回忆
2. retrieval 要贴近概念结构，而不是只考术语记忆
3. retrieval 设计要服务 transfer，而不是刷题感

---

## 6. Threshold Concepts：有些概念必须一刀捅穿

很多复杂主题都有“阈值概念”：

一旦理解，整章打开；
不理解，后面全在硬背。

在当前项目里，大概就包括：

- token 不是词
- attention 不是规则匹配，而是动态加权聚合
- transformer 不是 attention 单件，而是 block 模板
- prompt 不是礼貌话术，而是上下文程序

### 产品启示

- 每章开头必须打掉一个错误直觉
- “焦点问题”不是文案装饰，而是认知转折点

### 对产品的硬约束

1. 每章必须有一个要被击穿的错误直觉
2. 开场句优先制造认知冲突，而不是先下定义

---

## 三、对产品最有用的反模式

## 反模式 1：把页面做成漂亮文章

问题：
- 看起来清楚
- 其实关系结构仍然留给用户脑补

替代方案：
- 先关系图，再步骤，再解释

## 反模式 2：把交互做成玩具

问题：
- 用户觉得有趣
- 但不帮助理解核心机制

替代方案：
- 交互必须对应一个明确认知操作：比较 / 推演 / 验证 / 回忆

## 反模式 3：一页塞太多概念图节点

问题：
- 想表达完整
- 结果增加 extraneous load

替代方案：
- 每章 concept map 只围绕焦点问题服务

## 反模式 4：把 retrieval 理解成 quiz 插件

问题：
- 形式上做了测试
- 实际上只在考词语记忆

替代方案：
- retrieval 要考关系、顺序、机制、迁移

---

## 四、可以直接变成产品规则的 Learning Principles v1

1. **每章必须只有一个焦点问题。**
2. **每章必须先外显结构，再展开细节。**
3. **每章至少一个 worked example / steps。**
4. **图文布局必须近邻，不能让用户跨区域拼接。**
5. **交互必须服务认知操作，不做装饰性互动。**
6. **每章必须打掉一个错误直觉。**
7. **复杂内容优先分段与节奏控制，而不是连续动画。**
8. **每 1–2 个模块必须有主动回忆机制。**
9. **概念图要控制复杂度，不追求全收录。**
10. **产品评估指标不能只看停留时长，要看理解质量和迁移能力。**

---

## 五、对 LearnVisualization 的直接判断

当前这个网站的方向，和学习科学是对齐的。

它真正有潜力的地方在于：

- 它不是“知识文章站”
- 它在尝试把复杂知识转成可学习结构

但接下来如果要继续进化，最该补的不是更多 prose，而是：

1. retrieval 机制
2. 概念图复杂度控制规则
3. step block 的标准化能力
4. 焦点问题 → concept map → steps → bridge 的硬链路

---

## Sources

### 强相关
- Frontiers (2019), *Retrieval Practice in Classroom Settings: A Review of Applied Research*  
  https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00005/full
- Frontiers (2022), *Comparing Construction and Study of Concept Maps*  
  https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2022.892312/full
- Cambridge Handbook / Mayer multimedia learning principles (secondary access via Cambridge frontmatter and principle summaries)

### 辅助
- Cognitive Load practical guides / worked example summaries gathered through ddg-search
- NSW CLT practice guide (source identified; PDF fetch still needs a cleaner path for direct extraction in next round)
