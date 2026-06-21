"""
In-memory conversation store for course clarification dialogues.

Conversations have a 30-minute TTL and are thread-safe.
"""
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class ClarificationStore:
    """Thread-safe in-memory store for clarification conversations."""

    def __init__(self, ttl_seconds: int = 1800):  # 30 minutes default
        self._store: Dict[str, dict] = {}
        self._lock = threading.Lock()
        self.ttl_seconds = ttl_seconds

    def create_conversation(self, topic: str) -> str:
        """
        Create a new conversation.

        Args:
            topic: The initial topic user wants to learn about

        Returns:
            conversation_id: Unique identifier for this conversation
        """
        conversation_id = str(uuid.uuid4())[:8]  # Short ID
        now = datetime.utcnow()

        with self._lock:
            self._store[conversation_id] = {
                "topic": topic,
                "history": [],
                "createdAt": now.isoformat(),
                "expiresAt": (now + timedelta(seconds=self.ttl_seconds)).isoformat(),
                "synthesized": None  # Will hold {drivingQuestion, centralTension, knowledgeType}
            }

        return conversation_id

    def add_turn(self, conversation_id: str, role: str, text: str) -> None:
        """
        Add a dialogue turn to the conversation.

        Args:
            conversation_id: Conversation to update
            role: "bot" or "user"
            text: Message content

        Raises:
            KeyError: If conversation doesn't exist or expired
        """
        with self._lock:
            conv = self._get_conversation_unsafe(conversation_id)
            if not conv:
                raise KeyError(f"Conversation {conversation_id} not found or expired")

            conv["history"].append({
                "role": role,
                "text": text,
                "timestamp": datetime.utcnow().isoformat()
            })

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        """
        Retrieve conversation state.

        Returns:
            dict with {topic, history, createdAt, expiresAt, synthesized}
            or None if not found/expired
        """
        with self._lock:
            return self._get_conversation_unsafe(conversation_id)

    def set_synthesis(
        self,
        conversation_id: str,
        driving_question: str,
        central_tension: str,
        knowledge_type: str
    ) -> None:
        """Store the synthesized result."""
        with self._lock:
            conv = self._get_conversation_unsafe(conversation_id)
            if not conv:
                raise KeyError(f"Conversation {conversation_id} not found or expired")

            conv["synthesized"] = {
                "drivingQuestion": driving_question,
                "centralTension": central_tension,
                "knowledgeType": knowledge_type,
                "synthesizedAt": datetime.utcnow().isoformat()
            }

    def delete_conversation(self, conversation_id: str) -> None:
        """Remove a conversation from the store."""
        with self._lock:
            self._store.pop(conversation_id, None)

    def cleanup_expired(self) -> int:
        """
        Remove all expired conversations.

        Returns:
            Number of conversations removed
        """
        now = datetime.utcnow()
        removed = 0

        with self._lock:
            expired_ids = [
                conv_id for conv_id, conv in self._store.items()
                if datetime.fromisoformat(conv["expiresAt"]) < now
            ]
            for conv_id in expired_ids:
                del self._store[conv_id]
                removed += 1

        return removed

    def _get_conversation_unsafe(self, conversation_id: str) -> Optional[dict]:
        """Get conversation without lock (internal use only)."""
        conv = self._store.get(conversation_id)
        if not conv:
            return None

        # Check expiry
        if datetime.fromisoformat(conv["expiresAt"]) < datetime.utcnow():
            del self._store[conversation_id]
            return None

        return conv

    def get_stats(self) -> dict:
        """Get store statistics (for monitoring)."""
        with self._lock:
            return {
                "total_conversations": len(self._store),
                "oldest_created": min(
                    (conv["createdAt"] for conv in self._store.values()),
                    default=None
                )
            }


# Global instance
_store = None

def get_store() -> ClarificationStore:
    """Get the global clarification store instance."""
    global _store
    if _store is None:
        _store = ClarificationStore()
    return _store
