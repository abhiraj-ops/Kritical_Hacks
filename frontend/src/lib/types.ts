/**
 * Types shared by the dashboard and the serverless pipeline.
 * Mirrors the Pydantic schemas in backend/app/models/schemas.py.
 */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type EventLevel = "info" | "success" | "warn" | "error" | "agent";
export type EventType = "stage" | "finding" | "progress" | "intel" | "complete" | "error";

export interface AgentEvent {
  type: EventType;
  step: string;
  message: string;
  level: EventLevel;
  timestamp: string;
  data?: Record<string, unknown> | null;
}

export interface Finding {
  title: string;
  severity: Severity;
  cwe: string | null;
  description: string;
  location: string | null;
  code_snippet: string | null;
  language: string | null;
  source_url: string | null;
  confidence: number;
  evidence: string | null;
}

export interface RiskScore {
  risk_score: number;
  severity_label: Severity;
  confidence: number;
  engine: string;
  factors: string[];
  vector: Record<string, number>;
  signals: Record<string, unknown>;
}

export interface PatchFix {
  title: string;
  description: string;
  diff: string;
  language: string;
  cwe: string | null;
  steps: string[];
  references: string[];
}

export interface RiskVector {
  attack_surface: number;
  exploit_maturity: number;
  patch_availability: number;
  code_injection: number;
  authentication_bypass: number;
  data_exposure: number;
}

export interface Assessment {
  executive_summary: string;
  vulnerability_breakdown: Finding[];
  risk_vector: RiskVector;
  patch: PatchFix | null;
  risk: RiskScore;
  target: string;
  generated_at: string;
  reasoning_engine: string;
  agent_trace: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  tier?: string;
  config: {
    app_name: string;
    version: string;
    demo_mode: boolean;
    tinyfish_configured: boolean;
    llm_provider: string;
    codebert_enabled: boolean;
    codebert_model: string;
  };
}

export const SEVERITY_STYLES: Record<
  Severity,
  { text: string; ring: string; bg: string; hex: string }
> = {
  CRITICAL: {
    text: "text-rose-300",
    ring: "stroke-rose-500",
    bg: "bg-rose-500/10 border-rose-500/40",
    hex: "#fb7185",
  },
  HIGH: {
    text: "text-orange-300",
    ring: "stroke-orange-500",
    bg: "bg-orange-500/10 border-orange-500/40",
    hex: "#fb923c",
  },
  MEDIUM: {
    text: "text-amber-300",
    ring: "stroke-amber-500",
    bg: "bg-amber-500/10 border-amber-500/40",
    hex: "#fbbf24",
  },
  LOW: {
    text: "text-sky-300",
    ring: "stroke-sky-500",
    bg: "bg-sky-500/10 border-sky-500/40",
    hex: "#38bdf8",
  },
  INFO: {
    text: "text-slate-300",
    ring: "stroke-slate-500",
    bg: "bg-slate-500/10 border-slate-500/40",
    hex: "#94a3b8",
  },
};
