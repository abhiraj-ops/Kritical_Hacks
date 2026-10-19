# ZeroDay-Guard AI

> **Autonomous cybersecurity threat assessor.** Point it at a URL, and it crawls the live web
> with an AI browser agent, harvests real exploit intelligence, scores it with CodeBERT + AST
> static analysis, and hands you a risk verdict **and a working patch**.

```
Target URL  ──▶  TinyFish Web Agent  ──▶  CodeBERT + AST  ──▶  Risk Verdict + Diff
                (search · fetch · browse)   (semantic + static)    (streamed live)
```

---

## 🎯 What it actually does

1. **Autonomous reconnaissance** — hands TinyFish a natural-language goal ("find the advisory,
   the PoC, the affected versions and the patch"), and the agent drives a real cloud browser:
   dismisses cookie banners, expands collapsed sections, follows links, extracts.
2. **Intelligence harvesting** — pulls CVE IDs, affected versions, proof-of-concept code blocks
   and upstream patch diffs out of advisories, issue threads and release notes.
3. **ML risk scoring** — fuses CodeBERT contextual embeddings with a real AST/pattern static
   analyser into a normalised 0–100 risk score and a six-dimension risk vector.
4. **Reasoning + remediation** — synthesises an executive assessment and generates a concrete
   unified diff for the vulnerability class it found.

Every step streams to the dashboard over SSE, so you watch the agent work.

---

## 🐟 TinyFish integration (the core of this project)

TinyFish is **load-bearing**, not a mention. Four of its five API surfaces are used:

| Surface | Endpoint | How ZeroDay-Guard uses it | Cost |
|---|---|---|---|
| **Agent** | `POST agent.tinyfish.ai/v1/automation/run-sse` | Goal-driven browsing: navigates the target, dismisses modals, follows links, returns structured JSON validated against an `output_schema` | $0.016 / step |
| **Search** | `GET api.search.tinyfish.ai` | Discovers candidate advisory / PoC / release-note URLs for a target | **$0** |
| **Fetch** | `POST api.fetch.tinyfish.ai` | Renders JavaScript pages, extracts PDFs, pulls raw code blocks and diffs | **$0** |
| **Research** | `POST agent.tinyfish.ai/v1/automation/run-research` | Reasoning backend — source-backed synthesis when no OpenAI/Anthropic key is configured | **$0** |

*(Unit prices taken from the live `GET /v1/wallet` response on our own account.)*

### The agent call

```python
async with client.stream("POST", f"{BASE}/v1/automation/run-sse", json={
    "url": target_url,
    "goal": CRAWL_GOAL,
    "output_schema": CRAWL_OUTPUT_SCHEMA,   # guarantees typed fields
}) as response:
    async for line in response.aiter_lines():
        ...
```

### One integration detail worth documenting

TinyFish signals the event type **inside the JSON body** (`{"type": "COMPLETE", "result": {...}}`),
not as an SSE `event:` name. Parsing only the SSE event name silently discards every result and
makes a working agent look broken. `backend/app/services/tinyfish_agent.py` reads the body first
and only falls back to the SSE name.

### Graceful degradation — the agent is a bonus, not a dependency

The Agent API costs money per step and can be slow. Search + Fetch are free and always work, so
the scan **always completes with real live-web data**:

```
        ┌── Agent API ──────────────────┐   (time-boxed)
        │  drives a real cloud browser  │
        └──────────────┬────────────────┘
                       │  runs CONCURRENTLY with the fallback
        ┌──────────────┴────────────────┐
        │  Search  →  discover URLs      │
        │  Fetch   →  render + extract   │
        │  parse   →  CVSS / CWE /       │
        │             affected versions  │
        └──────────────┬────────────────┘
                       ▼
              full assessment
```

Three details that make the fallback a **first-class** path rather than a degraded one:

- **It runs concurrently with the agent.** The fallback is gathered in the background while the
  agent browses, so an agent timeout costs *no extra wall-clock time*. Total scan time is
  `max(agent, fetch)`, not `agent + fetch`.
- **It extracts vulnerability records, not just CVE IDs.** The raw advisory pages carry a CVSS
  score and severity, a CWE identifier, affected version ranges, a description and a verbatim
  evidence quote — all parsed out of the fetched markdown. Without this, an agent timeout
  silently produced a `0/100 "nothing found"` assessment even though the pages clearly
  described the vulnerability.
- **The agent path is capped by `AGENT_TIME_BUDGET`** (default 120 s). When the budget is
  exceeded we abandon the agent rather than stalling a live demo.

**A scan never returns empty.**

---

## 🧠 ML & AI layer

### CodeBERT (`microsoft/codebert-base`)

Loaded **lazily** — the service boots instantly and works without it.

CodeBERT is a masked language model, not a classifier, and we have no labelled CVE corpus to
fine-tune on. So we use it the way that is actually defensible: **embedding-similarity
classification**. Mean-pooled contextual embeddings of the snippet are compared, by cosine
similarity, against a curated set of *vulnerable* and *safe* exemplars:

```python
vuln_sim = max(cosine(embed(snippet), embed(e)) for e in VULNERABLE_EXEMPLARS)
safe_sim = max(cosine(embed(snippet), embed(e)) for e in SAFE_EXEMPLARS)
semantic_risk = clamp(0.5 + (vuln_sim - safe_sim) * 1.6)
```

The AST findings and the semantic signal are then fused:

```
risk_score = 0.78 × ast_score + 0.22 × (semantic_risk × 100)
```

> **Stated plainly, because it matters for the judging:** this is embedding similarity, *not* a
> fine-tuned classifier. The `engine` field in every response tells you which produced the score
> — `codebert+ast` or `ast`. The AST engine does the heavy lifting; CodeBERT is a second opinion.

### AST / pattern static analyser

The fallback is not a toy — it is real static analysis.

- **Python** is parsed with the stdlib `ast` module, so it understands structure: `eval`/`exec`
  sinks, `pickle.loads` and unsafe `yaml.load` deserialisation, `subprocess(..., shell=True)`,
  SQL built by string concatenation, `md5`/`sha1`, `random` used for tokens, `verify=False`,
  hardcoded credentials, `assert` used as validation, swallowed exceptions, `mktemp` races.
- **C / C++ / Java / JavaScript** use a curated pattern table: `strcpy`/`strcat`/`sprintf`/
  `gets` buffer overflows, `system()`, `eval`/`new Function`, `innerHTML`/`dangerouslySetInnerHTML`
  XSS, `child_process.exec`, `Runtime.getRuntime().exec`, `ObjectInputStream`, `Class.forName`,
  MD5/SHA-1, disabled TLS verification.

Every finding carries a **CWE identifier** and is mapped to one of six radar dimensions
(`code_injection`, `memory_safety`, `input_validation`, `crypto_weakness`, `auth_bypass`,
`data_exposure`).

### Reasoning engine chain

The narrative never hard-fails, because there is always a next engine:

```
OpenAI (GPT-4o)  ──▶  Anthropic (Claude)  ──▶  TinyFish Research  ──▶  deterministic template
```

The template is not a stub — it composes the executive summary from the harvested findings and
always produces a real remediation diff from the patch rulebook.

---

## 🩹 Patch generation

A **rulebook**, not a language model: each vulnerability class maps to a concrete before/after
unified diff with remediation steps.

| Detected | Generated fix |
|---|---|
| JNDI / Log4j | Upgrade to Log4j 2.17.1+ and set `log4j2.formatMsgNoLookups=true` |
| `pickle.loads` | Replace with `json.loads` (no code-execution semantics) |
| `yaml.load` | Switch to `yaml.safe_load` |
| `shell=True` | Argument list, `shell=False` |
| SQL concatenation | Parameter binding (`%s` + tuple) |
| `eval` / `exec` | `ast.literal_eval` or a dispatch table |
| `strcpy` / `sprintf` | `snprintf` with `sizeof` |
| `innerHTML` | `textContent` |
| MD5 / SHA-1 | SHA-256, and a slow KDF for passwords |
| `verify=False` | `verify=True` |
| Hardcoded secret | Environment variable + rotate the credential |
| `random` for tokens | `secrets.token_urlsafe(32)` |

If a real upstream diff was harvested from the advisory, **that vendor diff is preferred** and
shown as-is. If nothing matches, the tool says so rather than inventing a patch — an unverified
diff is worse than no diff.

---

## 🖥️ Architecture

```
┌──────────────┐   SSE (NDJSON-style frames)   ┌──────────────────────────┐
│  Next.js 15  │◀───────────────────────────────│  FastAPI (asyncio)       │
│  dashboard   │                                │                          │
│              │                                │  ┌────────────────────┐  │
│ • terminal   │                                │  │ TinyFishWebAgent   │  │
│ • risk radar │                                │  │  agent→search→fetch│  │
│ • patch diff │                                │  └────────────────────┘  │
└──────────────┘                                │  ┌────────────────────┐  │
                                                │  │ CodeBETAstScanner  │  │
                                                │  └────────────────────┘  │
                                                │  ┌────────────────────┐  │
                                                │  │ LLMOrchestrator    │  │
                                                │  └────────────────────┘  │
                                                └──────────────────────────┘
```

**Backend** — FastAPI, asyncio, Pydantic v2, Uvicorn, httpx.
**ML** — HuggingFace Transformers + PyTorch (`microsoft/codebert-base`), stdlib `ast`.
**Frontend** — Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide, Framer Motion.
**Agent** — TinyFish Python SDK / REST.

---

## 🚀 Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # then add your TinyFish key
python -m uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs>

> **Optional — enable the full CodeBERT engine** (downloads ~2.5 GB of torch):
> ```bash
> pip install -r requirements-ml.txt
> # smaller, CPU-only torch:
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
> Without it the service still works; `engine` simply reports `ast`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Point it at a different backend with `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

---

## 🔑 Configuration

| Variable | Default | Purpose |
|---|---|---|
| `TINYFISH_API_KEY` | `demo` | **Required for live scans.** `demo` serves simulated intelligence with no network calls |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o` | First choice for the narrative engine |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — / `claude-3-5-sonnet-latest` | Second choice |
| `ENABLE_CODEBERT` | `true` | Set `false` to skip the model download entirely |
| `CODEBERT_MODEL` | `microsoft/codebert-base` | Any HuggingFace encoder checkpoint |
| `AGENT_TIME_BUDGET` | `150` | Seconds before abandoning the agent path |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Comma-separated allowed origins |

Get a TinyFish key at <https://agent.tinyfish.ai/api-keys>.

> **Tip:** TinyFish runs a student program with wallet credit and office hours —
> see <https://www.tinyfish.ai/students>.

---

## 🔌 API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service status and effective config (no secrets) |
| `POST` | `/api/v1/scan` | Full scan → `{ assessment, events, elapsed_seconds }` |
| `GET` | `/api/v1/scan/stream?target_url=…` | **SSE** live agent trace + final assessment |
| `POST` | `/api/v1/scan/stream` | Same stream, POST body (for long URLs) |
| `GET` | `/api/v1/sample` | A ready-made target for a fast demo |

The dashboard uses `EventSource` against the SSE route, so the terminal animates in real time.

---

## 📁 Project structure

```
backend/
├── app/
│   ├── main.py                       # FastAPI app, CORS, SSE endpoints
│   ├── config.py                     # env loader (+ BOM-safe .env parser)
│   ├── models/schemas.py             # Pydantic v2 request/response schemas
│   └── services/
│       ├── tinyfish_agent.py         # Agent + Search + Fetch integration
│       ├── ml_evaluator.py           # CodeBERT embeddings + AST scanner
│       └── llm_orchestrator.py       # reasoning chain + patch rulebook
├── requirements.txt                  # core runtime
├── requirements-ml.txt               # optional torch + transformers
├── .env.example
└── smoke_test.py                     # end-to-end test against the live API
frontend/
├── src/app/{page,layout}.tsx         # dashboard
├── src/components/
│   ├── AgentTerminal.tsx             # live streaming terminal
│   ├── RiskCard.tsx                  # risk dial + SVG radar chart
│   └── PatchGenerator.tsx            # diff viewer
└── src/lib/types.ts                  # mirrors the Pydantic schemas
```

---

## ⚠️ Honest limitations

- **CodeBERT is embedding similarity, not a trained classifier.** The AST engine carries the
  analysis; CodeBERT is a second opinion. The `engine` field always tells you which ran.
- **The agent path costs money per step** and is bounded by a time budget. Search + Fetch are
  free and carry the scan when the agent is unavailable.
- **CWE coverage is a curated rule set**, not an exhaustive static analyser. It targets the
  high-signal classes (injection, deserialisation, buffer overflow, weak crypto, hardcoded
  secrets) and misses language-specific frameworks.
- **Exploit maturity is inferred** from the presence of public PoC code, not validated by
  executing anything. **This tool never executes the code it finds.** It reads and analyses.
- **Authorisation matters.** Only scan targets you are permitted to assess. It does not attempt
  exploitation, but automated browsing of a target is still traffic against that target.

---

## 💰 Cost & pricing

Live unit prices from the TinyFish wallet API:

| Surface | Unit price |
|---|---|
| Search | **$0** / request |
| Fetch | **$0** / URL |
| Research | **$0** / run |
| Agent | $0.016 / step |
| Browser | $0.002 / minute |

A typical scan is ~10 agent steps (~$0.16) plus free search/fetch. That underpins the pricing:
**$29/month** for an individual analyst, **$199/month** for a team with API access, **$0.40 per
scan** for API-only usage — a security consultant's hour is $100+.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

<sub>Built for KRITICAL HACKS '26 · TinyFish Agent + Search + Fetch + Research · CodeBERT + AST ·
FastAPI · Next.js</sub>
