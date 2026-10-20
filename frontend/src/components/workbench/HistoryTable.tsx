"use client";

import { History, Trash2, ExternalLink } from "lucide-react";

import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { severityToken } from "@/lib/types";
import type { ScanRecord } from "@/lib/scans";
import { absoluteTime, hostOf, relativeTime, shortenUrl } from "@/lib/format";

const STATUS_LABEL: Record<ScanRecord["status"], string> = {
  queued: "Queued",
  running: "Running",
  done: "Complete",
  error: "Failed",
};

const STATUS_CLASS: Record<ScanRecord["status"], string> = {
  queued: "bg-surface-3 text-ink-2 border-line-strong",
  running: "bg-accent-soft text-accent border-accent-line",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Every scan started from this browser. Kept in localStorage so the history
 * survives a reload — the backend only retains job state for an hour.
 */
export default function HistoryTable({
  records,
  activeId,
  onSelect,
  onClear,
  className = "",
}: {
  records: ScanRecord[];
  activeId: string | null;
  onSelect: (record: ScanRecord) => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <Panel
      className={className}
      eyebrow="This browser"
      title="Scan history"
      icon={<History className="h-4 w-4 text-faint" />}
      actions={
        records.length > 0 ? (
          <Button variant="ghost" size="xs" onClick={onClear}>
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        ) : null
      }
    >
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <History className="h-5 w-5 text-line-strong" />
          <p className="text-[13px] text-muted">No scans have been run from this browser.</p>
          <p className="max-w-sm text-[12px] leading-relaxed text-faint">
            Each run is recorded with its target, verdict and timing so you can compare
            results or hand a colleague the exact URL you assessed.
          </p>
        </div>
      ) : (
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Target
                </th>
                <th className="w-[104px] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Status
                </th>
                <th className="w-[88px] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Risk
                </th>
                <th className="w-[84px] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Findings
                </th>
                <th className="w-[132px] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Engine
                </th>
                <th className="w-[120px] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Started
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const token = record.severity ? severityToken(record.severity) : null;
                const active = record.id === activeId;
                return (
                  <tr
                    key={record.id}
                    onClick={() => onSelect(record)}
                    className={[
                      "cursor-pointer border-b border-line/70 align-middle transition-colors duration-150 last:border-b-0",
                      active ? "bg-accent-soft/50" : "hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "font-mono text-[12px]",
                            active ? "text-ink" : "text-ink-2",
                          ].join(" ")}
                          title={record.target}
                        >
                          {shortenUrl(record.target)}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-faint" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          "inline-flex items-center rounded-[4px] border px-1.5 py-[1px] text-[10.5px] font-medium",
                          STATUS_CLASS[record.status],
                        ].join(" ")}
                      >
                        {STATUS_LABEL[record.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {record.riskScore !== null && token ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: token.solid }}
                            aria-hidden
                          />
                          <span className="font-mono text-[11.5px] tabular-nums text-ink-2">
                            {record.riskScore}/100
                          </span>
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11.5px] tabular-nums text-ink-2">
                        {record.findingCount || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11px] text-muted">
                        {record.engine ?? "—"}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2.5 text-right font-mono text-[11px] text-muted"
                      title={absoluteTime(record.startedAt)}
                    >
                      {relativeTime(record.startedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
