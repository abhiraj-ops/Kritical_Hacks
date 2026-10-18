/**
 * POST /api/agent
 *
 * Runs a real TinyFish web agent from the server side so the API key never
 * reaches the browser. Body: { query: string, region?: string, fetch?: boolean }
 *
 * Pipeline: Search (discover URLs) -> Fetch (extract markdown) -> classify.
 * Every stage reports its own status; failures are returned honestly rather
 * than papered over with fabricated alerts.
 */
import type { HazardType, Severity } from './_shared/core';
import { resolveRegion } from './_shared/core';

const SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai';
const FETCH_ENDPOINT = 'https://api.fetch.tinyfish.ai';

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
  /** True when severity/type were produced by our classifier, not a human. */
  aiGenerated: true;
}

const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  global: { lat: 21, lng: 78 },
};

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const key = process.env.TINYFISH_API_KEY;
  if (!key) {
    return json(
      {
        ok: false,
        stage: 'config',
        error: 'missing_key',
        message: 'TINYFISH_API_KEY is not configured on this deployment. Set it in Netlify environment variables.',
        results: [],
        stages: [],
      },
      503,
    );
  }

  let body: { query?: string; region?: string; fetch?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'invalid_json', message: 'Request body must be JSON.' }, 400);
  }

  const region = body.region && body.region !== 'all' ? body.region : '';
  const query =
    body.query?.trim() ||
    `${region ? `${region} ` : ''}environmental hazard flood air quality storm emergency latest`;

  const stages: Array<{ name: string; status: 'ok' | 'error'; detail: string }> = [];

  // ---- Stage 1: Search -----------------------------------------------------
  let searchResults: Array<{ title: string; url: string; snippet?: string; site_name?: string }> = [];
  try {
    const res = await fetch(`${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}`, {
      headers: { 'X-API-Key': key },
    });
    if (!res.ok) throw new Error(`Search API returned HTTP ${res.status}`);
    const data = (await res.json()) as { results?: typeof searchResults };
    searchResults = (data.results ?? []).slice(0, 8);
    stages.push({ name: 'Scanning live web', status: 'ok', detail: `${searchResults.length} results via TinyFish Search` });
  } catch (err) {
    stages.push({ name: 'Scanning live web', status: 'error', detail: (err as Error).message });
    return json({ ok: false, stage: 'search', error: 'search_failed', message: (err as Error).message, results: [], stages }, 502);
  }

  // ---- Stage 2: Fetch markdown (best effort, top 3 URLs) -------------------
  let fetched: Array<{ url: string; title?: string; text?: string }> = [];
  if (body.fetch !== false && searchResults.length) {
    try {
      const res = await fetch(FETCH_ENDPOINT, {
        method: 'POST',
        headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: searchResults.slice(0, 3).map((r) => r.url), format: 'markdown', ttl: 0 }),
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: typeof fetched };
        fetched = data.results ?? [];
        stages.push({ name: 'Fetching markdown', status: 'ok', detail: `${fetched.length} pages extracted` });
      } else {
        stages.push({ name: 'Fetching markdown', status: 'error', detail: `Fetch API HTTP ${res.status}` });
      }
    } catch (err) {
      stages.push({ name: 'Fetching markdown', status: 'error', detail: (err as Error).message });
    }
  }

  // ---- Stage 3: Classify ---------------------------------------------------
  const excerptByUrl = new Map(fetched.map((f) => [f.url, (f.text ?? '').slice(0, 600)]));
  const now = new Date().toISOString();

  const results: AgentResult[] = searchResults.map((r) => {
    const text = `${r.title} ${r.snippet ?? ''} ${excerptByUrl.get(r.url) ?? ''}`;
    const { severity, type } = classify(text);
    const { regionId, region: regionLabel } = resolveRegion(`${r.title} ${r.snippet ?? ''}`);
    const coords = REGION_COORDS[regionId] ?? REGION_COORDS.global;

    let sourceUrl: string | null = null;
    let source = 'TinyFish Search';
    try {
      source = new URL(r.url).hostname.replace(/^www\./, '');
      sourceUrl = r.url;
    } catch {
      /* keep sourceUrl null for malformed URLs */
    }

    return {
      id: `tf-${hash(r.url)}`,
      type,
      severity,
      region: regionLabel,
      regionId,
      lat: coords.lat,
      lng: coords.lng,
      timestamp: now,
      source,
      sourceUrl,
      summary: (r.snippet || r.title).slice(0, 240),
      excerpt: excerptByUrl.get(r.url),
      aiGenerated: true,
    };
  });

  stages.push({ name: 'Classifying severity', status: 'ok', detail: `${results.length} records classified` });
  stages.push({ name: 'Alert dispatched', status: 'ok', detail: 'Results returned to dashboard' });

  return json({
    ok: true,
    query,
    stages,
    results,
    fetchedPages: fetched.length,
    timestamp: new Date().toISOString(),
  });
}

/** Keyword classifier. Deliberately simple and transparent. */
function classify(text: string): { severity: Severity; type: HazardType } {
  const t = text.toLowerCase();
  const has = (...k: string[]) => k.some((x) => t.includes(x));

  let type: HazardType = 'news';
  if (has('earthquake', 'magnitude', 'tremor', 'seismic')) type = 'earthquake';
  else if (has('air quality', 'aqi', 'pm2.5', 'smog', 'pollution')) type = 'air_quality';
  else if (has('cyclone', 'hurricane', 'typhoon', 'storm', 'wind speed')) type = 'storm';
  else if (has('flood', 'waterlog', 'inundation', 'heavy rain', 'rainfall')) type = 'flood';
  else if (has('wildfire', 'fire outbreak', 'blaze')) type = 'fire';

  let severity: Severity = 'low';
  if (has('emergency', 'evacuat', 'red alert', 'casualt', 'fatal', 'devastat', 'critical')) severity = 'critical';
  else if (has('severe', 'danger', 'warning', 'hazard', 'displaced', 'stranded')) severity = 'high';
  else if (has('advisory', 'caution', 'rise in', 'alert')) severity = 'medium';

  return { severity, type };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
}