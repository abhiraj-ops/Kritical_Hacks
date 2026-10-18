/**
 * OpenAQ v3 — air quality. Requires OPENAQ_API_KEY.
 * Without the key the function reports `missing_key` and the UI shows an
 * honest "data unavailable" state instead of inventing numbers.
 */
import type { NormalizedAlert, SourceStatus } from './core';
import { fetchWithTimeout, resolveRegion, severityFromAqi } from './core';

interface OpenAqResponse {
  results?: Array<{
    id?: number;
    location?: string[];
    coordinates?: { latitude: number; longitude: number };
    measurements?: Array<{ parameter?: string; value?: number; lastUpdated?: string; unit?: string }>;
  }>;
}

const INDIA_BOUNDS = { minLat: 6, maxLat: 36, minLng: 68, maxLng: 98 };

export async function fetchOpenAq(): Promise<{ alerts: NormalizedAlert[]; status: SourceStatus }> {
  const id = 'openaq';
  const label = 'OpenAQ Air Quality';
  const key = process.env.OPENAQ_API_KEY;

  if (!key) {
    return {
      alerts: [],
      status: { id, label, live: false, count: 0, reason: 'missing_key', message: 'Set OPENAQ_API_KEY to enable live air quality.' },
    };
  }

  try {
    const url =
      'https://api.openaq.org/v3/locations/latest' +
      '?limit=200&coordinates=28.6139,77.2090&radius=25000';
    const res = await fetchWithTimeout(url, { headers: { 'X-API-Key': key, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as OpenAqResponse;
    const alerts: NormalizedAlert[] = [];

    for (const loc of data.results ?? []) {
      const lat = loc.coordinates?.latitude;
      const lng = loc.coordinates?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const pm25 = loc.measurements?.find((m) => m.parameter === 'pm25');
      const pm10 = loc.measurements?.find((m) => m.parameter === 'pm10');
      const aqi = pm25?.value ?? pm10?.value;
      if (typeof aqi !== 'number') continue;

      const place = [loc.location?.[1], loc.location?.[0]].filter(Boolean).join(', ') || 'Air quality station';
      const { regionId, region } = resolveRegion(place);
      const inIndia = lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat && lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng;

      alerts.push({
        id: `aq-${loc.id ?? `${lat}-${lng}`}`,
        type: 'air_quality',
        severity: severityFromAqi(aqi),
        region: inIndia ? region : 'Global',
        regionId: inIndia ? regionId : 'global',
        lat,
        lng,
        timestamp: pm25?.lastUpdated ?? pm10?.lastUpdated ?? new Date().toISOString(),
        source: label,
        sourceUrl: 'https://openaq.org/',
        summary: `${place}: PM2.5 ${pm25?.value ?? '—'} µg/m³, PM10 ${pm10?.value ?? '—'} µg/m³.`,
        metrics: { pm25: pm25?.value ?? 0, pm10: pm10?.value ?? 0 },
      });
    }

    return { alerts, status: { id, label, live: true, count: alerts.length } };
  } catch (err) {
    return {
      alerts: [],
      status: { id, label, live: false, count: 0, reason: 'error', message: (err as Error).message },
    };
  }
}