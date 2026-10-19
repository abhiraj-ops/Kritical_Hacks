"use client";

import type { Verdict, VerdictLabel } from "@/lib/types";

const LABEL_STYLE: Record<VerdictLabel, { text: string; sub: string; classes: string; dot: string }> = {
  VERIFIED: {
    text: "Supported",
    sub: "the evidence backs this claim",
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  MISLEADING: {
    text: "Misleading",
    sub: "the evidence contradicts this claim",
    classes: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
  },
  DISPUTED: {
    text: "Disputed",
    sub: "credible sources disagree",
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  UNVERIFIED: {
    text: "Unverified",
    sub: "not enough quality evidence",
    classes: "border-slate-500/40 bg-slate-500/10 text-slate-300",
    dot: "bg-slate-400",
  },
};

/** Signed consensus in [-1, 1] → position on a left(refutes)/right(supports) bar. */
function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.max(-1, Math.min(1, confidence));
  const left = pct >= 0 ? 50 : 50 + pct * 50;
  const width = Math.abs(pct) * 50;

  return (
    <div className="mt-3">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--panel-2)]">
        <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--line)]" />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: pct >= 0 ? "#34d399" : "#fb7185",
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--muted)]">
        <span>contradicts</span>
        <span className="font-mono tabular-nums">
          consensus {confidence > 0 ? "+" : ""}
          {confidence.toFixed(2)}
        </span>
        <span>supports</span>
      </div>
    </div>
  );
}

export default function VerdictCard({ verdict, cached }: { verdict: Verdict; cached: boolean }) {
  const style = LABEL_STYLE[verdict.label];
  const s = verdict.stats;

  return (
    <section className={`panel animate-fade-up border ${style.classes} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{style.text}</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{style.sub}</p>
        </div>

        <div className="text-right">
          <div className="font-mono text-2xl font-semibold tabular-nums">{verdict.strength}%</div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
            evidence strength
          </div>
        </div>
      </div>

      <ConfidenceBar confidence={verdict.confidence} />

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--ink)]">{verdict.summary}</p>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[var(--muted)]">
        <div className="flex gap-1.5">
          <dt>Sources:</dt>
          <dd className="font-mono tabular-nums text-[var(--ink)]">{s.fetched}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Supporting:</dt>
          <dd className="font-mono tabular-nums text-emerald-300">{s.support}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Contradicting:</dt>
          <dd className="font-mono tabular-nums text-rose-300">{s.refute}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Inconclusive:</dt>
          <dd className="font-mono tabular-nums">{s.unclear}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>High-authority:</dt>
          <dd className="font-mono tabular-nums">{s.highAuthority}</dd>
        </div>
        {cached && (
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-wider">
            cached
          </span>
        )}
      </dl>
    </section>
  );
}
