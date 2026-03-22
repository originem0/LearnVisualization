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
ALLOWED_COGNITIVE_ACTIONS = {"distinguish", "trace", "compare", "simulate", "rebuild", "reflect", "analyze"}
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
ALLOWED_EXERCISE_TYPES = {
    "fill-blank", "rebuild-map", "compare-variants", "predict-next-step",
    "classify", "explain", "free-response", "self-explanation", "trace-execution",
}
ALLOWED_SCAFFOLD_LEVELS = {"full", "faded-1", "faded-2", "free"}
ALLOWED_RESPONSE_TYPES = {"select", "generate", "arrange", "code", "explain"}
ALLOWED_BLOOM_LEVELS = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
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
    # Soft fallbacks for fields LLMs sometimes omit
    if not _has_string(payload, "subtitle"):
        payload["subtitle"] = topic
    if not _has_string(payload, "goal"):
        payload["goal"] = payload["title"]
    if not isinstance(payload.get("audience"), dict):
        payload["audience"] = {"primaryAudience": "", "priorKnowledge": [], "constraints": []}
    if not isinstance(payload.get("learningGoals"), list):
        payload["learningGoals"] = []
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
        # Soft fallbacks for fields LLMs sometimes omit
        if not _has_string(outline, "subtitle"):
            outline["subtitle"] = ""
        if not _has_string(outline, "category"):
            outline["category"] = "core"
        if not _has_string(outline, "moduleKind"):
            outline["moduleKind"] = "concept-clarification"
        if not _has_string(outline, "primaryCognitiveAction"):
            outline["primaryCognitiveAction"] = "distinguish"
        if not _has_string(outline, "focusQuestion"):
            outline["focusQuestion"] = outline["title"] + "？"
        if not _has_string(outline, "misconception"):
            outline["misconception"] = ""
        if not _has_string(outline, "targetChunk"):
            outline["targetChunk"] = outline["title"]
        if outline["category"] not in category_ids:
            outline["category"] = next(iter(category_ids))  # use first category as fallback
        # Passthrough: start from LLM outline, overlay normalized id/number
        normalized_outline = {**outline}
        normalized_outline.update({
            "id": normalized_id,
            "number": index,
            "priorKnowledge": _to_clean_str_list(outline.get("priorKnowledge")),
        })
        module_outlines.append(normalized_outline)

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
    # Structural checks — these fields are genuinely required
    for key in ("title", "subtitle", "focusQuestion", "keyInsight", "opening"):
        _require_string(payload, key)
    if not _has_string(payload, "misconception"):
        payload["misconception"] = ""
    if next_module_id is not None and not _has_string(payload, "bridgeTo"):
        payload["bridgeTo"] = ""
    if not isinstance(payload.get("concepts"), list):
        payload["concepts"] = []
    if not isinstance(payload.get("logicChain"), list):
        payload["logicChain"] = []
    if not isinstance(payload.get("examples"), list):
        payload["examples"] = []
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
            capability_lower = capability.lower().replace("-", "").replace("_", "")
            fuzzy_map = {c.lower().replace("-", ""): c for c in ALLOWED_INTERACTION_CAPABILITIES}
            if capability_lower in fuzzy_map:
                capability = fuzzy_map[capability_lower]
            else:
                continue
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

    # Trim to max 2: first core + first secondary
    trimmed_interactions: list[dict[str, Any]] = []
    has_core = False
    has_secondary = False
    for req in interaction_requirements:
        if req["priority"] == "core" and not has_core:
            trimmed_interactions.append(req)
            has_core = True
        elif req["priority"] == "secondary" and not has_secondary:
            trimmed_interactions.append(req)
            has_secondary = True
        if len(trimmed_interactions) >= 2:
            break
    interaction_requirements = trimmed_interactions

    retrieval_prompts = []
    for prompt in payload.get("retrievalPrompts") or []:
        if not isinstance(prompt, dict):
            continue
        prompt_type = str(prompt.get("type") or "").strip()
        if prompt_type not in ALLOWED_RETRIEVAL_PROMPTS:
            type_lower = prompt_type.lower().replace("_", "-")
            if type_lower in ALLOWED_RETRIEVAL_PROMPTS:
                prompt_type = type_lower
            else:
                prompt_type = "fill-gap"
        retrieval_prompts.append(
            {
                "type": prompt_type,
                "prompt": str(prompt.get("prompt") or "").strip(),
                "answerShape": _normalize_optional_string(prompt.get("answerShape")),
            }
        )

    exercises = _normalize_exercises(payload.get("exercises"), module_outline["id"])

    # Start from LLM payload (passthrough), then overlay authoritative values
    normalized = {**payload}
    normalized.update({
        "id": module_outline["id"],
        "number": module_outline["number"],
        "category": module_outline["category"],
        "moduleKind": module_outline["moduleKind"],
        "primaryCognitiveAction": module_outline["primaryCognitiveAction"],
        "priorKnowledge": module_outline.get("priorKnowledge", []),
        "targetChunk": module_outline["targetChunk"],
        "quote": _normalize_optional_string(payload.get("quote")),
        "chunkDependencies": _to_clean_str_list(payload.get("chunkDependencies")) or module_outline.get("priorKnowledge", []),
        "concepts": [{"name": item["name"], "note": item["note"], **({"relatedTo": item["relatedTo"]} if isinstance(item.get("relatedTo"), dict) else {})} for item in payload["concepts"]],
        "logicChain": _to_clean_str_list(payload["logicChain"]),
        "examples": _to_clean_str_list(payload["examples"]),
        "counterexamples": _to_clean_str_list(payload.get("counterexamples")),
        "pitfalls": _normalize_pitfalls(payload.get("pitfalls")),
        "narrative": narrative,
        "exercises": exercises,
        "visuals": visuals,
        "interactionRequirements": interaction_requirements,
        "retrievalPrompts": retrieval_prompts,
        "bridgeTo": None if next_module_id is None else payload.get("bridgeTo", ""),
        "nextModuleId": next_module_id,
    })
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
        # Unknown type: preserve original data, just ensure content exists
        return {"type": block_type, **{k: v for k, v in block.items() if k != "type"},
                "content": str(block.get("content") or "")}

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
            for word in ("包含", "依赖", "推导", "实现", "约束", "影响", "组成", "触发", "产生", "决定", "需要"):
                if word in step:
                    return word
    return _NOVAK_LINK_WORDS[index % len(_NOVAK_LINK_WORDS)]


def _build_llm_edge_index(concepts: list[dict[str, Any]]) -> dict[str, list[tuple[str, str]]]:
    """Build a map: concept_name -> [(target_name, link_word)] from LLM relatedTo fields."""
    index: dict[str, list[tuple[str, str]]] = {}
    concept_names = {c["name"] for c in concepts}
    for c in concepts:
        related = c.get("relatedTo")
        if not isinstance(related, dict):
            continue
        target = str(related.get("concept") or "").strip()
        link = str(related.get("link") or "").strip()
        if target and link and target in concept_names:
            index.setdefault(c["name"], []).append((target, link))
    return index


def _estimate_node_width(text: str) -> int:
    """Estimate node width based on text length. CJK chars ~14px, ASCII ~8px, plus padding."""
    w = 0
    for ch in text:
        w += 14 if ord(ch) > 0x7f else 8
    return max(w + 32, 100)  # min 100px


def _assign_layers(concepts: list[dict[str, Any]], logic_chain: list[str]) -> list[list[int]]:
    """Assign concepts to hierarchical layers based on logicChain mention order."""
    n = len(concepts)
    # Find first mention index in logicChain for each concept
    mention_order: list[tuple[int, int]] = []
    for ci, concept in enumerate(concepts):
        name = concept["name"]
        first_mention = len(logic_chain)  # default: not mentioned
        for si, step in enumerate(logic_chain):
            if name in step:
                first_mention = si
                break
        mention_order.append((first_mention, ci))

    mention_order.sort()

    # Group into layers: concepts mentioned in same logicChain step → same layer
    # Aim for 2-4 concepts per layer
    layers: list[list[int]] = []
    current_layer: list[int] = []
    prev_mention = -1
    for mention_idx, concept_idx in mention_order:
        if current_layer and (mention_idx != prev_mention or len(current_layer) >= 4):
            layers.append(current_layer)
            current_layer = []
        current_layer.append(concept_idx)
        prev_mention = mention_idx
    if current_layer:
        layers.append(current_layer)

    return layers


def build_concept_map(module: dict[str, Any]) -> dict[str, Any]:
    concepts = module.get("concepts") or []
    logic_chain = module.get("logicChain") or []
    title = module["title"]

    # Limit to 10 concepts
    concepts = concepts[:10]
    n = len(concepts)

    if n == 0:
        # Minimal fallback
        return {
            "title": title,
            "type": "conceptMap",
            "nodes": [
                {"id": "core", "label": [title], "x": 280, "y": 64, "w": 220, "h": 52, "accent": True},
                {"id": "nX", "label": ["机制"], "x": 160, "y": 180, "w": 160, "h": 48},
                {"id": "nY", "label": ["结果"], "x": 400, "y": 180, "w": 160, "h": 48},
            ],
            "edges": [
                {"from": "core", "to": "nX", "label": "包含"},
                {"from": "nX", "to": "nY", "label": "推导"},
            ],
            "svgW": 560,
            "svgH": 280,
            "ariaLabel": f"{title} 概念关系图",
        }

    # Assign concepts to layers
    layers = _assign_layers(concepts, logic_chain)

    # Layout parameters
    layer_gap_y = 110
    node_h = 48
    core_y = 50
    core_w = _estimate_node_width(title)
    h_padding = 40  # horizontal padding between nodes
    min_svg_w = 480

    # Calculate node positions layer by layer
    nodes = [{"id": "core", "label": [title], "x": 0, "y": core_y, "w": core_w, "h": 52, "accent": True}]
    edges = []
    node_map: dict[int, str] = {}  # concept index -> node id

    max_layer_width = core_w
    for layer_idx, layer in enumerate(layers):
        y = core_y + (layer_idx + 1) * layer_gap_y
        # Calculate widths for this layer
        widths = [_estimate_node_width(concepts[ci]["name"]) for ci in layer]
        total_width = sum(widths) + h_padding * (len(layer) - 1)
        max_layer_width = max(max_layer_width, total_width)

        # Center the layer
        start_x = -total_width / 2
        current_x = start_x
        for j, ci in enumerate(layer):
            w = widths[j]
            node_id = f"n{ci + 1}"
            node_map[ci] = node_id
            nodes.append({
                "id": node_id,
                "label": [concepts[ci]["name"]],
                "x": int(current_x + w / 2),
                "y": y,
                "w": w,
                "h": node_h,
            })
            current_x += w + h_padding

    # Center everything: shift all x coordinates so the diagram is centered
    svg_w = max(int(max_layer_width + 80), min_svg_w)
    center_x = svg_w // 2
    for node in nodes:
        node["x"] += center_x

    svg_h = core_y + (len(layers) + 1) * layer_gap_y

    # Build edges using LLM-provided relatedTo when available, fallback to heuristic
    llm_edges = _build_llm_edge_index(concepts)
    name_to_node: dict[str, str] = {}
    for ci, c in enumerate(concepts):
        if ci in node_map:
            name_to_node[c["name"]] = node_map[ci]

    connected_nodes: set[str] = set()

    # First: edges from LLM relatedTo — these form meaningful propositions
    for ci, c in enumerate(concepts):
        src_id = node_map.get(ci)
        if not src_id:
            continue
        for target_name, link_word in llm_edges.get(c["name"], []):
            tgt_id = name_to_node.get(target_name)
            if tgt_id and tgt_id != src_id:
                edges.append({"from": src_id, "to": tgt_id, "label": link_word})
                connected_nodes.add(src_id)
                connected_nodes.add(tgt_id)

    # Connect core node to first-layer concepts that aren't already connected
    for ci in (layers[0] if layers else []):
        node_id = node_map.get(ci)
        if node_id and node_id not in connected_nodes:
            label = _infer_link_word(logic_chain, concepts[ci]["name"], ci)
            edges.append({"from": "core", "to": node_id, "label": label})
            connected_nodes.add(node_id)

    # Ensure all nodes have at least one connection (fallback heuristic)
    for li in range(len(layers) - 1):
        upper = layers[li]
        lower = layers[li + 1]
        for ci_lower in lower:
            nid_lower = node_map.get(ci_lower)
            if not nid_lower or nid_lower in connected_nodes:
                continue
            # Find best parent from upper layer
            best_parent = upper[0] if upper else None
            for ci_upper in upper:
                upper_name = concepts[ci_upper]["name"]
                lower_name = concepts[ci_lower]["name"]
                for step in logic_chain:
                    if upper_name in step and lower_name in step:
                        best_parent = ci_upper
                        break
            if best_parent is not None and node_map.get(best_parent):
                label = _infer_link_word(logic_chain, concepts[ci_lower]["name"], ci_lower)
                edges.append({"from": node_map[best_parent], "to": nid_lower, "label": label})
                connected_nodes.add(nid_lower)

    # If no LLM edges at all, connect core to all first-layer nodes
    if not llm_edges:
        for ci in (layers[0] if layers else []):
            node_id = node_map.get(ci)
            if node_id and not any(e["to"] == node_id and e["from"] == "core" for e in edges):
                label = _infer_link_word(logic_chain, concepts[ci]["name"], ci)
                edges.append({"from": "core", "to": node_id, "label": label})

    return {
        "title": title,
        "type": "conceptMap",
        "nodes": nodes,
        "edges": edges,
        "svgW": svg_w,
        "svgH": svg_h,
        "ariaLabel": f"{title} 概念关系图",
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

        # steps block check: severity depends on moduleKind
        has_steps = any(block.get("type") == "steps" for block in module.get("narrative") or [])
        if not has_steps:
            module_kind = module.get("moduleKind", "")
            if module_kind in {"mechanism-walkthrough", "system-overview", "integration-review"}:
                issues.append(_issue("error", module_id, "worked-example-missing", "module narrative is missing a steps block"))
            else:
                issues.append(_issue("warning", module_id, "worked-example-missing", "module narrative has no steps block (optional for this moduleKind)"))

        # exercises check
        exercises = module.get("exercises") or []
        if not exercises:
            issues.append(_issue("warning", module_id, "exercises-empty", "module has no exercises"))

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

        # Interaction data validation: simulate type needs enough scenarios/presets
        interaction_data = package.get("interaction_data") or {}
        module_interactions = interaction_data.get(module_id) or {}
        for slot_key, slot_data in module_interactions.items():
            if not isinstance(slot_data, dict):
                continue
            if slot_data.get("type") == "simulate":
                scenarios_count = len(slot_data.get("scenarios") or [])
                presets_count = len(slot_data.get("presets") or [])
                if scenarios_count + presets_count < 3:
                    issues.append(
                        _issue(
                            "warning",
                            module_id,
                            "simulate-scenarios-thin",
                            f"simulate interaction '{slot_key}' has only {scenarios_count} scenarios + {presets_count} presets (need at least 3 total)",
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


def _normalize_exercises(value: Any, module_id: str) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    exercises: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        exercise_id = str(item.get("id") or f"ex{index + 1}").strip() or f"ex{index + 1}"
        exercise_type = str(item.get("type") or "").strip()
        if exercise_type not in ALLOWED_EXERCISE_TYPES:
            type_lower = exercise_type.lower().replace("_", "-")
            if type_lower in ALLOWED_EXERCISE_TYPES:
                exercise_type = type_lower
            else:
                exercise_type = "free-response"  # safe default
        bloom_level = str(item.get("bloomLevel") or "understand").strip()
        if bloom_level not in ALLOWED_BLOOM_LEVELS:
            bloom_level = "understand"
        scaffold_level = str(item.get("scaffoldLevel") or "full").strip()
        if scaffold_level not in ALLOWED_SCAFFOLD_LEVELS:
            scaffold_level = "full"
        prompt_text = str(item.get("prompt") or "").strip()
        if not prompt_text:
            continue  # exercise without a prompt is useless
        response_type = str(item.get("responseType") or "generate").strip()
        if response_type not in ALLOWED_RESPONSE_TYPES:
            response_type = "generate"
        exercise: dict[str, Any] = {
            "id": exercise_id,
            "type": exercise_type,
            "bloomLevel": bloom_level,
            "scaffoldLevel": scaffold_level,
            "prompt": prompt_text,
            "responseType": response_type,
        }
        hints = item.get("hints")
        if isinstance(hints, list):
            exercise["hints"] = [str(h).strip() for h in hints if str(h).strip()]
        answer = _normalize_optional_string(item.get("answer"))
        if answer is not None:
            exercise["answer"] = answer
        exercises.append(exercise)
    return exercises


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


def _has_string(payload: dict[str, Any], key: str) -> bool:
    value = payload.get(key)
    return isinstance(value, str) and bool(value.strip())


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
