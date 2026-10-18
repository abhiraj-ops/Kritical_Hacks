/**
 * USGS Earthquakes — no key required.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson
 */
import type { NormalizedAlert, SourceStatus } from './core';
import { fetchWithTimeout, resolveRegion, severityFromMagnitude, bumpSeverity } from './core';

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    url: string;
    tsunami?: number;
    alert?: string | null;
    sig?: number;
  };
  geometry: { coordinates: [number, number, number] };
}

export async function fetchUsgs():Promise<{ alerts: NormalizedAlert[]; status: SourceStatus }> {
  const id = 'usgs';
  const label = 'USGS Earthquakes';
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'EcoPulseAI/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { features: UsgsFeature[] };

    const alerts: NormalizedAlert[] = (data.features ?? []).map((f) => {
      const [lng, lat, depth] = f.geometry.coordinates;
      const place = f.properties.place ?? 'Unknown location';
      const { regionId, region } = resolveRegion(place);
      const mag = f.properties.mag ?? 0;
      let severity = severityFromMagnitude(mag);
      if (f.properties.tsunami) severity = bumpSeverity(severity, 'critical');
      if (f.properties.alert === 'orange') severity = bumpSeverity(severity, 'high');
      if (f.properties.alert === 'red') severity = bumpSeverity(severity, 'critical');

      return {
        id: `usgs-${f.id}`,
        type: 'earthquake',
        severity,
        region,
        regionId,
        lat,
        lng,
        timestamp: new Date(f.properties.time).toISOString(),
        source: label,
        sourceUrl: f.properties.url,
        summary: `${place} — M${mag.toFixed(1)}, depth ${depth?.toFixed(0) ?? '?'} km.`,
        metrics: { magnitude: mag, depthKm: Number(depth ?? 0), significance: f.properties.sig ?? 0 },
      } satisfies NormalizedAlert;
    });

    return {
      alerts,
      status: { id, label, live: true, count: alerts.length },
    };
  } catch (err) {
    return {
      alerts: [],
      status: { id, label, live: false, count: 0, reason: 'error', message: (err as Error).message },
    };
  }
}