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
    '"patch_diffs": [string], "summary": string}}\n'
    "Dismiss cookie banners, expand collapsed sections, then read the advisory text, "
    "affected versions, proof-of-concept code and any patch diff. Quote text exactly as "
    "written. Be efficient - read the main advisory rather than exploring every link."
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
        """Pull code out of a fetched page, verbatim.

        Two shapes are handled: fenced blocks in markdown, and raw source
        files (raw.githubusercontent.com, *.py, *.js …) where the whole body
        IS the code.
        """
        blocks: list[dict[str, Any]] = []
        text = page.get("text", "")
        limit = self.settings.TINYFISH_MAX_ARTIFACT_CHARS
        url = page.get("url", "")

        # --- raw source file: the entire body is code --------------------
        if re.search(
            r"(raw\.githubusercontent\.com|"
            r"\.py|\.js|\.ts|\.java|\.c|\.cpp|\.go|\.rb|\.php|\.sh|\.ps1|\.yml|\.yaml)$",
            url,
            re.IGNORECASE,
        ):
            body = text.strip()
            if len(body) > 20:
                language = re.search(
                    r"\.([a-z]+)$", url.split("?")[0], re.IGNORECASE
                )
                blocks.append(
                    {
                        "language": (language.group(1).lower() if language else "text"),
                        "code": body[:limit],
                        "source": url,
                    }
                )
                return blocks

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
    # Fallback vulnerability extraction
    # ------------------------------------------------------------------
    #: "CVSS 3.1: 10.0 CRITICAL", "9.8 CRITICAL", "Base Score 7.5 HIGH"
    CVSS_PATTERN = re.compile(
        r"(?:\bCVSS\b[^0-9]{0,24}?|\bBase\s+Score\b[^0-9]{0,12})?(\d{1,2}\.\d)\s*"
        r"[-–—:]?\s*\b(CRITICAL|HIGH|MEDIUM|MODERATE|LOW|NONE)\b",
        re.IGNORECASE,
    )
    CWE_PATTERN = re.compile(r"\bCWE[- ]?(\d{1,4})\b", re.IGNORECASE)
    VERSION_PATTERN = re.compile(
        r"((?:versions?|releases?)\s+[\d.]+(?:-\w+)?\s*(?:through|to|-|–)\s*[\d.]+(?:-\w+)?|"
        r"[\d.]+(?:-\w+)?\s+(?:through|to)\s+[\d.]+(?:-\w+)?|"
        r"(?:before|prior to|earlier than)\s+[\d.]+(?:-\w+)?|"
        r"[\d.]+(?:\.\d+)*\s*(?:and\s+earlier|and\s+prior))",
        re.IGNORECASE,
    )
    DESC_TRIGGER = re.compile(
        r"\b(vulnerab|allows?|permit|attack|exploit|injection|overflow|traversal|"
        r"deserialis|deserializ|bypass|leak|disclos|rce|remote code)\w*",
        re.IGNORECASE,
    )

    SEVERITY_FROM_SCORE = [
        (9.0, "CRITICAL"),
        (7.0, "HIGH"),
        (4.0, "MEDIUM"),
        (0.1, "LOW"),
        (0.0, "INFO"),
    ]

    def _extract_vulnerabilities_from_pages(
        self, pages: list[dict[str, Any]], cve_ids: list[str]
    ) -> list[dict[str, Any]]:
        """Build vulnerability records from raw advisory pages.

        This is what makes the Search + Fetch fallback a first-class path
        rather than a degraded one. Without it, an agent timeout produced
        zero findings even though the fetched pages described the
        vulnerability in plain text.
        """
        records: list[dict[str, Any]] = []

        for page in pages:
            text = page.get("text", "")
            if not text:
                continue
            title = (page.get("title") or "").strip()
            if not title or len(title) < 4:
                continue

            page_cves = self._extract_cves(text)
            if not page_cves and not CVE_PATTERN.search(text):
                # Still worth reporting a page that talks about vulnerabilities.
                if not self.DESC_TRIGGER.search(text):
                    continue

            # --- severity from a CVSS score if present --------------------
            # Take the HIGHEST scoring match, not the first: advisory pages
            # often mention several CVSS vectors and the first one in the
            # markdown is not necessarily the headline score.
            severity = "MEDIUM"
            score_value: float | None = None
            for match in self.CVSS_PATTERN.finditer(text):
                try:
                    candidate_score = float(match.group(1))
                except ValueError:
                    continue
                if score_value is None or candidate_score > score_value:
                    score_value = candidate_score
                    severity = match.group(2).upper()
            if severity == "MODERATE":
                severity = "MEDIUM"
            if severity == "NONE":
                severity = "INFO"

            # --- CWE ------------------------------------------------------
            cwe_match = self.CWE_PATTERN.search(text)
            cwe = f"CWE-{cwe_match.group(1)}" if cwe_match else None

            # --- affected versions ---------------------------------------
            version_match = self.VERSION_PATTERN.search(text)
            affected = version_match.group(1).strip() if version_match else None

            # --- description + verbatim evidence -------------------------
            description, evidence = self._extract_description(text, page_cves)

            if not description and not cwe and not page_cves:
                continue

            # The finding title should identify the VULNERABILITY, not the
            # page it came from. "Splunk Security Advisory for Apache Log4j"
            # is a source; "CVE-2021-44228" is a finding. The page title is
            # kept as supporting context in the description.
            if page_cves:
                finding_title = ", ".join(page_cves[:2])
                if description:
                    description = f"{title} — {description}"
                else:
                    description = title
            else:
                finding_title = title

            records.append(
                {
                    "title": finding_title[:200],
                    "severity": severity,
                    "cwe": cwe,
                    "description": description,
                    "affected_versions": affected or "",
                    "evidence_quote": evidence or "",
                    "cve_ids": page_cves,
                    "_source": page.get("url", ""),
                    "_score": score_value,
                }
            )

        # Prefer pages that named a CVE, then pages with a CVSS score.
        records.sort(
            key=lambda r: (len(r.get("cve_ids") or []), r.get("_score") or 0.0),
            reverse=True,
        )
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for record in records:
            key = re.sub(r"\W+", "", record["title"].lower())[:60]
            if key in seen:
                continue
            seen.add(key)
            unique.append(record)
        return unique[:10]

    @staticmethod
    def _extract_description(text: str, cve_ids: list[str]) -> tuple[str, str]:
        """Return (description, verbatim evidence quote) from advisory prose."""
        paragraphs = [
            p.strip()
            for p in re.split(r"\n\s*\n", text)
            if 80 <= len(p.strip()) <= 1200
        ]
        for paragraph in paragraphs:
            # Skip markdown table rows and navigation chrome: they trip the
            # keyword trigger but read as noise in a findings panel.
            pipes = paragraph.count("|")
            if pipes > 6 or (pipes and pipes / max(1, len(paragraph)) > 0.08):
                continue
            lowered = paragraph.lower()
            if any(lowered.count(cve.lower()) for cve in cve_ids) or TinyFishWebAgent.DESC_TRIGGER.search(
                paragraph
            ):
                # Strip markdown noise but keep the sentence verbatim.
                cleaned = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", paragraph)
                cleaned = re.sub(r"[#*_`>]+", "", cleaned)
                cleaned = re.sub(r"\s+", " ", cleaned).strip()
                if len(cleaned) < 60:
                    continue
                return cleaned[:900], cleaned[:400]
        return "", ""

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
    # NVD enrichment
    # ------------------------------------------------------------------
    NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    @staticmethod
    def _cve_from_url(url: str) -> str | None:
        """Pull a CVE identifier out of a target URL, if there is one."""
        match = CVE_PATTERN.search(url or "")
        return match.group(0).upper() if match else None

    async def _fetch_nvd_records(self, cve_ids: list[str]) -> list[dict[str, Any]]:
        """Fetch authoritative CVE records from the NVD JSON API.

        Scraping advisory HTML is brittle: the same page renders differently
        between requests, so regexes hit different content each run. The NVD
        JSON API returns the same structured data every time - severity,
        CVSS vector, CWE and affected versions - so it is used to enrich
        whatever the web crawl found.

        This is enrichment, not replacement: the TinyFish crawl still
        discovers the CVE, the PoC and the advisory context.
        """
        if self.demo:
            return []

        client = await self._get_client()
        records: list[dict[str, Any]] = []

        for cve in cve_ids[:4]:
            try:
                response = await client.get(
                    self.NVD_API_URL, params={"cveId": cve}, timeout=20.0
                )
                if response.status_code != 200:
                    continue
                payload = response.json()
            except Exception:
                continue

            for item in payload.get("vulnerabilities", []) or []:
                record = self._parse_nvd_record(item)
                if record:
                    records.append(record)
            # Be polite to the public NVD API.
            await asyncio.sleep(0.35)

        return records

    @staticmethod
    def _parse_nvd_record(item: dict[str, Any]) -> dict[str, Any] | None:
        """Convert one NVD vulnerability object into our record shape."""
        cve = item.get("cve") or {}
        cve_id = str(cve.get("id") or "").upper()
        if not cve_id:
            return None

        description = ""
        for entry in cve.get("descriptions", []) or []:
            if str(entry.get("lang", "")).lower() == "en":
                description = str(entry.get("value", ""))
                break
        if not description:
            return None

        # --- severity: prefer the v3.1 primary metric -------------------
        severity = "MEDIUM"
        base_score: float | None = None
        metrics = cve.get("metrics", {}) or {}
        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            entries = metrics.get(key) or []
            primary = next(
                (e for e in entries if str(e.get("type", "")).lower() == "primary"),
                entries[0] if entries else None,
            )
            if not primary:
                continue
            cvss_data = primary.get("cvssData", {}) or {}
            try:
                score = float(cvss_data.get("baseScore"))
            except (TypeError, ValueError):
                score = None
            label = str(cvss_data.get("baseSeverity") or cvss_data.get("baseSeverity") or "").upper()
            if label in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
                severity = label
            if score is not None and (base_score is None or score > base_score):
                base_score = score
            if severity != "MEDIUM" and base_score is not None:
                break

        # --- CWE ---------------------------------------------------------
        cwe = None
        for weakness in cve.get("weaknesses", []) or []:
            for entry in weakness.get("description", []) or []:
                value = str(entry.get("value", ""))
                match = re.search(r"CWE-\d+", value, re.IGNORECASE)
                if match:
                    cwe = match.group(0).upper()
                    break
            if cwe:
                break

        # --- affected version ranges --------------------------------------
        versions: list[str] = []
        for configuration in cve.get("configurations", []) or []:
            for node in configuration.get("nodes", []) or []:
                for match in node.get("cpeMatch", []) or []:
                    start = match.get("versionStartIncluding") or match.get("versionStartExcluding")
                    end = match.get("versionEndIncluding") or match.get("versionEndExcluding")
                    if start and end:
                        versions.append(f"{start} through {end}")
                    elif end:
                        versions.append(f"before {end}")
                    elif start:
                        versions.append(f"from {start}")
        affected = "; ".join(dict.fromkeys(versions))[:300]

        return {
            "title": cve_id,
            "severity": severity,
            "cwe": cwe,
            "description": description[:900],
            "affected_versions": affected,
            "evidence_quote": description[:400],
            "cve_ids": [cve_id],
            "_source": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
            "_score": base_score,
        }

    @staticmethod
    def _merge_vulnerabilities(
        nvd: list[dict[str, Any]],
        agent_records: list[dict[str, Any]],
        scraped: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Merge vulnerability sources, most authoritative first.

        NVD records carry the authoritative severity, CWE and description.
        The agent's own records are richer in context (evidence quotes, PoC
        links). Scraped records are the last resort.

        A record is dropped when every CVE it names has already been covered.
        """
        merged: list[dict[str, Any]] = []
        seen_cves: set[str] = set()
        seen_titles: set[str] = set()

        for record in [*nvd, *agent_records, *scraped]:
            if not isinstance(record, dict):
                continue
            record = dict(record)

            # Agent records do not carry a cve_ids list; derive it.
            if not record.get("cve_ids"):
                haystack = f"{record.get('title', '')} {record.get('description', '')}"
                record["cve_ids"] = [m.group(0).upper() for m in CVE_PATTERN.finditer(haystack)]

            cves = [str(c).upper() for c in (record.get("cve_ids") or [])]
            title_key = re.sub(r"\W+", "", str(record.get("title", "")).lower())[:60]

            if cves and all(c in seen_cves for c in cves):
                continue
            if not cves and title_key in seen_titles:
                continue

            seen_cves.update(cves)
            seen_titles.add(title_key)
            merged.append(record)

        return merged[:12]

    # ------------------------------------------------------------------
    # Public API — streaming
    # ------------------------------------------------------------------
    async def _gather_web_sources(
        self, target_url: str, cve_id: str | None, focus: str | None
    ) -> tuple[list[str], list[dict[str, Any]], int]:
        """Discover and fetch candidate sources for a target.

        Runs concurrently with the agent so the fallback data is already
        gathered the instant the agent exceeds its budget. The total scan
        time becomes max(agent, fetch) rather than agent + fetch.

        When the target is (or mentions) a CVE, a proof-of-concept query is
        issued first. PoC pages are the only realistic source of actual
        code, and code is what the ML engine has something to say about.
        """
        target_cve = cve_id or self._cve_from_url(target_url)

        queries: list[str] = []
        if target_cve:
            # PoC repositories carry real code - the ML engine needs it.
            queries.append(f"{target_cve} proof of concept exploit github")
        queries.append(f"{target_url} security advisory vulnerability")
        if focus:
            queries.append(f"{target_url} {focus} vulnerability")
        if target_cve:
            queries.append(f"{target_cve} patch diff fix commit")

        all_urls: list[str] = []
        sources_searched = 0
        for query in queries[:4]:
            hits = await self._search(query)
            sources_searched += len(hits)
            for hit in hits:
                if hit["url"] not in all_urls:
                    all_urls.append(hit["url"])

        # Always include the target itself.
        if target_url not in all_urls:
            all_urls.insert(0, target_url)

        pages = await self._fetch_pages(all_urls[:10])
        return all_urls, pages, sources_searched

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

        The two paths run **concurrently**: the fallback is gathered in the
        background while the agent browses, so an agent timeout costs no
        extra wall-clock time and the fallback produces a full assessment
        rather than an empty one.
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
                type="intel", step="complete", level=EventLevel.success,
                message=f"Demo intelligence assembled for {target_url}",
                data={"intel": intel.to_dict(), "elapsed": asyncio.get_event_loop().time() - started},
            )
            return

        # Make sure the shared client exists before the task starts, so the
        # two coroutines cannot race to create it.
        await self._get_client()

        # Start the fallback discovery in the background, concurrently.
        fetch_task = asyncio.create_task(
            self._gather_web_sources(target_url, cve_id, focus)
        )

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

        all_urls, pages, sources_searched = await fetch_task
        intel.sources_searched = sources_searched
        intel.pages_fetched = len(pages)

        yield AgentEvent(
            type="stage", step="discover", level=EventLevel.agent,
            message=f"Discovered {len(all_urls)} candidate sources across the live web.",
        )

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

        # The agent is the richer source, but when it times out the fallback
        # must still produce vulnerability records — otherwise an agent
        # timeout silently produced a 0/100 "nothing found" assessment.
        scraped = self._extract_vulnerabilities_from_pages(pages, intel.cve_ids)

        # --- NVD enrichment ------------------------------------------------
        # Authoritative severity / CWE / description for every CVE we found.
        # Scraping advisory HTML is brittle because the same page renders
        # differently between requests; the NVD JSON API is deterministic.
        target_cve = self._cve_from_url(target_url)
        cve_order = ([target_cve] if target_cve else []) + [
            c for c in intel.cve_ids if c != target_cve
        ]
        nvd_records = await self._fetch_nvd_records(cve_order[:4])
        if nvd_records:
            yield AgentEvent(
                type="stage", step="enrich", level=EventLevel.success,
                message=(
                    f"Enriched {len(nvd_records)} CVE record(s) with authoritative "
                    f"NVD data (severity, CWE, affected versions)."
                ),
            )

        agent_records = list(intel.vulnerabilities or [])
        intel.vulnerabilities = self._merge_vulnerabilities(
            nvd_records, agent_records, scraped
        )

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
            type="intel", step="complete", level=EventLevel.success,
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
