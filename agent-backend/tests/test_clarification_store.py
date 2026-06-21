"""Tests for clarification_store.py"""
import time
import unittest
from pathlib import Path
import sys

# Add app dir to path
REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from clarification_store import ClarificationStore


class TestClarificationStore(unittest.TestCase):
    def setUp(self):
        self.store = ClarificationStore(ttl_seconds=2)  # Short TTL for testing

    def test_create_conversation(self):
        """Test creating a new conversation."""
        conv_id = self.store.create_conversation("RAG")

        self.assertIsNotNone(conv_id)
        self.assertEqual(len(conv_id), 8)  # Short UUID

        conv = self.store.get_conversation(conv_id)
        self.assertEqual(conv["topic"], "RAG")
        self.assertEqual(len(conv["history"]), 0)
        self.assertIsNone(conv["synthesized"])

    def test_add_turn(self):
        """Test adding dialogue turns."""
        conv_id = self.store.create_conversation("Test")

        self.store.add_turn(conv_id, "bot", "First question?")
        self.store.add_turn(conv_id, "user", "My answer")

        conv = self.store.get_conversation(conv_id)
        self.assertEqual(len(conv["history"]), 2)
        self.assertEqual(conv["history"][0]["role"], "bot")
        self.assertEqual(conv["history"][1]["role"], "user")

    def test_set_synthesis(self):
        """Test storing synthesis result."""
        conv_id = self.store.create_conversation("Test")

        self.store.set_synthesis(
            conv_id,
            "What is X?",
            "X is hard because Y",
            "conceptual"
        )

        conv = self.store.get_conversation(conv_id)
        self.assertIsNotNone(conv["synthesized"])
        self.assertEqual(conv["synthesized"]["drivingQuestion"], "What is X?")
        self.assertEqual(conv["synthesized"]["knowledgeType"], "conceptual")

    def test_conversation_expiry(self):
        """Test TTL expiration."""
        conv_id = self.store.create_conversation("Test")

        # Should exist immediately
        self.assertIsNotNone(self.store.get_conversation(conv_id))

        # Wait for TTL to expire
        time.sleep(2.1)

        # Should be gone
        self.assertIsNone(self.store.get_conversation(conv_id))

    def test_cleanup_expired(self):
        """Test manual cleanup of expired conversations."""
        # Create 3 conversations
        conv1 = self.store.create_conversation("Test1")
        conv2 = self.store.create_conversation("Test2")
        conv3 = self.store.create_conversation("Test3")

        # Wait for expiry
        time.sleep(2.1)

        # All should expire
        removed = self.store.cleanup_expired()
        self.assertEqual(removed, 3)

        # Store should be empty
        self.assertIsNone(self.store.get_conversation(conv1))

    def test_delete_conversation(self):
        """Test manual deletion."""
        conv_id = self.store.create_conversation("Test")

        self.store.delete_conversation(conv_id)

        self.assertIsNone(self.store.get_conversation(conv_id))

    def test_nonexistent_conversation(self):
        """Test accessing non-existent conversation."""
        self.assertIsNone(self.store.get_conversation("nonexistent"))

        with self.assertRaises(KeyError):
            self.store.add_turn("nonexistent", "bot", "Question")


if __name__ == "__main__":
    unittest.main()
