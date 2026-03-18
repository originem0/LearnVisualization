# Research Workflow

## 决策

从现在开始，这个项目的研究 / 搜索默认工作流是：

- **主搜索**：`ddg-search`（DuckDuckGo HTML）
- **内容抓取**：`web_fetch`
- **Brave / web_search**：**不再作为默认工作流依赖**

原因很简单：Brave 在当前环境里没有可用 API key，而 `ddg-search` 已经在主 workspace 中配置并验证可运行。

---

## 默认研究流程

### 1. 先用 ddg-search 找结果

脚本位置：

```bash
/home/ubuntu/.openclaw/workspace/skills/ddg-search/scripts/ddg.sh
```

用法：

```bash
bash /home/ubuntu/.openclaw/workspace/skills/ddg-search/scripts/ddg.sh "search query" 5
```

示例：

```bash
bash /home/ubuntu/.openclaw/workspace/skills/ddg-search/scripts/ddg.sh "worked example effect cognitive load theory" 5
```

返回内容：

- 标题
- URL
- snippet

---

### 2. 再用 web_fetch 抓正文

对命中的高价值页面，再用 `web_fetch` 拉正文做阅读、摘要和结构化提炼。

适合：

- 论文摘要页
- 教育研究机构文章
- 产品架构文章
- 文档站 / 规范说明页

不适合：

- 强依赖 JS 的页面
- 登录后内容
- 动态交互页面

---

### 3. 最后做人类判断 / 结构化沉淀

搜索结果不是答案。研究输出必须继续整理成：

- 产品原则
- schema 决策
- agent workflow 决策
- 风险与非目标

研究的目标不是“找更多链接”，而是把资料转成系统设计。

---

## 为什么不用 Brave

不是因为 Brave 理论上不好，而是因为**它在当前环境下不可靠**：

- 当前没有可用 Brave API key
- `web_search` 在当前会直接报 missing key
- `ddg-search` 已验证可运行，且对 early-stage research 足够用

所以这里的原则是：

> **优先使用可工作的搜索链路，而不是理论上更优雅但当前不可用的链路。**

---

## 建议研究顺序

对于 LearnVisualization / Learning Site Engine 相关研究，默认顺序：

1. `ddg-search` 找入口资料
2. `web_fetch` 抓 3–8 篇高价值正文
3. 做结构化摘要
4. 转成 schema / engine / agent 决策

---

## 与仓库内其他文件的关系

- Deep Research prompts：`DEEP_RESEARCH_PROMPTS.md`
- 设计原则：`DESIGN.md`
- 内容作者说明：`src/content/README.md`

这份文件只回答一个问题：

> **以后这个项目做研究时，默认用哪条搜索链路。**
