import logging
from typing import Sequence

import httpx

from ..config import settings

log = logging.getLogger(__name__)


class GroqNotConfigured(RuntimeError):
    pass


class GroqChatClient:
    def __init__(self, *, timeout: float = 20.0) -> None:
        self.timeout = timeout

    async def complete(
        self, *, system_prompt: str, messages: Sequence[dict[str, str]],
        temperature: float = 0.2, max_tokens: int = 220,
    ) -> str:
        if not settings.groq_api_key:
            raise GroqNotConfigured("GROQ_API_KEY is not configured")
        url     = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
        payload = {
            "model":       settings.groq_model,
            "messages":    [{"role": "system", "content": system_prompt}, *messages],
            "temperature": temperature,
            "max_tokens":  max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type":  "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            log.warning("Unexpected Groq response shape: %s", data)
            raise RuntimeError("Unexpected Groq response") from exc

    async def complete_with_tools(
        self, *, system_prompt: str, messages: Sequence[dict],
        tools: list[dict], temperature: float = 0.2, max_tokens: int = 400,
    ) -> tuple[str, list[dict]]:
        if not settings.groq_api_key:
            raise GroqNotConfigured("GROQ_API_KEY is not configured")
        url     = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
        payload = {
            "model":       settings.groq_model,
            "messages":    [{"role": "system", "content": system_prompt}, *messages],
            "temperature": temperature,
            "max_tokens":  max_tokens,
            "tools":       tools,
            "tool_choice": "auto",
        }
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type":  "application/json",
        }
        import json as _json
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        try:
            choice    = data["choices"][0]["message"]
            text      = (choice.get("content") or "").strip()
            raw_calls = choice.get("tool_calls") or []
            tool_calls = []
            for tc in raw_calls:
                fn   = tc.get("function", {})
                name = fn.get("name", "")
                try:
                    args = _json.loads(fn.get("arguments", "{}"))
                except Exception:
                    args = {}
                if name:
                    tool_calls.append({"name": name, "arguments": args})
            return text, tool_calls
        except (KeyError, IndexError, TypeError) as exc:
            log.warning("Unexpected Groq tool response: %s", data)
            raise RuntimeError("Unexpected Groq tool response") from exc
