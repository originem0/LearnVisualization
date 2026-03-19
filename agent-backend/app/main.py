import json
import os
import shutil
import subprocess
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from .models import (
        normalize_export_request,
        normalize_module_request,
        normalize_promote_request,
        normalize_topic_request,
        normalize_validate_request,
    )
    from .workflow import WORKFLOW_V1, retry_policy
except ImportError:
    from models import (
        normalize_export_request,
        normalize_module_request,
        normalize_promote_request,
        normalize_topic_request,
        normalize_validate_request,
    )
    from workflow import WORKFLOW_V1, retry_policy

REPO_ROOT = Path(__file__).resolve().parents[2]
COURSES_ROOT = REPO_ROOT / "courses"
POSTGRESQL_ROOT = COURSES_ROOT / "postgresql-internals"
POSTGRESQL_MODULES_DIR = POSTGRESQL_ROOT / "modules"
GENERATED_ROOT = REPO_ROOT / "agent-backend" / "generated"


def _slugify(text: str) -> str:
    return "-".join(text.strip().lower().replace("/", " ").replace("_", " ").split())


def _default_audience(req: dict) -> str:
    return req.get("audience") or "想系统理解复杂主题的中文学习者"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# PostgreSQL special-case (hand-authored reference data)
# ---------------------------------------------------------------------------

def _postgresql_modules() -> list[dict]:
    return [
        {
            "id": "s01",
            "title": "Pages, Tuples 与 Heap Storage",
            "module_kind": "system-overview",
            "primary_cognitive_action": "trace",
            "focus_question": "一行数据写进 PostgreSQL 后，到底以什么形状躺在磁盘里？",
            "misconception": "表就是抽象网格，而不是 page 与 tuple 结构。",
            "target_chunk": "table -> heap page -> tuple -> tuple header",
        },
        {
            "id": "s02",
            "title": "MVCC 与 Visibility",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": "PostgreSQL 怎么让并发事务看到各自的真相？",
            "misconception": "事务隔离主要靠整表锁住。",
            "prerequisites": ["s01"],
            "target_chunk": "xmin/xmax + snapshot -> tuple visibility",
        },
        {
            "id": "s03",
            "title": "WAL 与 Crash Recovery",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": "机器崩了之后，数据库怎么把世界补回一致？",
            "misconception": "把数据页直接写盘就足够安全。",
            "prerequisites": ["s01"],
            "target_chunk": "redo log -> checkpoint -> crash recovery",
        },
        {
            "id": "s04",
            "title": "B-Tree Index Internals",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": "索引为什么快，又为什么会分裂、膨胀、退化？",
            "misconception": "索引只是一个逻辑加速开关。",
            "prerequisites": ["s01"],
            "target_chunk": "B-Tree node/page -> search path -> split/bloat",
        },
        {
            "id": "s05",
            "title": "Planner / Executor Pipeline",
            "module_kind": "system-overview",
            "primary_cognitive_action": "compare",
            "focus_question": "同一条 SQL，为什么有时用索引、有时顺序扫描？",
            "misconception": "plan 基本是 SQL 的固定翻译。",
            "prerequisites": ["s04"],
            "target_chunk": "SQL -> planner -> plan -> executor",
        },
        {
            "id": "s06",
            "title": "VACUUM / Autovacuum / Freeze",
            "module_kind": "integration-review",
            "primary_cognitive_action": "rebuild",
            "focus_question": "如果 MVCC 不断制造旧版本，PostgreSQL 为什么不会被历史垃圾淹没？",
            "misconception": "删除就是删掉，系统会自然变干净。",
            "prerequisites": ["s02", "s04", "s05"],
            "target_chunk": "MVCC debt -> vacuum / autovacuum / freeze -> long-term health",
        },
    ]


def _load_postgresql_module(module_id: str) -> dict | None:
    module_path = POSTGRESQL_MODULES_DIR / f"{module_id}.json"
    if not module_path.exists():
        return None
    return _read_json(module_path)


def _load_postgresql_course_package() -> dict:
    modules = []
    for module_id in _read_json(POSTGRESQL_ROOT / "course.json")["moduleGraph"]["order"]:
        modules.append(_load_postgresql_module(module_id))
    return {
        "course": _read_json(POSTGRESQL_ROOT / "course.json"),
        "modules": modules,
        "concept_maps": _read_json(POSTGRESQL_ROOT / "visuals" / "concept-maps.json"),
        "interaction_registry": _read_json(POSTGRESQL_ROOT / "interactions" / "registry.json"),
    }


# ---------------------------------------------------------------------------
# Topic type classification (Line C hook — heuristic, not LLM)
# ---------------------------------------------------------------------------

# Archetype sequences per topic type. Each entry defines the default module
# sequence and cognitive action for that kind of course.
TOPIC_TYPES = {
    "internals": {
        "description": "系统内部机制（数据库、编译器、运行时）",
        "archetype_sequence": [
            ("system-overview", "compare"),
            ("mechanism-walkthrough", "trace"),
            ("mechanism-walkthrough", "trace"),
            ("mechanism-walkthrough", "trace"),
            ("integration-review", "rebuild"),
        ],
    },
    "theory": {
        "description": "理论框架（ML、统计、算法）",
        "archetype_sequence": [
            ("concept-clarification", "distinguish"),
            ("concept-clarification", "distinguish"),
            ("mechanism-walkthrough", "trace"),
            ("meta-reflection", "reflect"),
        ],
    },
    "workflow": {
        "description": "流程与方法论（CI/CD、设计思维、事件响应）",
        "archetype_sequence": [
            ("system-overview", "compare"),
            ("mechanism-walkthrough", "trace"),
            ("case-study", "simulate"),
        ],
    },
    "system-overview": {
        "description": "系统架构全景（分布式系统、网络协议栈）",
        "archetype_sequence": [
            ("system-overview", "compare"),
            ("mechanism-walkthrough", "trace"),
            ("mechanism-walkthrough", "trace"),
            ("integration-review", "rebuild"),
        ],
    },
    "case-study": {
        "description": "案例分析与权衡（安全事件、架构决策）",
        "archetype_sequence": [
            ("concept-clarification", "distinguish"),
            ("case-study", "simulate"),
            ("meta-reflection", "reflect"),
        ],
    },
}

DEFAULT_TOPIC_TYPE = "system-overview"


def _classify_topic_type(topic: str, explicit_type: str | None = None) -> str:
    """Classify topic type. Explicit override takes priority, then heuristic keyword matching."""
    if explicit_type and explicit_type in TOPIC_TYPES:
        return explicit_type
    t = topic.lower()
    for signal in ["internal", "核心原理", "引擎", "kernel", "runtime", "compiler", "数据库内部", "internals"]:
        if signal in t:
            return "internals"
    for signal in ["theory", "理论", "数学", "统计", "算法基础", "foundations"]:
        if signal in t:
            return "theory"
    for signal in ["workflow", "流程", "pipeline", "ci/cd", "方法论", "实践指南"]:
        if signal in t:
            return "workflow"
    for signal in ["case", "案例", "事件", "事故", "tradeoff", "权衡", "incident", "postmortem"]:
        if signal in t:
            return "case-study"
    return DEFAULT_TOPIC_TYPE


def _archetype_title(topic: str, archetype: str, index: int) -> str:
    templates = {
        "concept-clarification": f"{topic} 的核心概念与边界",
        "mechanism-walkthrough": f"{topic} 的关键机制",
        "system-overview": f"{topic} 的系统全景",
        "case-study": f"{topic} 实战案例分析",
        "meta-reflection": f"{topic} 的认知复盘",
        "integration-review": f"{topic} 的系统整合",
    }
    base = templates.get(archetype, f"{topic} 模块 {index + 1}")
    # Disambiguate repeated archetypes
    count_so_far = index  # simple suffix
    if archetype == "mechanism-walkthrough" and index > 0:
        base = f"{topic} 的关键机制（{index}）"
    return base


def _archetype_focus_question(topic: str, archetype: str) -> str:
    templates = {
        "concept-clarification": f"{topic} 里最容易被混淆的核心概念之间的真正区别是什么？",
        "mechanism-walkthrough": f"{topic} 中这个关键机制的因果链条到底怎么运转？",
        "system-overview": f"{topic} 的各组件是怎么协作形成整体的？",
        "case-study": f"在这个真实场景里，{topic} 的原理是怎么体现（或失效）的？",
        "meta-reflection": f"学完这些之后，你对 {topic} 的理解结构发生了什么改变？",
        "integration-review": f"{topic} 的各个机制之间存在哪些关键制约关系？",
    }
    return templates.get(archetype, f"{topic} 在这一步最关键的问题是什么？")


# ---------------------------------------------------------------------------
# Per-archetype narrative templates
# ---------------------------------------------------------------------------

def _narrative_for_archetype(module_kind: str, topic: str) -> list[dict]:
    if module_kind == "concept-clarification":
        return [
            {"type": "text", "content": f"先拿出大家最常混淆的两个概念，正面碰撞。"},
            {"type": "comparison", "content": f"概念 A：...\n概念 B：...", "label": "核心区分"},
            {"type": "steps", "content": "", "label": "概念边界三步法", "steps": [
                {"title": "定义", "description": "给出最小可用定义", "visual": "definition", "highlight": "core"},
                {"title": "对比", "description": "和相邻概念做显式区分", "visual": "comparison", "highlight": "boundary"},
                {"title": "验证", "description": "用一个边界案例验证区分是否成立", "visual": "test case", "highlight": "verify"},
            ]},
            {"type": "callout", "content": "如果你不能说出两个概念的区别，你其实还没理解任何一个。"},
        ]
    if module_kind == "system-overview":
        return [
            {"type": "text", "content": f"先画 {topic} 的系统全景，然后逐层放大。"},
            {"type": "diagram", "content": f"[{topic} system diagram placeholder]", "label": "系统全景"},
            {"type": "steps", "content": "", "label": "系统分层", "steps": [
                {"title": "全景", "description": "各组件关系总览", "visual": "overview", "highlight": "all"},
                {"title": "数据流", "description": "数据如何在组件间流动", "visual": "data flow", "highlight": "flow"},
                {"title": "控制流", "description": "决策与调度如何发生", "visual": "control flow", "highlight": "control"},
            ]},
            {"type": "callout", "content": "系统理解的关键不是记住每个零件，而是看清它们之间的制约关系。"},
        ]
    if module_kind == "case-study":
        return [
            {"type": "text", "content": f"从一个真实场景切入，看 {topic} 的原理在实际中如何运作。"},
            {"type": "steps", "content": "", "label": "案例复盘", "steps": [
                {"title": "场景", "description": "描述问题发生的上下文", "visual": "scenario", "highlight": "context"},
                {"title": "决策", "description": "当时做了什么选择、为什么", "visual": "decision", "highlight": "choice"},
                {"title": "结果", "description": "选择导致了什么后果", "visual": "outcome", "highlight": "result"},
            ]},
            {"type": "callout", "content": "案例不是故事——它是原理的实验场。"},
        ]
    if module_kind == "meta-reflection":
        return [
            {"type": "text", "content": f"这一章不再追加新知识，而是回头审视你对 {topic} 的理解结构。"},
            {"type": "steps", "content": "", "label": "认知复盘", "steps": [
                {"title": "重建", "description": "不看材料，尝试重建核心机制链", "visual": "rebuild", "highlight": "recall"},
                {"title": "检验", "description": "哪些环节你说不清楚？", "visual": "gap check", "highlight": "gaps"},
                {"title": "迁移", "description": "这些原理能迁移到什么相近领域？", "visual": "transfer", "highlight": "transfer"},
            ]},
            {"type": "callout", "content": "理解不是记忆——是你能在新场景里重建它。"},
        ]
    if module_kind == "integration-review":
        return [
            {"type": "text", "content": f"把前面各章的机制重新连起来，看 {topic} 的整体制约关系。"},
            {"type": "steps", "content": "", "label": "系统整合", "steps": [
                {"title": "列举", "description": "列出前面学到的核心机制", "visual": "inventory", "highlight": "parts"},
                {"title": "连接", "description": "找出机制之间的依赖和制约", "visual": "connections", "highlight": "links"},
                {"title": "闭环", "description": "画出完整的系统闭环", "visual": "closed loop", "highlight": "system"},
            ]},
            {"type": "callout", "content": "孤立的机制知识不够用——系统理解要求你看见制约。"},
        ]
    # Default: mechanism-walkthrough
    return [
        {"type": "text", "content": f"先用一个最小冲突把 {topic} 的问题拎出来。"},
        {"type": "steps", "content": "", "label": "最小机制链", "steps": [
            {"title": "建立对象", "description": "明确这一章操作的最小对象是什么", "visual": "object boundary", "highlight": "object"},
            {"title": "追踪机制", "description": "按因果顺序解释关键变化", "visual": "mechanism trace", "highlight": "trace"},
            {"title": "验证结果", "description": "机制运行后的可观测结果是什么", "visual": "outcome", "highlight": "verify"},
        ]},
        {"type": "callout", "content": "如果一章不能被重建，它就还只是材料，不是课程。"},
    ]


# ---------------------------------------------------------------------------
# Core endpoint handlers
# ---------------------------------------------------------------------------

def health() -> dict:
    return {
        "ok": True,
        "service": "agent-backend",
        "mode": "zero-dependency-dev-server",
    }


def workflow() -> dict:
    return {
        "workflow": WORKFLOW_V1,
        "retry_policy": retry_policy(),
    }


def topic_framing_dry_run(req: dict) -> dict:
    audience = _default_audience(req)
    return {
        "topic": req["topic"],
        "audience": audience,
        "learning_goals": req["goals"] or [f"建立对 {req['topic']} 的结构化理解"],
        "non_goals": ["不覆盖所有边缘细节", "不直接追求百科式完整性"],
        "assumptions": req["constraints"] or ["需要保留 human review gate"],
        "scope_statement": f"围绕 {req['topic']} 构建可视化学习路径，优先焦点问题、结构外显和 worked examples。",
    }


def topic_classification_dry_run(req: dict) -> dict:
    classified = _classify_topic_type(req["topic"], req.get("topic_type"))
    return {
        "topic": req["topic"],
        "classified_type": classified,
        "type_description": TOPIC_TYPES[classified]["description"],
        "module_count": len(TOPIC_TYPES[classified]["archetype_sequence"]),
        "available_types": list(TOPIC_TYPES.keys()),
    }


def curriculum_planning_dry_run(req: dict) -> dict:
    topic = req["topic"].lower()
    if "postgres" in topic:
        modules = _postgresql_modules()
        return {"topic_type": "internals", "module_ids": [m["id"] for m in modules], "modules": modules}

    topic_type = _classify_topic_type(req["topic"], req.get("topic_type"))
    type_config = TOPIC_TYPES[topic_type]

    modules = []
    for idx, (archetype, cog_action) in enumerate(type_config["archetype_sequence"]):
        mod_id = f"s{idx + 1:02d}"
        modules.append({
            "id": mod_id,
            "title": _archetype_title(req["topic"], archetype, idx),
            "module_kind": archetype,
            "primary_cognitive_action": cog_action,
            "focus_question": _archetype_focus_question(req["topic"], archetype),
            "prerequisites": [f"s{idx:02d}"] if idx > 0 else [],
            "target_chunk": f"{req['topic']} {archetype} module {idx + 1}",
        })

    return {
        "topic_type": topic_type,
        "module_ids": [m["id"] for m in modules],
        "modules": modules,
    }


def draft_course_package_dry_run(req: dict) -> dict:
    framing = topic_framing_dry_run(req)
    plan = curriculum_planning_dry_run(req)
    return {
        "id": _slugify(req["topic"]),
        "title": req["topic"],
        "topic": req["topic"],
        "topic_type": plan.get("topic_type", DEFAULT_TOPIC_TYPE),
        "audience": framing["audience"],
        "learning_goals": framing["learning_goals"],
        "module_graph_order": plan["module_ids"],
        "modules": plan["modules"],
    }


def _generic_module_draft(req: dict) -> dict:
    title = req.get("title") or f"{req['topic']} 模块 {req['module_id']}"
    focus_question = req.get("focus_question") or f"{req['topic']} 在这一章最关键的问题到底是什么？"
    module_kind = req.get("module_kind") or "mechanism-walkthrough"
    primary_cognitive_action = req.get("primary_cognitive_action") or "trace"

    narrative = _narrative_for_archetype(module_kind, req["topic"])

    return {
        "id": req["module_id"],
        "number": None,
        "title": title,
        "subtitle": "由 agent-backend 生成的结构脚手架，需要人工审查和充实内容",
        "category": "generated",
        "moduleKind": module_kind,
        "primaryCognitiveAction": primary_cognitive_action,
        "focusQuestion": focus_question,
        "misconception": f"认为 {req['topic']} 只需要背定义，不需要理解因果机制。",
        "quote": f"{req['topic']} 不该被写成百科，而该被组织成可追踪的认知动作。",
        "keyInsight": f"这一章的目标不是堆信息，而是把 {req['topic']} 的一个关键结构讲到可复述、可区分、可重建。",
        "opening": f"这一章围绕 {req['topic']} 的一个核心问题展开：{focus_question}",
        "priorKnowledge": req.get("prerequisites", []),
        "targetChunk": f"{req['topic']} -> {module_kind} -> structured understanding",
        "chunkDependencies": req.get("prerequisites", []),
        "concepts": [
            {"name": f"{req['topic']} 核心概念", "note": "需要先建立最小概念边界。"},
            {"name": f"{req['topic']} 关键机制", "note": "理解它如何一步步发生。"},
        ],
        "logicChain": [
            f"先定义 {req['topic']} 的局部对象",
            "再追踪其关键机制与约束",
            "最后把机制结果与系统层影响重新连起来",
        ],
        "examples": [f"用一个最小 worked example 解释 {req['topic']} 的关键过程。"],
        "counterexamples": [f"{req['topic']} 不是只靠术语记忆就能掌握的主题。"],
        "pitfalls": [
            {
                "point": "把模块写成资料堆砌",
                "rootCause": "没有围绕焦点问题组织认知动作",
            }
        ],
        "narrative": narrative,
        "visuals": [{"id": f"{req['module_id']}-draft-visual", "type": "stepSequence", "required": True}],
        "interactionRequirements": [{"capability": primary_cognitive_action, "purpose": f"围绕 {module_kind} 的核心交互", "priority": "core"}],
        "retrievalPrompts": [{"type": "rebuild-map", "prompt": f"请重建 {req['topic']} 这一章的核心结构。"}],
        "bridgeTo": "下一章应该接着解释这个机制如何影响更大系统。",
        "nextModuleId": None,
        "_scaffold": True,
        "_scaffoldNote": "此模块由 agent-backend 自动生成，仅为结构脚手架，需要人工审查和充实内容。",
    }


def module_composition_dry_run(req: dict) -> dict:
    topic = req["topic"].lower()
    if "postgres" in topic:
        module = _load_postgresql_module(req["module_id"])
        if module is None:
            raise FileNotFoundError(f"Unknown PostgreSQL module: {req['module_id']}")
        return module
    return _generic_module_draft(req)


def _build_generic_course_package(req: dict) -> dict:
    framing = topic_framing_dry_run(req)
    plan = curriculum_planning_dry_run(req)
    order = plan["module_ids"]
    topic_type = plan.get("topic_type", DEFAULT_TOPIC_TYPE)
    modules = []
    for index, planned in enumerate(plan["modules"], start=1):
        module = module_composition_dry_run(
            {
                "topic": req["topic"],
                "audience": req.get("audience"),
                "goals": req.get("goals", []),
                "constraints": req.get("constraints", []),
                "module_id": planned["id"],
                "title": planned.get("title"),
                "module_kind": planned.get("module_kind"),
                "primary_cognitive_action": planned.get("primary_cognitive_action"),
                "focus_question": planned.get("focus_question"),
                "prerequisites": planned.get("prerequisites", []),
            }
        )
        module["number"] = index
        module["nextModuleId"] = order[index] if index < len(order) else None
        modules.append(module)

    slug = _slugify(req["topic"])

    # Minimal valid concept maps with placeholder nodes/edges
    # Keys are module numbers as strings (e.g. "1", "2"), matching frontend convention.
    concept_maps = {}
    for module in modules:
        num_key = str(module["number"])
        concept_maps[num_key] = {
            "type": (module.get("visuals") or [{"type": "stepSequence"}])[0].get("type", "stepSequence"),
            "title": module["title"],
            "nodes": [
                {"id": "core", "label": [module["title"]], "x": 200, "y": 50, "w": 160, "h": 50},
                {"id": "detail", "label": ["Detail"], "x": 200, "y": 150, "w": 160, "h": 50},
            ],
            "edges": [
                {"from": "core", "to": "detail", "label": "explores"},
            ],
            "svgW": 560,
            "svgH": 260,
            "ariaLabel": f"{module['title']} concept map (scaffold)",
            "_scaffold": True,
        }

    # Interaction registry with componentHint
    interaction_registry = {}
    for module in modules:
        mid = module["id"]
        cog_action = (module.get("interactionRequirements") or [{"capability": "trace"}])[0].get("capability", "trace")
        hint_base = slug.replace("-", " ").title().replace(" ", "")
        interaction_registry[mid] = {
            "heroInteractive": {
                "capability": cog_action,
                "purpose": "首屏核心理解交互",
                "priority": "core",
                "componentHint": f"{hint_base}Hero",
            },
            "secondaryInteractive": {
                "capability": "compare",
                "purpose": "补充对比交互",
                "priority": "secondary",
                "componentHint": f"{hint_base}Secondary",
            },
            "_scaffold": True,
        }

    edges = []
    for module in modules:
        for prerequisite in module.get("priorKnowledge", []):
            edges.append(
                {
                    "from": prerequisite,
                    "to": module["id"],
                    "type": "prerequisite",
                    "note": f"{prerequisite} -> {module['id']}",
                }
            )
    course = {
        "id": slug,
        "slug": slug,
        "title": req["topic"],
        "subtitle": f"由 agent-backend 导出的 {req['topic']} 课程包",
        "goal": framing["learning_goals"][0] if framing["learning_goals"] else f"建立对 {req['topic']} 的结构化理解",
        "projectType": "mixed",
        "startDate": date.today().isoformat(),
        "topic": slug,
        "language": "zh",
        "status": "scaffold",
        "categories": [{"id": "generated", "name": "生成课程", "color": "blue"}],
        "audience": {
            "primaryAudience": framing["audience"],
            "priorKnowledge": [],
            "desiredOutcome": framing["scope_statement"],
        },
        "learningGoals": framing["learning_goals"],
        "nonGoals": framing["non_goals"],
        "assumptions": framing["assumptions"],
        "philosophy": {
            "promise": framing["scope_statement"],
            "corePrinciples": [
                "先组织认知动作，再组织文本材料",
                "先输出结构化对象，再考虑最终渲染",
                "每个阶段都允许失败重试",
            ],
            "shiftStatement": f"从零散理解升级为对 {req['topic']} 的结构化掌握。",
        },
        "paths": [
            {
                "id": "core-path",
                "title": "核心路径",
                "description": f"围绕 {req['topic']} 的最小学习闭环",
                "moduleIds": order,
            }
        ],
        "moduleGraph": {"order": order, "edges": edges},
        "modules": order,
        "topicType": topic_type,
        "_scaffold": True,
        "_scaffoldNote": "此课程包由 agent-backend 自动生成，仅为结构脚手架。",
    }
    return {
        "course": course,
        "modules": modules,
        "concept_maps": concept_maps,
        "interaction_registry": interaction_registry,
    }


def export_course_package_dry_run(req: dict) -> dict:
    topic = req["topic"].lower()
    output_slug = req.get("output_slug") or _slugify(req["topic"])
    if "postgres" in topic:
        package = _load_postgresql_course_package()
    else:
        package = _build_generic_course_package(req)
    return {
        "output_slug": output_slug,
        "target_dir": str((GENERATED_ROOT / output_slug).resolve()),
        "files": [
            "course.json",
            "modules/*.json",
            "visuals/concept-maps.json",
            "interactions/registry.json",
        ],
        "module_count": len(package["modules"]),
        "module_ids": [m["id"] for m in package["modules"]],
        "course_title": package["course"]["title"],
    }


def export_course_package_write(req: dict) -> dict:
    topic = req["topic"].lower()
    output_slug = req.get("output_slug") or _slugify(req["topic"])
    output_root = Path(req.get("output_root") or GENERATED_ROOT)
    output_dir = output_root / output_slug
    if "postgres" in topic:
        package = _load_postgresql_course_package()
    else:
        package = _build_generic_course_package(req)

    _write_json(output_dir / "course.json", package["course"])
    for module in package["modules"]:
        _write_json(output_dir / "modules" / f"{module['id']}.json", module)
    _write_json(output_dir / "visuals" / "concept-maps.json", package["concept_maps"])
    _write_json(output_dir / "interactions" / "registry.json", package["interaction_registry"])
    return {
        "written": True,
        "output_dir": str(output_dir.resolve()),
        "module_count": len(package["modules"]),
        "module_ids": [m["id"] for m in package["modules"]],
    }


# ---------------------------------------------------------------------------
# Promote pipeline
# ---------------------------------------------------------------------------

def _validate_package_dir(package_dir: Path) -> dict:
    """Validate a course package directory: file existence + basic content shape."""
    required_files = [
        package_dir / "course.json",
        package_dir / "visuals" / "concept-maps.json",
        package_dir / "interactions" / "registry.json",
    ]
    missing = [str(path) for path in required_files if not path.exists()]
    modules_dir = package_dir / "modules"
    module_files = sorted([p.name for p in modules_dir.glob("s*.json")]) if modules_dir.exists() else []
    if not module_files:
        missing.append(str(modules_dir / "s*.json"))
    ok = not missing

    summary = None
    content_issues = []

    if ok:
        course = _read_json(package_dir / "course.json")
        if not course.get("id"):
            content_issues.append("course.json: missing id")
        if not course.get("title"):
            content_issues.append("course.json: missing title")
        if not course.get("moduleGraph", {}).get("order"):
            content_issues.append("course.json: missing moduleGraph.order")

        concept_maps = _read_json(package_dir / "visuals" / "concept-maps.json")
        interactions = _read_json(package_dir / "interactions" / "registry.json")

        for mod_file in module_files:
            mod_id = mod_file.replace(".json", "")
            mod = _read_json(package_dir / "modules" / mod_file)
            if not mod.get("title"):
                content_issues.append(f"{mod_id}: missing title")
            if not mod.get("focusQuestion"):
                content_issues.append(f"{mod_id}: missing focusQuestion")
            # Concept maps use numeric keys (module number), interactions use module ID
            mod_number = str(mod.get("number", ""))
            if mod_id not in concept_maps and mod_number not in concept_maps:
                content_issues.append(f"{mod_id}: missing concept-map entry")
            if mod_id not in interactions:
                content_issues.append(f"{mod_id}: missing interaction registry entry")

        summary = {
            "course_id": course.get("id"),
            "module_count": len(module_files),
            "module_ids": course.get("modules", []),
        }

    return {"ok": ok, "missing": missing, "content_issues": content_issues, "summary": summary}


def promote_dry_run(req: dict) -> dict:
    """Preview what promote would do without actually copying."""
    source_dir = GENERATED_ROOT / req["source_slug"]
    target_dir = COURSES_ROOT / req["target_slug"]

    validation = _validate_package_dir(source_dir)
    conflicts = {}
    if target_dir.exists():
        conflicts["target_exists"] = True
        conflicts["overwrite_required"] = True

    # Detect scaffold content
    scaffold_warnings = []
    if validation["ok"]:
        course = _read_json(source_dir / "course.json")
        if course.get("_scaffold"):
            scaffold_warnings.append("course.json is scaffold — needs human review")
        if course.get("status") == "scaffold":
            scaffold_warnings.append("course status is 'scaffold', not production-ready")
        concept_maps = _read_json(source_dir / "visuals" / "concept-maps.json")
        for key, cm in concept_maps.items():
            if cm.get("_scaffold"):
                scaffold_warnings.append(f"concept-map '{key}' is placeholder scaffold")
        interactions = _read_json(source_dir / "interactions" / "registry.json")
        for key, reg in interactions.items():
            if reg.get("_scaffold"):
                scaffold_warnings.append(f"interaction registry '{key}' is placeholder scaffold")
        modules_dir = source_dir / "modules"
        for mod_file in sorted(modules_dir.glob("s*.json")):
            mod = _read_json(mod_file)
            if mod.get("_scaffold"):
                scaffold_warnings.append(f"module '{mod.get('id', mod_file.stem)}' is scaffold — narrative needs human authoring")

    return {
        "source_slug": req["source_slug"],
        "target_slug": req["target_slug"],
        "source_valid": validation["ok"],
        "source_issues": validation.get("missing", []),
        "content_issues": validation.get("content_issues", []),
        "scaffold_warnings": scaffold_warnings,
        "target_conflicts": conflicts,
        "summary": validation.get("summary"),
        "would_promote": validation["ok"] and (not conflicts or req.get("overwrite")),
    }


def promote_generated_course_package(req: dict) -> dict:
    """Copy a generated course package from generated/ to courses/."""
    source_dir = GENERATED_ROOT / req["source_slug"]
    target_dir = COURSES_ROOT / req["target_slug"]

    validation = _validate_package_dir(source_dir)
    if not validation["ok"]:
        raise ValueError(f"source package invalid: {validation['missing']}")

    if target_dir.exists():
        if not req.get("overwrite"):
            raise ValueError(f"target already exists: {target_dir}")
        shutil.rmtree(target_dir)

    shutil.copytree(source_dir, target_dir)

    # Post-promote validation
    post_validation = _validate_package_dir(target_dir)

    return {
        "promoted": True,
        "source_dir": str(source_dir.resolve()),
        "target_dir": str(target_dir.resolve()),
        "module_count": validation["summary"]["module_count"] if validation.get("summary") else None,
        "module_ids": validation["summary"]["module_ids"] if validation.get("summary") else [],
        "post_promote_valid": post_validation["ok"],
        "post_promote_issues": post_validation.get("content_issues", []),
    }


# ---------------------------------------------------------------------------
# Build validation
# ---------------------------------------------------------------------------

def _run_command(command: list[str], cwd: Path, timeout: int = 1200) -> dict:
    completed = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return {
        "command": " ".join(command),
        "returncode": completed.returncode,
        "stdout": completed.stdout[-8000:],
        "stderr": completed.stderr[-8000:],
        "ok": completed.returncode == 0,
    }


def validate_build_dry_run(req: dict) -> dict:
    mode = req["mode"]
    if mode == "package":
        package_dir = Path(req.get("package_dir") or "")
        if not package_dir:
            raise ValueError("package_dir is required when mode=package")
        return {
            "mode": "package",
            "result": _validate_package_dir(package_dir),
        }

    check_result = _run_command(["npm", "run", "check"], REPO_ROOT)
    build_result = _run_command(["npm", "run", "build"], REPO_ROOT) if req.get("run_build", True) else None
    ok = check_result["ok"] and (build_result is None or build_result["ok"])
    return {
        "mode": "repo",
        "ok": ok,
        "check": check_result,
        "build": build_result,
    }


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------

class AgentBackendHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def log_message(self, format, *args):
        return

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send_json(health())
        if path == "/workflow":
            return self._send_json(workflow())
        return self._send_json({"error": f"Unknown route: {path}"}, status=404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self._read_json()
            if path == "/topic-framing/dry-run":
                return self._send_json(topic_framing_dry_run(normalize_topic_request(payload)))
            if path == "/topic-classification/dry-run":
                return self._send_json(topic_classification_dry_run(normalize_topic_request(payload)))
            if path == "/curriculum-planning/dry-run":
                return self._send_json(curriculum_planning_dry_run(normalize_topic_request(payload)))
            if path == "/draft-course-package/dry-run":
                return self._send_json(draft_course_package_dry_run(normalize_topic_request(payload)))
            if path == "/module-composition/dry-run":
                return self._send_json(module_composition_dry_run(normalize_module_request(payload)))
            if path == "/export-course-package/dry-run":
                return self._send_json(export_course_package_dry_run(normalize_export_request(payload)))
            if path == "/export-course-package/write":
                return self._send_json(export_course_package_write(normalize_export_request(payload)))
            if path == "/validate-build/dry-run":
                return self._send_json(validate_build_dry_run(normalize_validate_request(payload)))
            if path == "/promote-course-package/dry-run":
                return self._send_json(promote_dry_run(normalize_promote_request(payload)))
            if path == "/promote-course-package/write":
                return self._send_json(promote_generated_course_package(normalize_promote_request(payload)))
            return self._send_json({"error": f"Unknown route: {path}"}, status=404)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, status=400)
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=404)
        except subprocess.TimeoutExpired as exc:
            return self._send_json({"error": f"timeout: {exc.cmd}"}, status=504)
        except Exception as exc:
            return self._send_json({"error": f"internal_error: {exc}"}, status=500)


def serve() -> None:
    port = int(os.environ.get("AGENT_BACKEND_PORT", "8081"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AgentBackendHandler)
    print(f"agent-backend listening on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()
