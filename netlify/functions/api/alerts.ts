/**
 * GET /api/alerts
 *
 * Aggregates every upstream hazard source, normalizes to one schema and
 * returns them sorted by recency. Cached for 5 minutes to protect upstream
 * rate limits. If a source fails we serve its last-known-good data and mark
 * the response `stale` rather than inventing anything.
 */
import type { AlertsResponse, NormalizedAlert } from '../_shared/core';
import { cached, rememberGood, recallGood, emptyCounts } from '../_shared/core';
import { fetchUsgs } from '../_shared/usgs';
import { fetchGdacs } from '../_shared/gdacs';
import { fetchOpenMeteo } from '../_shared/openmeteo';
import { fetchOpenAq } from '../_shared/openaq';
import { fetchFires } from '../_shared/fires';

const TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'alerts:v2';

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

  try {
    const payload = await cached(CACHE_KEY, TTL_MS, async () => {
      const settled = await Promise.all([
        safe(fetchUsgs),
        safe(fetchGdacs),
        safe(fetchOpenMeteo),
        safe(fetchOpenAq),
        safe(fetchFires),
      ]);

      const alerts: NormalizedAlert[] = [];
      const sources = [];
      let degraded = false;

      for (const r of settled) {
        if (!r) continue;
        // If a live fetch produced nothing but we have a previous good copy,
        // serve the stale copy and flag it.
        const remembered = recallGood<{ alerts: NormalizedAlert[] }>(r.status.id);
        if (!r.status.live && remembered?.alerts?.length) {
          alerts.push(...remembered.alerts);
          degraded = true;
          sources.push({ ...r.status, count: remembered.alerts.length, message: `${r.status.message ?? 'unavailable'} · serving cached copy` });
          continue;
        }
        if (r.status.live && r.alerts.length) rememberGood(r.status.id, { alerts: r.alerts });
        if (!r.status.live && r.status.reason !== 'missing_key') degraded = true;
        alerts.push(...r.alerts);
        sources.push(r.status);
      }

      alerts.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

      const counts = emptyCounts();
      for (const a of alerts) counts[a.severity] += 1;

      const liveSources = sources.filter((s) => s.live).length;

      const response: AlertsResponse = {
        alerts: alerts.slice(0, 600),
        meta: {
          status: liveSources === 0 ? 'unavailable' : degraded ? 'degraded' : 'ok',
          fetchedAt: new Date().toISOString(),
          sources,
          stale: false,
          counts,
          total: alerts.length,
          tinyfishConfigured: Boolean(process.env.TINYFISH_API_KEY),
        },
      };
      return response;
    });

    const body: AlertsResponse = { ...payload };
    body.alerts = [...body.alerts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return cors(Response.json(body, { headers: { 'Cache-Control': 'public, max-age=60' } }));
  } catch (err) {
    return cors(
      Response.json(
        { error: 'alerts_unavailable', message: (err as Error).message },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      ),
    );
  }
};

async function safe(fn: () => Promise<{ alerts: NormalizedAlert[]; status: AlertsResponse['meta']['sources'][number] }>) {
  try {
    return await fn();
  } catch (err) {
    const status = {
      id: 'unknown',
      label: 'unknown',
      live: false,
      count: 0,
      reason: 'error' as const,
      message: (err as Error).message,
    };
    return { alerts: [] as NormalizedAlert[], status };
  }
}

function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res;
}