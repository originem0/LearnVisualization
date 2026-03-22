from __future__ import annotations

import http.client
import json
import os
import random
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
    max_retries: int = 3
    fallback_model: str | None = None

    # Path to runtime config file (overrides env vars, survives restarts)
    _RUNTIME_CONFIG_PATH = Path(__file__).resolve().parent.parent / "runtime-config.json"

    @classmethod
    def _load_runtime_overrides(cls) -> dict[str, str]:
        """Load runtime-config.json if it exists. Returns a dict of overrides."""
        try:
            if cls._RUNTIME_CONFIG_PATH.exists():
                return json.loads(cls._RUNTIME_CONFIG_PATH.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
        return {}

    @classmethod
    def save_runtime_config(cls, overrides: dict[str, str]) -> None:
        """Write runtime overrides to runtime-config.json atomically."""
        tmp = cls._RUNTIME_CONFIG_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(overrides, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(cls._RUNTIME_CONFIG_PATH)

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

        # runtime-config.json overrides env vars
        rt = cls._load_runtime_overrides()
        if rt.get("base_url"):
            base_url = rt["base_url"]
        if rt.get("model"):
            model = rt["model"]
        if rt.get("api_key"):
            api_key = rt["api_key"]
        if rt.get("fallback_model"):
            fallback_model = rt["fallback_model"]

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
            body["model"] = self.config.fallback_model
            return self._call_and_parse(body, schema_name)

    def generate_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 12000,
    ) -> dict[str, Any]:
        """Generate plain text (no JSON mode). Used for code generation."""
        body = {
            "model": self.config.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        try:
            payload = self._post_json(body)
        except ProviderError:
            if not self.config.fallback_model or self.config.fallback_model == self.config.model:
                raise
            body["model"] = self.config.fallback_model
            payload = self._post_json(body)

        content = self._extract_message_content(payload)
        return {
            "content": content,
            "usage": payload.get("usage") or {},
            "model": payload.get("model") or body["model"],
        }

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

    # Human-readable error translations
    _HTTP_ERRORS = {
        401: "API Key 无效或已过期",
        403: "API Key 无权访问该模型",
        404: "API 端点不存在（检查 Base URL 是否正确）",
        422: "请求参数不合法（模型可能不支持 JSON mode）",
        429: "请求过于频繁，已被限流",
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
        timeout = self.config.timeout_seconds

        for attempt in range(self.config.max_retries + 1):
            req = request.Request(endpoint, data=encoded, headers=headers, method="POST")
            try:
                with request.urlopen(req, timeout=timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except error.HTTPError as exc:
                last_error = exc
                code = exc.code
                detail = ""
                try:
                    detail = exc.read().decode("utf-8", errors="ignore")
                except Exception:
                    pass

                # 429: respect Retry-After header
                if code == 429 and attempt < self.config.max_retries:
                    retry_after = exc.headers.get("Retry-After") if exc.headers else None
                    if retry_after and retry_after.strip().isdigit():
                        time.sleep(min(int(retry_after), 60))
                    else:
                        time.sleep(5.0 * (2 ** attempt) + random.uniform(0, 2))
                    continue

                # Other retryable server errors
                if code in {500, 502, 503, 504} and attempt < self.config.max_retries:
                    time.sleep(3.0 * (2 ** attempt) + random.uniform(0, 1))
                    continue

                human_msg = self._HTTP_ERRORS.get(code, f"HTTP {code}")
                if detail:
                    human_msg = f"{human_msg}（{detail[:200]}）"
                raise ProviderError(human_msg) from exc

            except error.URLError as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    raise ProviderError(f"网络错误: {self._translate_connection_error(exc.reason)}") from exc
                time.sleep(3.0 * (2 ** attempt) + random.uniform(0, 1))

            except (ConnectionError, OSError) as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    raise ProviderError(f"连接错误: {self._translate_connection_error(exc)}") from exc
                # RemoteDisconnected / ConnectionReset: retry quickly with fresh connection
                if isinstance(exc, http.client.RemoteDisconnected) or "ConnectionReset" in type(exc).__name__:
                    time.sleep(1.0 + random.uniform(0, 0.5))
                else:
                    time.sleep(3.0 * (2 ** attempt) + random.uniform(0, 1))

        raise ProviderError(f"请求失败（已重试 {self.config.max_retries} 次）: {self._translate_connection_error(last_error)}")

    @staticmethod
    def _translate_connection_error(exc: Any) -> str:
        """Translate raw connection exceptions to human-readable Chinese."""
        exc_name = type(exc).__name__
        exc_str = str(exc).lower()
        if "RemoteDisconnected" in exc_name or "remote end closed" in exc_str:
            return "API 服务器在响应前关闭了连接（可能超时或过载）"
        if "ConnectionRefused" in exc_name or "connection refused" in exc_str:
            return "无法连接到 API 服务器（服务未启动或地址错误）"
        if "ConnectionReset" in exc_name or "connection reset" in exc_str:
            return "连接被重置（网络不稳定或服务器过载）"
        if "timeout" in exc_str or "timed out" in exc_str:
            return "请求超时（服务器未在规定时间内响应）"
        if "ssl" in exc_str:
            return "SSL/TLS 握手失败（证书问题或网络劫持）"
        if "name or service not known" in exc_str or "nodename nor servname" in exc_str:
            return "域名解析失败（检查 Base URL 是否正确）"
        return str(exc)

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
