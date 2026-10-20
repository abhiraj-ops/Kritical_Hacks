"use client";

import { FileText, Fingerprint, Route } from "lucide-react";

import Panel from "@/components/ui/Panel";
import type { Assessment } from "@/lib/types";
import { absoluteTime, shortenUrl } from "@/lib/format";

/** Signals are free-form; only flat scalars are worth showing in a table. */
function scalarSignals(signals: Record<string, unknown>): [string, string][] {
  return Object.entries(signals)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 10)
    .map(([key, value]) => [key.replace(/_/g, " "), String(value)]);
}

export default function ExecutiveSummary({ assessment }: { assessment: Assessment }) {
  const signals = scalarSignals(assessment.risk.signals ?? {});
  const traceLength = assessment.agent_trace?.length ?? 0;

  return (
    <Panel
      eyebrow="Written by the reasoning engine"
      title="Executive summary"
      icon={<FileText className="h-4 w-4 text-faint" />}
      bodyClassName="p-4"
    >
      <p className="max-w-3xl text-[13.5px] leading-[1.65] text-ink">
        {assessment.executive_summary}
      </p>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <dl className="space-y-1.5">
          <div className="flex items-start gap-2 text-[12px]">
            <dt className="flex w-[92px] shrink-0 items-center gap-1.5 text-muted">
              <Fingerprint className="h-3.5 w-3.5 text-faint" />
              Target
            </dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-ink-2" title={assessment.target}>
              {shortenUrl(assessment.target)}
            </dd>
          </div>
          <div className="flex items-start gap-2 text-[12px]">
            <dt className="flex w-[92px] shrink-0 items-center gap-1.5 text-muted">
              <Route className="h-3.5 w-3.5 text-faint" />
              Generated
            </dt>
            <dd className="min-w-0 flex-1 font-mono text-ink-2">
              {absoluteTime(assessment.generated_at)}
            </dd>
          </div>
        </dl>

        {signals.length > 0 && (
          <dl className="space-y-1.5">
            {signals.map(([label, value]) => (
              <div key={label} className="flex items-start gap-2 text-[12px]">
                <dt className="w-[92px] shrink-0 truncate capitalize text-muted">{label}</dt>
                <dd className="min-w-0 flex-1 break-words font-mono text-ink-2">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {traceLength > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-[11.5px] text-faint">
          {traceLength} step{traceLength === 1 ? "" : "s"} recorded in the agent trace. Open{" "}
          <span className="font-medium text-muted">Run log</span> for the full sequence.
        </p>
      )}
    </Panel>
  );
}
