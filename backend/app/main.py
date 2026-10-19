"""ZeroDay-Guard AI — FastAPI application.

Endpoints
---------
``GET  /api/v1/health``      — service and configuration status
``POST /api/v1/scan``        — full scan, returns the complete assessment
``GET  /api/v1/scan/stream`` — Server-Sent Events: live agent trace + assessment
``POST /api/v1/scan/stream`` — same stream, but POST (handy for long URLs)
``GET  /api/v1/sample``      — a ready-made target for a fast demo
"""

from __future__ import annotations

import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.models.schemas import (
    AgentEvent,
    Assessment,
    EventLevel,
    HealthResponse,
    ScanRequest,
    ScanResponse,
)
from app.services.llm_orchestrator import LLMOrchestrator
from app.services.ml_evaluator import CodeBETAstScanner
from app.services.tinyfish_agent import TinyFishWebAgent

settings = get_settings()

# Module-level singletons — the model load and HTTP pool should be reused.
tinyfish_agent = TinyFishWebAgent(settings)
ml_scanner = CodeBETAstScanner(settings)
orchestrator = LLMOrchestrator(settings)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Warm up services and release connections on shutdown."""
    # Pre-load CodeBERT in the background so the first scan isn't slow.
    if settings.ENABLE_CODEBERT:
        asyncio.create_task(asyncio.to_thread(_warm_ml))
    yield
    await tinyfish_agent.aclose()


def _warm_ml() -> None:
    try:
        ml_scanner._ensure_codebert()  # noqa: SLF001 - intentional warm-up
    except Exception:
        pass


app = FastAPI(
    title="ZeroDay-Guard AI",
    description=(
        "Autonomous cybersecurity threat assessor: crawls a target with the TinyFish web "
        "agent, extracts exploit intelligence, scores it with CodeBERT + AST analysis and "
        "produces a full security assessment with a remediation patch."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------
def sse(event: AgentEvent) -> str:
    """Format one AgentEvent as a Server-Sent Event frame."""
    payload = event.model_dump(mode="json")
    return f"event: {event.type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _run_pipeline(
    target_url: str,
    cve_id: str | None = None,
    focus: str | None = None,
) -> AsyncIterator[AgentEvent]:
    """Shared pipeline for both the streaming and non-streaming endpoints.

    Emits the full agent trace, then the final assessment.
    """
    started = time.perf_counter()
    trace: list[str] = []

    async for event in tinyfish_agent.stream_crawl(target_url, cve_id=cve_id, focus=focus):
        trace.append(event.message)
        yield event
        if event.type == "complete" and event.data:
            intel_payload = event.data.get("intel", {})

            # --- ML stage -------------------------------------------------
            yield AgentEvent(
                type="stage", step="ml", level=EventLevel.agent,
                message="Running CodeBERT embeddings + AST static analysis…",
            )
            code_blocks = intel_payload.get("code_blocks", [])
            ml_result = await asyncio.to_thread(ml_scanner.analyze_many, code_blocks)
            yield AgentEvent(
                type="stage", step="ml", level=EventLevel.success,
                message=(
                    f"Static analysis complete — risk {ml_result.get('risk_score', 0)}/100 "
                    f"({ml_result.get('severity_label')}), engine={ml_result.get('engine')}."
                ),
                data={"ml": ml_result},
            )

            # --- Reasoning stage -----------------------------------------
            yield AgentEvent(
                type="stage", step="reason", level=EventLevel.agent,
                message=f"Synthesising assessment with the {orchestrator.engine_name} engine…",
            )
            from app.services.tinyfish_agent import ExploitIntel  # local import avoids a cycle

            intel = ExploitIntel(
                target_url=intel_payload.get("target_url", target_url),
                summary=intel_payload.get("summary", ""),
                cve_ids=list(intel_payload.get("cve_ids", [])),
                vulnerabilities=list(intel_payload.get("vulnerabilities", [])),
                code_blocks=list(code_blocks),
                patch_diffs=list(intel_payload.get("patch_diffs", [])),
                reproduction_steps=list(intel_payload.get("reproduction_steps", [])),
                references=list(intel_payload.get("references", [])),
                sources_searched=int(intel_payload.get("sources_searched", 0)),
                pages_fetched=int(intel_payload.get("pages_fetched", 0)),
                engine=intel_payload.get("engine", "tinyfish-agent"),
            )

            assessment: Assessment = await orchestrator.generate_assessment(
                intel, ml_result, agent_trace=trace
            )
            yield AgentEvent(
                type="complete", step="complete", level=EventLevel.success,
                message=(
                    f"Assessment ready in {time.perf_counter() - started:.1f}s — "
                    f"{assessment.risk.risk_score}/100 ({assessment.risk.severity_label.value})."
                ),
                data={
                    "assessment": assessment.model_dump(mode="json"),
                    "elapsed": round(time.perf_counter() - started, 2),
                },
            )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/v1/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Service health and effective configuration (no secrets)."""
    return HealthResponse(
        status="ok",
        service=settings.APP_NAME,
        version=settings.VERSION,
        config=settings.redacted(),
    )


@app.get("/api/v1/sample")
async def sample() -> dict[str, Any]:
    """A target that reliably produces an interesting assessment."""
    return {
        "target_url": "https://github.com/advisories?query=remote+code+execution",
        "note": "A live advisory index — good for a first end-to-end demo.",
    }


@app.post("/api/v1/scan", response_model=ScanResponse)
async def scan(request: ScanRequest) -> ScanResponse:
    """Run a complete scan and return the assessment in one response."""
    started = time.perf_counter()
    events: list[AgentEvent] = []
    assessment: Assessment | None = None

    async for event in _run_pipeline(request.target_url, request.cve_id, request.focus):
        events.append(event)
        if event.type == "complete" and event.data and "assessment" in event.data:
            assessment = Assessment.model_validate(event.data["assessment"])

    if assessment is None:
        raise HTTPException(
            status_code=502,
            detail="The scan pipeline did not produce an assessment. Check the agent trace.",
        )

    return ScanResponse(
        assessment=assessment,
        events=events,
        elapsed_seconds=round(time.perf_counter() - started, 2),
    )


@app.get("/api/v1/scan/stream")
async def scan_stream(
    target_url: str = Query(..., min_length=3, max_length=2048),
    cve_id: str | None = Query(default=None, max_length=64),
    focus: str | None = Query(default=None, max_length=256),
) -> StreamingResponse:
    """Stream a live scan over Server-Sent Events.

    The browser's native ``EventSource`` only issues GET requests, so this is
    the endpoint the dashboard's live terminal connects to.
    """
    normalised = target_url.strip()
    if "://" not in normalised:
        normalised = f"https://{normalised}"

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for event in _run_pipeline(normalised, cve_id, focus):
                yield sse(event)
        except Exception as exc:  # keep the stream alive with a terminal error frame
            yield sse(
                AgentEvent(
                    type="error", step="error", level=EventLevel.error,
                    message=f"{type(exc).__name__}: {exc}",
                )
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/scan/stream")
async def scan_stream_post(request: ScanRequest) -> StreamingResponse:
    """POST variant of the SSE stream, for targets too long for a query string."""

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for event in _run_pipeline(request.target_url, request.cve_id, request.focus):
                yield sse(event)
        except Exception as exc:
            yield sse(
                AgentEvent(
                    type="error", step="error", level=EventLevel.error,
                    message=f"{type(exc).__name__}: {exc}",
                )
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "endpoints": [
            "GET  /api/v1/health",
            "POST /api/v1/scan",
            "GET  /api/v1/scan/stream?target_url=...",
            "POST /api/v1/scan/stream",
        ],
    }
