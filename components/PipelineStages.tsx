"use client";

import type { StageName } from "@/lib/types";

export interface StageState {
  status: "idle" | "start" | "done";
  detail?: string;
  count?: number;
}

export const STAGE_ORDER: StageName[] = ["search", "fetch", "extract", "score"];

const STAGE_META: Record<StageName, { label: string; api: string }> = {
  search: { label: "Searching the live web", api: "TinyFish Search" },
  fetch: { label: "Fetching source pages", api: "TinyFish Fetch" },
  extract: { label: "Extracting verbatim evidence", api: "Highlights" },
  score: { label: "Scoring consensus", api: "authority × stance" },
};

export function emptyStages(): Record<StageName, StageState> {
  return {
    search: { status: "idle" },
    fetch: { status: "idle" },
    extract: { status: "idle" },
    score: { status: "idle" },
  };
}

export default function PipelineStages({
  stages,
  running,
}: {
  stages: Record<StageName, StageState>;
  running: boolean;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {STAGE_ORDER.map((name) => {
        const meta = STAGE_META[name];
        const state = stages[name];
        const active = state.status === "start";
        const done = state.status === "done";

        return (
          <li
            key={name}
            className={`panel relative flex flex-col gap-1 p-3 transition-colors ${
              active
                ? "border-teal-500/50"
                : done
                  ? "border-emerald-500/25"
                  : running
                    ? "opacity-40"
                    : "opacity-40"
            }`}
          >
            {active && <span className="shimmer absolute inset-0 rounded-2xl" aria-hidden />}
            <div className="relative flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  active
                    ? "animate-pulse-soft bg-teal-400"
                    : done
                      ? "bg-emerald-400"
                      : "bg-[var(--line)]"
                }`}
                aria-hidden
              />
              <span className="text-[13px] font-medium">{meta.label}</span>
            </div>
            <p className="relative pl-4 text-[11px] text-[var(--muted)]">
              {state.detail ?? meta.api}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
