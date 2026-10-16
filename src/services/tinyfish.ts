/**
 * TinyFish integration — Search API + Fetch API.
 * Docs: https://docs.tinyfish.ai/search-api and https://docs.tinyfish.ai/fetch-api
 *
 * - Search: GET https://api.search.tinyfish.ai?query=...  (X-API-Key header)
 * - Fetch:  POST https://api.fetch.tinyfish.ai { urls, format: 'markdown', ttl: 0 }
 *
 * The key is read from VITE_TINYFISH_API_KEY. Never commit a real key —
 * put it in `.env.local` (gitignored). All calls fail soft and the UI
 * falls back to simulated data so the demo never breaks.
 */

export interface TinyFishResult {
  title: string;
  url: string;
  snippet?: string;
  site_name?: string;
}

const SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai';
const FETCH_ENDPOINT = 'https://api.fetch.tinyfish.ai';

export function getTinyFishKey(): string {
  return (import.meta.env.VITE_TINYFISH_API_KEY as string | undefined)?.trim() ?? '';
}

export function hasTinyFishKey(): boolean {
  return getTinyFishKey().length > 8;
}

export async function tinyFishSearch(query: string, signal?: AbortSignal): Promise<TinyFishResult[]> {
  const key = getTinyFishKey();
  if (!key) throw new Error('Missing VITE_TINYFISH_API_KEY');
  const url = `${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-Key': key },
    signal,
  });
  if (!res.ok) throw new Error(`TinyFish Search ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ title: string; url: string; snippet?: string; site_name?: string }> };
  return (data.results ?? []).slice(0, 8).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    site_name: r.site_name,
  }));
}

export async function tinyFishFetch(urls: string[]): Promise<Array<{ url: string; title?: string; text?: string }>> {
  const key = getTinyFishKey();
  if (!key) throw new Error('Missing VITE_TINYFISH_API_KEY');
  const res = await fetch(FETCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({ urls: urls.slice(0, 3), format: 'markdown', ttl: 0 }),
  });
  if (!res.ok) throw new Error(`TinyFish Fetch ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ url: string; title?: string; text?: string }> };
  return data.results ?? [];
}

/** Simple heuristic urgency classifier used after fetch. */
export function classifyUrgency(text: string): { label: 'Critical' | 'High' | 'Moderate'; score: number } {
  const t = text.toLowerCase();
  const critical = ['emergency', 'severe', 'evacuat', 'hazardous', 'crosses 300', 'disaster', 'sos'];
  const high = ['advisory', 'flood', 'heavy rain', 'smog', 'alert', 'waterlog'];
  if (critical.some((k) => t.includes(k))) return { label: 'Critical', score: 9.2 };
  if (high.some((k) => t.includes(k))) return { label: 'High', score: 7.8 };
  return { label: 'Moderate', score: 6.1 };
}
