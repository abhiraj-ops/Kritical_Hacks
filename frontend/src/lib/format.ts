/**
 * Formatting helpers shared across the dashboard.
 *
 * Everything a human would want to read at a glance: relative time,
 * durations, byte counts and URL shortening.
 */

const RELATIVE_STEPS: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, divisor: 1, unit: "second" },
  { limit: 3600, divisor: 60, unit: "minute" },
  { limit: 86400, divisor: 3600, unit: "hour" },
  { limit: 604800, divisor: 86400, unit: "day" },
  { limit: 2629800, divisor: 604800, unit: "week" },
  { limit: 31557600, divisor: 2629800, unit: "month" },
  { limit: Infinity, divisor: 31557600, unit: "year" },
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "12s ago", "3m ago", "2h ago", "Nov 4". */
export function relativeTime(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === "") return "—";
  const date = input instanceof Date ? input : new Date(input);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "—";

  const deltaSeconds = (ms - Date.now()) / 1000;
  const abs = Math.abs(deltaSeconds);
  if (abs < 5) return "just now";

  for (const step of RELATIVE_STEPS) {
    if (abs < step.limit) {
      const value = Math.round(deltaSeconds / step.divisor);
      return relative.format(value, step.unit);
    }
  }
  return "—";
}

/** "20 Oct 2026, 14:03 UTC" — the absolute form shown in tooltips. */
export function absoluteTime(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === "") return "—";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .replace(",", "")
    .concat(" UTC");
}

/** "00:04.812" — duration for scan timings. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

/** Strip the scheme and any trailing slash so URLs fit in a table cell. */
export function shortenUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .slice(0, 72);
}

/** Human label for a hostname. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0] ?? url;
  }
}

/** "3 findings" / "1 finding" */
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Initials for the avatar fallback. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
