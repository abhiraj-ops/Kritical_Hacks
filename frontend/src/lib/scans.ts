"use client";

import type { Severity } from "@/lib/types";

/**
 * Session scan history.
 *
 * The analysis backend keeps job state for an hour, but a reviewer wants to
 * see what they ran this morning. History is therefore mirrored into
 * localStorage and read back on load — same records, same fields.
 */

export type ScanStatus = "queued" | "running" | "done" | "error";

export interface ScanRecord {
  id: string;
  target: string;
  status: ScanStatus;
  startedAt: string;
  finishedAt: string | null;
  riskScore: number | null;
  severity: Severity | null;
  findingCount: number;
  engine: string | null;
  error: string | null;
}

const STORAGE_KEY = "zdg.scan-history.v1";
const MAX_RECORDS = 40;

function readStorage(): ScanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ScanRecord =>
        typeof entry === "object" && entry !== null && typeof (entry as ScanRecord).id === "string",
    );
  } catch {
    return [];
  }
}

function writeStorage(records: ScanRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    /* private mode or quota — history is a convenience, not a requirement */
  }
}

export function loadHistory(): ScanRecord[] {
  return readStorage();
}

export function upsertScan(record: ScanRecord): ScanRecord[] {
  const existing = readStorage();
  const next = [record, ...existing.filter((entry) => entry.id !== record.id)].slice(0, MAX_RECORDS);
  writeStorage(next);
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
