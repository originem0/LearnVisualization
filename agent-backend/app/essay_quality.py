from __future__ import annotations

from typing import Any


BANNED_PHRASES = (
    "你有没有想过",
    "想象你是",
    "某个深夜",
    "这不仅仅是",
    "更是一种",
    "背后有着深刻",
    "让我们一起",
    "接下来我们将",
)


def evaluate_chapter_quality(chapter: dict[str, Any], *, register: str) -> dict[str, Any]:
    narrative = chapter.get("narrative") if isinstance(chapter, dict) else []
    blocks = narrative if isinstance(narrative, list) else []
    text = "\n".join(str(block.get("content") or "") for block in blocks if isinstance(block, dict))
    issues: list[str] = []

    if len(blocks) < 4:
        issues.append("narrative 太短，无法形成连续论证")
    if not any(isinstance(block, dict) and block.get("type") == "heading" for block in blocks):
        issues.append("缺少至少一个自然小节标题")
    for phrase in BANNED_PHRASES:
        if phrase in text:
            issues.append(f"包含 AI/摆拍套话: {phrase}")
    if register == "explainer" and ("哲学" in text or "人生" in text):
        issues.append("explainer 章节滑向空泛哲学化")
    if text.count("。") + text.count("；") < 6:
        issues.append("正文句子太少，实质密度不足")

    return {
        "pass": not issues,
        "score": 90 if not issues else max(40, 85 - 10 * len(issues)),
        "issues": issues,
        "rewriteHint": "；".join(issues),
    }
