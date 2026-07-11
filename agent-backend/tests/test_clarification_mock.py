"""
Mock test for clarification endpoints without starting server or calling LLM.
Tests the handler logic directly.
"""
import json
import sys
import unittest
from pathlib import Path

# Add app dir to path
REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from unittest.mock import Mock, patch
import main
from main import handle_clarify_start, handle_clarify_respond
from clarification_store import get_store


class _MockConfig:
    model = "mock-clarify"
    clarify_model = "mock-clarify"
    judge_model = "mock-judge"
    research_model = None


def _mock_config():
    return _MockConfig()



def test_handle_clarify_start_with_mock_llm():
    """Test handle_clarify_start with mocked LLM."""

    # Mock the LLM response
    mock_response = {
        "content": {"question": "你在学习 RAG 时遇到了什么具体问题？"},
        "usage": {},
        "model": "mock-model"
    }

    with patch('main.get_pipeline') as mock_pipeline:
        # Setup mock
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.client = mock_client

        # Call handler
        result = handle_clarify_start({"topic": "RAG"})

        # Verify result
        assert "conversationId" in result
        assert "question" in result
        assert result["question"] == mock_response["content"]["question"]
        assert result["roundNumber"] == 1
        assert mock_client.generate_json.call_args.kwargs["schema_name"] == "clarification_start"

        print("✓ handle_clarify_start works with mocked LLM")
        print(f"  Generated question: {result['question']}")

        return result["conversationId"]


def test_handle_clarify_start_fallback():
    """Test handle_clarify_start fallback when LLM fails."""

    with patch('main.get_pipeline') as mock_pipeline:
        # Make LLM fail
        mock_pipeline.side_effect = Exception("LLM unavailable")

        # Call handler - should report unavailable, not substitute fixed questions
        result = handle_clarify_start({"topic": "Python装饰器"})

        assert "conversationId" in result
        assert result["question"] == ""
        assert result["fallback"] == True
        assert result["roundNumber"] == 1
        assert result["error"] == "AI clarification unavailable"

        print("✓ handle_clarify_start reports unavailable without fixed template")


def test_handle_clarify_respond_continue():
    """Test handle_clarify_respond when continuing dialogue."""

    # First create a conversation
    store = get_store()
    conv_id = store.create_conversation("RAG")
    store.add_turn(conv_id, "bot", "你遇到什么问题？")

    # Mock LLM to return next question
    mock_response = {
        "content": {"question": "能具体描述一下你的场景吗？"},
        "usage": {},
        "model": "mock-model"
    }

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.client = mock_client

        # Call handler
        result = handle_clarify_respond({
            "conversationId": conv_id,
            "answer": "召回率很低"
        })

        assert "question" in result
        assert not result.get("complete")
        assert result["question"] == mock_response["content"]["question"]
        assert mock_client.generate_json.call_args.kwargs["schema_name"] == "clarification_respond"
        assert result["roundNumber"] == 2

        print("✓ handle_clarify_respond continues dialogue")
        print(f"  Next question: {result['question']}")
        print(f"  Round number: {result['roundNumber']}")


def test_handle_clarify_respond_returns_candidate_contract():
    """Test handle_clarify_respond returns a candidate contract for user confirmation."""

    # Create a conversation with some history
    store = get_store()
    conv_id = store.create_conversation("Python装饰器")
    store.add_turn(conv_id, "bot", "问题1")
    store.add_turn(conv_id, "user", "答案1")
    store.add_turn(conv_id, "bot", "问题2")
    store.add_turn(conv_id, "user", "答案2")
    store.add_turn(conv_id, "bot", "问题3")
    store.add_turn(conv_id, "user", "答案3")

    # Mock LLM to return synthesis
    mock_response = {
        "content": {
            "complete": True,
            "contract": {
                "drivingQuestion": "Python装饰器中的闭包作用域如何工作？",
                "centralTension": "多层函数嵌套使变量捕获机制不直观",
                "knowledgeType": "conceptual",
                "audience": "写过 Python 函数但不理解闭包的新手",
                "desiredOutcome": "能解释装饰器里变量如何被捕获",
                "scope": {
                    "include": ["闭包", "作用域", "装饰器调用时机"],
                    "exclude": ["元类", "完整 descriptor 协议"],
                    "depth": "围绕机制深挖，4-6章"
                },
                "problemFraming": {
                    "phenomenon": "写装饰器时函数能执行，但引用外层变量时出现 UnboundLocalError",
                    "contrast": "普通函数调用里变量查找看似直接，但装饰器多层嵌套后同名变量的读写结果不同",
                    "problemNature": "model_mismatch",
                    "systemGoal": "理解装饰器调用链和闭包变量捕获如何共同决定运行时行为",
                    "modelGap": "缺少函数对象、作用域链、闭包 cell 与赋值语义之间的关系模型"
                }
            }
        },
        "usage": {},
        "model": "mock-model"
    }

    review_response = {
        "content": {"pass": True, "issues": [], "teachingHooks": ["装饰器调用时机决定闭包捕获", "cell 变量在赋值时被判定为局部"]},
        "usage": {},
        "model": "mock-judge",
    }

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.side_effect = [mock_response, review_response]
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client

        # Call handler
        result = handle_clarify_respond({
            "conversationId": conv_id,
            "answer": "我写的装饰器总是报 UnboundLocalError"
        })

        assert result["readyForConfirmation"] == True
        assert result["contract"]["drivingQuestion"] == mock_response["content"]["contract"]["drivingQuestion"]
        assert result["drivingQuestion"] == mock_response["content"]["contract"]["drivingQuestion"]
        assert result["centralTension"] == mock_response["content"]["contract"]["centralTension"]
        assert result["knowledgeType"] == mock_response["content"]["contract"]["knowledgeType"]
        assert "候选学习契约" in result["message"]
        assert mock_client.generate_json.call_args.kwargs["schema_name"] == "contract_review"
        assert result["contract"]["teachingHooks"] == ["装饰器调用时机决定闭包捕获", "cell 变量在赋值时被判定为局部"]

        # Verify the candidate was stored as a bot turn, but final synthesis waits for user confirmation.
        conv = store.get_conversation(conv_id)
        assert conv["synthesized"] is None
        assert "候选学习契约" in conv["history"][-1]["text"]

        print("✓ handle_clarify_respond returns candidate synthesis")
        print(f"  Driving Question: {result['drivingQuestion']}")
        print(f"  Knowledge Type: {result['knowledgeType']}")


def test_handle_clarify_respond_rejects_weak_synthesis():
    """Test that service-side readiness gate rejects generic contracts."""

    store = get_store()
    conv_id = store.create_conversation("概率论")
    for i in range(3):
        store.add_turn(conv_id, "bot", f"问题{i}")
        store.add_turn(conv_id, "user", f"回答{i}")

    mock_response = {
        "content": {
            "complete": True,
            "contract": {
                "drivingQuestion": "如何学习概率论？",
                "centralTension": "用户想学好概率论但还不理解基本概念",
                "knowledgeType": "conceptual",
                "audience": "初学者",
                "desiredOutcome": "理解概率论基础",
                "scope": {
                    "include": ["随机变量", "条件概率", "分布"],
                    "exclude": ["测度论"],
                    "depth": "概览"
                },
                "problemFraming": {
                    "phenomenon": "学习概率论时觉得困难",
                    "contrast": "没有明确差异",
                    "problemNature": "gap",
                    "systemGoal": "学会概率论",
                    "modelGap": "缺少基础知识"
                }
            }
        },
        "usage": {},
        "model": "mock-model"
    }

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client

        result = handle_clarify_respond({
            "conversationId": conv_id,
            "answer": "我就是想学会"
        })

        assert not result.get("complete")
        assert result["needsMoreEvidence"] == True
        assert "gateIssue" in result
        assert "problemFraming" not in result["question"]


def test_beginner_uncertainty_allows_inferred_contrast():
    """A beginner saying 'I don't know' can rely on the agent to infer the organizing contrast."""

    history = [
        {"role": "bot", "text": "你怎么看尼采的超人？"},
        {"role": "user", "text": "我不知道超人或权力意志是什么意思"},
        {"role": "bot", "text": "那你对上帝已死有什么直觉？"},
        {"role": "user", "text": "我知道上帝已死，但不知道为什么会涉及超人"},
        {"role": "bot", "text": "如果没有信仰你希望怎样？"},
        {"role": "user", "text": "迷茫时希望有指引"},
    ]
    contract = {
        "drivingQuestion": "尼采为什么认为上帝已死会引出超人问题？",
        "centralTension": "用户直觉里失去信仰只是少了旧指南，但尼采把它看成价值来源的危机。",
        "knowledgeType": "conceptual",
        "audience": "对尼采好奇但不了解核心概念的初学者",
        "desiredOutcome": "能解释上帝已死、虚无主义、超人和权力意志之间的来龙去脉",
        "scope": {
            "include": ["上帝已死", "虚无主义", "超人", "权力意志"],
            "exclude": ["萨特专题", "存在主义通史"],
            "depth": "从前因和概念关系入门",
        },
        "problemFraming": {
            "phenomenon": "用户听过上帝已死，却不知道为什么它会引出超人和权力意志。",
            "contrast": "失去旧指南针与重新创造价值来源",
            "problemNature": "model_mismatch",
            "systemGoal": "建立尼采核心概念如何回应价值危机的解释链条",
            "modelGap": "缺少上帝已死、虚无主义、超人和权力意志之间的关系模型",
        },
    }

    assert main._clarification_readiness_issue(contract, history) is None


def test_beginner_gate_followup_does_not_exam_user():
    history = [
        {"role": "bot", "text": "你怎么看超人？"},
        {"role": "user", "text": "我不知道超人是什么意思"},
    ]

    question = main._clarification_gate_followup(
        "problemFraming.contrast 必须写出 A/B 差异、条件变化或直觉与现实冲突",
        "尼采",
        history,
    )

    assert "problemFraming" not in question
    assert "A/B" not in question
    assert "初学" in question
    assert "直接回" in question


def test_handle_clarify_respond_rejects_hollow_contract_via_review():
    """规则闸通过但异族评审判定契约空洞时，继续追问而非给候选契约。"""
    store = get_store()
    conv_id = store.create_conversation("尼采哲学")
    for i in range(3):
        store.add_turn(conv_id, "bot", f"问题{i}")
        store.add_turn(conv_id, "user", f"这是我第{i}个足够长的具体回答，描述了差异现象和困惑")

    synthesis = {
        "content": {
            "complete": True,
            "contract": {
                "drivingQuestion": "为什么上帝已死意味着尺度崩塌而不仅是信仰缺失？",
                "centralTension": "直觉以为少个指南，实则衡量价值的尺度整体失效",
                "knowledgeType": "conceptual",
                "audience": "对存在主义有零散直觉的初学者",
                "desiredOutcome": "能解释尺度崩塌的机制",
                "scope": {"include": ["上帝已死", "虚无主义"], "exclude": ["海德格尔阐释"], "depth": "机制深挖"},
                "problemFraming": {
                    "phenomenon": "现代人没有明确信仰也能凭常识活得好好的",
                    "contrast": "直觉当少个旧指南；尼采说是评价尺度整体失效",
                    "problemNature": "model_mismatch",
                    "systemGoal": "理解尺度崩塌后的真实生存处境",
                    "modelGap": "缺少价值尺度这一对象模型",
                },
            },
        },
        "usage": {}, "model": "mock-clarify",
    }
    review_fail = {
        "content": {"pass": False, "issues": ["modelGap 只是重复了问题，没有指出缺失的具体关系"], "teachingHooks": []},
        "usage": {}, "model": "mock-judge",
    }

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.side_effect = [synthesis, review_fail]
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client

        result = handle_clarify_respond({"conversationId": conv_id, "answer": "我想弄懂尺度崩塌"})

        assert result.get("needsMoreEvidence") is True
        assert "readyForConfirmation" not in result
        assert "contract" not in result
        # 追问不得暴露内部字段名
        assert "modelGap" not in result["question"]
        assert "problemFraming" not in result["question"]


def test_error_handling():
    """Test error handling for invalid inputs."""

    # Test missing topic
    try:
        handle_clarify_start({"topic": ""})
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print("✓ Rejects empty topic")

    # Test missing conversationId
    try:
        handle_clarify_respond({"conversationId": "", "answer": "test"})
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print("✓ Rejects empty conversationId")

    # Test nonexistent conversation
    try:
        handle_clarify_respond({"conversationId": "nonexistent", "answer": "test"})
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print("✓ Rejects nonexistent conversation")


class ClarificationHandlerMockTests(unittest.TestCase):
    def test_start_with_mock_llm(self):
        test_handle_clarify_start_with_mock_llm()

    def test_start_fallback(self):
        test_handle_clarify_start_fallback()

    def test_respond_continue(self):
        test_handle_clarify_respond_continue()

    def test_respond_returns_candidate_contract(self):
        test_handle_clarify_respond_returns_candidate_contract()

    def test_respond_rejects_weak_synthesis(self):
        test_handle_clarify_respond_rejects_weak_synthesis()

    def test_respond_rejects_hollow_contract_via_review(self):
        test_handle_clarify_respond_rejects_hollow_contract_via_review()

    def test_beginner_uncertainty_allows_inferred_contrast(self):
        test_beginner_uncertainty_allows_inferred_contrast()

    def test_beginner_gate_followup_does_not_exam_user(self):
        test_beginner_gate_followup_does_not_exam_user()

    def test_error_handling(self):
        test_error_handling()


if __name__ == "__main__":
    print("Running mock tests for clarification handlers...\n")

    test_handle_clarify_start_with_mock_llm()
    test_handle_clarify_start_fallback()
    test_handle_clarify_respond_continue()
    test_handle_clarify_respond_returns_candidate_contract()
    test_handle_clarify_respond_rejects_weak_synthesis()
    test_handle_clarify_respond_rejects_hollow_contract_via_review()
    test_beginner_uncertainty_allows_inferred_contrast()
    test_beginner_gate_followup_does_not_exam_user()
    test_error_handling()

    print("\n✅ All mock tests passed!")
    print("\nNote: These tests use mocked LLM responses.")
    print("For full E2E testing with real LLM, start the server and run test_e2e_clarification.py")
