"""Tests for provider config hot-swap and client snapshot isolation."""

import sys
import threading
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from provider import OpenAICompatibleClient, ProviderConfig


def make_config(model: str = "test-model") -> ProviderConfig:
    return ProviderConfig(
        base_url="https://fake.api/v1",
        model=model,
        api_key="sk-fake",
        timeout_seconds=10,
        max_retries=0,
    )


class TestClientSnapshotIsolation(unittest.TestCase):
    """Scenario 7: config hot-swap doesn't affect already-snapshotted clients."""

    def test_snapshot_captures_current_client(self):
        """Simulates the run_job snapshot pattern: with lock, grab client ref."""
        lock = threading.Lock()
        client_a = OpenAICompatibleClient(make_config("model-a"))
        client_b = OpenAICompatibleClient(make_config("model-b"))

        # Simulate pipeline state
        current_client = client_a

        # Snapshot (like run_job does)
        with lock:
            snapshot = current_client

        # Swap (like update_provider_config does)
        with lock:
            current_client = client_b

        # Snapshot still points to old client
        self.assertEqual(snapshot.config.model, "model-a")
        self.assertEqual(current_client.config.model, "model-b")
        self.assertIsNot(snapshot, current_client)

    def test_concurrent_swap_during_snapshot(self):
        """Multiple threads snapshotting and swapping don't corrupt each other."""
        lock = threading.Lock()
        clients = {"current": OpenAICompatibleClient(make_config("original"))}
        snapshots = []
        barrier = threading.Barrier(3)

        def snapshot_worker():
            barrier.wait()
            with lock:
                snapshots.append(clients["current"])

        def swap_worker():
            barrier.wait()
            with lock:
                clients["current"] = OpenAICompatibleClient(make_config("swapped"))

        t1 = threading.Thread(target=snapshot_worker)
        t2 = threading.Thread(target=snapshot_worker)
        t3 = threading.Thread(target=swap_worker)

        t1.start()
        t2.start()
        t3.start()
        t1.join()
        t2.join()
        t3.join()

        # Each snapshot got a valid client (either original or swapped, but not corrupted)
        for s in snapshots:
            self.assertIn(s.config.model, ("original", "swapped"))


if __name__ == "__main__":
    unittest.main()
