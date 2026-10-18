/**
 * Shared types + helpers for EcoPulse AI Netlify Functions.
 *
 * Every upstream source (USGS, Open-Meteo, GDACS, OpenAQ, NASA FIRMS, TinyFish)
 * is normalized into ONE schema so the client never has to know which
 * provider produced a record.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type HazardType = 'earthquake' | 'weather' | 'air_quality' | 'fire' | 'flood' | 'storm' | 'news';

export interface NormalizedAlert {
  id: string;
  type: HazardType;
  severity: Severity;
  region: string;
  regionId: string;
  lat: number;
  lng: number;
  timestamp: string; // ISO 8601
  source: string;
  sourceUrl: string | null;
  summary: string;
  /** Extra UI-facing numbers, e.g. magnitude, aqi, temperature. */
  metrics?: Record<string, number | string>;
}

export interface AlertsResponse {
  alerts: NormalizedAlert[];
  meta: {
    /** Overall fetch outcome. "degraded" means at least one source failed. */
    status: 'ok' | 'degraded' | 'unavailable';
    fetchedAt: string;
    /** Per-source detail so the UI can show honest provenance. */
    sources: SourceStatus[];
    /** True when the payload is being served from a stale cache. */
    stale: boolean;
    counts: Record<Severity, number>;
    total: number;
    /** Whether TINYFISH_API_KEY is configured on this deployment. */
    tinyfishConfigured: boolean;
  };
}

export interface SourceStatus {
  id: string;
  label: string;
  live: boolean;
  /** Present when live === false. */
  reason?: 'missing_key' | 'error' | 'timeout';
  message?: string;
  count: number;
}

/** Canonical region buckets used for the region chips. */
export const REGIONS = {
  global: { id: 'global', label: 'Global', lat: 20, lng: 78, zoom: 4 },
  delhi: { id: 'delhi', label: 'Delhi-NCR', lat: 28.6139, lng: 77.209, zoom: 10 },
  mumbai: { id: 'mumbai', label: 'Mumbai', lat: 19.076, lng: 72.8777, zoom: 10 },
  chennai: { id: 'chennai', label: 'Chennai', lat: 13.0827, lng: 80.2707, zoom: 10 },
} as const;

export type RegionId = keyof typeof REGIONS;

const REGION_MATCHERS: Array<{ id: RegionId; keywords: string[] }> = [
  { id: 'delhi', keywords: ['delhi', 'ncr', 'noida', 'ghaziabad', 'gurgaon', 'gurugram', 'faridabad', 'anand vihar', 'uttar pradesh', 'haryana'] },
  { id: 'mumbai', keywords: ['mumbai', 'bombay', 'maharashtra', 'thane', 'pune', 'versova', 'kurla', 'suburban'] },
  { id: 'chennai', keywords: ['chennai', 'tamil nadu', 'madras', 'coimbatore'] },
];

/** Map a free-text place name to one of our region buckets. */
export function resolveRegion(place: string | null | undefined): { regionId: string; region: string } {
  const p = (place ?? '').toLowerCase();
  for (const m of REGION_MATCHERS) {
    if (m.keywords.some((k) => p.includes(k))) {
      return { regionId: m.id, region: REGIONS[m.id].label };
    }
  }
  return { regionId: 'global', region: 'Global' };
}

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical'];

export function bumpSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/** USGS magnitude -> severity. */
export function severityFromMagnitude(mag: number): Severity {
  if (mag >= 6) return 'critical';
  if (mag >= 4.5) return 'high';
  if (mag >= 2.5) return 'medium';
  return 'low';
}

/** US AQI band -> severity. */
export function severityFromAqi(aqi: number): Severity {
  if (aqi >= 300) return 'critical';
  if (aqi >= 200) return 'high';
  if (aqi >= 100) return 'medium';
  return 'low';
}

/** GDACS alert level -> severity. */
export function severityFromAlertLevel(level: string | null): Severity {
  switch ((level ?? '').toLowerCase()) {
    case 'red':
      return 'critical';
    case 'orange':
      return 'high';
    case 'yellow':
      return 'medium';
    default:
      return 'low';
  }
}

export function emptyCounts(): Record<Severity, number> {
  return { low: 0, medium: 0, high: 0, critical: 0 };
}

/** In-memory TTL cache. Survives warm Lambda invocations, per-region isolate. */
const store = new Map<string, { expires: number; value: unknown }>();

export function cached<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  return producer().then((value) => {
    store.set(key, { expires: Date.now() + ttlMs, value });
    return value;
  });
}

/** Last-known-good copy, used to serve stale data when a source fails. */
const lastGood = new Map<string, unknown>();

export function rememberGood<T>(key: string, value: T): T {
  lastGood.set(key, value);
  return value;
}

export function recallGood<T>(key: string): T | undefined {
  return lastGood.get(key) as T | undefined;
}

/** fetch() with a hard timeout so one slow provider cannot stall the function. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}