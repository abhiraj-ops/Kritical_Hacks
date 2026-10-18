/**
 * Typed client for the EcoPulse Netlify Functions.
 * All data access goes through these helpers — no provider calls from the browser.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type HazardType = 'earthquake' | 'weather' | 'air_quality' | 'fire' | 'flood' | 'storm' | 'news';

export interface Alert {
  id: string;
  type: HazardType;
  severity: Severity;
  region: string;
  regionId: string;
  lat: number;
  lng: number;
  timestamp: string;
  source: string;
  sourceUrl: string | null;
  summary: string;
  metrics?: Record<string, number | string>;
  /** True for records produced by the TinyFish agent rather than a sensor feed. */
  aiGenerated?: boolean;
  /** Verbatim markdown excerpt extracted from the source page (agent results only). */
  excerpt?: string;
}

export interface SourceStatus {
  id: string;
  label: string;
  live: boolean;
  reason?: 'missing_key' | 'error' | 'timeout';
  message?: string;
  count: number;
}

export interface AlertsPayload {
  alerts: Alert[];
  meta: {
    status: 'ok' | 'degraded' | 'unavailable';
    fetchedAt: string;
    sources: SourceStatus[];
    stale: boolean;
    counts: Record<Severity, number>;
    total: number;
    tinyfishConfigured: boolean;
  };
}

export interface AgentStage {
  name: string;
  status: 'ok' | 'error';
  detail: string;
}

/** Agent findings use the exact same schema as sensor alerts so the UI can merge them. */
export interface AgentResult {
  id: string;
  type: HazardType;
  severity: Severity;
  region: string;
  regionId: string;
  lat: number;
  lng: number;
  timestamp: string;
  source: string;
  sourceUrl: string | null;
  summary: string;
  /** Verbatim markdown excerpt pulled from the page, when fetch succeeded. */
  excerpt?: string;
  /** True because severity/type were produced by our classifier, not a human. */
  aiGenerated: true;
}

export interface AgentPayload {
  ok: boolean;
  query?: string;
  stage?: string;
  error?: string;
  message?: string;
  stages: AgentStage[];
  results?: AgentResult[];
  fetchedPages?: number;
  timestamp?: string;
}

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function fetchAlerts(signal?: AbortSignal): Promise<AlertsPayload> {
  const res = await fetch(`${BASE}/alerts`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const msg = (detail as { message?: string })?.message ?? `Request failed with HTTP ${res.status}`;
    throw new ApiError(msg, res.status, detail);
  }
  return (await res.json()) as AlertsPayload;
}

export async function runAgent(
  body: { query?: string; region?: string; fetch?: boolean },
  signal?: AbortSignal,
): Promise<AgentPayload> {
  const res = await fetch(`${BASE}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await res.json().catch(() => ({}))) as AgentPayload;
  if (!res.ok) {
    throw new ApiError(payload.message ?? `Agent failed with HTTP ${res.status}`, res.status, payload);
  }
  return payload;
}