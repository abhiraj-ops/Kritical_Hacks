/**
 * Open-Meteo — weather, rainfall and wind. No key required.
 * Dangerous conditions become normalized alerts for the tracked regions.
 */
import type { NormalizedAlert, SourceStatus } from './core';
import { REGIONS, fetchWithTimeout } from './core';

interface MeteoCurrent {
  temperature_2m?: number;
  apparent_temperature?: number;
  precipitation?: number;
  rain?: number;
  showers?: number;
  wind_gusts_10m?: number;
  wind_speed_10m?: number;
  relative_humidity_2m?: number;
}

interface MeteoResponse {
  current?: MeteoCurrent;
  latitude: number;
  longitude: number;
  hourly?: { precipitation_probability?: number[] };
}

export async function fetchOpenMeteo(): Promise<{ alerts: NormalizedAlert[]; status: SourceStatus }> {
  const id = 'open-meteo';
  const label = 'Open-Meteo Weather';

  try {
    const targets = [REGIONS.delhi, REGIONS.mumbai, REGIONS.chennai];

    const settled = await Promise.allSettled(
      targets.map(async (r) => {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${r.lat}&longitude=${r.lng}` +
          '&current=temperature_2m,apparent_temperature,precipitation,rain,showers,wind_gusts_10m,wind_speed_10m,relative_humidity_2m' +
          '&hourly=precipitation_probability&forecast_days=1&timezone=auto';
        const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'EcoPulseAI/1.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { region: r, data: (await res.json()) as MeteoResponse };
      }),
    );

    const alerts: NormalizedAlert[] = [];
    let ok = 0;

    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      ok++;
      const { region, data } = s.value;
      const c = data.current ?? {};
      const gust = c.wind_gusts_10m ?? 0;
      const rain = (c.precipitation ?? 0) + (c.rain ?? 0) + (c.showers ?? 0);
      const temp = c.apparent_temperature ?? c.temperature_2m ?? 0;
      const pop = Math.max(0, ...(data.hourly?.precipitation_probability ?? [0]));
      const now = new Date().toISOString();
      const lat = data.latitude;
      const lng = data.longitude;

      const metrics = {
        tempC: round1(temp),
        windGustKmh: round1(gust),
        rainMm: round1(rain),
        rainProbabilityPct: pop,
        humidityPct: round1(c.relative_humidity_2m ?? 0),
      };

      if (gust >= 60 || rain >= 20) {
        alerts.push({
          id: `wx-wind-${region.id}`,
          type: 'weather',
          severity: gust >= 90 || rain >= 50 ? 'critical' : gust >= 75 || rain >= 30 ? 'high' : 'medium',
          region: region.label,
          regionId: region.id,
          lat,
          lng,
          timestamp: now,
          source: label,
          sourceUrl: 'https://open-meteo.com/',
          summary: `Severe weather over ${region.label}: gusts ${round1(gust)} km/h, ${round1(rain)} mm precipitation, ${round1(temp)}°C apparent.`,
          metrics,
        });
      }

      if (temp >= 40) {
        alerts.push({
          id: `wx-heat-${region.id}`,
          type: 'weather',
          severity: temp >= 45 ? 'critical' : temp >= 42 ? 'high' : 'medium',
          region: region.label,
          regionId: region.id,
          lat,
          lng,
          timestamp: now,
          source: label,
          sourceUrl: 'https://open-meteo.com/',
          summary: `Extreme heat stress in ${region.label}: apparent temperature ${round1(temp)}°C.`,
          metrics,
        });
      }

      if (pop >= 70 && rain < 20) {
        alerts.push({
          id: `wx-rain-${region.id}`,
          type: 'flood',
          severity: pop >= 90 ? 'high' : 'medium',
          region: region.label,
          regionId: region.id,
          lat,
          lng,
          timestamp: now,
          source: label,
          sourceUrl: 'https://open-meteo.com/',
          summary: `Heavy rain probability ${pop}% forecast for ${region.label} — urban flood risk elevated.`,
          metrics,
        });
      }
    }

    if (ok === 0) throw new Error('All Open-Meteo region requests failed');
    return { alerts, status: { id, label, live: true, count: alerts.length } };
  } catch (err) {
    return {
      alerts: [],
      status: { id, label, live: false, count: 0, reason: 'error', message: (err as Error).message },
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}