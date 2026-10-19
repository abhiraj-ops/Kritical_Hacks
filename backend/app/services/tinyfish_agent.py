"""TinyFish Web Agent — autonomous browsing for vulnerability intelligence.

Why this service exists
-----------------------
Finding real exploit intelligence means reading pages that are hostile to
naive fetching: GitHub issue threads, release notes, security advisories and
PoC repositories, most of which are JavaScript-rendered, paginated or
interactively gated. TinyFish gives us a real browser and a real extractor.

Three surfaces are used, in descending order of capability:

1. **Agent API** (``/v1/automation/run-sse``) — goal-driven browsing. We hand
   TinyFish a natural-language objective and it decides the clicks, scrolling
   and extraction. This is the primary path.
2. **Search API** (``api.search.tinyfish.ai``) — free, fast, used to discover
   candidate advisory and PoC URLs for a target.
3. **Fetch API** (``api.fetch.tinyfish.ai``) — free, renders JavaScript and
   extracts PDFs, used to pull raw code blocks and patch diffs out of those
   pages. This is the *reliable* path.

The Agent API draws from a wallet and can be slow or unavailable, so Search +
Fetch are a genuine fallback path rather than decoration: if the agent errors
or the account has no balance, the scan still completes with real web data.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import httpx

from app.config import Settings
from app.models.schemas import AgentEvent, EventLevel

# ---------------------------------------------------------------------------
# Goal templates handed to the TinyFish Agent
# ---------------------------------------------------------------------------
CRAWL_GOAL = (
    "You are a security analyst. Open the target page and extract the following, "
    "returning a single JSON object:\n"
    '{{"cve_ids": [string], "vulnerabilities": [{{"title": string, "severity": string, '
    '"cwe": string, "description": string, "affected_versions": string, "evidence_quote": string}}], '
    '"code_snippets": [{{"language": string, "code": string, "source": string}}], '
    '"patch_diffs": [string], "references": [string], "summary": string}}\n'
    "Steps: dismiss cookie/consent banners, expand collapsed sections, scroll to the "
    "full advisory or issue thread, then read the description, affected versions, "
    "proof-of-concept code and any patch diff. Quote text exactly as written."
)

POC_GOAL = (
    "You are extracting exploit proof-of-concept material. Open the page and return a "
    "single JSON object:\n"
    '{{"cve_id": string, "poc_code": [{{"language": string, "code": string}}], '
    '"reproduction_steps": [string], "patch_diff": string, "affected_targets": [string], '
    '"references": [string]}}\n'
    "Extract raw code blocks verbatim, any reproduction steps in order, and the unified "
    "diff of the fix if one is present. Do not paraphrase code."
)

CVE_PATTERN = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)
CODE_BLOCK_PATTERN = re.compile(r"```([\w+#.-]*)\n(.*?)```", re.DOTALL)
DIFF_PATTERN = re.compile(
    r"(^diff --git .*?$|^@@ .*?$|^[+-](?![+-]).*?$)", re.MULTILINE | re.DOTALL
)

# JSON Schema handed to the Agent API so the result is typed rather than
# hoping the model complies with the instructions in the goal string.
CRAWL_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "cve_ids": {"type": "array", "items": {"type": "string"}},
        "vulnerabilities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "severity": {"type": "string"},
                    "cwe": {"type": "string"},
                    "description": {"type": "string"},
                    "affected_versions": {"type": "string"},
                    "evidence_quote": {"type": "string"},
                },
                "required": ["title", "severity", "description"],
            },
        },
        "code_snippets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "language": {"type": "string"},
                    "code": {"type": "string"},
                    "source": {"type": "string"},
                },
                "required": ["language", "code"],
            },
        },
        "patch_diffs": {"type": "array", "items": {"type": "string"}},
        "references": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
    },
    "required": [
        "cve_ids",
        "vulnerabilities",
        "code_snippets",
        "patch_diffs",
        "references",
        "summary",
    ],
}


@dataclass
class ExploitIntel:
    """Structured intelligence harvested from the live web."""

    target_url: str
    summary: str = ""
    cve_ids: list[str] = field(default_factory=list)
    vulnerabilities: list[dict[str, Any]] = field(default_factory=list)
    code_blocks: list[dict[str, Any]] = field(default_factory=list)
    patch_diffs: list[str] = field(default_factory=list)
    reproduction_steps: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    sources_searched: int = 0
    pages_fetched: int = 0
    engine: str = "tinyfish-agent"

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_url": self.target_url,
            "summary": self.summary,
            "cve_ids": self.cve_ids,
            "vulnerabilities": self.vulnerabilities,
            "code_blocks": self.code_blocks,
            "patch_diffs": self.patch_diffs,
            "reproduction_steps": self.reproduction_steps,
            "references": self.references,
            "sources_searched": self.sources_searched,
            "pages_fetched": self.pages_fetched,
            "engine": self.engine,
        }


class TinyFishWebAgent:
    """Autonomous web agent for exploit intelligence gathering."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.api_key = settings.TINYFISH_API_KEY
        self.demo = settings.demo_mode
        self._client: httpx.AsyncClient | None = None

    # ------------------------------------------------------------------
    # HTTP plumbing
    # ------------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.settings.TINYFISH_TIMEOUT, connect=15.0),
                headers={
                    "X-API-Key": self.api_key,
                    "Content-Type": "application/json",
                    "User-Agent": "ZeroDay-Guard/1.0 (security research; contact: repo README)",
                },
                follow_redirects=True,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _headers(self) -> dict[str, str]:
        return {"X-API-Key": self.api_key, "Content-Type": "application/json"}

    # ------------------------------------------------------------------
    # 1. Agent API — goal-driven browsing
    # ------------------------------------------------------------------
    async def _stream_agent(
        self, url: str, goal: str, output_schema: dict[str, Any] | None = None
    ) -> AsyncIterator[tuple[str, dict[str, Any]]]:
        """Stream SSE events from the TinyFish Agent API.

        Yields ``(event_name, payload)`` pairs. Raises on unrecoverable
        transport failures so the caller can fall back.

        Note: TinyFish signals the event type inside the JSON body
        (``{"type": "COMPLETE", ...}``) rather than as an SSE ``event:`` name.
        We read the body first and only fall back to the SSE name, because
        reading only the SSE name silently drops every result.
        """
        endpoint = f"{self.settings.TINYFISH_BASE_URL}/v1/automation/run-sse"
        client = await self._get_client()
        body: dict[str, Any] = {"url": url, "goal": goal}
        if output_schema:
            # Guarantees typed fields instead of hoping the agent complies.
            body["output_schema"] = output_schema

        async with client.stream(
            "POST", endpoint, json=body
        ) as response:
            if response.status_code >= 400:
                body = await response.aread()
                raise RuntimeError(
                    f"TinyFish agent HTTP {response.status_code}: "
                    f"{body[:300].decode('utf-8', 'ignore')}"
                )

            sse_event = "MESSAGE"
            async for raw_line in response.aiter_lines():
                line = raw_line.strip()
                if not line:
                    continue
                if line.startswith("event:"):
                    sse_event = line[6:].strip()
                    continue
                if not line.startswith("data:"):
                    continue
                payload_raw = line[5:].strip()
                if not payload_raw or payload_raw == "[DONE]":
                    continue
                try:
                    payload = json.loads(payload_raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(payload, dict):
                    continue
                # The body carries the authoritative event type.
                event_name = str(payload.get("type") or sse_event)
                yield event_name, payload

    @staticmethod
    def _extract_result(payload: dict[str, Any]) -> dict[str, Any] | None:
        """Pull the agent's final JSON out of a COMPLETE payload.

        The agent returns either a bare object under ``result`` or a list /
        plain text under ``result.result`` depending on how it interpreted the
        goal, so we normalise both shapes.
        """
        if "result" not in payload:
            return None
        result = payload["result"]
        if isinstance(result, dict):
            if "result" in result and isinstance(result["result"], (dict, list)):
                inner = result["result"]
                return inner if isinstance(inner, dict) else {"raw": inner}
            return result
        if isinstance(result, list):
            return {"raw": result}
        if isinstance(result, str):
            text = result.strip()
            # The agent often wraps JSON in prose or a code fence.
            fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            candidate = fenced.group(1) if fenced else None
            if candidate is None:
                brace = re.search(r"\{.*\}", text, re.DOTALL)
                candidate = brace.group(0) if brace else None
            if candidate:
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass
            return {"summary": text[:4000]}
        return None

    # ------------------------------------------------------------------
    # 2. Search API — free, reliable discovery
    # ------------------------------------------------------------------
    async def _search(self, query: str, limit: int = 8) -> list[dict[str, Any]]:
        if self.demo:
            return []
        client = await self._get_client()
        params = {"query": query}
        try:
            response = await client.get(
                self.settings.TINYFISH_SEARCH_URL, params=params, timeout=25.0
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            return []
        results = data.get("results") or []
        return [
            {
                "url": r.get("url", ""),
                "title": r.get("title") or "",
                "snippet": r.get("snippet") or "",
                "site": r.get("site_name") or "",
            }
            for r in results[:limit]
            if r.get("url")
        ]

    # ------------------------------------------------------------------
    # 3. Fetch API — free, renders JS, extracts raw content
    # ------------------------------------------------------------------
    async def _fetch_pages(self, urls: list[str]) -> list[dict[str, Any]]:
        if self.demo or not urls:
            return []
        client = await self._get_client()
        target = urls[:10]
        try:
            response = await client.post(
                self.settings.TINYFISH_FETCH_URL,
                json={"urls": target, "format": "markdown", "ttl": 0},
                timeout=90.0,
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            return []

        pages: list[dict[str, Any]] = []
        for item in data.get("results") or []:
            text = item.get("text")
            if isinstance(text, (dict, list)):
                text = json.dumps(text)
            pages.append(
                {
                    "url": item.get("url", ""),
                    "title": item.get("title") or "",
                    "description": item.get("description") or "",
                    "text": str(text or ""),
                }
            )
        return pages

    # ------------------------------------------------------------------
    # Static analysers over fetched markdown
    # ------------------------------------------------------------------
    def _extract_code_blocks(self, page: dict[str, Any]) -> list[dict[str, Any]]:
        """Pull fenced code blocks out of a fetched page, verbatim."""
        blocks: list[dict[str, Any]] = []
        text = page.get("text", "")
        limit = self.settings.TINYFISH_MAX_ARTIFACT_CHARS
        for language, code in CODE_BLOCK_PATTERN.findall(text):
            cleaned = code.strip()
            if len(cleaned) < 12:
                continue
            blocks.append(
                {
                    "language": (language or "unknown").strip() or "unknown",
                    "code": cleaned[:limit],
                    "source": page.get("url", ""),
                }
            )
        return blocks

    @staticmethod
    def _extract_diffs(page: dict[str, Any]) -> list[str]:
        text = page.get("text", "")
        diffs: list[str] = []
        for match in DIFF_PATTERN.finditer(text):
            chunk = match.group(0).strip()
            if len(chunk) > 40 and any(line.startswith(("+", "-")) for line in chunk.splitlines()):
                diffs.append(chunk[:6000])
        return diffs[:5]

    @staticmethod
    def _extract_cves(text: str) -> list[str]:
        return sorted({m.group(0).upper() for m in CVE_PATTERN.finditer(text)})

    @staticmethod
    def _extract_steps(text: str) -> list[str]:
        """Pull ordered reproduction steps out of advisory prose."""
        steps: list[str] = []
        pattern = re.compile(
            r"^\s*(?:step\s*\d+[\.\):]|\d+[\.\)]\s+|(?:-|\*)\s+)(.{12,220})$",
            re.MULTILINE,
        )
        for match in pattern.finditer(text):
            candidate = match.group(1).strip()
            if candidate and not candidate.lower().startswith(("http", "note:")):
                steps.append(candidate)
        return steps[:12]

    # ------------------------------------------------------------------
    # Demo-mode payload
    # ------------------------------------------------------------------
    def _mock_intel(self, target_url: str) -> ExploitIntel:
        """A realistic payload so the dashboard is demonstrable without a key."""
        return ExploitIntel(
            target_url=target_url,
            summary=(
                "Demonstration payload. The target's release notes and security advisory "
                "page expose a deserialisation flaw in the configuration parser, tracked "
                "as CVE-2024-3094, with a public proof-of-concept and an upstream fix "
                "available."
            ),
            cve_ids=["CVE-2024-3094"],
            vulnerabilities=[
                {
                    "title": "Remote code execution via unsafe deserialisation in config parser",
                    "severity": "CRITICAL",
                    "cwe": "CWE-502",
                    "description": (
                        "The configuration loader deserialises attacker-reachable objects "
                        "without validation, allowing arbitrary code execution on startup."
                    ),
                    "affected_versions": "<= 3.2.1",
                    "evidence_quote": (
                        "Deserialisation of untrusted data allows remote code execution "
                        "when the config file is processed."
                    ),
                },
                {
                    "title": "Path traversal in archive extraction routine",
                    "severity": "HIGH",
                    "cwe": "CWE-22",
                    "description": (
                        "Archive entries are extracted without normalising member paths, "
                        "allowing writes outside the intended directory."
                    ),
                    "affected_versions": "<= 3.2.1",
                    "evidence_quote": "Archive member names are used without normalisation.",
                },
            ],
            code_blocks=[
                {
                    "language": "python",
                    "code": (
                        "import pickle\n\n"
                        "def load_config(blob: bytes):\n"
                        "    # VULNERABLE: pickle executes arbitrary opcodes on load\n"
                        "    return pickle.loads(blob)\n"
                    ),
                    "source": "demo://poc/loader.py",
                },
                {
                    "language": "python",
                    "code": (
                        "import json\n\n"
                        "def load_config(blob: bytes):\n"
                        "    # FIXED: JSON has no code-execution semantics\n"
                        "    return json.loads(blob.decode('utf-8'))\n"
                    ),
                    "source": "demo://patch/loader.py",
                },
            ],
            patch_diffs=[
                "-    return pickle.loads(blob)\n+    return json.loads(blob.decode('utf-8'))"
            ],
            reproduction_steps=[
                "Craft a payload that invokes os.system on deserialisation.",
                "Send the payload as the configuration blob to the loader.",
                "Observe command execution in the application context.",
            ],
            references=[
                "https://nvd.nist.gov/vuln/detail/CVE-2024-3094",
                "https://cwe.mitre.org/data/definitions/502.html",
            ],
            sources_searched=6,
            pages_fetched=3,
            engine="demo",
        )

    # ------------------------------------------------------------------
    # Public API — streaming
    # ------------------------------------------------------------------
    async def stream_crawl(
        self,
        target_url: str,
        cve_id: str | None = None,
        focus: str | None = None,
    ) -> AsyncIterator[AgentEvent]:
        """Crawl a target for vulnerability intelligence, yielding live events.

        Primary path is the TinyFish Agent API. If that is unavailable (no
        wallet, timeout, account restriction) we transparently fall back to
        Search + Fetch, which are on the free tier and still return real,
        rendered, live-web data.
        """
        started = asyncio.get_event_loop().time()

        if self.demo:
            yield AgentEvent(
                type="stage", step="init", level=EventLevel.warn,
                message="TINYFISH_API_KEY is 'demo' — serving simulated intelligence.",
            )
            for message in (
                "Simulating navigation to target page…",
                "Bypassing dynamic JS modal…",
                "Extracting code snippet…",
                "Running static analysis…",
            ):
                await asyncio.sleep(0.35)
                yield AgentEvent(type="progress", step="demo", message=message)
            intel = self._mock_intel(target_url)
            yield AgentEvent(
                type="complete", step="complete", level=EventLevel.success,
                message=f"Demo intelligence assembled for {target_url}",
                data={"intel": intel.to_dict(), "elapsed": asyncio.get_event_loop().time() - started},
            )
            return

        # --- 1. Agent API -------------------------------------------------
        agent_payload: dict[str, Any] | None = None
        agent_error: str | None = None
        deadline = time.monotonic() + max(15, self.settings.AGENT_TIME_BUDGET)

        yield AgentEvent(
            type="stage", step="navigate", level=EventLevel.agent,
            message=f"Navigating to {target_url}…",
        )

        try:
            async for event_name, payload in self._stream_agent(
                target_url, CRAWL_GOAL, output_schema=CRAWL_OUTPUT_SCHEMA
            ):
                if time.monotonic() > deadline:
                    agent_error = (
                        f"agent exceeded its {self.settings.AGENT_TIME_BUDGET}s budget"
                    )
                    break
                if event_name in ("STARTED", "PROGRESS"):
                    purpose = str(payload.get("purpose") or payload.get("message") or "")
                    if purpose:
                        yield AgentEvent(
                            type="progress", step="navigate", level=EventLevel.agent,
                            message=purpose[:220],
                        )
                elif event_name in ("COMPLETE", "COMPLETED", "RESULT"):
                    agent_payload = self._extract_result(payload)
                elif event_name == "ERROR":
                    agent_error = str(payload.get("message") or payload.get("error") or "")
        except Exception as exc:  # network, auth, wallet, timeout — all recoverable
            agent_error = f"{type(exc).__name__}: {exc}"

        if agent_payload is not None:
            yield AgentEvent(
                type="stage", step="navigate", level=EventLevel.success,
                message="Agent extracted structured intelligence from the target.",
            )
        else:
            reason = agent_error or "agent returned no structured result"
            yield AgentEvent(
                type="stage", step="navigate", level=EventLevel.warn,
                message=f"Agent path unavailable ({reason[:120]}) — falling back to Search + Fetch.",
            )

        # --- 2. Search + Fetch fallback / augmentation ---------------------
        intel = ExploitIntel(target_url=target_url, engine="tinyfish-agent")

        if agent_payload:
            intel.summary = str(agent_payload.get("summary") or "")
            intel.vulnerabilities = list(agent_payload.get("vulnerabilities") or [])
            intel.cve_ids = [str(c).upper() for c in (agent_payload.get("cve_ids") or [])]
            for block in agent_payload.get("code_snippets") or []:
                if isinstance(block, dict) and block.get("code"):
                    intel.code_blocks.append(
                        {
                            "language": block.get("language") or "unknown",
                            "code": str(block.get("code"))[:12000],
                            "source": block.get("source") or target_url,
                        }
                    )
            for diff in agent_payload.get("patch_diffs") or []:
                intel.patch_diffs.append(str(diff))
            intel.references = [str(r) for r in (agent_payload.get("references") or [])]
            intel.reproduction_steps = [
                str(s) for s in (agent_payload.get("reproduction_steps") or [])
            ]

        queries = [f"{target_url} security advisory vulnerability"]
        if cve_id:
            queries.insert(0, f"{cve_id} exploit proof of concept")
        if focus:
            queries.append(f"{target_url} {focus} vulnerability")

        all_urls: list[str] = []
        for query in queries[:3]:
            hits = await self._search(query)
            intel.sources_searched += len(hits)
            for hit in hits:
                if hit["url"] not in all_urls:
                    all_urls.append(hit["url"])
            await asyncio.sleep(0.05)

        # Always include the target itself.
        if target_url not in all_urls:
            all_urls.insert(0, target_url)

        yield AgentEvent(
            type="stage", step="discover", level=EventLevel.agent,
            message=f"Discovered {len(all_urls)} candidate sources across the live web.",
        )

        pages = await self._fetch_pages(all_urls[:10])
        intel.pages_fetched = len(pages)

        for page in pages:
            yield AgentEvent(
                type="progress", step="extract", level=EventLevel.info,
                message=f"Extracting artefacts from {page.get('title') or page.get('url','')}…",
            )
            intel.code_blocks.extend(self._extract_code_blocks(page))
            intel.patch_diffs.extend(self._extract_diffs(page))
            for cve in self._extract_cves(page.get("text", "")):
                if cve not in intel.cve_ids:
                    intel.cve_ids.append(cve)
            intel.reproduction_steps.extend(self._extract_steps(page.get("text", "")))
            if page.get("url") and page["url"] not in intel.references:
                intel.references.append(page["url"])

        # De-duplicate while preserving order.
        seen: set[str] = set()
        intel.code_blocks = [
            b for b in intel.code_blocks
            if not (b["code"] in seen or seen.add(b["code"]))
        ]
        intel.reproduction_steps = list(dict.fromkeys(intel.reproduction_steps))[:12]
        intel.patch_diffs = list(dict.fromkeys(intel.patch_diffs))[:8]
        intel.references = list(dict.fromkeys(intel.references))[:15]

        if not intel.summary:
            intel.summary = (
                f"Analysed {len(intel.vulnerabilities)} vulnerability records and "
                f"{len(intel.code_blocks)} code artefacts harvested from "
                f"{intel.pages_fetched} live pages for {target_url}."
            )

        if cve_id:
            normalised = cve_id.upper()
            if normalised not in intel.cve_ids:
                intel.cve_ids.insert(0, normalised)

        yield AgentEvent(
            type="complete", step="complete", level=EventLevel.success,
            message=(
                f"Harvested {len(intel.code_blocks)} code artefacts and "
                f"{len(intel.cve_ids)} CVE identifiers."
            ),
            data={"intel": intel.to_dict(), "elapsed": asyncio.get_event_loop().time() - started},
        )

    # ------------------------------------------------------------------
    # Public API — non-streaming
    # ------------------------------------------------------------------
    async def crawl_vulnerability_target(self, target_url: str) -> ExploitIntel:
        """Run a full crawl and return the harvested intelligence."""
        intel: ExploitIntel | None = None
        async for event in self.stream_crawl(target_url):
            if event.type == "complete" and event.data:
                intel = ExploitIntel(
                    target_url=target_url,
                    summary=event.data.get("intel", {}).get("summary", ""),
                    cve_ids=list(event.data.get("intel", {}).get("cve_ids", [])),
                    vulnerabilities=list(event.data.get("intel", {}).get("vulnerabilities", [])),
                    code_blocks=list(event.data.get("intel", {}).get("code_blocks", [])),
                    patch_diffs=list(event.data.get("intel", {}).get("patch_diffs", [])),
                    reproduction_steps=list(event.data.get("intel", {}).get("reproduction_steps", [])),
                    references=list(event.data.get("intel", {}).get("references", [])),
                    sources_searched=int(event.data.get("intel", {}).get("sources_searched", 0)),
                    pages_fetched=int(event.data.get("intel", {}).get("pages_fetched", 0)),
                    engine=event.data.get("intel", {}).get("engine", "tinyfish-agent"),
                )
        if intel is None:
            return ExploitIntel(target_url=target_url, summary="No intelligence harvested.")
        return intel

    async def fetch_exploit_poc(self, cve_or_repo_url: str) -> ExploitIntel:
        """Extract raw code blocks, issue threads and patch diffs for a PoC page."""
        if self.demo:
            mock = self._mock_intel(cve_or_repo_url)
            mock.engine = "demo"
            return mock

        pages = await self._fetch_pages([cve_or_repo_url])
        intel = ExploitIntel(
            target_url=cve_or_repo_url,
            engine="tinyfish-fetch",
            pages_fetched=len(pages),
        )
        for page in pages:
            intel.code_blocks.extend(self._extract_code_blocks(page))
            intel.patch_diffs.extend(self._extract_diffs(page))
            intel.reproduction_steps.extend(self._extract_steps(page.get("text", "")))
            intel.cve_ids.extend(self._extract_cves(page.get("text", "")))
            intel.references.append(page.get("url", ""))
        intel.cve_ids = list(dict.fromkeys(intel.cve_ids))
        intel.code_blocks = [
            b for b in intel.code_blocks
            if not any(b["code"] == x["code"] for x in intel.code_blocks[: intel.code_blocks.index(b)])
        ]
        intel.summary = (
            f"Extracted {len(intel.code_blocks)} code artefacts and "
            f"{len(intel.patch_diffs)} patch diffs."
        )
        return intel
