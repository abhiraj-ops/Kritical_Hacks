"use client";

import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "critical" | "high" | "medium" | "low" | "positive";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2 border-line-strong",
  accent: "bg-accent-soft text-accent border-accent-line",
  critical: "bg-critical-bg text-critical-fg border-critical-line",
  high: "bg-high-bg text-high-fg border-high-line",
  medium: "bg-medium-bg text-medium-fg border-medium-line",
  low: "bg-low-bg text-low-fg border-low-line",
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function Badge({
  tone = "neutral",
  children,
  className = "",
  mono = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border px-1.5 py-[1px]",
        "text-2xs font-semibold uppercase tracking-[0.06em] leading-4",
        mono ? "font-mono tracking-normal" : "",
        TONES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
