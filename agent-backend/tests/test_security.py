"""Security boundary tests for the agent backend."""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import main  # noqa: E402


class SecurityTests(unittest.TestCase):
    def make_handler(self, headers: dict[str, str]):
        handler = object.__new__(main.AgentBackendHandler)
        handler.headers = headers
        handler.client_address = ("127.0.0.1", 12345)
        return handler

    def test_settings_password_is_not_admin_token(self):
        with patch.dict(os.environ, {"AGENT_SETTINGS_PASSWORD": "settings-password"}, clear=False):
            os.environ.pop("AGENT_ADMIN_TOKEN", None)
            handler = self.make_handler({"X-Agent-Admin-Token": "settings-password"})
            with self.assertRaises(PermissionError):
                handler._require_admin({})

    def test_admin_token_is_not_accepted_from_body(self):
        with patch.dict(os.environ, {"AGENT_ADMIN_TOKEN": "admin-token"}, clear=False):
            handler = self.make_handler({})
            with self.assertRaises(PermissionError):
                handler._require_admin({"adminToken": "admin-token"})

    def test_admin_token_header_is_accepted(self):
        with patch.dict(os.environ, {"AGENT_ADMIN_TOKEN": "admin-token"}, clear=False):
            handler = self.make_handler({"X-Agent-Admin-Token": "admin-token"})
            handler._require_admin({})

    def test_course_generation_and_clarification_are_admin_exempt(self):
        self.assertIn("/api/clarify/start", main.AUTH_EXEMPT_POST_PATHS)
        self.assertIn("/api/clarify/respond", main.AUTH_EXEMPT_POST_PATHS)
        self.assertIn("/jobs/course-generation", main.AUTH_EXEMPT_POST_PATHS)

    def test_public_job_get_boundary(self):
        self.assertTrue(main._is_public_job_get(["jobs"]))
        self.assertTrue(main._is_public_job_get(["jobs", "abc123"]))
        self.assertFalse(main._is_public_job_get(["jobs", "abc123", "artifacts"]))
        self.assertFalse(main._is_public_job_get(["jobs", "abc123", "delete"]))

    def test_public_job_view_omits_internal_fields(self):
        public = main._public_job_view(
            {
                "id": "job123",
                "status": "queued",
                "currentStage": None,
                "request": {"topic": "Nietzsche", "_request_identity": "client:127.0.0.1"},
                "provider": {"apiKey": "***"},
                "artifacts": {"plan": "/tmp/internal"},
                "stages": [{"name": "plan", "status": "pending", "artifactPath": "/tmp/internal"}],
                "resultSummary": {},
                "createdAt": "2026-06-22T00:00:00+08:00",
                "updatedAt": "2026-06-22T00:00:00+08:00",
            }
        )
        self.assertEqual(public["request"], {"topic": "Nietzsche"})
        self.assertNotIn("provider", public)
        self.assertNotIn("artifacts", public)
        self.assertNotIn("artifactPath", public["stages"][0])


if __name__ == "__main__":
    unittest.main()
