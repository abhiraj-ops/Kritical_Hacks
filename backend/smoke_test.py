"""End-to-end smoke test for the ZeroDay-Guard AI backend.

Exercises the real SSE pipeline against the live TinyFish API and prints the
agent trace plus the final assessment. Run from the backend/ directory:

    python smoke_test.py "https://example.com/target"
"""

from __future__ import annotations

import json
import sys
import time

import httpx

BASE = "http://127.0.0.1:8000"
TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://github.com/advisories?query=remote+code+execution"


def hr(title: str) -> None:
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def main() -> int:
    hr("HEALTH")
    with httpx.Client(timeout=30) as client:
        health = client.get(f"{BASE}/api/v1/health").json()
        print(json.dumps(health, indent=2))

        hr("SSE SCAN STREAM")
        started = time.time()
        assessment = None
        event_count = 0

        with client.stream(
            "GET",
            f"{BASE}/api/v1/scan/stream",
            params={"target_url": TARGET},
            timeout=900.0,
        ) as response:
            print(f"HTTP {response.status_code}  content-type={response.headers.get('content-type')}")
            event_name = "message"
            for line in response.iter_lines():
                line = line.strip()
                if not line:
                    continue
                if line.startswith("event:"):
                    event_name = line[6:].strip()
                    continue
                if not line.startswith("data:"):
                    continue
                payload = json.loads(line[5:].strip())
                event_count += 1
                level = payload.get("level", "info")
                mark = {"success": "+", "warn": "!", "error": "x", "agent": ">", "info": "-"}.get(level, "-")
                print(f"  [{mark}] {payload.get('step',''):<10} {payload.get('message','')}")
                if event_name == "complete" and payload.get("data", {}).get("assessment"):
                    assessment = payload["data"]["assessment"]

        print(f"\n  events: {event_count}   elapsed: {time.time() - started:.1f}s")

        if not assessment:
            print("\n  !! NO ASSESSMENT PRODUCED")
            return 1

        hr("ASSESSMENT")
        risk = assessment["risk"]
        print(f"  target            : {assessment['target']}")
        print(f"  risk score        : {risk['risk_score']}/100  ({risk['severity_label']})")
        print(f"  confidence        : {risk['confidence']}")
        print(f"  engine            : {risk['engine']}")
        print(f"  reasoning engine  : {assessment['reasoning_engine']}")
        print(f"  findings          : {len(assessment['vulnerability_breakdown'])}")
        print(f"  risk vector       : {assessment['risk_vector']}")

        hr("EXECUTIVE SUMMARY")
        print(" ", assessment["executive_summary"])

        hr("VULNERABILITY BREAKDOWN")
        for i, f in enumerate(assessment["vulnerability_breakdown"], 1):
            print(f"  {i}. [{f['severity']}] {f['title']}  ({f.get('cwe') or 'n/a'})")
            if f.get("description"):
                print(f"     {f['description'][:180]}")
            if f.get("evidence"):
                print(f"     evidence: {f['evidence'][:160]}")

        hr("PATCH")
        patch = assessment.get("patch")
        if patch:
            print(f"  title  : {patch['title']}")
            print(f"  cwe    : {patch.get('cwe')}")
            print(f"  lang   : {patch['language']}")
            if patch.get("diff"):
                print("  --- diff ---")
                for dline in patch["diff"].splitlines():
                    print("   ", dline)
            for step in patch.get("steps", []):
                print(f"   - {step}")
        else:
            print("  (none)")

        hr("AGENT TRACE")
        for line in assessment.get("agent_trace", [])[:25]:
            print("  ", line)

    print("\nSMOKE TEST PASSED\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
