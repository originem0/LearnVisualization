from __future__ import annotations

import re
from typing import Any

try:
    from .common import MODULE_REGISTRY_PATH, NARRATIVE_BLOCK_SPEC_PATH, read_json, read_text
except ImportError:
    from common import MODULE_REGISTRY_PATH, NARRATIVE_BLOCK_SPEC_PATH, read_json, read_text

ALLOWED_COLORS = {"blue", "emerald", "purple", "amber", "red"}
ALLOWED_MODULE_KINDS = {
    "concept-clarification",
    "mechanism-walkthrough",
    "system-overview",
    "case-study",
    "meta-reflection",
    "integration-review",
}
ALLOWED_COGNITIVE_ACTIONS = {"distinguish", "trace", "compare", "simulate", "rebuild", "reflect"}
ALLOWED_VISUAL_TYPES = {"conceptMap", "processFlow", "comparisonFrame", "stepSequence"}
ALLOWED_INTERACTION_CAPABILITIES = {
    "compare",
    "step-through",
    "simulate",
    "trace",
    "classify",
    "rebuild",
    "retrieve",
    "parameter-play",
}
ALLOWED_RETRIEVAL_PROMPTS = {"predict-next-step", "fill-gap", "rebuild-map", "compare-variants"}
GENERIC_PATTERNS = [
    "结构化理解",
    "资料堆砌",
    "最关键的问题",
    "关键结构讲到可复述",
    "需要先建立最小概念边界",
    "围绕这个机制",
    "举一个例子",
]


def load_narrative_spec() -> dict[str, Any]:
    return read_json(NARRATIVE_BLOCK_SPEC_PATH)


def load_frontend_component_whitelist() -> set[str]:
    content = read_text(MODULE_REGISTRY_PATH)
    match = re.search(r"componentWhitelist:\s*Record<string,\s*ComponentType>\s*=\s*{(?P<body>.*?)};", content, re.S)
    if not match:
        return set()
    body = match.group("body")
    return set(re.findall(r"^\s{2}([A-Za-z][A-Za-z0-9]+),?$", body, re.M))


def normalize_plan_payload(payload: dict[str, Any], *, topic: str, slug: str) -> dict[str, Any]:
    _require_string(payload, "title")
    _require_string(payload, "subtitle")
    _require_string(payload, "goal")
    _require_record(payload, "audience")
    _require_list(payload, "learningGoals")
    _require_list(payload, "categories")
    _require_list(payload, "moduleOutlines")
    if not payload["moduleOutlines"]:
        raise ValueError("course plan: moduleOutlines must not be empty")

    categories: list[dict[str, Any]] = []
    category_ids: set[str] = set()
    for category in payload["categories"]:
        if not isinstance(category, dict):
            raise ValueError("course plan: categories must contain objects")
        _require_string(category, "id")
        _require_string(category, "name")
        _require_string(category, "color")
        if category["color"] not in ALLOWED_COLORS:
            raise ValueError(f"course plan: unsupported category color '{category['color']}'")
        categories.append({"id": category["id"], "name": category["name"], "color": category["color"]})
        category_ids.add(category["id"])

    original_to_normalized: dict[str, str] = {}
    module_outlines: list[dict[str, Any]] = []
    for index, outline in enumerate(payload["moduleOutlines"], start=1):
        if not isinstance(outline, dict):
            raise ValueError("course plan: moduleOutlines must contain objects")
        normalized_id = f"s{index:02d}"
        original_to_normalized[str(outline.get("id") or normalized_id)] = normalized_id
        _require_string(outline, "title")
        _require_string(outline, "subtitle")
        _require_string(outline, "category")
        _require_string(outline, "moduleKind")
        _require_string(outline, "primaryCognitiveAction")
        _require_string(outline, "focusQuestion")
        _require_string(outline, "misconception")
        _require_string(outline, "targetChunk")
        if outline["category"] not in category_ids:
            raise ValueError(f"course plan: unknown category '{outline['category']}'")
        if outline["moduleKind"] not in ALLOWED_MODULE_KINDS:
            raise ValueError(f"course plan: unsupported moduleKind '{outline['moduleKind']}'")
        if outline["primaryCognitiveAction"] not in ALLOWED_COGNITIVE_ACTIONS:
            raise ValueError(
                f"course plan: unsupported primaryCognitiveAction '{outline['primaryCognitiveAction']}'"
            )
        module_outlines.append(
            {
                "id": normalized_id,
                "number": index,
                "title": outline["title"],
                "subtitle": outline["subtitle"],
                "category": outline["category"],
                "moduleKind": outline["moduleKind"],
                "primaryCognitiveAction": outline["primaryCognitiveAction"],
                "focusQuestion": outline["focusQuestion"],
                "misconception": outline["misconception"],
                "targetChunk": outline["targetChunk"],
                "priorKnowledge": _to_clean_str_list(outline.get("priorKnowledge")),
            }
        )

    module_ids = [item["id"] for item in module_outlines]
    raw_edges = payload.get("moduleGraph", {}).get("edges") if isinstance(payload.get("moduleGraph"), dict) else []
    edges: list[dict[str, Any]] = []
    for edge in raw_edges or []:
        if not isinstance(edge, dict):
            continue
        edge_type = str(edge.get("type") or "").strip()
        source = original_to_normalized.get(str(edge.get("from") or "").strip())
        target = original_to_normalized.get(str(edge.get("to") or "").strip())
        if not source or not target or edge_type not in {"prerequisite", "bridge", "recommended"}:
            continue
        edges.append(
            {
                "from": source,
                "to": target,
                "type": edge_type,
                "note": str(edge.get("note") or "").strip() or None,
            }
        )

    paths: list[dict[str, Any]] = []
    for index, path in enumerate(payload.get("paths") or [], start=1):
        if not isinstance(path, dict):
            continue
        module_refs = [original_to_normalized.get(str(item).strip()) for item in path.get("moduleIds") or []]
        normalized_module_refs = [item for item in module_refs if item]
        if not normalized_module_refs:
            continue
        paths.append(
            {
                "id": str(path.get("id") or f"path-{index}").strip() or f"path-{index}",
                "title": str(path.get("title") or "学习路径").strip() or "学习路径",
                "description": str(path.get("description") or "").strip() or None,
                "moduleIds": normalized_module_refs,
            }
        )
    if not paths:
        paths.append(
            {
                "id": "core-path",
                "title": "核心路径",
                "description": "默认完整学习路径",
                "moduleIds": module_ids,
            }
        )

    research_summary = payload.get("researchSummary") if isinstance(payload.get("researchSummary"), dict) else {}
    return {
        "id": slug,
        "slug": slug,
        "title": payload["title"],
        "subtitle": payload["subtitle"],
        "goal": payload["goal"],
        "projectType": str(payload.get("projectType") or "mixed"),
        "startDate": str(payload.get("startDate") or ""),
        "topic": topic,
        "language": str(payload.get("language") or "zh"),
        "status": "draft",
        "audience": {
            "primaryAudience": str(payload["audience"].get("primaryAudience") or "").strip(),
            "priorKnowledge": _to_clean_str_list(payload["audience"].get("priorKnowledge")),
            "constraints": _to_clean_str_list(payload["audience"].get("constraints")),
            "desiredOutcome": str(payload["audience"].get("desiredOutcome") or "").strip() or None,
        },
        "learningGoals": _to_clean_str_list(payload.get("learningGoals")),
        "nonGoals": _to_clean_str_list(payload.get("nonGoals")),
        "assumptions": _to_clean_str_list(payload.get("assumptions")),
        "philosophy": {
            "promise": str((payload.get("philosophy") or {}).get("promise") or "").strip() or None,
            "corePrinciples": _to_clean_str_list((payload.get("philosophy") or {}).get("corePrinciples")),
            "shiftStatement": str((payload.get("philosophy") or {}).get("shiftStatement") or "").strip() or None,
        },
        "categories": categories,
        "paths": paths,
        "moduleGraph": {"order": module_ids, "edges": edges},
        "moduleOutlines": module_outlines,
        "researchSummary": {
            "keyQuestions": _to_clean_str_list(research_summary.get("keyQuestions")),
            "commonMisconceptions": _to_clean_str_list(research_summary.get("commonMisconceptions")),
            "workedExamples": _to_clean_str_list(research_summary.get("workedExamples")),
            "visualTargets": _to_clean_str_list(research_summary.get("visualTargets")),
        },
    }


def normalize_module_payload(
    payload: dict[str, Any],
    *,
    module_outline: dict[str, Any],
    next_module_id: str | None,
) -> dict[str, Any]:
    for key in ("title", "subtitle", "focusQuestion", "misconception", "keyInsight", "opening", "bridgeTo"):
        if next_module_id is None and key == "bridgeTo":
            continue
        _require_string(payload, key)
    _require_list(payload, "concepts")
    _require_list(payload, "logicChain")
    _require_list(payload, "examples")
    _require_list(payload, "narrative")

    for concept in payload["concepts"]:
        if not isinstance(concept, dict):
            raise ValueError(f"{module_outline['id']}: concepts must contain objects")
        _require_string(concept, "name")
        _require_string(concept, "note")

    narrative = []
    for block_index, block in enumerate(payload["narrative"]):
        validated = validate_narrative_block(block, block_index)
        narrative.append(validated)

    visuals = []
    for visual in payload.get("visuals") or []:
        if not isinstance(visual, dict):
            continue
        visual_type = str(visual.get("type") or "").strip() or "conceptMap"
        if visual_type not in ALLOWED_VISUAL_TYPES:
            # Normalize common LLM aliases
            vt_map = {v.lower(): v for v in ALLOWED_VISUAL_TYPES}
            vt_map.update({"concept-map": "conceptMap", "process-flow": "processFlow",
                           "comparison-frame": "comparisonFrame", "step-sequence": "stepSequence",
                           "concept_map": "conceptMap", "process_flow": "processFlow"})
            visual_type = vt_map.get(visual_type.lower(), "conceptMap")
        visuals.append(
            {
                "id": str(visual.get("id") or f"{module_outline['id']}-visual").strip() or f"{module_outline['id']}-visual",
                "type": visual_type,
                "required": bool(visual.get("required", True)),
            }
        )
    if not visuals:
        visuals.append({"id": f"{module_outline['id']}-visual", "type": "conceptMap", "required": True})

    interaction_requirements = []
    for requirement in payload.get("interactionRequirements") or []:
        if not isinstance(requirement, dict):
            continue
        capability = str(requirement.get("capability") or "").strip()
        priority = str(requirement.get("priority") or "core").strip()
        if capability not in ALLOWED_INTERACTION_CAPABILITIES:
            # Try fuzzy match before rejecting
            capability_lower = capability.lower().replace("-", "").replace("_", "")
            fuzzy_map = {c.lower().replace("-", ""): c for c in ALLOWED_INTERACTION_CAPABILITIES}
            if capability_lower in fuzzy_map:
                capability = fuzzy_map[capability_lower]
            else:
                continue  # skip unrecognized capabilities instead of crashing
        # Normalize priority aliases LLMs commonly produce
        if priority in {"primary", "main", "hero", "essential"}:
            priority = "core"
        elif priority not in {"core", "secondary"}:
            priority = "secondary"
        interaction_requirements.append(
            {
                "capability": capability,
                "purpose": str(requirement.get("purpose") or "").strip(),
                "priority": priority,
                "componentHint": _validate_component_hint(requirement.get("componentHint")),
            }
        )

    retrieval_prompts = []
    for prompt in payload.get("retrievalPrompts") or []:
        if not isinstance(prompt, dict):
            continue
        prompt_type = str(prompt.get("type") or "").strip()
        if prompt_type not in ALLOWED_RETRIEVAL_PROMPTS:
            # Fuzzy match or default
            type_lower = prompt_type.lower().replace("_", "-")
            if type_lower in ALLOWED_RETRIEVAL_PROMPTS:
                prompt_type = type_lower
            else:
                prompt_type = "fill-gap"  # safe default
        retrieval_prompts.append(
            {
                "type": prompt_type,
                "prompt": str(prompt.get("prompt") or "").strip(),
                "answerShape": _normalize_optional_string(prompt.get("answerShape")),
            }
        )

    normalized = {
        "id": module_outline["id"],
        "number": module_outline["number"],
        "title": payload["title"],
        "subtitle": payload["subtitle"],
        "category": module_outline["category"],
        "moduleKind": module_outline["moduleKind"],
        "primaryCognitiveAction": module_outline["primaryCognitiveAction"],
        "focusQuestion": payload["focusQuestion"],
        "misconception": payload["misconception"],
        "quote": _normalize_optional_string(payload.get("quote")),
        "keyInsight": payload["keyInsight"],
        "opening": payload["opening"],
        "priorKnowledge": module_outline.get("priorKnowledge", []),
        "targetChunk": module_outline["targetChunk"],
        "chunkDependencies": _to_clean_str_list(payload.get("chunkDependencies")) or module_outline.get("priorKnowledge", []),
        "concepts": [{"name": item["name"], "note": item["note"]} for item in payload["concepts"]],
        "logicChain": _to_clean_str_list(payload["logicChain"]),
        "examples": _to_clean_str_list(payload["examples"]),
        "counterexamples": _to_clean_str_list(payload.get("counterexamples")),
        "pitfalls": _normalize_pitfalls(payload.get("pitfalls")),
        "narrative": narrative,
        "visuals": visuals,
        "interactionRequirements": interaction_requirements,
        "retrievalPrompts": retrieval_prompts,
        "bridgeTo": None if next_module_id is None else payload["bridgeTo"],
        "nextModuleId": next_module_id,
    }
    return normalized


def validate_narrative_block(block: Any, index: int) -> dict[str, Any]:
    if not isinstance(block, dict):
        raise ValueError(f"narrative[{index}] must be an object")
    block_type = str(block.get("type") or "").strip()

    # Normalize common LLM-generated type aliases to valid block types
    _type_aliases = {
        "comparisonframe": "comparison", "comparison-frame": "comparison",
        "concept-map": "diagram", "conceptmap": "diagram", "processflow": "diagram",
        "process-flow": "diagram", "stepsequence": "steps", "step-sequence": "steps",
        "step_sequence": "steps", "quote": "callout", "warning": "callout",
        "note": "callout", "tip": "callout", "example": "text",
        "paragraph": "text", "subheading": "heading", "h2": "heading", "h3": "heading",
    }
    if block_type.lower() in _type_aliases:
        block_type = _type_aliases[block_type.lower()]

    spec = load_narrative_spec().get(block_type)
    if not spec:
        # Last resort: treat unrecognized types as text blocks
        block_type = "text"
        spec = load_narrative_spec()["text"]

    normalized: dict[str, Any] = {"type": block_type, "content": str(block.get("content") or "")}
    if "label" in block and block.get("label") is not None:
        normalized["label"] = str(block["label"]).strip()

    for required_field in spec.get("required") or []:
        if required_field == "steps":
            continue
        value = normalized.get(required_field) if required_field in normalized else block.get(required_field)
        if not isinstance(value, str):
            raise ValueError(f"narrative[{index}] missing string field '{required_field}'")
        if block_type == "steps" and required_field == "content":
            normalized[required_field] = value
            continue
        if not value.strip():
            raise ValueError(f"narrative[{index}] missing string field '{required_field}'")
        normalized[required_field] = value.strip()

    if block_type == "steps":
        steps = block.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ValueError(f"narrative[{index}] steps block must contain steps[]")
        normalized_steps = []
        for step_index, step in enumerate(steps):
            if not isinstance(step, dict):
                raise ValueError(f"narrative[{index}].steps[{step_index}] must be an object")
            normalized_step: dict[str, Any] = {}
            for key in ("title", "description", "visual"):
                value = str(step.get(key) or "").strip()
                if not value:
                    raise ValueError(f"narrative[{index}].steps[{step_index}] missing '{key}'")
                normalized_step[key] = value
            highlight = _normalize_optional_string(step.get("highlight"))
            if highlight is not None:
                normalized_step["highlight"] = highlight
            normalized_steps.append(normalized_step)
        normalized["steps"] = normalized_steps

    return normalized


_NOVAK_LINK_WORDS = ["包含", "依赖", "推导", "实现", "约束", "区别于", "影响", "组成", "触发", "支撑"]


def _infer_link_word(logic_chain: list[str], concept_name: str, index: int) -> str:
    """Infer a short Novak-style link word from logicChain context, fallback to rotation."""
    for step in logic_chain:
        if concept_name in step:
            for word in ("包含", "依赖", "推导", "实现", "约束", "影响", "组成", "触发"):
                if word in step:
                    return word
    return _NOVAK_LINK_WORDS[index % len(_NOVAK_LINK_WORDS)]


def build_concept_map(module: dict[str, Any]) -> dict[str, Any]:
    concepts = module.get("concepts") or []
    logic_chain = module.get("logicChain") or []
    nodes = [
        {"id": "core", "label": [module["title"]], "x": 280, "y": 64, "w": 220, "h": 52, "accent": True},
    ]
    edges = []
    positions = [(120, 170), (280, 170), (440, 170), (280, 274)]
    for index, concept in enumerate(concepts[:4]):
        x, y = positions[index]
        node_id = f"n{index + 1}"
        nodes.append(
            {
                "id": node_id,
                "label": [concept["name"]],
                "x": x,
                "y": y,
                "w": 180,
                "h": 48,
            }
        )
        label = _infer_link_word(logic_chain, concept["name"], index)
        edges.append({"from": "core", "to": node_id, "label": label})

    if len(nodes) < 3:
        nodes.extend(
            [
                {"id": "nX", "label": ["机制"], "x": 160, "y": 180, "w": 160, "h": 48},
                {"id": "nY", "label": ["结果"], "x": 400, "y": 180, "w": 160, "h": 48},
            ]
        )
        edges.extend(
            [
                {"from": "core", "to": "nX", "label": "包含"},
                {"from": "nX", "to": "nY", "label": "推导"},
            ]
        )

    return {
        "title": module["title"],
        "type": "conceptMap",
        "nodes": nodes,
        "edges": edges,
        "svgW": 560,
        "svgH": 320,
        "ariaLabel": f"{module['title']} 概念关系图",
    }


def build_interaction_registry(module: dict[str, Any]) -> dict[str, Any]:
    registry: dict[str, Any] = {}
    secondary_index = 1
    for requirement in module.get("interactionRequirements") or []:
        key = "heroInteractive" if requirement["priority"] == "core" else f"secondaryInteractive{secondary_index}"
        if requirement["priority"] == "secondary":
            secondary_index += 1
        entry = {
            "capability": requirement["capability"],
            "purpose": requirement["purpose"],
            "priority": requirement["priority"],
        }
        if requirement.get("componentHint"):
            entry["componentHint"] = requirement["componentHint"]
        registry[key] = entry
    return registry


def run_quality_checks(package: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    whitelist = load_frontend_component_whitelist()
    modules = package.get("modules") or []
    interactions = package.get("interaction_registry") or {}
    concept_maps = package.get("concept_maps") or {}

    for module in modules:
        module_id = module["id"]
        _check_text_specificity(issues, module_id, "misconception", module.get("misconception"))
        _check_text_specificity(issues, module_id, "keyInsight", module.get("keyInsight"))
        _check_text_specificity(issues, module_id, "opening", module.get("opening"))

        focus_question = str(module.get("focusQuestion") or "")
        if "?" not in focus_question and "？" not in focus_question:
            issues.append(_issue("warning", module_id, "focus-question-shape", "focusQuestion should read like a real question"))
        if "是什么" in focus_question:
            issues.append(
                _issue(
                    "warning",
                    module_id,
                    "focus-question-generic",
                    "focusQuestion still looks definition-first; sharpen the conflict, not just the term.",
                )
            )

        if not any(block.get("type") == "steps" for block in module.get("narrative") or []):
            issues.append(_issue("error", module_id, "worked-example-missing", "module narrative is missing a steps block"))

        normalized_blocks = [re.sub(r"\s+", " ", str(block.get("content") or "")).strip() for block in module.get("narrative") or []]
        normalized_blocks = [item for item in normalized_blocks if item]
        if len(normalized_blocks) >= 3 and len(set(normalized_blocks)) / len(normalized_blocks) < 0.75:
            issues.append(_issue("warning", module_id, "narrative-duplication", "narrative blocks look repetitive"))

        examples = [item for item in module.get("examples") or [] if isinstance(item, str)]
        if not examples or any(len(item.strip()) < 12 for item in examples):
            issues.append(_issue("error", module_id, "examples-thin", "examples are too thin or too generic"))

        if any("..." in item for item in examples):
            issues.append(_issue("warning", module_id, "examples-placeholder", "examples still contain placeholder ellipsis"))

        registry_entry = interactions.get(module_id) or {}
        for interaction in registry_entry.values():
            if not isinstance(interaction, dict):
                continue
            component_hint = interaction.get("componentHint")
            if component_hint and component_hint not in whitelist:
                issues.append(
                    _issue(
                        "warning",
                        module_id,
                        "interaction-component-unregistered",
                        f"componentHint '{component_hint}' is not registered in the frontend whitelist",
                    )
                )

        schema = concept_maps.get(module_id) or concept_maps.get(str(module.get("number")))
        if not isinstance(schema, dict) or len(schema.get("nodes") or []) < 3 or len(schema.get("edges") or []) < 2:
            issues.append(_issue("warning", module_id, "concept-map-thin", "concept map is renderable but still too thin"))
        elif isinstance(schema, dict):
            for edge in schema.get("edges") or []:
                edge_label = edge.get("label") or ""
                if len(edge_label) > 10:
                    issues.append(_issue("warning", module_id, "concept-map-edge-verbose", f"concept map edge label too long ({len(edge_label)} chars): '{edge_label}'"))

    return issues


def _check_text_specificity(issues: list[dict[str, Any]], module_id: str, field: str, value: Any) -> None:
    text = str(value or "").strip()
    if not text:
        issues.append(_issue("error", module_id, f"{field}-missing", f"{field} is empty"))
        return
    for pattern in GENERIC_PATTERNS:
        if pattern in text:
            issues.append(_issue("error", module_id, f"{field}-generic", f"{field} still contains templated language: '{pattern}'"))
            return


def _normalize_pitfalls(value: Any) -> list[dict[str, str]]:
    pitfalls: list[dict[str, str]] = []
    for item in value or []:
        if not isinstance(item, dict):
            continue
        point = str(item.get("point") or "").strip()
        root_cause = str(item.get("rootCause") or "").strip()
        if point and root_cause:
            pitfalls.append({"point": point, "rootCause": root_cause})
    return pitfalls


def _normalize_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _validate_component_hint(value: Any) -> str | None:
    hint = _normalize_optional_string(value)
    if hint is None:
        return None
    whitelist = load_frontend_component_whitelist()
    return hint if hint in whitelist else None


def _to_clean_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        text = str(item).strip()
        if text:
            result.append(text)
    return result


def _require_string(payload: dict[str, Any], key: str) -> None:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"missing string field '{key}'")


def _require_list(payload: dict[str, Any], key: str) -> None:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"missing list field '{key}'")


def _require_record(payload: dict[str, Any], key: str) -> None:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"missing object field '{key}'")


def _issue(severity: str, module_id: str, code: str, message: str) -> dict[str, Any]:
    return {
        "severity": severity,
        "category": "quality",
        "moduleId": module_id,
        "code": code,
        "message": message,
        "suggestedFix": "Revise the generated content before review." if severity == "error" else "Inspect during review.",
    }
