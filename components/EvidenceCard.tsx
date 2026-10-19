"use client";

import type { Evidence } from "@/lib/types";

const STANCE_STYLE = {
  support: { label: "Supports", classes: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" },
  refute: { label: "Contradicts", classes: "border-rose-500/40 text-rose-300 bg-rose-500/10" },
  unclear: { label: "Inconclusive", classes: "border-slate-500/40 text-slate-300 bg-slate-500/10" },
} as const;

/** Authority weight → a 0–100 bar, so the weighting model is visible, not hidden. */
function AuthorityBar({ weight, label }: { weight: number; label: string }) {
  return (
    <div className="flex items-center gap-2" title={`Authority weight ${weight.toFixed(2)} — ${label}`}>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--panel-2)]">
        <div
          className="h-full rounded-full bg-teal-400/70"
          style={{ width: `${Math.round(weight * 100)}%` }}
        />
      </div>
      <span className="text-[11px] text-[var(--muted)]">
        {label} · {weight.toFixed(2)}
      </span>
    </div>
  );
}

export default function EvidenceCard({ source, index }: { source: Evidence; index: number }) {
  const stance = STANCE_STYLE[source.stance];

  return (
    <article className="panel animate-fade-up flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--muted)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="truncate text-sm font-medium">{source.title ?? source.domain}</h3>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-[12px] text-teal-300/80 underline-offset-2 hover:underline"
          >
            {source.domain}
          </a>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${stance.classes}`}
        >
          {stance.label}
        </span>
      </header>

      <AuthorityBar weight={source.authority} label={source.authorityLabel} />

      {source.quotes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {source.quotes.slice(0, 3).map((quote, i) => (
            <blockquote
              key={i}
              className="evidence bg-[var(--panel-2)] py-2 pl-3 pr-2 text-[13px] leading-relaxed text-[var(--ink)]"
            >
              “{quote}”
            </blockquote>
          ))}
        </div>
      ) : (
        <p className="text-[12px] italic text-[var(--muted)]">
          Page fetched, but no passage matched this claim closely enough to quote.
        </p>
      )}

      {source.cueHits.length > 0 && (
        <footer className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <span>Signals:</span>
          {source.cueHits.slice(0, 5).map((cue) => (
            <code
              key={cue}
              className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[10px]"
            >
              {cue}
            </code>
          ))}
        </footer>
      )}
    </article>
  );
}
