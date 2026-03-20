from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error, request


def _load_dotenv() -> None:
    """Read agent-backend/.env into os.environ (no third-party deps)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        # Don't overwrite existing env vars — explicit env takes precedence
        if key not in os.environ:
            os.environ[key] = value


_load_dotenv()


class ProviderError(RuntimeError):
    pass


@dataclass(slots=True)
class ProviderConfig:
    base_url: str
    model: str
    api_key: str | None = None
    timeout_seconds: int = 120
    max_retries: int = 2
    fallback_model: str | None = None

    @classmethod
    def from_env(cls) -> "ProviderConfig":
        base_url = (  # single default profile for V1
            os.environ.get("AGENT_LLM_BASE_URL")
            or os.environ.get("OPENAI_BASE_URL")
            or "https://api.openai.com/v1"
        )
        model = os.environ.get("AGENT_LLM_MODEL") or "gpt-4o-mini"
        api_key = os.environ.get("AGENT_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
        timeout_seconds = int(os.environ.get("AGENT_LLM_TIMEOUT_SECONDS") or "120")
        max_retries = int(os.environ.get("AGENT_LLM_MAX_RETRIES") or "2")
        fallback_model = os.environ.get("AGENT_LLM_FALLBACK_MODEL") or None
        return cls(
            base_url=base_url.rstrip("/"),
            model=model,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            fallback_model=fallback_model,
        )

    @property
    def masked(self) -> dict[str, Any]:
        return {
            "base_url": self.base_url,
            "model": self.model,
            "fallback_model": self.fallback_model,
            "api_key_configured": bool(self.api_key),
            "timeout_seconds": self.timeout_seconds,
            "max_retries": self.max_retries,
        }


class OpenAICompatibleClient:
    def __init__(self, config: ProviderConfig) -> None:
        self.config = config

    def generate_json(
        self,
        *,
        schema_name: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 8000,
    ) -> dict[str, Any]:
        body = {
            "model": self.config.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        try:
            return self._call_and_parse(body, schema_name)
        except ProviderError:
            if not self.config.fallback_model or self.config.fallback_model == self.config.model:
                raise
            # Retry with fallback model
            body["model"] = self.config.fallback_model
            return self._call_and_parse(body, schema_name)

    def _call_and_parse(self, body: dict[str, Any], schema_name: str) -> dict[str, Any]:
        payload = self._post_json(body)
        content = self._extract_message_content(payload)

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ProviderError(f"{schema_name}: model returned invalid JSON: {exc}") from exc

        return {
            "schema_name": schema_name,
            "content": parsed,
            "raw_text": content,
            "usage": payload.get("usage") or {},
            "model": payload.get("model") or body["model"],
        }

    def _post_json(self, body: dict[str, Any]) -> dict[str, Any]:
        endpoint = self.config.base_url
        if not endpoint.endswith("/chat/completions"):
            endpoint = f"{endpoint}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "LearnVisualization-Agent/1.0",
        }
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"

        encoded = json.dumps(body).encode("utf-8")
        last_error: Exception | None = None

        for attempt in range(self.config.max_retries + 1):
            req = request.Request(endpoint, data=encoded, headers=headers, method="POST")
            try:
                with request.urlopen(req, timeout=self.config.timeout_seconds) as response:
                    return json.loads(response.read().decode("utf-8"))
            except error.HTTPError as exc:
                last_error = exc
                if attempt >= self.config.max_retries or exc.code not in {429, 500, 502, 503, 504}:
                    detail = exc.read().decode("utf-8", errors="ignore")
                    raise ProviderError(f"provider http {exc.code}: {detail or exc.reason}") from exc
            except error.URLError as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    raise ProviderError(f"provider network error: {exc.reason}") from exc
            except (ConnectionError, OSError) as exc:
                # Covers http.client.RemoteDisconnected, ConnectionResetError, etc.
                last_error = exc
                if attempt >= self.config.max_retries:
                    raise ProviderError(f"provider connection error: {exc}") from exc

            time.sleep(0.5 * (2 ** attempt))

        raise ProviderError(f"provider request failed: {last_error}")

    @staticmethod
    def _extract_message_content(payload: dict[str, Any]) -> str:
        choices = payload.get("choices") or []
        if not choices:
            raise ProviderError("provider returned no choices")

        message = choices[0].get("message") or {}
        if isinstance(message.get("content"), str):
            return message["content"]
        if isinstance(message.get("content"), list):
            parts: list[str] = []
            for item in message["content"]:
                if isinstance(item, dict):
                    if isinstance(item.get("text"), str):
                        parts.append(item["text"])
                    elif item.get("type") == "output_text" and isinstance(item.get("text"), str):
                        parts.append(item["text"])
            joined = "".join(parts).strip()
            if joined:
                return joined
        if isinstance(message.get("parsed"), dict):
            return json.dumps(message["parsed"], ensure_ascii=False)
        raise ProviderError("provider returned no JSON-capable content")
