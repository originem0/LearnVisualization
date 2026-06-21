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
    mock_response = {"question": "你在学习 RAG 时遇到了什么具体问题？"}

    with patch('main.get_pipeline') as mock_pipeline:
        # Setup mock
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.provider_config.create_client.return_value = mock_client

        # Call handler
        result = handle_clarify_start({"topic": "RAG"})

        # Verify result
        assert "conversationId" in result
        assert "question" in result
        assert result["question"] == mock_response["question"]
        assert result["roundNumber"] == 1

        print("✓ handle_clarify_start works with mocked LLM")
        print(f"  Generated question: {result['question']}")

        return result["conversationId"]


def test_handle_clarify_start_fallback():
    """Test handle_clarify_start fallback when LLM fails."""

    with patch('main.get_pipeline') as mock_pipeline:
        # Make LLM fail
        mock_pipeline.side_effect = Exception("LLM unavailable")

        # Call handler - should use fallback
        result = handle_clarify_start({"topic": "Python装饰器"})

        assert "conversationId" in result
        assert "question" in result
        assert result["fallback"] == True
        assert result["roundNumber"] == 1

        print("✓ handle_clarify_start fallback works")
        print(f"  Fallback question: {result['question']}")


def test_handle_clarify_respond_continue():
    """Test handle_clarify_respond when continuing dialogue."""

    # First create a conversation
    store = get_store()
    conv_id = store.create_conversation("RAG")
    store.add_turn(conv_id, "bot", "你遇到什么问题？")

    # Mock LLM to return next question
    mock_response = {"question": "能具体描述一下你的场景吗？"}

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.provider_config.create_client.return_value = mock_client

        # Call handler
        result = handle_clarify_respond({
            "conversationId": conv_id,
            "answer": "召回率很低"
        })

        assert "question" in result
        assert not result.get("complete")
        # history is a reference to the store's list, so it includes the new bot turn
        # Initial: bot1, after adding user1 and bot2: [bot1, user1, bot2]
        # len([bot1, bot2]) + 1 = 2 + 1 = 3
        assert result["roundNumber"] == 3

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
        "complete": True,
        "drivingQuestion": "Python装饰器中的闭包作用域如何工作？",
        "centralTension": "多层函数嵌套使变量捕获机制不直观",
        "knowledgeType": "conceptual"
    }

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.provider_config.create_client.return_value = mock_client

        # Call handler
        result = handle_clarify_respond({
            "conversationId": conv_id,
            "answer": "我写的装饰器总是报 UnboundLocalError"
        })

        assert result["complete"] == True
        assert result["drivingQuestion"] == mock_response["drivingQuestion"]
        assert result["centralTension"] == mock_response["centralTension"]
        assert result["knowledgeType"] == mock_response["knowledgeType"]

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
