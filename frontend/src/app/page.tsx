"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldHalf,
  Radar,
  ScanSearch,
  Loader2,
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  Crosshair,
} from "lucide-react";

import AgentTerminal from "@/components/AgentTerminal";
import RiskCard from "@/components/RiskCard";
import PatchGenerator from "@/components/PatchGenerator";
import { SEVERITY_STYLES, type AgentEvent, type Assessment, type HealthResponse } from "@/lib/types";

// Default to the explicit IPv4 loopback: browsers resolve "localhost" to
// ::1 first on some systems, while uvicorn commonly binds 127.0.0.1 only —
// which makes the health check fail for no visible reason.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const SAMPLE_TARGET = "https://github.com/advisories?query=remote+code+execution";

export default function Dashboard() {
  const [target, setTarget] = useState(SAMPLE_TARGET);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [running, setRunning] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // --- backend health ------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setHealth(data as HealthResponse);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- cleanup --------------------------------------------------------
  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const startScan = useCallback(() => {
    const trimmed = target.trim();
    if (!trimmed) {
      setError("Enter a target URL to scan.");
      return;
    }

    sourceRef.current?.close();
    setEvents([]);
    setAssessment(null);
    setError(null);
    setRunning(true);

    const url = `${API_BASE}/api/v1/scan/stream?target_url=${encodeURIComponent(trimmed)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const push = (event: AgentEvent) =>
      setEvents((prev) => [...prev, event]);

    source.addEventListener("stage", (e) => {
      try {
        push(JSON.parse((e as MessageEvent).data) as AgentEvent);
      } catch {
        /* ignore malformed frame */
      }
    });

    source.addEventListener("progress", (e) => {
      try {
        push(JSON.parse((e as MessageEvent).data) as AgentEvent);
      } catch {
        /* ignore malformed frame */
      }
    });

    source.addEventListener("intel", (e) => {
      try {
        push(JSON.parse((e as MessageEvent).data) as AgentEvent);
      } catch {
        /* ignore malformed frame */
      }
    });

    source.addEventListener("complete", (e) => {
      let event: AgentEvent;
      try {
        event = JSON.parse((e as MessageEvent).data) as AgentEvent;
      } catch {
        setRunning(false);
        source.close();
        return;
      }
      push(event);
      const data = event.data ?? {};
      if (data.assessment) {
        setAssessment(data.assessment as Assessment);
        setRunning(false);
        source.close();
      }
      // NOTE: "complete" now only fires for the final assessment. The
      // intermediate intel event has its own "intel" type, so closing the
      // stream here cannot cut the assessment short.
    });

    source.addEventListener("error", (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as AgentEvent;
        push(event);
        setError(event.message);
      } catch {
        setError("Lost connection to the analysis backend.");
      }
      setRunning(false);
      source.close();
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        setRunning(false);
      }
    };
  }, [target]);

  const backendUp = health !== null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      {/* ---------------- Header ---------------- */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-emerald-400/80">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-400" />
            Autonomous Threat Assessment
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            ZeroDay<span className="text-emerald-400">-Guard</span>{" "}
            <span className="text-slate-500">AI</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            Crawls a target with the TinyFish web agent, extracts live exploit
            intelligence, scores it with CodeBERT + AST analysis, and generates
            a remediation patch.
          </p>
        </div>

        <div className="panel px-3 py-2 font-mono text-[10px]">
          {backendUp ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Wifi className="h-3 w-3" />
              backend online
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400">
              <WifiOff className="h-3 w-3" />
              backend offline
            </div>
          )}
          {health && (
            <div className="mt-1 space-y-0.5 text-slate-500">
              <div>
                llm: <span className="text-slate-300">{health.config.llm_provider}</span>
              </div>
              <div>
                ml:{" "}
                <span className="text-slate-300">
                  {health.config.codebert_enabled ? health.config.codebert_model : "ast only"}
                </span>
              </div>
              {health.config.demo_mode && (
                <div className="text-amber-500/80">demo mode — no live agent</div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ---------------- Target input ---------------- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startScan();
        }}
        className="panel mb-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2.5 focus-within:border-emerald-500/50">
          <Crosshair className="h-4 w-4 shrink-0 text-emerald-500/70" />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://github.com/advisories?query=remote+code+execution"
            className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>
        <button
          type="submit"
          disabled={running}
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning
            </>
          ) : (
            <>
              <ScanSearch className="h-4 w-4" />
              Initiate Scan
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---------------- Split screen ---------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <AgentTerminal events={events} running={running} target={target} />

          {/* Findings */}
          {assessment && assessment.vulnerability_breakdown.length > 0 && (
            <section className="panel overflow-hidden">
              <header className="panel-header">
                <span className="flex items-center gap-2">
                  <ShieldHalf className="h-3.5 w-3.5" />
                  Vulnerability Breakdown
                </span>
              </header>
              <ul className="divide-y divide-[var(--line)]">
                {assessment.vulnerability_breakdown.map((finding, i) => {
                  const style =
                    SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.INFO;
                  return (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-[13px] font-medium text-slate-200">
                          {finding.title}
                        </h4>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      {finding.cwe && (
                        <span className="mt-1 inline-block font-mono text-[10px] text-sky-400/80">
                          {finding.cwe}
                        </span>
                      )}
                      {finding.description && (
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">
                          {finding.description}
                        </p>
                      )}
                      {finding.evidence && (
                        <blockquote className="mt-2 border-l-2 border-emerald-500/40 bg-[var(--panel-2)] py-1.5 pl-2.5 pr-2 font-mono text-[11px] leading-relaxed text-slate-500">
                          {finding.evidence}
                        </blockquote>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {assessment ? (
            <>
              <RiskCard assessment={assessment} />

              {/* Executive summary */}
              <section className="panel p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
                  <Radar className="h-3 w-3" />
                  Executive Summary
                </h3>
                <p className="text-[13px] leading-relaxed text-slate-300">
                  {assessment.executive_summary}
                </p>
              </section>

              <PatchGenerator patch={assessment.patch} />
            </>
          ) : (
            <section className="panel flex min-h-[26rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <Cpu className="h-8 w-8 text-slate-800" />
              <p className="text-[13px] text-slate-500">
                {running
                  ? "Agent is working — the assessment will appear here."
                  : "No assessment yet. Enter a target and initiate a scan."}
              </p>
              {!running && (
                <p className="max-w-sm text-[11.5px] text-slate-600">
                  The pipeline crawls the target with TinyFish, extracts exploit
                  artefacts, scores them with CodeBERT + AST, then reasons over
                  the result to produce a patch.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="mt-10 border-t border-[var(--line)] pt-4 text-[11px] text-slate-600">
        ZeroDay-Guard AI · TinyFish web agent (Search + Fetch + Agent + Research) ·
        CodeBERT embeddings + AST static analysis · FastAPI + Next.js
      </footer>
    </main>
  );
}
