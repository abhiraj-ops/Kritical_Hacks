"""ZeroDay-Guard AI — application configuration.

Everything is environment-driven so the same image runs in demo mode, in a
judge review, and in production without a code change.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

try:  # pydantic-settings is the clean path; fall back to os.environ if absent.
    from pydantic_settings import BaseSettings, SettingsConfigDict

    _HAS_PYDANTIC_SETTINGS = True
except Exception:  # pragma: no cover - exercised only on partial installs
    BaseSettings = object  # type: ignore[assignment,misc]
    _HAS_PYDANTIC_SETTINGS = False


def _load_dotenv() -> None:
    """Load ``backend/.env`` into the process environment.

    Values already present in the real environment always win, so a container
    or CI secret overrides the file. Implemented inline to avoid a hard
    dependency on python-dotenv.
    """
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return
    try:
        raw = env_path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in raw.splitlines():
        line = line.strip()
        # Strip a UTF-8 BOM that PowerShell's Set-Content writes by default —
        # otherwise the first key silently becomes "<BOM>TINYFISH_API_KEY"
        # and never matches, so the service boots in demo mode.
        line = line.lstrip("\ufeff")
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()


class Settings:
    """Typed, validated application settings.

    Implemented as a plain class rather than a pydantic model so the service
    boots even if only a subset of the dependencies are installed — on a
    deadline, "it starts" beats "it validates".
    """

    # --- Service -----------------------------------------------------------
    APP_NAME: str = "ZeroDay-Guard AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # --- CORS --------------------------------------------------------------
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    # --- TinyFish ----------------------------------------------------------
    TINYFISH_API_KEY: str = "demo"
    TINYFISH_BASE_URL: str = "https://agent.tinyfish.ai"
    TINYFISH_SEARCH_URL: str = "https://api.search.tinyfish.ai"
    TINYFISH_FETCH_URL: str = "https://api.fetch.tinyfish.ai"
    TINYFISH_TIMEOUT: int = 180
    TINYFISH_MAX_ARTIFACT_CHARS: int = 12000
    #: Wall-clock budget for the goal-driven agent path. When exceeded we
    #: abandon it and fall back to the fast Search + Fetch path, so a scan
    #: never stalls a live demo for minutes.
    AGENT_TIME_BUDGET: int = 150
    #: Wall-clock budget for the TinyFish Research reasoning stage. Research
    #: routinely takes 5-20 minutes, which is far too long to hold a scan
    #: open, so we abandon it and fall back to the deterministic summary.
    RESEARCH_TIME_BUDGET: int = 90

    # --- LLM reasoning -----------------------------------------------------
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o"
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-latest"

    # --- ML ----------------------------------------------------------------
    CODEBERT_MODEL: str = "microsoft/codebert-base"
    ENABLE_CODEBERT: bool = True
    TORCH_THREADS: int = 4
    MAX_SNIPPET_CHARS: int = 4000

    def __init__(self, **overrides: Any) -> None:
        for field_name in dir(self):
            if not field_name.isupper() or field_name.startswith("_"):
                continue
            env_key = field_name
            raw = os.getenv(env_key)
            if raw is None:
                continue
            setattr(self, field_name, self._coerce(field_name, raw))
        for key, value in overrides.items():
            setattr(self, key.upper(), value)

    # ------------------------------------------------------------------
    def _coerce(self, name: str, raw: str) -> Any:
        if name in {"DEBUG", "ENABLE_CODEBERT"}:
            return raw.strip().lower() in {"1", "true", "yes", "on"}
        if name in {"PORT", "TINYFISH_TIMEOUT", "TINYFISH_MAX_ARTIFACT_CHARS",
                    "TORCH_THREADS", "MAX_SNIPPET_CHARS"}:
            try:
                return int(raw)
            except ValueError:
                return getattr(type(self), name, 0)
        return raw.strip()

    # ------------------------------------------------------------------
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def demo_mode(self) -> bool:
        """True when TinyFish is unavailable and we should serve mock payloads.

        Also true when the key is a placeholder, so a half-configured
        deployment degrades to a demo instead of erroring on every request.
        """
        key = (self.TINYFISH_API_KEY or "").strip().lower()
        return key in {"", "demo", "your_key_here", "changeme", "none"}

    @property
    def has_openai(self) -> bool:
        return bool(self.OPENAI_API_KEY) and "your" not in (self.OPENAI_API_KEY or "").lower()

    @property
    def has_anthropic(self) -> bool:
        return bool(self.ANTHROPIC_API_KEY) and "your" not in (self.ANTHROPIC_API_KEY or "").lower()

    def redacted(self) -> dict[str, Any]:
        """Config snapshot safe to log or return over the API."""
        return {
            "app_name": self.APP_NAME,
            "version": self.VERSION,
            "demo_mode": self.demo_mode,
            "tinyfish_configured": not self.demo_mode,
            "llm_provider": (
                "openai" if self.has_openai
                else "anthropic" if self.has_anthropic
                else "tinyfish-research"
            ),
            "codebert_enabled": self.ENABLE_CODEBERT,
            "codebert_model": self.CODEBERT_MODEL,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance (immutable for the process lifetime)."""
    return Settings()
