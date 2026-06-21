"""
Mock test for clarification endpoints without starting server or calling LLM.
Tests the handler logic directly.
"""
import json
import sys
from pathlib import Path

# Add app dir to path
REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from unittest.mock import Mock, patch
from main import handle_clarify_start, handle_clarify_respond
from clarification_store import get_store


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


def test_handle_clarify_respond_complete():
    """Test handle_clarify_respond when synthesis is ready."""

    # Create a conversation with some history
    store = get_store()
    conv_id = store.create_conversation("Python装饰器")
    store.add_turn(conv_id, "bot", "问题1")
    store.add_turn(conv_id, "user", "答案1")
    store.add_turn(conv_id, "bot", "问题2")
    store.add_turn(conv_id, "user", "答案2")

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

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.client = mock_client

        # Call handler
        result = handle_clarify_respond({
            "conversationId": conv_id,
            "answer": "我写的装饰器总是报 UnboundLocalError"
        })

        assert result["complete"] == True
        assert result["contract"]["drivingQuestion"] == mock_response["content"]["contract"]["drivingQuestion"]
        assert result["drivingQuestion"] == mock_response["content"]["contract"]["drivingQuestion"]
        assert result["centralTension"] == mock_response["content"]["contract"]["centralTension"]
        assert result["knowledgeType"] == mock_response["content"]["contract"]["knowledgeType"]
        assert mock_client.generate_json.call_args.kwargs["schema_name"] == "clarification_respond"

        # Verify synthesis was stored
        conv = store.get_conversation(conv_id)
        assert conv["synthesized"] is not None

        print("✓ handle_clarify_respond completes synthesis")
        print(f"  Driving Question: {result['drivingQuestion']}")
        print(f"  Knowledge Type: {result['knowledgeType']}")


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


if __name__ == "__main__":
    print("Running mock tests for clarification handlers...\n")

    test_handle_clarify_start_with_mock_llm()
    test_handle_clarify_start_fallback()
    test_handle_clarify_respond_continue()
    test_handle_clarify_respond_complete()
    test_error_handling()

    print("\n✅ All mock tests passed!")
    print("\nNote: These tests use mocked LLM responses.")
    print("For full E2E testing with real LLM, start the server and run test_e2e_clarification.py")
