import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from provider import OpenAICompatibleClient, ProviderConfig, ProviderError, model_family  # noqa: E402


def _ok_payload():
    return {"choices": [{"message": {"content": "{}"}}], "usage": {}, "model": "echo"}


class PerCallModelTests(unittest.TestCase):
    def make_client(self, **kwargs):
        config = ProviderConfig(base_url="http://fake.local/v1", model="writer-a", **kwargs)
        return OpenAICompatibleClient(config)

    def test_generate_json_uses_config_model_by_default(self):
        client = self.make_client()
        captured = []
        with patch.object(client, "_post_json", side_effect=lambda body: (captured.append(body["model"]), _ok_payload())[1]):
            client.generate_json(schema_name="x", system_prompt="s", user_prompt="u")
        self.assertEqual(captured, ["writer-a"])

    def test_generate_json_per_call_model_override(self):
        client = self.make_client()
        captured = []
        with patch.object(client, "_post_json", side_effect=lambda body: (captured.append(body["model"]), _ok_payload())[1]):
            client.generate_json(schema_name="x", system_prompt="s", user_prompt="u", model="judge-c")
        self.assertEqual(captured, ["judge-c"])

    def test_fallback_applies_to_overridden_model(self):
        client = self.make_client(fallback_model="backup-b")
        calls = []

        def fake_post(body):
            calls.append(body["model"])
            if len(calls) == 1:
                raise ProviderError("boom")
            return _ok_payload()

        with patch.object(client, "_post_json", side_effect=fake_post):
            client.generate_json(schema_name="x", system_prompt="s", user_prompt="u", model="judge-c")
        self.assertEqual(calls, ["judge-c", "backup-b"])

    def test_model_family(self):
        self.assertEqual(model_family("z-ai/glm-5.1"), "glm")
        self.assertEqual(model_family("claude-sonnet-5"), "claude")
        self.assertEqual(model_family("openai/gpt-5.2"), "gpt")
        self.assertEqual(model_family("gemini-3-pro"), "gemini")
        self.assertEqual(model_family(None), "")

    def test_config_carries_stage_models(self):
        config = ProviderConfig(base_url="http://fake.local/v1", model="a", research_model="r", judge_model="j")
        self.assertEqual(config.research_model, "r")
        self.assertEqual(config.masked["research_model"], "r")
        self.assertEqual(config.masked["judge_model"], "j")


if __name__ == "__main__":
    unittest.main()
