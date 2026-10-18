/**
 * GDACS RSS — global disaster alerts, no key required.
 * https://www.gdacs.org/xml/rss.xml
 */
import type { NormalizedAlert, SourceStatus } from './core';
import { fetchWithTimeout, resolveRegion, severityFromAlertLevel } from './core';

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function fetchGdacs(): Promise<{ alerts: NormalizedAlert[]; status: SourceStatus }> {
  const id = 'gdacs';
  const label = 'GDACS Global Alerts';

  try {
    const res = await fetchWithTimeout('https://www.gdacs.org/xml/rss.xml', { headers: { 'User-Agent': 'EcoPulseAI/1.0' } }, 11000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    const alerts: NormalizedAlert[] = [];

    for (const block of blocks) {
      const title = tag(block, 'title');
      const link = tag(block, 'link');
      const pubDate = tag(block, 'pubDate');
      const point = tag(block, 'georss:point');
      const alertLevel = tag(block, 'gdacs:alertlevel');
      const eventType = tag(block, 'gdacs:eventtype');
      const country = tag(block, 'gdacs:country');
      const severityText = tag(block, 'gdacs:severity');
      const description = tag(block, 'description');

      if (!title || !point) continue;
      const [latStr, lngStr] = point.split(/\s+/);
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const { regionId, region } = resolveRegion(`${country ?? ''} ${title}`);
      const ts = pubDate ? new Date(pubDate) : new Date();
      const timestamp = Number.isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();

      const typeMap: Record<string, NormalizedAlert['type']> = {
        EQ: 'earthquake',
        TC: 'storm',
        FL: 'flood',
        WF: 'storm',
        VO: 'fire',
        DR: 'news',
      };

      alerts.push({
        id: `gdacs-${Math.abs(hash(`${link}${title}`))}`,
        type: typeMap[eventType ?? ''] ?? 'news',
        severity: severityFromAlertLevel(alertLevel),
        region,
        regionId,
        lat,
        lng,
        timestamp,
        source: label,
        sourceUrl: link,
        summary: description ? truncate(description, 220) : title,
        metrics: { alertLevel: alertLevel ?? 'unknown', eventType: eventType ?? 'NA', severityText: severityText ?? '' },
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}