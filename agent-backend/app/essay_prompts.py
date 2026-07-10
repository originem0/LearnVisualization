from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    from .essay_schema import register_for_knowledge_type, writing_mode_for_knowledge_type
except ImportError:
    from essay_schema import register_for_knowledge_type, writing_mode_for_knowledge_type


REPO_ROOT = Path(__file__).resolve().parents[2]


def _read_optional(path: Path, max_chars: int = 9000) -> str:
    try:
        return path.read_text(encoding="utf-8")[:max_chars]
    except OSError:
        return ""


def load_narrative_principles() -> str:
    parts = [
        _read_optional(REPO_ROOT / "DESIGN.md", 3500),
        _read_optional(REPO_ROOT / "design" / "04-agent-contract.md", 7000),
    ]
    return "\n\n".join(part for part in parts if part.strip())


def load_seed_example(register: str) -> str:
    if register != "essay":
        return ""
    seed_dir = REPO_ROOT / "fixtures" / "essay-seeds" / "work-money"
    course = _read_optional(seed_dir / "course.json", 5000)
    chapter = _read_optional(seed_dir / "chapters" / "c01.json", 5000)
    if not course or not chapter:
        return ""
    return f"course.json:\n{course}\n\nc01.json:\n{chapter}"


def build_essay_plan_prompts(
    request_payload: dict[str, Any],
    *,
    research_artifact: dict[str, Any] | None = None,
    revision_feedback: str | None = None,
) -> tuple[str, str]:
    contract = request_payload["contract"]
    register = register_for_knowledge_type(contract["knowledgeType"])
    default_writing_mode = writing_mode_for_knowledge_type(contract["knowledgeType"])
    system_prompt = (
        "你是 Learning Site Engine 的课程架构师。你只设计一条叙事主线，不设计模块清单、练习题、检索题或通用互动组件。\n"
        "输出必须是 JSON。课程必须是一条主线 + 4-6 章连续 essay。"
    )
    user_prompt = (
        "基于下面的学习契约，规划一门 narrative-essay 课程。\n\n"
        f"topic: {request_payload['topic']}\n"
        f"output_slug: {request_payload['output_slug']}\n"
        f"register: {register}\n"
        f"defaultWritingMode: {default_writing_mode}\n"
        f"contract: {json.dumps(contract, ensure_ascii=False, indent=2)}\n\n"
        "writingMode 选择规则：\n"
        "- conceptual-essay：概念论证、价值辨析、策略判断、元认知模型。尼采这类哲学/观念辨析课应使用它；它不要求人物、情节、个人故事。\n"
        "- mechanism-explainer：事实机制、操作过程、系统状态变化、技术/程序性解释。\n"
        "- case-narrative：只有当课程主线明确依赖一个具体情境、真实案例轨迹或事件过程时才使用；不要把 essay 自动理解成故事。\n\n"
        "叙事原则摘要：\n"
        f"{load_narrative_principles()}\n\n"
        "同语域 few-shot 种子（学习结构，不复制内容）：\n"
        f"{load_seed_example(register) or '(无可用种子)'}\n\n"
    )

    evidence_digest = ""
    if research_artifact and research_artifact.get("evidence"):
        lines = [
            f"[{item['id']}] ({item['kind']})《{item['sourceTitle']}》: {str(item['content'])[:80]}"
            for item in research_artifact["evidence"]
        ]
        evidence_digest = (
            "研究阶段已建立证据库（写作时每章会拿到全文，这里是摘要）：\n"
            + "\n".join(lines)
            + "\n\n"
        )
    user_prompt += evidence_digest

    user_prompt += (
        "输出 JSON 字段：\n"
        "{\n"
        '  "title": "课程标题",\n'
        '  "subtitle": "课程副标题",\n'
        '  "writingMode": "conceptual-essay | case-narrative | mechanism-explainer",\n'
        '  "overview": {"whyExists": "为什么存在", "wherePoints": "指向哪里", "arc": ["第1章作用", "第2章作用", "..."]},\n'
        '  "factSpine": [{"claim": "具体事实/机制断言", "evidenceIds": ["E01"]}],\n'
        '  "chapters": [\n'
        '    {"id": "c01", "number": 1, "title": "章节标题", "role": "这一章在主线里的作用", "evidenceIds": ["E01", "E02"]}\n'
        "  ]\n"
        "}\n\n"
    )
    user_prompt += (
        "硬约束：chapters 必须 4-6 个；章节标题必须像论证步骤，不要写'基础概念/进阶应用'；"
        "factSpine 必须 3-5 条且每条是具体事实、文本、数字或机制锚点，不能是概念定义，不能为空。"
    )
    if evidence_digest:
        user_prompt += "factSpine 每条和每个 chapter 都必须挂到证据库里真实存在的 evidenceIds；每章至少 2 条。"
    if revision_feedback:
        user_prompt += f"\n\n上一版规划未通过校验，必须修正：{revision_feedback}\n"
    return system_prompt, user_prompt


def build_chapter_prompts(
    *,
    request_payload: dict[str, Any],
    plan_artifact: dict[str, Any],
    chapter_plan: dict[str, Any],
    prev_chapter_ending: str | None,
    revision_feedback: str | None = None,
    evidence_items: list[dict[str, Any]] | None = None,
) -> tuple[str, str]:
    contract = request_payload["contract"]
    register = plan_artifact["register"]
    writing_mode = plan_artifact.get("writingMode") or writing_mode_for_knowledge_type(contract["knowledgeType"])
    is_final_chapter = chapter_plan.get("number") == len(plan_artifact.get("chapterPlans") or [])
    if register == "essay":
        register_rules = (
            "语域：思想随笔腔。允许有立场，但每个抽象判断都必须落到具体事实、案例或经验结构。"
            "禁止空洞金句、哲学家点名式背书、'这不仅仅是X，更是Y'。"
        )
    else:
        register_rules = (
            "语域：技术解说腔。像优秀技术视频脚本一样，从具体机制、代码、状态变化或反直觉问题进入。"
            "禁止摆拍场景、哲学化抒情、为比喻而比喻。"
        )
    if writing_mode == "conceptual-essay":
        mode_rules = (
            "写作模式：conceptual-essay。它是概念论证，不是记叙文。\n"
            "- 本章必须完成 chapterPlan.role，而不是百科式铺陈。\n"
            "- 以论证主线推进：判断 -> 理由 -> 反直觉处 -> 修正后的概念关系。\n"
            "- 每个抽象判断都要有具体事实、文本、历史处境、日常经验或可验证例子作为锚点。\n"
            "- 明确概念关系链：谁改变谁，谁依赖谁，谁和谁构成张力。\n"
            "- 不要求人物、情节、场景、个人经历；不要为了显得有故事而硬造深夜场景。\n"
            "- 比较对象必须受控。除非本章 role 明确要求比较，不要提前扩写萨特、康德、福柯等旁支。\n"
        )
    elif writing_mode == "case-narrative":
        mode_rules = (
            "写作模式：case-narrative。沿一个具体情境、案例或事件轨迹推进，但案例必须服务课程主线。"
            "不要把故事细节写成目的本身。"
        )
    else:
        mode_rules = (
            "写作模式：mechanism-explainer。拆解机制、状态变化和因果链；用例子解释机制，不做哲学化漂移。"
        )

    system_prompt = (
        "你是 narrative-essay 课程作者。你写连续散文，不写教学检查表。输出必须是 JSON。"
    )
    user_prompt = (
        f"课程主题：{request_payload['topic']}\n"
        f"本章：{json.dumps(chapter_plan, ensure_ascii=False, indent=2)}\n\n"
        f"学习契约：{json.dumps(contract, ensure_ascii=False, indent=2)}\n\n"
        "课程主线：\n"
        f"- drivingQuestion: {plan_artifact['drivingQuestion']}\n"
        f"- centralTension: {plan_artifact['centralTension']}\n"
        f"- register: {register}\n"
        f"- writingMode: {writing_mode}\n"
        f"- overview: {json.dumps(plan_artifact['overview'], ensure_ascii=False, indent=2)}\n"
        f"- factSpine: {json.dumps(plan_artifact.get('factSpine') or [], ensure_ascii=False, indent=2)}\n\n"
        f"上一章结尾（用于承接声音和过渡）：\n{prev_chapter_ending or '(第一章，无上一章)'}\n\n"
    )

    evidence_block = ""
    if evidence_items:
        rendered = "\n\n".join(
            f"[{item['id']}] ({item['kind']})《{item['sourceTitle']}》 {item['sourceUrl']}\n{item['content']}"
            for item in evidence_items
        )
        evidence_block = (
            "本章证据库（写作必须建立在这些材料上）：\n"
            f"{rendered}\n\n"
            "证据使用规则：\n"
            "- 具体事实断言必须有上面证据支撑；证据覆盖不到的地方，要么不写，要么明示为作者立场。\n"
            "- quote 类型的 narrative block 必须逐字复制某条证据的 content（程序校验），cite 写来源标题。\n"
            "- 证据要进入论证（解释、对照、推进），不要点名式背书。\n"
            '- 在输出 JSON 里加 "usedEvidence": ["E01", ...]，列出实际使用的证据 id。\n\n'
        )

    user_prompt += evidence_block
    user_prompt += (
        f"{register_rules}\n\n"
        f"{mode_rules}\n\n"
        "写作约束：\n"
        "- narrative 只允许 text/heading/callout/code/quote。\n"
        "- 主体必须是 text；不要 bullet，不要“本章将介绍”。\n"
        "- 开头直接进入问题、机制或判断，不要“想象你在某个深夜”。\n"
        "- narrative 表示章节内容的连续性，不表示必须写成故事体裁。\n"
        "- highlight 默认 null；只有代码执行追踪才使用 kind=trace。\n"
        "- 非最后一章 bridge 必须自然抛出下一章要承接的问题。\n"
        "- 如果这是最后一章，正文最后必须回扣 drivingQuestion 和 desiredOutcome，给出判断框架；不要写“下一章/接下来/要回答这些/必须深入”。\n"
        "- 输出 10-18 个 narrative block，宁可少而有主线，不要凑满知识点。\n"
    )
    if is_final_chapter:
        user_prompt += "\n章节位置：这是最后一章。bridge 必须为 null，正文必须完成课程收束，不能再抛出后续章节式问题。\n"
    if revision_feedback:
        user_prompt += f"\n上次质量评审未通过，必须修正：{revision_feedback}\n"
    user_prompt += (
        "\n输出 JSON 字段：\n"
        "{\n"
        '  "title": "章节标题",\n'
        '  "role": "章节作用",\n'
        '  "narrative": [{"type": "text", "content": "正文"}],\n'
        '  "usedEvidence": ["E01"],\n'
        '  "highlight": null,\n'
        '  "bridge": "过渡到下一章；末章为 null"\n'
        "}"
    )
    return system_prompt, user_prompt


def build_judge_prompts(
    chapter: dict[str, Any],
    *,
    register: str,
    writing_mode: str,
    chapter_plan: dict[str, Any],
    plan_artifact: dict[str, Any],
    evidence_items: list[dict[str, Any]] | None = None,
) -> tuple[str, str]:
    system_prompt = "你是严格的课程内容评审。只输出 JSON。"
    if writing_mode == "conceptual-essay":
        mode_standard = (
            "conceptual-essay 评审标准：\n"
            "- 章节是否完成原始 chapterPlan.role，而不是偏题成百科条目。\n"
            "- 概念链是否清楚：核心概念之间的依赖、冲突、转化关系是否能追踪。\n"
            "- 抽象判断是否有事实、文本、历史处境、经验结构或可验证例子作为锚点。\n"
            "- 比较对象是否受控；除非 chapterPlan.role 要求比较，不应让萨特、康德、福柯等旁支喧宾夺主。\n"
            "- 是否变成论文腔、百科腔或空洞金句。\n"
            "- 禁止因为没有场景、人物、情节、个人经历而判定不合格；这不是故事写作任务。\n"
        )
    elif writing_mode == "case-narrative":
        mode_standard = (
            "case-narrative 评审标准：案例轨迹是否清楚，案例是否服务 chapterPlan.role，情节细节是否没有吞掉概念主线。\n"
        )
    else:
        mode_standard = (
            "mechanism-explainer 评审标准：机制链是否清楚，状态变化是否具体，是否避免哲学化漂移和概念空转。\n"
        )
    user_prompt = (
        "评审下面章节是否适合进入 narrative-essay 课程。\n"
        f"register: {register}\n"
        f"writingMode: {writing_mode}\n"
        f"chapterPlan: {json.dumps(chapter_plan, ensure_ascii=False, indent=2)}\n"
        "课程主线：\n"
        f"- drivingQuestion: {plan_artifact.get('drivingQuestion')}\n"
        f"- centralTension: {plan_artifact.get('centralTension')}\n"
        f"- chapterPosition: {chapter.get('number')} / {len(plan_artifact.get('chapterPlans') or [])}\n"
        f"chapter: {json.dumps(chapter, ensure_ascii=False, indent=2)}\n\n"
    )

    if evidence_items:
        digest = "\n".join(
            f"[{item['id']}] ({item['kind']}) {item['content']}"
            for item in evidence_items
        )
        user_prompt += (
            f"本章证据库（以下为证据全文）：\n{digest}\n\n"
            "证据评审（任一不过即 pass=false）：\n"
            "(a) 列出没有证据支撑、又没有明示为立场的具体事实断言；\n"
            "(b) quote 块是否逐字来自证据；程序已做子串校验，只有确实不在上面证据全文中的才算违规；\n"
            "(c) 证据是否真正进入论证，而不是点名背书；\n"
            "(d) 章节是否完成 chapterPlan.role。\n\n"
        )

    user_prompt += (
        "标准：主线连贯、实质密度足够、没有 AI 套话、没有疑似杜撰的无来源研究/专家背书、语域吻合。\n"
        f"{mode_standard}"
        "输出 JSON：{\"pass\": true/false, \"score\": 0-100, \"issues\": [\"具体问题\"], \"rewriteHint\": \"如何重写\"}"
    )
    return system_prompt, user_prompt


def build_research_query_prompts(topic: str, contract: dict[str, Any]) -> tuple[str, str]:
    system_prompt = (
        "你是课程研究员。输出 JSON。"
        "搜索词要能命中一手文本和高质量二手材料（原著章节、标准百科、权威讲义），不要泛泛的科普词。"
    )
    scope = contract.get("scope") or {}
    user_prompt = (
        f"课程主题：{topic}\n"
        f"驱动问题：{contract.get('drivingQuestion')}\n"
        f"必须覆盖：{json.dumps(scope.get('include') or [], ensure_ascii=False)}\n"
        f"不覆盖：{json.dumps(scope.get('exclude') or [], ensure_ascii=False)}\n\n"
        "生成 6-10 个搜索查询，中英混合，具体到概念名、文本名、机制名或争论点。\n"
        "另外给出 wikiTopics：3-6 个维基百科条目名（人名、著作名、概念名），"
        "必须覆盖『必须覆盖』清单里出现的每一个思想家和核心概念，不要只围绕主主题。\n"
        '输出 JSON：{"queries": ["...", "..."], "wikiTopics": ["条目名", "..."]}'
    )
    return system_prompt, user_prompt


def build_evidence_extraction_prompts(
    *,
    topic: str,
    contract: dict[str, Any],
    doc_title: str,
    doc_url: str,
    doc_text: str,
) -> tuple[str, str]:
    system_prompt = (
        "你是课程研究员，从给定材料中萃取证据条目。输出 JSON。\n"
        "kind=quote 的 content 必须逐字复制材料原文中的连续片段——程序会做子串校验，任何改写、缩略、拼接都会被丢弃。\n"
        "fact/example/figure 可以用你的话概括，但必须忠实于材料，不得掺入材料之外的知识。"
    )
    user_prompt = (
        f"课程主题：{topic}\n"
        f"驱动问题：{contract.get('drivingQuestion')}\n\n"
        f"材料标题：{doc_title}\n材料地址：{doc_url}\n材料正文：\n{doc_text}\n\n"
        "萃取最多 8 条与课程问题直接相关的证据，优先级：可直接引用的原文论证段（quote）>"
        "具体事实/日期/数字（fact/figure）> 具体案例（example）。与课程问题无关的内容宁可不出。\n"
        '输出 JSON：{"evidence": [{"kind": "quote|fact|example|figure", "content": "...", "note": "与课程哪条论线相关"}]}'
    )
    return system_prompt, user_prompt


def build_course_verify_prompts(
    *,
    plan_artifact: dict[str, Any],
    chapters: list[dict[str, Any]],
) -> tuple[str, str]:
    system_prompt = "你是课程终审评审。只输出 JSON。"

    def _chapter_digest(chapter: dict[str, Any], full: bool) -> str:
        blocks = [b for b in chapter.get("narrative") or [] if isinstance(b, dict) and b.get("type") == "text"]
        if full:
            body = "\n".join(str(b.get("content") or "") for b in blocks)
        else:
            head = str(blocks[0].get("content") or "") if blocks else ""
            tail = str(blocks[-1].get("content") or "") if len(blocks) > 1 else ""
            body = f"{head}\n……\n{tail}"
        return f"## {chapter['id']} {chapter.get('title')}\nrole: {chapter.get('role')}\n{body}"

    digests = [
        _chapter_digest(chapter, full=(index == len(chapters) - 1))
        for index, chapter in enumerate(chapters)
    ]
    user_prompt = (
        "对整门课做终检（章节已逐章通过评审，这里只看课程级问题）。\n"
        f"drivingQuestion: {plan_artifact.get('drivingQuestion')}\n"
        f"centralTension: {plan_artifact.get('centralTension')}\n"
        f"desiredOutcome: {(plan_artifact.get('contract') or {}).get('desiredOutcome')}\n\n"
        + "\n\n".join(digests)
        + "\n\n检查：\n"
        "1. 全课读完，drivingQuestion 是否被实际回答（不是被绕开或替换）。\n"
        "2. 末章（全文已给出）是否完成收束，给出可迁移的判断框架，而不是继续抛问题。\n"
        "3. 章节之间的论证是否连续，有没有断裂或重复空转。\n"
        '输出 JSON：{"pass": true/false, "issues": ["具体问题"]}'
    )
    return system_prompt, user_prompt
