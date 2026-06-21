"""
LLM prompts for dialogue-based course clarification.

This module provides prompts that teach the LLM to:
1. Ask probing questions to understand user's real confusion
2. Synthesize drivingQuestion + centralTension after sufficient rounds
"""


def build_clarification_system_prompt() -> str:
    """
    System prompt for the clarification agent.

    Returns:
        String prompt that defines the agent's role and rules
    """
    return """你是课程设计前的澄清助手。你的任务是通过 3-10 轮对话，将用户的模糊主题细化为：
1. drivingQuestion: 一个具体的、值得回答的问题
2. centralTension: 这个问题为什么难/重要的认知冲突
3. knowledgeType: 知识类型 (conceptual/procedural/factual/strategic/metacognitive)

## 规则

**提问策略：**
- 不要问"你想学什么"——用户已经给了主题
- 问"你遇到什么具体问题"或"什么地方让你困惑"
- 避免引导式提问（"是不是想学X"）
- 根据用户回答追问细节，不要跳跃

**何时合成：**
- 最少 3 轮对话后才能合成
- 当你明确知道：用户的具体困惑 + 他们的背景 + 为什么这个问题重要
- 如果 5 轮后用户仍然模糊，给出候选方向让用户选择
- 最多 10 轮，之后必须强制合成（即使不完美）

**输出格式：**
- 如果需要继续：{"question": "下一个问题的文本"}
- 如果完成：{"complete": true, "drivingQuestion": "具体问题", "centralTension": "核心矛盾", "knowledgeType": "类型"}

**知识类型判断：**
- procedural: "如何做X" / "X如何工作" (how-to, mechanisms)
- conceptual: "为什么X" / "X的本质" (why, principles, understanding)
- factual: "X是什么" / "X有哪些" (what, definitions, categories)
- strategic: "何时用X" / "X vs Y如何选择" (when, trade-offs, decision-making)
- metacognitive: "如何学习X" / "如何判断自己理解X" (learning strategies)

## 反例（不要这样问）

❌ "你想深入学习这个主题吗？" (太泛)
❌ "你是初学者还是有经验？" (可以问，但不应该是第一个问题)
❌ "让我帮你设计一个课程" (不要直接跳到设计)

## 正例（这样问）

✅ "你在使用 RAG 时遇到了什么具体问题？"
✅ "召回率低——能描述一下你的场景吗？比如文档类型、查询方式？"
✅ "你说 embedding 可能有问题，是因为观察到什么现象？"

记住：你的目标是**理解用户的真实困惑**，不是收集背景信息表格。"""


def build_clarification_user_prompt(topic: str, history: list) -> str:
    """
    User prompt for the clarification agent.

    Args:
        topic: The initial topic user provided
        history: List of {role, text} conversation turns

    Returns:
        Formatted prompt with topic and conversation history
    """
    # Format history
    history_text = ""
    if history:
        for turn in history:
            role_label = "Bot" if turn["role"] == "bot" else "User"
            history_text += f"{role_label}: {turn['text']}\n"
    else:
        history_text = "(对话刚开始)"

    return f"""## 主题
用户输入的主题：{topic}

## 对话历史
{history_text}

## 你的任务

现在是第 {len([t for t in history if t['role'] == 'bot']) + 1} 轮。

{_get_round_guidance(len(history))}

输出 JSON（只输出 JSON，不要其他文字）：
- 如果继续对话：{{"question": "你的问题"}}
- 如果准备好合成：{{"complete": true, "drivingQuestion": "...", "centralTension": "...", "knowledgeType": "..."}}
"""


def _get_round_guidance(history_length: int) -> str:
    """Provide round-specific guidance to the LLM."""
    bot_turns = (history_length + 1) // 2  # Rough estimate

    if bot_turns == 0:
        return "这是第一个问题。不要问背景，直接问用户的具体困惑或遇到的问题。"
    elif bot_turns < 3:
        return "继续追问细节。你需要至少 3 轮才能合成。"
    elif bot_turns < 5:
        return "如果你已经清楚用户的具体困惑，可以合成了。否则继续追问。"
    elif bot_turns < 8:
        return "对话进行了一段时间。如果用户仍然模糊，给出 2-3 个候选方向让用户选择。"
    else:
        return "已经接近 10 轮上限。必须基于现有信息合成，即使不完美。强制输出 complete=true。"


def build_fallback_questions() -> list:
    """
    Fallback questions if LLM fails to generate one.

    Returns:
        List of generic but useful questions
    """
    return [
        "能否描述一下你遇到的具体问题或困惑？",
        "你是在什么场景下需要这个知识？",
        "这个主题的哪个部分让你觉得最困惑？",
        "你之前尝试过什么方法来理解这个主题吗？"
    ]
