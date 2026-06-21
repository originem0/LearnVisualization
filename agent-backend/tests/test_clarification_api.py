"""Integration test for clarification API endpoints."""
import json
import sys
from pathlib import Path

# Add app dir to path
REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from clarification_store import ClarificationStore
from clarification_prompts import (
    build_clarification_system_prompt,
    build_clarification_user_prompt,
    build_fallback_questions
)


def test_prompt_generation():
    """Test that prompts are generated correctly."""
    system_prompt = build_clarification_system_prompt()
    assert "drivingQuestion" in system_prompt
    assert "centralTension" in system_prompt
    assert "knowledgeType" in system_prompt

    user_prompt = build_clarification_user_prompt("RAG", [])
    assert "RAG" in user_prompt
    assert "第 1 轮" in user_prompt

    # Test with history
    history = [
        {"role": "bot", "text": "What's your problem?"},
        {"role": "user", "text": "My recall is low"}
    ]
    user_prompt = build_clarification_user_prompt("RAG", history)
    assert "What's your problem?" in user_prompt
    assert "My recall is low" in user_prompt

    print("✓ Prompt generation tests passed")


def test_fallback_questions():
    """Test that fallback questions exist."""
    questions = build_fallback_questions()
    assert len(questions) >= 3
    assert all(isinstance(q, str) and len(q) > 0 for q in questions)
    print("✓ Fallback questions test passed")


def test_full_conversation_flow():
    """Test a complete conversation flow without LLM."""
    store = ClarificationStore(ttl_seconds=60)

    # Start conversation
    conv_id = store.create_conversation("学习 Python 装饰器")
    conv = store.get_conversation(conv_id)
    assert conv["topic"] == "学习 Python 装饰器"

    # Simulate dialogue turns
    store.add_turn(conv_id, "bot", "你在使用装饰器时遇到了什么具体问题？")
    store.add_turn(conv_id, "user", "不理解闭包和作用域")
    store.add_turn(conv_id, "bot", "能描述一下具体的困惑场景吗？")
    store.add_turn(conv_id, "user", "写了一个装饰器，但变量总是报 undefined")

    conv = store.get_conversation(conv_id)
    assert len(conv["history"]) == 4

    # Simulate synthesis
    store.set_synthesis(
        conv_id,
        "Python 装饰器中的闭包作用域是如何工作的？",
        "装饰器涉及多层函数嵌套，变量作用域的捕获机制不直观，容易产生 UnboundLocalError",
        "conceptual"
    )

    conv = store.get_conversation(conv_id)
    assert conv["synthesized"]["drivingQuestion"] == "Python 装饰器中的闭包作用域是如何工作的？"
    assert conv["synthesized"]["knowledgeType"] == "conceptual"

    print("✓ Full conversation flow test passed")


def test_round_guidance():
    """Test that round guidance adapts to conversation length."""
    from clarification_prompts import _get_round_guidance

    guidance_1 = _get_round_guidance(0)
    assert "第一个问题" in guidance_1

    guidance_3 = _get_round_guidance(6)
    assert "合成" in guidance_3

    guidance_10 = _get_round_guidance(18)
    assert "强制" in guidance_10 or "必须" in guidance_10

    print("✓ Round guidance test passed")


if __name__ == "__main__":
    test_prompt_generation()
    test_fallback_questions()
    test_full_conversation_flow()
    test_round_guidance()
    print("\n✅ All integration tests passed!")
