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

PROMPT_VERSION = "v1-course-generation"


def build_topic_validation_prompt(topic: str) -> tuple[str, str]:
    """Build a lightweight prompt to validate and normalize a learning topic."""
    system_prompt = (
        "你是学习主题审核员。判断用户输入是否是一个有效的、可教学的知识主题。\n"
        "有效主题：一个具体的技术、概念、领域或技能，有足够深度设计成 5-15 章的课程。\n"
        "无效主题：乱码、单词碎片、过于窄（如某个函数的用法）、不是知识点（闲聊、问天气）、有害内容。\n"
        "宽泛主题（如'计算机'、'编程'）：valid=true 但提供 3-5 个更具体的方向建议。\n"
        "规范化：将同义表达统一为最通用的中文名称，括号内附英文缩写（如有）。\n"
        "只输出 JSON。"
    )
    user_prompt = (
        f"用户输入的主题：{topic}\n\n"
        "返回 JSON：\n"
        '{"valid": true/false, "canonicalTopic": "规范化名称", '
        '"narrowSuggestions": ["细化方向1", "细化方向2"] 或 null, '
        '"reason": "拒绝原因" 或 null}'
    )
    return system_prompt, user_prompt

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
        "- 每个 moduleOutline 必须标注 knowledgeTypes（至少一个，可选：factual/conceptual/procedural/strategic/metacognitive/situational）。\n"
        "- 每个 moduleOutline 必须标注 bloomLevel（remember/understand/apply/analyze/evaluate/create）。\n"
        "- 每个 moduleOutline 必须标注 elementInteractivity（low/medium/high）。\n"
        "- 不允许连续 3 个相同 moduleKind。\n"
        "- 课程前 1/3 模块可以是 remember/understand，中间 1/3 必须达到 apply/analyze，后 1/3 应有 evaluate/create。\n"
        "- focusQuestion 不能是定义式（不能用'X 是什么'句式），必须指向认知冲突或设计决策。\n"
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
        "\nv3 必选字段：\n"
        "- knowledgeTypes: 标注本模块教的知识类型（factual/conceptual/procedural/strategic/metacognitive/situational），至少一个。\n"
        "- bloomLevel: 本模块的认知层级（remember/understand/apply/analyze/evaluate/create）。\n"
        "- elementInteractivity: 概念间交互复杂度（low/medium/high），决定脚手架强度。\n"
        "- exercises: 至少 1 个练习。程序性模块至少 2 个且 scaffoldLevel 不同。每个 exercise 必须标注 bloomLevel。\n"
        "  exercise.type 可选: fill-blank/rebuild-map/compare-variants/predict-next-step/classify/explain/free-response/self-explanation/trace-execution。\n"
        "  exercise.scaffoldLevel 可选: full/faded-1/faded-2/free。\n"
        "  exercise.responseType 可选: select/generate/arrange/code/explain。\n"
        "- scaffoldProgression: 渐退序列，如 ['full', 'faded-1', 'free']。\n"
        "- retrievalPrompts 的每一项必须标注 bloomLevel。remember 层最多占 30%。\n"
        "- misconception 必须是具体的错误直觉，不能是空泛描述。\n"
        "\n负面样本（不要这样做）：\n"
        "差的焦点问题: 'Transformer 的全称是什么？' — 定义式 | '深入理解注意力机制' — 不是问题\n"
        "好的焦点问题: '为什么 Attention 不用 CNN 的局部窗口，而要看全部位置？' — 指向设计决策\n"
        "差的误解: '很多人对注意力机制理解不深' — 空泛 | '注意力是一个重要概念' — 不是误解\n"
        "好的误解: '认为注意力就是给每个词打分，分高的就重要' — 具体的错误心智模型\n"
        "差的检索: type=fill-gap, '______的全称是Transformer' — 事实记忆\n"
        "好的检索: type=compare-variants, bloomLevel=analyze, '如果把 Self-Attention 的 softmax 换成 hardmax，长句翻译会怎样？' — 反事实推理\n"
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
                "knowledgeTypes": ["conceptual"],
                "bloomLevel": "understand",
                "elementInteractivity": "medium",
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
        "knowledgeTypes": ["conceptual"],
        "bloomLevel": "understand",
        "elementInteractivity": "medium",
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
        "exercises": [
            {
                "id": "ex1",
                "type": "compare-variants",
                "bloomLevel": "analyze",
                "knowledgeType": "conceptual",
                "scaffoldLevel": "faded-1",
                "prompt": "具体练习题",
                "responseType": "generate",
                "hints": ["递进提示1"],
            }
        ],
        "scaffoldProgression": ["full", "faded-1", "free"],
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
                "bloomLevel": "analyze",
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


def build_interaction_data_prompt(
    *,
    module: dict[str, Any],
    interaction: dict[str, Any],
) -> tuple[str, str]:
    """Build prompts for generating structured interaction data (not code)."""
    capability = interaction.get("capability", "compare")

    schema_by_capability = {
        "compare": {
            "type": "compare",
            "title": "对比标题",
            "description": "引导说明",
            "items": [
                {"id": "a", "label": "选项A", "detail": "详细说明", "pros": ["优势1"], "cons": ["劣势1"]},
                {"id": "b", "label": "选项B", "detail": "详细说明", "pros": ["优势1"], "cons": ["劣势1"]},
            ],
            "dimensions": [{"name": "维度名", "description": "比较维度说明"}],
            "insight": "对比后应得出的关键认知",
        },
        "trace": {
            "type": "trace",
            "title": "追踪标题",
            "description": "引导说明",
            "steps": [
                {"id": "1", "label": "步骤名", "detail": "本步骤发生了什么", "state": "当前状态的文字描述", "highlight": "需要关注的关键变化"},
            ],
            "insight": "追踪完成后应得出的关键认知",
        },
        "step-through": {
            "type": "step-through",
            "title": "分步演示标题",
            "description": "引导说明",
            "steps": [
                {"id": "1", "label": "步骤名", "detail": "本步骤发生了什么", "state": "当前状态的文字描述", "highlight": "需要关注的关键变化"},
            ],
            "insight": "演示完成后应得出的关键认知",
        },
        "simulate": {
            "type": "simulate",
            "title": "模拟标题",
            "description": "引导说明",
            "parameters": [
                {"id": "param1", "label": "参数名", "min": 0, "max": 100, "default": 50, "step": 1, "unit": "单位"},
            ],
            "computeDescription": "参数如何影响结果的文字描述（前端用此解释变化）",
            "presets": [
                {"label": "预设名", "values": {"param1": 50}, "note": "为什么这个值有意义"},
            ],
            "insight": "调参后应得出的关键认知",
        },
        "parameter-play": {
            "type": "simulate",
            "title": "参数调节标题",
            "description": "引导说明",
            "parameters": [
                {"id": "param1", "label": "参数名", "min": 0, "max": 100, "default": 50, "step": 1, "unit": "单位"},
            ],
            "computeDescription": "参数如何影响结果的文字描述",
            "presets": [
                {"label": "预设名", "values": {"param1": 50}, "note": "为什么这个值有意义"},
            ],
            "insight": "调参后应得出的关键认知",
        },
        "classify": {
            "type": "classify",
            "title": "分类练习标题",
            "description": "引导说明",
            "categories": [
                {"id": "cat1", "label": "类别名", "description": "类别定义"},
            ],
            "items": [
                {"id": "item1", "content": "待分类内容", "correctCategory": "cat1", "explanation": "为什么属于这个类别"},
            ],
            "insight": "分类练习后应得出的关键认知",
        },
        "rebuild": {
            "type": "rebuild",
            "title": "重建练习标题",
            "description": "引导说明",
            "targetStructure": "需要重建的目标结构描述",
            "pieces": [
                {"id": "p1", "label": "拼图块", "correctPosition": 1},
            ],
            "insight": "重建后应得出的关键认知",
        },
        "retrieve": {
            "type": "classify",
            "title": "检索练习标题",
            "description": "引导说明",
            "categories": [
                {"id": "cat1", "label": "类别名", "description": "类别定义"},
            ],
            "items": [
                {"id": "item1", "content": "问题", "correctCategory": "cat1", "explanation": "答案与解释"},
            ],
            "insight": "练习后应得出的关键认知",
        },
    }

    schema = schema_by_capability.get(capability, schema_by_capability["compare"])

    system_prompt = (
        "你是一位教学交互设计师。根据模块内容生成结构化的交互数据（JSON）。\n"
        "不是生成代码，而是生成数据——前端有预建的渲染器会根据数据类型自动展示。\n\n"
        "要求：\n"
        "- 内容必须与模块的焦点问题和关键洞见直接相关\n"
        "- 每个交互都要有明确的认知目标（insight 字段）\n"
        "- 数据要具体到真实内容，不能用占位符\n"
        "- 只输出 JSON\n"
    )

    user_prompt = (
        f"模块标题：{module.get('title', '')}\n"
        f"焦点问题：{module.get('focusQuestion', '')}\n"
        f"关键洞见：{module.get('keyInsight', '')}\n"
        f"概念列表：{json.dumps([c.get('name', '') for c in module.get('concepts', [])], ensure_ascii=False)}\n"
        f"逻辑链：{json.dumps(module.get('logicChain', [])[:5], ensure_ascii=False)}\n\n"
        f"交互需求：\n"
        f"- 能力类型：{capability}\n"
        f"- 交互目的：{interaction.get('purpose', '')}\n\n"
        f"按以下 JSON 结构输出（字段含义见示例值）：\n"
        f"{json.dumps(schema, ensure_ascii=False, indent=2)}\n"
    )

    return system_prompt, user_prompt
