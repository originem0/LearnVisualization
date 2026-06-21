from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    from .essay_schema import register_for_knowledge_type
except ImportError:
    from essay_schema import register_for_knowledge_type


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


def build_essay_plan_prompts(request_payload: dict[str, Any]) -> tuple[str, str]:
    contract = request_payload["contract"]
    register = register_for_knowledge_type(contract["knowledgeType"])
    system_prompt = (
        "你是 Learning Site Engine 的课程架构师。你只设计一条叙事主线，不设计模块清单、练习题、检索题或通用互动组件。\n"
        "输出必须是 JSON。课程必须是一条主线 + 4-6 章连续 essay。"
    )
    user_prompt = (
        "基于下面的学习契约，规划一门 narrative-essay 课程。\n\n"
        f"topic: {request_payload['topic']}\n"
        f"output_slug: {request_payload['output_slug']}\n"
        f"register: {register}\n"
        f"contract: {json.dumps(contract, ensure_ascii=False, indent=2)}\n\n"
        "叙事原则摘要：\n"
        f"{load_narrative_principles()}\n\n"
        "同语域 few-shot 种子（学习结构，不复制内容）：\n"
        f"{load_seed_example(register) or '(无可用种子)'}\n\n"
        "输出 JSON 字段：\n"
        "{\n"
        '  "title": "课程标题",\n'
        '  "subtitle": "课程副标题",\n'
        '  "overview": {"whyExists": "为什么存在", "wherePoints": "指向哪里", "arc": ["第1章作用", "第2章作用", "..."]},\n'
        '  "factSpine": ["3-5 个具体事实、案例、代码或机制锚点"],\n'
        '  "chapters": [\n'
        '    {"id": "c01", "number": 1, "title": "章节标题", "role": "这一章在主线里的作用"}\n'
        "  ]\n"
        "}\n\n"
        "硬约束：chapters 必须 4-6 个；章节标题必须像论证步骤，不要写“基础概念/进阶应用”；"
        "factSpine 必须具体，不能是概念定义。"
    )
    return system_prompt, user_prompt


def build_chapter_prompts(
    *,
    request_payload: dict[str, Any],
    plan_artifact: dict[str, Any],
    chapter_plan: dict[str, Any],
    prev_chapter_ending: str | None,
    revision_feedback: str | None = None,
) -> tuple[str, str]:
    contract = request_payload["contract"]
    register = plan_artifact["register"]
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
        f"- overview: {json.dumps(plan_artifact['overview'], ensure_ascii=False, indent=2)}\n"
        f"- factSpine: {json.dumps(plan_artifact.get('factSpine') or [], ensure_ascii=False, indent=2)}\n\n"
        f"上一章结尾（用于承接声音和过渡）：\n{prev_chapter_ending or '(第一章，无上一章)'}\n\n"
        f"{register_rules}\n\n"
        "写作约束：\n"
        "- narrative 只允许 text/heading/callout/code/quote。\n"
        "- 主体必须是 text；不要 bullet，不要“本章将介绍”。\n"
        "- 开头直接进入问题、机制或判断，不要“想象你在某个深夜”。\n"
        "- highlight 默认 null；只有代码执行追踪才使用 kind=trace。\n"
        "- 非最后一章 bridge 必须自然抛出下一章要承接的问题。\n"
        "- 输出 10-18 个 narrative block，宁可少而有主线，不要凑满知识点。\n"
    )
    if revision_feedback:
        user_prompt += f"\n上次质量评审未通过，必须修正：{revision_feedback}\n"
    user_prompt += (
        "\n输出 JSON 字段：\n"
        "{\n"
        '  "title": "章节标题",\n'
        '  "role": "章节作用",\n'
        '  "narrative": [{"type": "text", "content": "正文"}],\n'
        '  "highlight": null,\n'
        '  "bridge": "过渡到下一章；末章为 null"\n'
        "}"
    )
    return system_prompt, user_prompt


def build_judge_prompts(chapter: dict[str, Any], *, register: str) -> tuple[str, str]:
    system_prompt = "你是严格的课程内容评审。只输出 JSON。"
    user_prompt = (
        "评审下面章节是否适合进入 narrative-essay 课程。\n"
        f"register: {register}\n"
        f"chapter: {json.dumps(chapter, ensure_ascii=False, indent=2)}\n\n"
        "标准：主线连贯、实质密度足够、没有 AI 套话、没有疑似杜撰的无来源研究/专家背书、语域吻合。\n"
        "输出 JSON：{\"pass\": true/false, \"score\": 0-100, \"issues\": [\"具体问题\"], \"rewriteHint\": \"如何重写\"}"
    )
    return system_prompt, user_prompt
