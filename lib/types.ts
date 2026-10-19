import type { Stance } from "./stance";

/** A single web source we pulled evidence out of. */
export interface Evidence {
  url: string;
  title: string | null;
  site: string;
  domain: string;
  authority: number;
  authorityLabel: string;
  stance: Stance;
  stanceScore: number;
  cueHits: string[];
  quotes: string[];
}

export type VerdictLabel = "VERIFIED" | "MISLEADING" | "DISPUTED" | "UNVERIFIED";

export interface Verdict {
  label: VerdictLabel;
  /** Signed consensus in [-1, 1]. Negative = the web contradicts the claim. */
  confidence: number;
  /** Human-facing 0–100 strength of the evidence, not the direction. */
  strength: number;
  summary: string;
  claim: string;
  sources: Evidence[];
  checkedAt: string;
  stats: {
    searched: number;
    found: number;
    fetched: number;
    failed: number;
    support: number;
    refute: number;
    unclear: number;
    highAuthority: number;
  };
}

/** NDJSON events streamed from POST /api/verify so the UI can animate stages. */
export type VerifyEvent =
  | { type: "stage"; stage: StageName; status: "start" | "done"; detail?: string; count?: number }
  | { type: "verdict"; verdict: Verdict; cached: boolean }
  | { type: "error"; message: string; hint?: string };

export type StageName = "search" | "fetch" | "extract" | "score";
