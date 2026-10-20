"use client";

import { Gauge, Cpu, ShieldAlert, CircleCheck } from "lucide-react";

import Panel from "@/components/ui/Panel";
import Meter from "@/components/ui/Meter";
import Badge from "@/components/ui/Badge";
import { severityToken } from "@/lib/types";
import type { Assessment } from "@/lib/types";
import { absoluteTime, relativeTime } from "@/lib/format";

/** The six dimensions the risk model reports, in the order the model emits them. */
const AXES: { key: keyof Assessment["risk_vector"]; label: string; hint: string }[] = [
  {
    key: "attack_surface",
    label: "Attack surface",
    hint: "How much of the product is reachable without authentication",
  },
  {
    key: "exploit_maturity",
    label: "Exploit maturity",
    hint: "Public proof-of-concept, weaponised tooling, in-the-wild use",
  },
  {
    key: "code_injection",
    label: "Code injection",
    hint: "Likelihood the flaw lets an attacker execute their own code",
  },
  {
    key: "authentication_bypass",
    label: "Authentication bypass",
    hint: "Ability to act as another user without credentials",
  },
  {
    key: "data_exposure",
    label: "Data exposure",
    hint: "Sensitivity of the data reachable through the flaw",
  },
  {
    key: "patch_availability",
    label: "Patch availability",
    hint: "Upstream fix diffs the agent located — it scores 34 for each diff it finds",
  },
];

/**
 * The score scale. Bands mirror the thresholds in the scoring engine:
 * below 40 is low observed risk, 40–69 needs remediation, 70+ is immediate.
 */
const BANDS = [
  { label: "Low", max: 40, color: "#9A9AA3" },
  { label: "Medium", max: 70, color: "#DC6803" },
  { label: "Critical", max: 100, color: "#D92D20" },
];

function bandColor(value: number): string {
  for (const band of BANDS) {
    if (value < band.max) return band.color;
  }
  return BANDS[BANDS.length - 1].color;
}

export default function RiskSummary({ assessment }: { assessment: Assessment }) {
  const { risk, risk_vector, reasoning_engine } = assessment;
  const token = severityToken(risk.severity_label);
  const confidence = Math.round(risk.confidence * 100);

  return (
    <Panel
      eyebrow="Model output"
      title="Risk assessment"
      icon={<Gauge className="h-4 w-4 text-faint" />}
      actions={
        <Badge tone="neutral" mono>
          <Cpu className="h-3 w-3" />
          {risk.engine}
        </Badge>
      }
      bodyClassName="p-4"
    >
      {/* Score ------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">
                {risk.risk_score}
              </span>
              <span className="font-mono text-[13px] leading-none text-faint">/100</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-[2px] text-[11px] font-semibold uppercase tracking-[0.06em]",
                  token.bg,
                  token.text,
                  token.border,
                ].join(" ")}
              >
                <ShieldAlert className="h-3 w-3" />
                {token.label}
              </span>
              <span className="text-[12px] text-muted">
                {assessment.vulnerability_breakdown.length} finding
                {assessment.vulnerability_breakdown.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <dl className="min-w-[176px] space-y-1.5 text-[12px]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Confidence</dt>
            <dd className="font-mono tabular-nums text-ink">{confidence}%</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Reasoner</dt>
            <dd className="truncate font-mono text-ink">{reasoning_engine}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Generated</dt>
            <dd className="font-mono text-ink" title={absoluteTime(assessment.generated_at)}>
              {relativeTime(assessment.generated_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Scale ------------------------------------------------------------ */}
      <div className="mt-4">
        <div className="relative h-[8px] w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-swift"
            style={{ width: `${Math.min(100, Math.max(0, risk.risk_score))}%`, backgroundColor: token.solid }}
          />
          {/* Threshold ticks */}
          {[40, 70].map((tick) => (
            <span
              key={tick}
              className="absolute top-0 h-full w-px bg-white/80"
              style={{ left: `${tick}%` }}
              aria-hidden
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10.5px] text-faint">
          {BANDS.map((band, index) => (
            <span key={band.label} className={index === 0 ? "" : "text-center"}>
              {band.label}
              <span className="ml-1 font-mono">
                {index === 0 ? "0–39" : index === 1 ? "40–69" : "70–100"}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Risk vector ------------------------------------------------------ */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[12.5px] font-semibold text-ink">Risk vector</h3>
          <span className="text-[11px] text-faint">six dimensions, 0–100 each</span>
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {AXES.map((axis) => {
            const value = risk_vector[axis.key] ?? 0;
            // Patch availability measures how much fix material was found,
            // not how much risk there is — so it is never severity-coloured.
            const isCoverage = axis.key === "patch_availability";
            return (
              <Meter
                key={axis.key}
                label={axis.label}
                hint={axis.hint}
                value={value}
                color={bandColor(value)}
                neutral={isCoverage}
              />
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
          Five dimensions score risk directly. Patch availability counts the upstream fix
          diffs the agent found — more diffs means a more precise patch, not more risk.
        </p>
      </div>

      {/* Drivers ---------------------------------------------------------- */}
      {risk.factors.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-ink">Risk drivers</h3>
          <ul className="space-y-1.5">
            {risk.factors.slice(0, 6).map((factor, index) => (
              <li key={index} className="flex gap-2 text-[12.5px] leading-5 text-ink-2">
                <CircleCheck className="mt-[3px] h-3.5 w-3.5 shrink-0 text-faint" />
                <span className="min-w-0 break-words">{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
