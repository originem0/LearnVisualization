from __future__ import annotations

import re
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


COMPARISON_NAMES = ("萨特", "康德", "黑格尔", "马克思", "福柯", "海德格尔", "柏拉图", "苏格拉底", "弗洛伊德")
COMPARISON_ROLE_MARKERS = ("比较", "对比", "对照", "分歧", "差异", "路线", "三人", "两条", "另两条")
CONCEPTUAL_DRIFT_PHRASES = ("从某种意义上", "某种程度上", "本质上", "更深层", "深刻", "意义", "价值", "秩序", "主体", "现代性")


def _role_terms(role: str) -> list[str]:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]+", " ", role)
    terms: list[str] = []
    for chunk in cleaned.split():
        if re.fullmatch(r"[\u4e00-\u9fff]{2,}", chunk):
            terms.extend(chunk[i:i + 2] for i in range(0, max(len(chunk) - 1, 1), 2))
        elif len(chunk) >= 4:
            terms.append(chunk)
    return [term for term in terms if term not in {"这一", "这个", "本章", "章节", "主线", "作用"}]


def _comparison_is_runaway(text: str, name: str, role_text: str) -> bool:
    mentions = text.count(name)
    if mentions < 4:
        return False
    role_terms = [term for term in _role_terms(role_text) if term not in COMPARISON_NAMES]
    role_hits = sum(text.count(term) for term in role_terms)
    sentence_count = max(text.count("。") + text.count("；") + text.count("？") + text.count("！"), 1)

    # A comparison object is only a hard local failure when it starts competing with
    # the chapter's assigned concepts. A few mentions are acceptable as contrast or bridge.
    return mentions >= 6 or (mentions >= 4 and mentions >= max(role_hits, sentence_count // 3))


def _role_allows_comparison(role_text: str) -> bool:
    return any(marker in role_text for marker in COMPARISON_NAMES + COMPARISON_ROLE_MARKERS)


def evaluate_chapter_quality(
    chapter: dict[str, Any],
    *,
    register: str,
    writing_mode: str = "mechanism-explainer",
    chapter_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    narrative = chapter.get("narrative") if isinstance(chapter, dict) else []
    blocks = narrative if isinstance(narrative, list) else []
    text = "\n".join(str(block.get("content") or "") for block in blocks if isinstance(block, dict))
    title_and_text = f"{chapter.get('title') or ''}\n{text}"
    issues: list[str] = []

    if len(blocks) < 4:
        issues.append("narrative 太短，无法形成连续论证")
    if writing_mode != "conceptual-essay" and not any(
        isinstance(block, dict) and block.get("type") == "heading"
        for block in blocks
    ):
        issues.append("缺少至少一个自然小节标题")
    for phrase in BANNED_PHRASES:
        if phrase in text:
            issues.append(f"包含 AI/摆拍套话: {phrase}")
    if register == "explainer" and ("哲学" in text or "人生" in text):
        issues.append("explainer 章节滑向空泛哲学化")
    if text.count("。") + text.count("；") < 6:
        issues.append("正文句子太少，实质密度不足")
    if writing_mode == "conceptual-essay":
        role = str((chapter_plan or {}).get("role") or chapter.get("role") or "").strip()
        role_text = "\n".join([
            str((chapter_plan or {}).get("title") or chapter.get("title") or ""),
            role,
        ])
        terms = _role_terms(role)
        if role and terms and not any(term in title_and_text for term in terms):
            issues.append(f"conceptual-essay 没有明显完成章节 role: {role}")

        anchor_hits = sum(text.count(token) for token in ("例如", "比如", "具体", "案例", "事实", "文本", "历史", "经验", "处境"))
        anchor_hits += len(re.findall(r"\d{2,4}|《[^》]+》|“[^”]{2,}”", text))
        drift_hits = sum(text.count(phrase) for phrase in CONCEPTUAL_DRIFT_PHRASES)
        if drift_hits >= 10 and anchor_hits == 0:
            issues.append("conceptual-essay 连续空转概念，缺少具体事实/文本/经验锚点")

        role_mentions_comparison = _role_allows_comparison(role_text)
        runaway_names = [
            name for name in COMPARISON_NAMES
            if _comparison_is_runaway(text, name, role_text)
        ]
        if runaway_names and not role_mentions_comparison:
            issues.append(f"比较对象喧宾夺主: {', '.join(runaway_names)}")

    return {
        "pass": not issues,
        "score": 90 if not issues else max(40, 85 - 10 * len(issues)),
        "issues": issues,
        "rewriteHint": "；".join(issues),
    }
