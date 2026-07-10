from __future__ import annotations

import re
from typing import Any

try:
    from .research import quote_in_text
except ImportError:
    from research import quote_in_text


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
FINAL_FORWARD_PHRASES = ("下一章", "接下来", "要回答这些", "要回答这个问题", "必须深入", "继续追问")


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
    is_final_chapter: bool = False,
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
    text_blocks = [
        str(block.get("content") or "")
        for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    if len(blocks) > 24:
        issues.append(
            f"narrative 碎块化：{len(blocks)} 个块远超 10-18 的约束；"
            "不要按句子切块，把连续论证合并成 3-6 句的完整段落"
        )
    elif len(text_blocks) >= 8 and sum(len(t) for t in text_blocks) / len(text_blocks) < 60:
        issues.append("narrative 碎块化：text 块平均长度过短，把相邻短句合并成完整段落")
    if writing_mode == "conceptual-essay":
        if is_final_chapter:
            tail_text = "\n".join(
                str(block.get("content") or "")
                for block in blocks[-3:]
                if isinstance(block, dict)
            )
            if any(phrase in tail_text for phrase in FINAL_FORWARD_PHRASES):
                issues.append("末章仍在抛出后续问题，没有完成课程收束")

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
            issues.append(
                f"比较对象喧宾夺主: {', '.join(runaway_names)}；"
                "本章 role 没有要求比较，重写时删除这些对象的成段展开，正文最多保留一句过渡提及"
            )

    return {
        "pass": not issues,
        "score": 90 if not issues else max(40, 85 - 10 * len(issues)),
        "issues": issues,
        "rewriteHint": "；".join(issues),
    }


def validate_fact_spine(fact_spine: Any, *, evidence_ids: set[str] | None = None) -> list[str]:
    """factSpine 硬校验：非空、每条 claim 具体；二期传 evidence_ids 后每条必须挂到有效证据。"""
    issues: list[str] = []
    items = fact_spine if isinstance(fact_spine, list) else []
    if len(items) < 3:
        issues.append(f"factSpine 至少 3 条具体事实锚点，当前只有 {len(items)} 条")
    for index, item in enumerate(items):
        claim = str(item.get("claim") if isinstance(item, dict) else item or "").strip()
        if len(claim) < 10:
            issues.append(f"factSpine[{index}] 过短，不是具体事实/案例/机制锚点")
        if evidence_ids is not None:
            ids = [str(x).strip() for x in (item.get("evidenceIds") or [])] if isinstance(item, dict) else []
            if not any(x in evidence_ids for x in ids):
                issues.append(f"factSpine[{index}] 没有挂到任何有效证据 id")
    return issues


def validate_chapter_evidence(chapter_plans: list[dict[str, Any]], evidence_ids: set[str]) -> list[str]:
    """验证每个 chapter 都挂到至少 2 条有效证据。"""
    issues: list[str] = []
    for chapter in chapter_plans or []:
        ids = [x for x in (chapter.get("evidenceIds") or []) if x in evidence_ids]
        if len(ids) < 2:
            issues.append(f"{chapter.get('id')} 只挂到 {len(ids)} 条有效证据（每章至少 2 条）")
    return issues


def check_quote_fidelity(chapter: dict[str, Any], evidence: list[dict[str, Any]]) -> list[str]:
    """quote block 必须逐字来自证据库（归一化子串）；这是机器防线，不走 LLM。"""
    issues: list[str] = []
    for block in chapter.get("narrative") or []:
        if isinstance(block, dict) and block.get("type") == "quote":
            content = str(block.get("content") or "")
            if not any(quote_in_text(content, str(e.get("content") or "")) for e in evidence):
                issues.append(f"quote 块不是证据库原文，必须逐字引用证据或改为 text：{content[:40]}…")
    return issues
