from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    from .common import COURSES_ROOT, DESIGN_PATH, REPO_ROOT, read_json, read_text
except ImportError:
    from common import COURSES_ROOT, DESIGN_PATH, REPO_ROOT, read_json, read_text

try:
    from .quality import load_frontend_component_whitelist
except ImportError:
    from quality import load_frontend_component_whitelist

# Mapping from interaction capability to a good few-shot example component
_CAPABILITY_EXAMPLE_MAP = {
    "compare": "ArchitectureCompare",
    "trace": "TransformerFlow",
    "step-through": "TransformerFlow",
    "simulate": "LossLandscape",
    "parameter-play": "ScalingLawPlotter",
    "classify": "CoTToggle",
    "rebuild": "FullPipelineTracer",
    "retrieve": "ContextLengthCalc",
}

PROMPT_VERSION = "v1-course-generation"

ALLOWED_CATEGORY_COLORS = ["blue", "emerald", "purple", "amber", "red"]
ALLOWED_MODULE_KINDS = [
    "concept-clarification",
    "mechanism-walkthrough",
    "system-overview",
    "case-study",
    "meta-reflection",
    "integration-review",
]
ALLOWED_COGNITIVE_ACTIONS = ["distinguish", "trace", "compare", "simulate", "rebuild", "reflect"]
ALLOWED_EDGE_TYPES = ["prerequisite", "bridge", "recommended"]
ALLOWED_VISUAL_TYPES = ["conceptMap", "processFlow", "comparisonFrame", "stepSequence"]
ALLOWED_INTERACTION_CAPABILITIES = [
    "compare",
    "step-through",
    "simulate",
    "trace",
    "classify",
    "rebuild",
    "retrieve",
    "parameter-play",
]
ALLOWED_RETRIEVAL_PROMPTS = ["predict-next-step", "fill-gap", "rebuild-map", "compare-variants"]


@lru_cache(maxsize=1)
def load_design_prompt_principles() -> str:
    """Load design principles relevant to course generation from the design docs.

    DESIGN.md v3 splits content across design/*.md files.  The Agent prompt
    needs the learning-science constraints (01) and the agent contract (04).
    We also pull the non-goals from the top-level DESIGN.md for grounding.
    """
    parts: list[str] = []

    # Top-level DESIGN.md — non-goals + core tensions
    top_level = read_text(DESIGN_PATH)
    non_goals = _extract_section(top_level, "## 非目标", "## 学习科学基础")
    if non_goals.strip():
        parts.append(non_goals.strip())

    # design/01 — learning principles (Merrill baseline, knowledge types)
    learning_path = REPO_ROOT / "design" / "01-learning-principles.md"
    if learning_path.exists():
        lp = read_text(learning_path)
        merrill = _extract_section(lp, "### 2.1 Merrill 教学首要原则", "### 2.2")
        if merrill.strip():
            parts.append(merrill.strip())

    # design/04 — agent contract (compose constraints, quality rules)
    agent_path = REPO_ROOT / "design" / "04-agent-contract.md"
    if agent_path.exists():
        ac = read_text(agent_path)
        compose = _extract_section(ac, "## 三、Compose 阶段约束", "## 四、质量检查规则")
        negative = _extract_section(ac, "## 五、生成负面样本", "## 六、")
        if compose.strip():
            parts.append(compose.strip())
        if negative.strip():
            parts.append(negative.strip())

    if not parts:
        # Fallback: try old v2 section layout in DESIGN.md
        for start, end in [
            ("## 1. 非目标", "## 2. 顶层设计思想"),
            ("## 3. 学习产品原则", "## 4. 内容表达原则"),
            ("## 4. 内容表达原则", "## 5. 可视化原则"),
            ("## 5. 可视化原则", "## 6."),
        ]:
            section = _extract_section(top_level, start, end)
            if section.strip():
                parts.append(section.strip())

    return "\n\n".join(parts)


@lru_cache(maxsize=1)
def load_few_shot_examples() -> list[dict[str, Any]]:
    examples: list[dict[str, Any]] = []
    for module_id in ("s01", "s04"):
        path = COURSES_ROOT / "llm-fundamentals" / "modules" / f"{module_id}.json"
        module = read_json(path)
        examples.append(
            {
                "id": module["id"],
                "title": module["title"],
                "focusQuestion": module["focusQuestion"],
                "misconception": module["misconception"],
                "keyInsight": module["keyInsight"],
                "logicChain": module["logicChain"][:4],
                "examples": module["examples"][:2],
                "narrativeSample": module["narrative"][:4],
            }
        )
    return examples


def build_plan_prompts(request_payload: dict[str, Any], planning_seed: dict[str, Any]) -> tuple[str, str]:
    system_prompt = (
        "你是 Learning Site Engine 的课程设计器。"
        "你不是内容工厂，不允许输出百科式目录、空洞术语或模板化鸡汤。"
        "输出必须是合法 JSON，对应用户的主题，并体现焦点问题、误解拆除、结构先行、worked example、bridge 的教学原则。\n\n"
        f"设计原则摘要：\n{load_design_prompt_principles()}\n\n"
        "输出约束：\n"
        "- 只输出 JSON，不要 Markdown，不要解释。\n"
        "- category.color 只能使用: " + ", ".join(ALLOWED_CATEGORY_COLORS) + "\n"
        "- moduleKind 只能使用: " + ", ".join(ALLOWED_MODULE_KINDS) + "\n"
        "- primaryCognitiveAction 只能使用: " + ", ".join(ALLOWED_COGNITIVE_ACTIONS) + "\n"
        "- moduleGraph.edges[].type 只能使用: " + ", ".join(ALLOWED_EDGE_TYPES) + "\n"
        "- moduleOutlines 必须按学习顺序排列，id 必须是 s01, s02 ...\n"
        "- 所有字符串必须具体，不能写空套话。\n"
    )
    user_prompt = (
        "为下面的主题设计一门 zh 课程的课程计划。\n\n"
        f"topic: {request_payload['topic']}\n"
        f"audience: {request_payload.get('audience') or '想系统理解复杂主题的中文学习者'}\n"
        f"goals: {json.dumps(request_payload.get('goals') or [], ensure_ascii=False)}\n"
        f"constraints: {json.dumps(request_payload.get('constraints') or [], ensure_ascii=False)}\n"
        f"background: {request_payload.get('background') or '未指定'}\n"
        f"learning_style: {json.dumps(request_payload.get('learning_style') or [], ensure_ascii=False)}\n"
        f"planning_seed: {json.dumps(planning_seed, ensure_ascii=False, indent=2)}\n\n"
        "few-shot 参考（不是照抄模板，而是学习颗粒度和张力）：\n"
        f"{json.dumps(load_few_shot_examples(), ensure_ascii=False, indent=2)}\n\n"
        "返回 JSON，字段结构必须是：\n"
        f"{json.dumps(_plan_contract(), ensure_ascii=False, indent=2)}"
    )
    return system_prompt, user_prompt


def build_module_prompts(
    *,
    request_payload: dict[str, Any],
    course_plan: dict[str, Any],
    module_outline: dict[str, Any],
    module_index: int,
    module_count: int,
) -> tuple[str, str]:
    system_prompt = (
        "你是 Learning Site Engine 的模块作者。"
        "你的任务不是凑字数，而是产出一个可以直接进入课程包 schema 的完整模块。"
        "你必须优先回答焦点问题、先击穿误解、给出 worked example、保持逻辑链可追踪。"
        "如果一个字段没有具体内容，不要用模板句补洞；要根据主题和模块位置给出真正具体的内容。\n\n"
        f"设计原则摘要：\n{load_design_prompt_principles()}\n\n"
        "输出约束：\n"
        "- 只输出 JSON。\n"
        "- moduleKind 必须与 outline 保持一致。\n"
        "- primaryCognitiveAction 必须与 outline 保持一致。\n"
        "- visuals[].type 只能使用: " + ", ".join(ALLOWED_VISUAL_TYPES) + "\n"
        "- interactionRequirements[].capability 只能使用: " + ", ".join(ALLOWED_INTERACTION_CAPABILITIES) + "\n"
        "- retrievalPrompts[].type 只能使用: " + ", ".join(ALLOWED_RETRIEVAL_PROMPTS) + "\n"
        "- narrative 至少 6 个 block，必须包含至少 1 个 heading、1 个 steps、1 个 callout。\n"
        "- examples 必须具体到主题内实体、过程或案例，不能写空泛描述。\n"
        "- concepts[].name 必须是名词短语（8 字以内），不是完整句子。\n"
        "- bridgeTo 必须自然导向下一章；如果是最后一章，bridgeTo 设为 null。\n"
        "- componentHint 只允许以下值之一: " + ", ".join(sorted(load_frontend_component_whitelist())) + "。"
        "不匹配则必须设为 null。不要编造组件名。\n"
    )
    user_prompt = (
        "基于课程计划，生成一个完整模块。\n\n"
        f"topic: {request_payload['topic']}\n"
        f"module_position: {module_index}/{module_count}\n"
        f"course_plan_summary: {json.dumps(_compact_course_plan(course_plan), ensure_ascii=False, indent=2)}\n"
        f"module_outline: {json.dumps(module_outline, ensure_ascii=False, indent=2)}\n\n"
        "few-shot 参考：\n"
        f"{json.dumps(load_few_shot_examples(), ensure_ascii=False, indent=2)}\n\n"
        "返回 JSON，字段结构必须是：\n"
        f"{json.dumps(_module_contract(), ensure_ascii=False, indent=2)}"
    )
    return system_prompt, user_prompt


def _plan_contract() -> dict[str, Any]:
    return {
        "title": "课程标题",
        "subtitle": "课程副标题",
        "goal": "课程总目标",
        "projectType": "mixed",
        "language": "zh",
        "audience": {
            "primaryAudience": "核心受众",
            "priorKnowledge": ["前知识 1"],
            "constraints": ["学习约束 1"],
            "desiredOutcome": "期望结果",
        },
        "learningGoals": ["学习目标 1"],
        "nonGoals": ["非目标 1"],
        "assumptions": ["假设 1"],
        "philosophy": {
            "promise": "学习承诺",
            "corePrinciples": ["原则 1"],
            "shiftStatement": "认知换挡描述",
        },
        "categories": [
            {"id": "core", "name": "分类名", "color": "blue"},
        ],
        "paths": [
            {"id": "core-path", "title": "路径标题", "description": "路径描述", "moduleIds": ["s01"]},
        ],
        "moduleOutlines": [
            {
                "id": "s01",
                "number": 1,
                "title": "模块标题",
                "subtitle": "模块副标题",
                "category": "core",
                "moduleKind": "concept-clarification",
                "primaryCognitiveAction": "distinguish",
                "focusQuestion": "模块焦点问题",
                "misconception": "需要先打穿的错误直觉",
                "targetChunk": "这章帮助形成的认知组块",
                "priorKnowledge": ["前知识模块或概念"],
            }
        ],
        "moduleGraph": {
            "order": ["s01"],
            "edges": [{"from": "s01", "to": "s02", "type": "prerequisite", "note": "为什么相连"}],
        },
        "researchSummary": {
            "keyQuestions": ["主题下必须回答的问题"],
            "commonMisconceptions": ["跨模块常见误解"],
            "workedExamples": ["值得贯穿课程的案例或过程"],
            "visualTargets": ["适合可视化的结构或机制"],
        },
    }


def _module_contract() -> dict[str, Any]:
    return {
        "title": "模块标题",
        "subtitle": "模块副标题",
        "focusQuestion": "尖锐的焦点问题",
        "misconception": "必须先击穿的旧直觉",
        "quote": "本章金句",
        "keyInsight": "本章关键洞见",
        "opening": "反直觉开场",
        "concepts": [{"name": "概念名", "note": "为什么重要"}],
        "logicChain": ["因果步骤 1"],
        "examples": ["具体例子 1"],
        "counterexamples": ["反例 1"],
        "pitfalls": [{"point": "常见坑", "rootCause": "根因"}],
        "narrative": [
            {"type": "text", "content": "正文"},
            {"type": "heading", "content": "小节标题"},
            {
                "type": "steps",
                "label": "步骤标签",
                "content": "",
                "steps": [
                    {
                        "title": "步骤标题",
                        "description": "步骤解释",
                        "visual": "步骤图示文本",
                        "highlight": "可选强调",
                    }
                ],
            },
            {"type": "callout", "content": "关键提醒"},
        ],
        "visuals": [{"id": "s01-map", "type": "conceptMap", "required": True}],
        "interactionRequirements": [
            {
                "capability": "trace",
                "purpose": "交互目的",
                "priority": "core",
                "componentHint": None,
            }
        ],
        "retrievalPrompts": [
            {
                "type": "fill-gap",
                "prompt": "主动回忆问题",
                "answerShape": "回答应包含的结构",
            }
        ],
        "bridgeTo": "如何自然导向下一章；最后一章填 null",
    }


def _compact_course_plan(course_plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": course_plan.get("title"),
        "goal": course_plan.get("goal"),
        "categories": course_plan.get("categories"),
        "researchSummary": course_plan.get("researchSummary"),
        "moduleOutlines": [
            {
                "id": item.get("id"),
                "title": item.get("title"),
                "category": item.get("category"),
                "moduleKind": item.get("moduleKind"),
                "primaryCognitiveAction": item.get("primaryCognitiveAction"),
                "focusQuestion": item.get("focusQuestion"),
                "misconception": item.get("misconception"),
            }
            for item in course_plan.get("moduleOutlines", [])
        ],
    }


def _extract_section(content: str, start_heading: str, end_heading: str) -> str:
    start = content.find(start_heading)
    if start == -1:
        return ""
    end = content.find(end_heading, start + len(start_heading))
    if end == -1:
        end = len(content)
    return content[start:end]


def _load_example_component(capability: str) -> str:
    """Load an existing interactive component as a few-shot example."""
    component_name = _CAPABILITY_EXAMPLE_MAP.get(capability, "ContextLengthCalc")
    path = REPO_ROOT / "src" / "components" / "interactive" / f"{component_name}.tsx"
    if path.exists():
        return read_text(path)
    # Fallback
    fallback = REPO_ROOT / "src" / "components" / "interactive" / "ContextLengthCalc.tsx"
    return read_text(fallback) if fallback.exists() else ""


def build_interaction_component_prompt(
    *,
    component_name: str,
    module: dict[str, Any],
    interaction: dict[str, Any],
) -> tuple[str, str]:
    """Build prompts for generating an interactive React component."""
    example_code = _load_example_component(interaction.get("capability", ""))

    system_prompt = (
        "你是一位 React + TypeScript 组件开发者，为学习可视化平台编写交互式教学组件。\n\n"
        "技术约束（必须严格遵守）：\n"
        "- 第一行必须是 'use client';\n"
        "- 只使用 React hooks（useState, useMemo, useCallback 等）和 Tailwind CSS\n"
        "- 零外部依赖——不允许 import 任何第三方包（d3、recharts、lodash 等全部不行）\n"
        "- 使用项目 CSS 变量：var(--color-text)、var(--color-bg)、var(--color-border)、"
        "var(--color-muted)、var(--color-panel)、var(--color-accent)\n"
        "- 暗色模式通过 Tailwind dark: 前缀支持，darkMode 策略是 class\n"
        "- 组件必须 export default function " + component_name + "()\n"
        "- 200-400 行 TypeScript 代码，一个文件完成\n"
        "- 只输出代码，不要 markdown 围栏、不要解释、不要注释块\n\n"
        "组件设计原则：\n"
        "- 组件服务于学习目标——用户操作后应该产生认知洞见，不是纯展示\n"
        "- 提供有意义的默认数据，用户打开就能看到有内容的状态\n"
        "- 包含简短的中文说明文字，解释操作和背后的原理\n"
        "- 外层容器用 rounded-xl border bg-[color:var(--color-panel)] overflow-hidden\n"
        "- header 区域显示图标 + 中文标题 + 英文副标题\n"
    )

    user_prompt = (
        f"为以下学习模块生成交互组件，组件名为 {component_name}。\n\n"
        f"模块标题：{module.get('title', '')}\n"
        f"焦点问题：{module.get('focusQuestion', '')}\n"
        f"关键洞见：{module.get('keyInsight', '')}\n"
        f"概念列表：{json.dumps([c.get('name', '') for c in module.get('concepts', [])], ensure_ascii=False)}\n"
        f"逻辑链：{json.dumps(module.get('logicChain', [])[:5], ensure_ascii=False)}\n\n"
        f"交互需求：\n"
        f"- 能力类型：{interaction.get('capability', '')}\n"
        f"- 交互目的：{interaction.get('purpose', '')}\n\n"
        "参考组件（学习风格、结构和 CSS 变量用法，不要照抄业务逻辑）：\n"
        "```tsx\n"
        f"{example_code}\n"
        "```\n"
    )

    return system_prompt, user_prompt
