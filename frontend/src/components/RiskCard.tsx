"use client";

import { motion } from "framer-motion";
import { Activity, Brain, Gauge, ShieldAlert } from "lucide-react";
import { SEVERITY_STYLES, type Assessment } from "@/lib/types";

/** Radar axes — the six dimensions the risk model reports. */
const AXES: { key: keyof Assessment["risk_vector"]; label: string }[] = [
  { key: "attack_surface", label: "Attack Surface" },
  { key: "exploit_maturity", label: "Exploit Maturity" },
  { key: "code_injection", label: "Code Injection" },
  { key: "authentication_bypass", label: "Auth Bypass" },
  { key: "data_exposure", label: "Data Exposure" },
  { key: "patch_availability", label: "Patch Avail." },
];

function RadarChart({ vector }: { vector: Assessment["risk_vector"] }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 92;
  const count = AXES.length;

  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1].map((scale) =>
    AXES.map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      return `${cx + radius * scale * Math.cos(angle)},${cy + radius * scale * Math.sin(angle)}`;
    }).join(" "),
  );

  const shape = AXES.map((axis, i) => point(i, vector[axis.key] ?? 0).join(",")).join(" ");
  const shapeRef = AXES.map((axis, i) => point(i, vector[axis.key] ?? 0).join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-full w-full"
      role="img"
      aria-label="Risk radar chart"
    >
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.08" />
        </radialGradient>
      </defs>

      {rings.map((ringsPoints, i) => (
        <polygon
          key={i}
          points={ringsPoints}
          fill="none"
          stroke="#1c2534"
          strokeWidth="1"
        />
      ))}

      {AXES.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1c2534" strokeWidth="1" />;
      })}

      <motion.polygon
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        points={shapeRef}
        fill="url(#radarFill)"
        stroke="#34d399"
        strokeWidth="1.8"
      />

      {AXES.map((axis, i) => {
        const [x, y] = point(i, vector[axis.key] ?? 0);
        return <circle key={axis.key} cx={x} cy={y} r="2.6" fill="#34d399" />;
      })}

      {AXES.map((axis, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        const lx = cx + (radius + 26) * Math.cos(angle);
        const ly = cy + (radius + 22) * Math.sin(angle);
        const anchor =
          Math.abs(lx - cx) < 12 ? "middle" : lx > cx ? "start" : "end";
        return (
          <text
            key={axis.key}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-slate-500"
            style={{ fontSize: 9, letterSpacing: "0.04em" }}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function RiskCard({ assessment }: { assessment: Assessment }) {
  const { risk, risk_vector, vulnerability_breakdown, reasoning_engine } = assessment;
  const style = SEVERITY_STYLES[risk.severity_label] ?? SEVERITY_STYLES.INFO;
  const circumference = 2 * Math.PI * 46;

  const counts = vulnerability_breakdown.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="panel overflow-hidden">
      <header className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          ML Risk Assessment
        </span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal text-slate-500">
          <Brain className="h-3 w-3" />
          {risk.engine}
        </span>
      </header>

      <div className="p-4">
        {/* Score dial */}
        <div className="flex items-center gap-4">
          <div className="relative h-[108px] w-[108px] shrink-0">
            <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
              <circle
                cx="54"
                cy="54"
                r="46"
                fill="none"
                stroke="#1c2534"
                strokeWidth="8"
              />
              <motion.circle
                cx="54"
                cy="54"
                r="46"
                fill="none"
                stroke={style.hex}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{
                  strokeDashoffset: circumference * (1 - risk.risk_score / 100),
                }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {risk.risk_score}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-slate-500">
                / 100
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}
            >
              <ShieldAlert className="h-3 w-3" />
              {risk.severity_label}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Confidence{" "}
              <span className="font-mono text-slate-300">
                {Math.round(risk.confidence * 100)}%
              </span>{" "}
              · Reasoning engine{" "}
              <span className="font-mono text-slate-300">{reasoning_engine}</span>
            </p>
            {Object.keys(counts).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(counts).map(([sev, count]) => {
                  const s =
                    SEVERITY_STYLES[sev as keyof typeof SEVERITY_STYLES] ??
                    SEVERITY_STYLES.INFO;
                  return (
                    <span
                      key={sev}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${s.bg} ${s.text}`}
                    >
                      {count} {sev.toLowerCase()}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Radar */}
        <div className="mt-4 h-[260px] w-full">
          <RadarChart vector={risk_vector} />
        </div>

        {/* Factors */}
        {risk.factors.length > 0 && (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
              <Gauge className="h-3 w-3" />
              Risk drivers
            </h4>
            <ul className="space-y-1">
              {risk.factors.slice(0, 6).map((factor, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-slate-400">
                  <span className="text-emerald-500/70">▸</span>
                  <span className="min-w-0 break-words">{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
