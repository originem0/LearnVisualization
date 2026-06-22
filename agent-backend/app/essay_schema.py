from __future__ import annotations

from typing import Any

REGISTERS = {"explainer", "essay"}
WRITING_MODES = {"conceptual-essay", "case-narrative", "mechanism-explainer"}
BLOCK_TYPES = {"text", "heading", "callout", "code", "quote"}
BLOCK_TYPE_ALIASES = {
    "paragraph": "text",
    "section": "heading",
    "subheading": "heading",
    "h2": "heading",
    "h3": "heading",
}
HIGHLIGHT_KINDS = {"bespoke", "trace"}
ESSAY_KNOWLEDGE_TYPES = {"conceptual", "strategic", "metacognitive"}
CONCEPTUAL_WRITING_TYPES = {"conceptual", "strategic", "metacognitive"}


def _s(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _str_list(value: Any) -> list[str]:
    return [str(x).strip() for x in value if str(x).strip()] if isinstance(value, list) else []


def register_for_knowledge_type(knowledge_type: str) -> str:
    return "essay" if _s(knowledge_type).lower() in ESSAY_KNOWLEDGE_TYPES else "explainer"


def writing_mode_for_knowledge_type(knowledge_type: str) -> str:
    return "conceptual-essay" if _s(knowledge_type).lower() in CONCEPTUAL_WRITING_TYPES else "mechanism-explainer"


def normalize_writing_mode(value: Any, knowledge_type: str) -> str:
    mode = _s(value)
    if mode in WRITING_MODES:
        return mode
    return writing_mode_for_knowledge_type(knowledge_type)


def normalize_essay_plan_payload(payload: dict[str, Any] | None, *, topic: str, slug: str) -> dict[str, Any]:
    p = payload or {}
    overview = p.get("overview") or {}
    knowledge_type = _s(p.get("knowledgeType")) or "factual"
    register = _s(p.get("register")) or register_for_knowledge_type(knowledge_type)
    if register not in REGISTERS:
        register = "explainer"
    writing_mode = normalize_writing_mode(p.get("writingMode"), knowledge_type)
    return {
        "id": slug,
        "slug": slug,
        "title": _s(p.get("title")) or topic,
        "subtitle": _s(p.get("subtitle")),
        "topic": topic,
        "language": "zh",
        "status": "draft",
        "register": register,
        "writingMode": writing_mode,
        "knowledgeType": knowledge_type,
        "drivingQuestion": _s(p.get("drivingQuestion")),
        "centralTension": _s(p.get("centralTension")),
        "overview": {
            "whyExists": _s(overview.get("whyExists")),
            "wherePoints": _s(overview.get("wherePoints")),
            "arc": _str_list(overview.get("arc")),
        },
        "chapters": [c for c in (_str_list(p.get("chapters")))],
    }


def validate_essay_narrative_block(block: dict[str, Any] | None, index: int) -> dict[str, Any]:
    b = block or {}
    btype = _s(b.get("type")) or "text"
    btype = BLOCK_TYPE_ALIASES.get(btype, btype)
    if btype not in BLOCK_TYPES:
        btype = "text"
    out: dict[str, Any] = {"type": btype, "content": _s(b.get("content"))}
    if btype == "code" and _s(b.get("lang")):
        out["lang"] = _s(b.get("lang"))
    if btype == "quote" and _s(b.get("cite")):
        out["cite"] = _s(b.get("cite"))
    return out


def _normalize_highlight(raw: Any, narrative_len: int) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    kind = _s(raw.get("kind"))
    if kind not in HIGHLIGHT_KINDS:
        return None
    after = raw.get("afterBlock")
    if not isinstance(after, int) or after < 0 or after >= max(narrative_len, 1):
        after = 0
    out: dict[str, Any] = {"kind": kind, "caption": _s(raw.get("caption")), "afterBlock": after}
    if kind == "bespoke":
        if not _s(raw.get("component")):
            return None
        out["component"] = _s(raw.get("component"))
    if kind == "trace":
        if not isinstance(raw.get("data"), dict):
            return None
        out["data"] = raw["data"]
    return out


def normalize_chapter_payload(payload: dict[str, Any] | None, *, chapter_id: str, number: int) -> dict[str, Any]:
    p = payload or {}
    narrative = [validate_essay_narrative_block(b, i) for i, b in enumerate(p.get("narrative") or [])]
    bridge_raw = p.get("bridge")
    bridge = _s(bridge_raw) or None if bridge_raw is not None else None
    return {
        "id": chapter_id,
        "number": number,
        "title": _s(p.get("title")) or f"第 {number} 章",
        "role": _s(p.get("role")),
        "narrative": narrative,
        "highlight": _normalize_highlight(p.get("highlight"), len(narrative)),
        "bridge": bridge,
    }
