/**
 * NVD enrichment — authoritative CVE records.
 *
 * Scraping advisory HTML is inherently brittle: the same page renders
 * differently between fetches, so a regex that matched a CVSS score on one
 * run matched a table of contents on the next. The NVD JSON API returns the
 * same structured data every time, so it supplies the authoritative severity,
 * CWE and affected-version ranges for whatever the crawl discovered.
 */

export const NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";

export interface NvdRecord {
  title: string;
  severity: string;
  cwe: string | null;
  description: string;
  affected_versions: string;
  evidence_quote: string;
  cve_ids: string[];
  source: string;
  score: number | null;
}

const CVE_PATTERN = /\bCVE-\d{4}-\d{4,7}\b/gi;

export function cveFromUrl(url: string): string | null {
  const match = /CVE-\d{4}-\d{4,7}/i.exec(url ?? "");
  return match ? match[0].toUpperCase() : null;
}

export function extractCves(text: string): string[] {
  return [...new Set((text.match(CVE_PATTERN) ?? []).map((c) => c.toUpperCase()))];
}

interface NvdVulnerabilityItem {
  cve?: {
    id?: string;
    descriptions?: { lang?: string; value?: string }[];
    metrics?: Record<string, unknown>;
    weaknesses?: { description?: { value?: string }[] }[];
    configurations?: {
      nodes?: {
        cpeMatch?: {
          versionStartIncluding?: string;
          versionStartExcluding?: string;
          versionEndIncluding?: string;
          versionEndExcluding?: string;
        }[];
      }[];
    }[];
  };
}

function parseNvdRecord(item: NvdVulnerabilityItem): NvdRecord | null {
  const cve = item.cve;
  if (!cve) return null;

  const cveId = (cve.id ?? "").toUpperCase();
  if (!cveId) return null;

  let description = "";
  for (const entry of cve.descriptions ?? []) {
    if ((entry.lang ?? "").toLowerCase() === "en") {
      description = entry.value ?? "";
      break;
    }
  }
  if (!description) return null;

  // --- severity: prefer the v3.1 primary metric ---------------------------
  let severity = "MEDIUM";
  let baseScore: number | null = null;
  const metrics = cve.metrics ?? {};
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const entries = (metrics[key] ?? []) as {
      type?: string;
      cvssData?: { baseScore?: number; baseSeverity?: string };
    }[];
    if (!entries.length) continue;
    const primary = entries.find((e) => e.type?.toLowerCase() === "primary") ?? entries[0];
    const data = primary.cvssData ?? {};
    const score = typeof data.baseScore === "number" ? data.baseScore : null;
    const label = (data.baseSeverity ?? "").toUpperCase();
    if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(label)) severity = label;
    if (score !== null && (baseScore === null || score > baseScore)) baseScore = score;
    if (severity !== "MEDIUM" && baseScore !== null) break;
  }

  // --- CWE ---------------------------------------------------------------
  let cwe: string | null = null;
  for (const weakness of cve.weaknesses ?? []) {
    for (const entry of weakness.description ?? []) {
      const match = /CWE-\d+/i.exec(entry.value ?? "");
      if (match) {
        cwe = match[0].toUpperCase();
        break;
      }
    }
    if (cwe) break;
  }

  // --- affected version ranges -------------------------------------------
  const versions: string[] = [];
  for (const configuration of cve.configurations ?? []) {
    for (const node of configuration.nodes ?? []) {
      for (const match of node.cpeMatch ?? []) {
        const start = match.versionStartIncluding ?? match.versionStartExcluding;
        const end = match.versionEndIncluding ?? match.versionEndExcluding;
        if (start && end) versions.push(`${start} through ${end}`);
        else if (end) versions.push(`before ${end}`);
        else if (start) versions.push(`from ${start}`);
      }
    }
  }

  return {
    title: cveId,
    severity,
    cwe,
    description: description.slice(0, 900),
    affected_versions: [...new Set(versions)].join("; ").slice(0, 300),
    evidence_quote: description.slice(0, 400),
    cve_ids: [cveId],
    source: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    score: baseScore,
  };
}

/** Fetch authoritative records for the given CVEs. */
export async function fetchNvdRecords(cveIds: string[]): Promise<NvdRecord[]> {
  if (!cveIds.length) return [];

  const records: NvdRecord[] = [];
  for (const cve of cveIds.slice(0, 4)) {
    try {
      const res = await fetch(`${NVD_API_URL}?cveId=${encodeURIComponent(cve)}`, {
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { vulnerabilities?: NvdVulnerabilityItem[] };
      for (const item of data.vulnerabilities ?? []) {
        const record = parseNvdRecord(item);
        if (record) records.push(record);
      }
    } catch {
      /* enrichment is best-effort */
    }
    // Be polite to the public NVD API.
    await new Promise((r) => setTimeout(r, 350));
  }
  return records;
}
