"""Probe the TinyFish Agent API directly to see exactly what comes back.

Read the key from the environment (or backend/.env) - never hardcode it.

    python probe_agent.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

# Load backend/.env if present, without requiring python-dotenv.
ENV_PATH = Path(__file__).resolve().parent / ".env"
if ENV_PATH.is_file():
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip().lstrip("\ufeff")
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

KEY = os.getenv("TINYFISH_API_KEY", "")
BASE = os.getenv("TINYFISH_BASE_URL", "https://agent.tinyfish.ai")

if not KEY or KEY.lower() in {"demo", "changeme", "your_key_here"}:
    print("TINYFISH_API_KEY is not configured (set it in backend/.env).")
    sys.exit(1)

print("=" * 70)
print("  1. WALLET BALANCE")
print("=" * 70)
try:
    r = httpx.get(f"{BASE}/v1/wallet", headers={"X-API-Key": KEY}, timeout=30)
    print(f"HTTP {r.status_code}")
    print(r.text[:600])
except Exception as e:
    print(f"ERROR {type(e).__name__}: {e}")

print()
print("=" * 70)
print("  2. AGENT API (run-sse) - raw events")
print("=" * 70)
goal = "Open the page and return a JSON object: {\"title\": <the page title>}"
payload = {"url": "https://example.com", "goal": goal}
try:
    with httpx.stream(
        "POST",
        f"{BASE}/v1/automation/run-sse",
        headers={"X-API-Key": KEY, "Content-Type": "application/json"},
        json=payload,
        timeout=httpx.Timeout(180.0, connect=15.0),
    ) as r:
        print(f"HTTP {r.status_code}  content-type={r.headers.get('content-type')}")
        if r.status_code >= 400:
            body = r.read().decode("utf-8", "ignore")
            print("BODY:", body[:900])
        else:
            for line in r.iter_lines():
                line = line.strip()
                if line:
                    print(" ", line[:400])
except Exception as e:
    print(f"ERROR {type(e).__name__}: {e}")

print()
print("=" * 70)
print("  3. AGENT API (run, synchronous)")
print("=" * 70)
try:
    r = httpx.post(
        f"{BASE}/v1/automation/run",
        headers={"X-API-Key": KEY, "Content-Type": "application/json"},
        json=payload,
        timeout=httpx.Timeout(180.0, connect=15.0),
    )
    print(f"HTTP {r.status_code}")
    print(r.text[:1200])
except Exception as e:
    print(f"ERROR {type(e).__name__}: {e}")
