import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import type { Alert, HazardType, Severity } from '@/api/client';
import { SEVERITIES, HAZARD_TYPES, REGION_LABELS, filterAlerts, type RegionId } from '@/hooks/useEcoData';
import { SEVERITY_META, TYPE_META, downloadCsv, relativeTime, toCsv } from '@/lib/format';

type SortKey = 'timestamp' | 'severity' | 'region' | 'type' | 'source';
type SortDir = 'asc' | 'desc';

interface Props {
  alerts: Alert[];
  region: RegionId;
  onSelect: (a: Alert) => void;
}

const PAGE_SIZE = 25;

export function TriageTable({ alerts, region, onSelect }: Props) {
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [type, setType] = useState<HazardType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => filterAlerts(alerts, { region, severity, type, query }),
    [alerts, region, severity, type, query],
  );

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'severity':
          return (SEVERITY_META[a.severity].weight - SEVERITY_META[b.severity].weight) * dir;
        case 'timestamp':
          return (Date.parse(a.timestamp) - Date.parse(b.timestamp)) * dir;
        case 'region':
          return a.region.localeCompare(b.region) * dir;
        case 'type':
          return TYPE_META[a.type].label.localeCompare(TYPE_META[b.type].label) * dir;
        case 'source':
          return a.source.localeCompare(b.source) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'severity' || key === 'timestamp' ? 'desc' : 'asc');
    }
    setPage(0);
  }

  function exportCsv() {
    const csv = toCsv(
      sorted.map((a) => ({
        time: new Date(a.timestamp).toISOString(),
        region: a.region,
        type: TYPE_META[a.type].label,
        severity: a.severity,
        severityScore: SEVERITY_META[a.severity].weight * 2.5,
        source: a.source,
        lat: a.lat,
        lng: a.lng,
        summary: a.summary,
        sourceUrl: a.sourceUrl ?? '',
        aiGenerated: a.aiGenerated ? 'yes' : 'no',
      })),
    );
    downloadCsv(`ecopulse-triage-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px]">
          <span className="sr-only">Search alerts</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-subtle)' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search summary, source, region…"
            className="input-glass w-full !pl-9"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--panel)',
              color: 'var(--text)',
            }}
          />
        </label>

        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as Severity | 'all');
            setPage(0);
          }}
          aria-label="Filter by severity"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_META[s].label}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as HazardType | 'all');
            setPage(0);
          }}
          aria-label="Filter by type"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          <option value="all">All types</option>
          {HAZARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>

        <button type="button" onClick={exportCsv} disabled={sorted.length === 0} className="btn btn-ghost">
          <Download className="h-4 w-4" />
          CSV
        </button>
      </div>

      <p className="mb-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
        {sorted.length} record{sorted.length === 1 ? '' : 's'} · region {REGION_LABELS[region]} · page {safePage + 1} of{' '}
        {pageCount}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr style={{ background: 'var(--panel)' }}>
              <Th label="Time" sortKey="timestamp" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Region" sortKey="region" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Type" sortKey="type" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Severity" sortKey="severity" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Source" sortKey="source" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--text-subtle)' }}>
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((a) => {
                const sev = SEVERITY_META[a.severity];
                return (
                  <tr
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className="cursor-pointer border-t transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {relativeTime(a.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>
                      {a.region}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {TYPE_META[a.type].label}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${sev.weight * 25}%`, background: `var(${sev.varName})` }}
                          />
                        </span>
                        <span
                          className="badge"
                          style={{
                            color: `var(${sev.varName})`,
                            borderColor: `var(${sev.varName})`,
                            background: `color-mix(in srgb, var(${sev.varName}) 14%, transparent)`,
                          }}
                        >
                          {sev.label}
                        </span>
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {a.source}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={{
                          borderColor: 'var(--border-strong)',
                          background: 'var(--panel)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {a.aiGenerated ? 'AI triaged' : 'Monitored'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" className="btn btn-ghost !py-1.5" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-ghost !py-1.5"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 text-left" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition"
        style={{ color: active ? 'var(--accent)' : 'var(--text-subtle)' }}
      >
        {label}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  );
}