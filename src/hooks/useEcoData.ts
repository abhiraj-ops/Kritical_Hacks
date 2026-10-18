import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAlerts,
  runAgent,
  type Alert,
  type AlertsPayload,
  type AgentPayload,
  type HazardType,
  type Severity,
} from '@/api/client';
import { haversineKm } from '@/lib/format';

export const REGION_IDS = ['global', 'delhi', 'mumbai', 'chennai'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export const REGION_LABELS: Record<RegionId, string> = {
  global: 'Global',
  delhi: 'Delhi-NCR',
  mumbai: 'Mumbai',
  chennai: 'Chennai',
};

export const REGION_CENTER: Record<RegionId, { lat: number; lng: number; zoom: number }> = {
  global: { lat: 21, lng: 78, zoom: 4 },
  delhi: { lat: 28.6139, lng: 77.209, zoom: 10 },
  mumbai: { lat: 19.076, lng: 72.8777, zoom: 10 },
  chennai: { lat: 13.0827, lng: 80.2707, zoom: 10 },
};

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const HAZARD_TYPES = ['earthquake', 'weather', 'air_quality', 'fire', 'flood', 'storm', 'news'] as const;

/** Keep the region chip in sync with the URL so a filtered view is shareable. */
export function useRegionFromUrl(): [RegionId, (r: RegionId) => void] {
  const read = (): RegionId => {
    if (typeof window === 'undefined') return 'global';
    const v = new URLSearchParams(window.location.search).get('region');
    return (REGION_IDS as readonly string[]).includes(v ?? '') ? (v as RegionId) : 'global';
  };

  const [region, setRegion] = useState<RegionId>(read);

  useEffect(() => {
    const onPop = () => setRegion(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const set = useCallback((next: RegionId) => {
    setRegion(next);
    const url = new URL(window.location.href);
    if (next === 'global') url.searchParams.delete('region');
    else url.searchParams.set('region', next);
    window.history.replaceState({}, '', url);
  }, []);

  return [region, set];
}

export interface AlertsState {
  data: AlertsPayload | null;
  error: string | null;
  loading: boolean;
  /** True when we are showing a previous payload while refreshing. */
  refreshing: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useAlerts(): AlertsState {
  const [data, setData] = useState<AlertsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;

    if (data) setRefreshing(true);
    else setLoading(true);

    fetchAlerts(ctrl.signal)
      .then((payload) => {
        setData(payload);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    return () => ctrl.abort();
    // `tick` is the manual refresh trigger only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, refreshing, lastUpdated, refresh };
}

export interface AgentState {
  result: AgentPayload | null;
  error: string | null;
  running: boolean;
  run: (opts: { region: RegionId; query?: string }) => Promise<AgentPayload | null>;
  reset: () => void;
}

export function useTinyFishAgent(): AgentState {
  const [result, setResult] = useState<AgentPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async ({ region, query }: { region: RegionId; query?: string }) => {
    setRunning(true);
    setError(null);
    try {
      const payload = await runAgent({ region, query, fetch: true });
      setResult(payload);
      return payload;
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, running, run, reset };
}

/** Merge agent results into the alert list without mutating server state. */
export function useMergedAlerts(server: Alert[] | undefined, agent: Alert[] | undefined): Alert[] {
  return useMemo(() => {
    const base = server ?? [];
    if (!agent?.length) return base;
    const seen = new Set(base.map((a) => a.id));
    return [...base, ...agent.filter((a) => !seen.has(a.id))];
  }, [server, agent]);
}

/** Events tagged "global" still belong in a city view when they are physically close. */
const REGION_RADIUS_KM = 1200;

export function filterAlerts(
  alerts: Alert[],
  opts: { region: RegionId; severity?: Severity | 'all'; type?: HazardType | 'all'; query?: string },
): Alert[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  const centre = REGION_CENTER[opts.region];

  return alerts.filter((a) => {
    if (opts.region !== 'global') {
      if (a.regionId === opts.region) {
        // direct match
      } else if (a.regionId === 'global' && haversineKm(centre.lat, centre.lng, a.lat, a.lng) <= REGION_RADIUS_KM) {
        // nearby global event — included
      } else {
        return false;
      }
    }
    if (opts.severity && opts.severity !== 'all' && a.severity !== opts.severity) return false;
    if (opts.type && opts.type !== 'all' && a.type !== opts.type) return false;
    if (q) {
      const hay = `${a.summary} ${a.source} ${a.region} ${a.type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}