"use client";

import { useCallback, useRef, useState } from "react";
import SampleChips from "@/components/SampleChips";
import PipelineStages, { emptyStages } from "@/components/PipelineStages";
import type { StageState } from "@/components/PipelineStages";
import VerdictCard from "@/components/VerdictCard";
import EvidenceCard from "@/components/EvidenceCard";
import DeepReport from "@/components/DeepReport";
import type { StageName, Verdict, VerifyEvent } from "@/lib/types";

type Phase = "idle" | "running" | "done";
type DeepStatus = "idle" | "running" | "done" | "error";

interface DeepState {
  status: DeepStatus;
  message?: string;
  report?: string;
  citations?: string[];
  error?: string;
  hint?: string;
  runId?: string;
}

const DEEP_IDLE: DeepState = { status: "idle" };

/** Read an NDJSON stream, invoking `onEvent` for each line. */
async function readNdjson(res: Response, onEvent: (line: string) => void) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error("Empty response from server.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) onEvent(trimmed);
    }
  }
}

export default function Home() {
  const [claim, setClaim] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stages, setStages] = useState<Record<StageName, StageState>>(emptyStages);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deep, setDeep] = useState<DeepState>(DEEP_IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const verify = useCallback(
    async (rawClaim?: string) => {
      const text = (rawClaim ?? claim).trim();
      if (text.length < 8) {
        setError("Enter a fuller claim to verify — a short sentence works best.");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setClaim(text);
      setPhase("running");
      setVerdict(null);
      setCached(false);
      setError(null);
      setDeep(DEEP_IDLE);
      setStages(emptyStages());

      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim: text }),
          signal: controller.signal,
        });

        await readNdjson(res, (line) => {
          let event: VerifyEvent;
          try {
            event = JSON.parse(line) as VerifyEvent;
          } catch {
            return;
          }

          if (event.type === "stage") {
            setStages((prev) => ({
              ...prev,
              [event.stage]: {
                status: event.status === "start" ? "start" : "done",
                detail: event.detail,
                count: event.count,
              },
            }));
          } else if (event.type === "verdict") {
            setVerdict(event.verdict);
            setCached(event.cached);
          } else if (event.type === "error") {
            setError(event.hint ? `${event.message} ${event.hint}` : event.message);
          }
        });

        setPhase("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Verification failed.");
        setPhase("done");
      }
    },
    [claim],
  );

  const runDeepDive = useCallback(async () => {
    if (!claim) return;
    setDeep({ status: "running", message: "Starting…" });

    try {
      const res = await fetch("/api/deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim, runId: deep.runId }),
      });

      await readNdjson(res, (line) => {
        let event: {
          type: DeepStatus extends never ? never : string;
          event?: string;
          runId?: string;
          replayed?: boolean;
          message?: string;
          report?: string;
          citations?: string[];
          hint?: string;
        };
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === "meta") {
          setDeep((d) => ({
            ...d,
            status: "running",
            message: event.replayed ? "Replaying cached report…" : event.message ?? "Researching…",
            runId: event.runId ?? d.runId,
          }));
        } else if (event.type === "progress") {
          const label =
            event.event === "plan_updated"
              ? "Planning sub-questions…"
              : event.event === "sources_searched"
                ? "Searching sources…"
                : event.event === "source_fetched"
                  ? "Reading sources…"
                  : event.event === "partial_summary"
                    ? "Synthesising…"
                    : "Working…";
          setDeep((d) => ({ ...d, status: "running", message: label }));
        } else if (event.type === "report") {
          setDeep((d) => ({
            ...d,
            status: "done",
            report: event.report,
            citations: event.citations ?? [],
          }));
        } else if (event.type === "error") {
          setDeep((d) => ({
            ...d,
            status: "error",
            error: event.message ?? "Deep research failed.",
            hint: event.hint,
          }));
        }
      });

      setDeep((d) => (d.status === "running" ? { ...d, status: "done", report: d.report ?? "" } : d));
    } catch (err) {
      setDeep((d) => ({
        ...d,
        status: "error",
        error: err instanceof Error ? err.message : "Deep research failed.",
      }));
    }
  }, [claim, deep.runId]);

  const busy = phase === "running";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          Live web verification
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Claim<span className="text-teal-300">Check</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          Paste a claim. Get a verdict in seconds — with the exact sentences that prove it,{" "}
          <span className="text-[var(--ink)]">quoted word-for-word</span> from live pages. The
          evidence is extracted, never generated, so it can’t hallucinate its sources.
        </p>
      </header>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="panel p-4 sm:p-5"
      >
        <label htmlFor="claim" className="mb-2 block text-[12px] uppercase tracking-wider text-[var(--muted)]">
          Claim to verify
        </label>
        <textarea
          id="claim"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void verify();
          }}
          rows={3}
          placeholder="e.g. Drinking papaya leaf juice cures dengue completely in 24 hours"
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)]/60 focus:border-teal-500/50"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--muted)]">
            ⌘/Ctrl + Enter to verify · {claim.length}/500
          </span>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-teal-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify claim"}
          </button>
        </div>
      </form>

      {/* Sample claims */}
      <div className="mt-4">
        <SampleChips onPick={(c) => void verify(c)} />
      </div>

      {error && (
        <div className="panel animate-fade-up mt-6 border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Pipeline */}
      {(busy || verdict) && (
        <div className="mt-8">
          <PipelineStages stages={stages} running={busy} />
        </div>
      )}

      {/* Verdict */}
      {verdict && (
        <div className="mt-8 flex flex-col gap-8">
          <VerdictCard verdict={verdict} cached={cached} />

          {verdict.sources.length > 0 && (
            <section>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Evidence panel</h2>
                <p className="text-[12px] text-[var(--muted)]">
                  Every quote below is an exact substring of the linked page — Ctrl+F to check.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {verdict.sources.map((source, i) => (
                  <EvidenceCard key={source.url} source={source} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Deep Dive — optional, uses the Research API */}
          <section>
            {deep.status === "idle" && (
              <button
                type="button"
                onClick={() => void runDeepDive()}
                className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
              >
                🔬 Run deep research report
              </button>
            )}
            <DeepReport {...deep} />
          </section>
        </div>
      )}

      <footer className="mt-16 border-t border-[var(--line)] pt-6 text-[12px] leading-relaxed text-[var(--muted)]">
        <p>
          Core verdict runs on <strong className="text-[var(--ink)]">TinyFish Search + Fetch</strong>{" "}
          (free tier: 12k searches + 1k fetches/day). Optional deep reports use{" "}
          <strong className="text-[var(--ink)]">TinyFish Research</strong>.
        </p>
        <p className="mt-2">
          Scoring: <code className="font-mono">confidence = Σ(authority × stance) / Σ(authority)</code>{" "}
          — source weights and cue words are published in the repo, not hidden in a black box.
        </p>
      </footer>
    </main>
  );
}
