/**
 * NASA FIRMS — active fire hotspots. Requires NASA_FIRMS_MAP_KEY.
 * https://firms.modaps.eosdis.nasa.gov/api/area/csv/
 */
import type { NormalizedAlert, SourceStatus } from './core';
import { fetchWithTimeout, resolveRegion } from './core';

export async function fetchFires(): Promise<{ alerts: NormalizedAlert[]; status: SourceStatus }> {
  const id = 'firms';
  const label = 'NASA FIRMS Fire Hotspots';
  const key = process.env.NASA_FIRMS_MAP_KEY;

  if (!key) {
    return {
      alerts: [],
      status: { id, label, live: false, count: 0, reason: 'missing_key', message: 'Set NASA_FIRMS_MAP_KEY to enable live fire hotspots.' },
    };
  }

  try {
    const days = Number(process.env.NASA_FIRMS_DAY ?? '1');
    // Bounding box covering India so we never exceed the free-tier area limit.
    // Format: <key>/<product>/<minLng,minLat,maxLng,maxLat>/<days>/<resolution>
    const url =
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/` +
      `${key}/MOD14_NRT/68,6,98,36/${days}/2`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'EcoPulseAI/1.0' } }, 12000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csv = await res.text();
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return { alerts: [], status: { id, label, live: true, count: 0 } };

    const idx = (name: string) => lines[0].split(',').indexOf(name);
    const iLat = idx('latitude');
    const iLng = idx('longitude');
    const iConf = idx('confidence');
    const iFrp = idx('frp');
    const iTime = idx('acq_time');
    const iSat = idx('satellite');

    const alerts: NormalizedAlert[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      const lat = Number(cols[iLat]);
      const lng = Number(cols[iLng]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const conf = Number(cols[iConf]);
      const frp = Number(cols[iFrp]);
      const acq = cols[iTime] ?? '';
      const timestamp = acq.length >= 12
        ? `${acq.slice(0, 4)}-${acq.slice(4, 6)}-${acq.slice(6, 8)}T${acq.slice(8, 10)}:${acq.slice(10, 12)}:00Z`
        : new Date().toISOString();

      const { regionId, region } = resolveRegion(`fire ${lat} ${lng}`);

      alerts.push({
        id: `fire-${lat.toFixed(3)}-${lng.toFixed(3)}-${acq}`,
        type: 'fire',
        severity: conf >= 80 ? 'high' : conf >= 60 ? 'medium' : 'low',
        region,
        regionId,
        lat,
        lng,
        timestamp,
        source: label,
        sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/map/',
        summary: `Active fire hotspot detected (confidence ${conf}%, ${Number.isFinite(frp) ? frp : '—'} MW radiative power) near ${lat.toFixed(2)}, ${lng.toFixed(2)}.`,
        metrics: { confidence: conf, fireRadiativePower: Number.isFinite(frp) ? frp : 0, satellite: cols[iSat] ?? 'unknown' },
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