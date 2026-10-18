import type { HazardType, Severity } from '@/api/client';

export const SEVERITY_META: Record<Severity, { label: string; varName: string; weight: number }> = {
  critical: { label: 'Critical', varName: '--severity-critical', weight: 4 },
  high: { label: 'High', varName: '--severity-high', weight: 3 },
  medium: { label: 'Medium', varName: '--severity-medium', weight: 2 },
  low: { label: 'Low', varName: '--severity-low', weight: 1 },
};

export const TYPE_META: Record<HazardType, { label: string }> = {
  earthquake: { label: 'Earthquake' },
  weather: { label: 'Weather' },
  air_quality: { label: 'Air Quality' },
  fire: { label: 'Fire' },
  flood: { label: 'Flood' },
  storm: { label: 'Storm' },
  news: { label: 'News' },
};

export function severityColor(sev: Severity): string {
  return `var(${SEVERITY_META[sev].varName})`;
}

export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'unknown';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Proper CSV escaping so exported files open cleanly in Excel. */
function csvCell(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Great-circle distance in km, used to scope a city view to nearby global events. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toCsv(rows: Record<string, string | number | boolean | null>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}