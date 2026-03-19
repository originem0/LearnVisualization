from typing import Any


def _to_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def normalize_topic_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    topic = str(payload.get("topic") or "").strip()
    if not topic:
        raise ValueError("topic is required")
    return {
        "topic": topic,
        "audience": str(payload.get("audience") or "").strip() or None,
        "goals": _to_str_list(payload.get("goals")),
        "constraints": _to_str_list(payload.get("constraints")),
    }


def normalize_module_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    topic_req = normalize_topic_request(payload)
    module_id = str(payload.get("module_id") or "").strip()
    if not module_id:
        raise ValueError("module_id is required")
    return {
        **topic_req,
        "module_id": module_id,
        "title": str(payload.get("title") or "").strip() or None,
        "module_kind": str(payload.get("module_kind") or "").strip() or None,
        "primary_cognitive_action": str(payload.get("primary_cognitive_action") or "").strip() or None,
        "focus_question": str(payload.get("focus_question") or "").strip() or None,
        "prerequisites": _to_str_list(payload.get("prerequisites")),
    }
