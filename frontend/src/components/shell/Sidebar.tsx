"use client";

import {
  ShieldCheck,
  LayoutDashboard,
  ListTree,
  Wrench,
  ScrollText,
  History,
  ChevronDown,
  CircleDot,
  Command,
  PanelLeftClose,
} from "lucide-react";

import Kbd from "@/components/ui/Kbd";
import { hostOf, relativeTime } from "@/lib/format";
import type { ScanRecord } from "@/lib/scans";
import type { HealthResponse } from "@/lib/types";
import { VIEW_DESCRIPTIONS, VIEW_LABELS, type ViewKey } from "@/lib/views";

const NAV: { key: ViewKey; icon: typeof LayoutDashboard }[] = [
  { key: "assessment", icon: LayoutDashboard },
  { key: "findings", icon: ListTree },
  { key: "patch", icon: Wrench },
  { key: "log", icon: ScrollText },
  { key: "history", icon: History },
];

const STATUS_DOT: Record<ScanRecord["status"], string> = {
  queued: "bg-faint",
  running: "bg-accent",
  done: "bg-emerald-600",
  error: "bg-red-600",
};

export default function Sidebar({
  view,
  onViewChange,
  history,
  activeScanId,
  onSelectScan,
  health,
  onOpenPalette,
  onCollapse,
}: {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  history: ScanRecord[];
  activeScanId: string | null;
  onSelectScan: (record: ScanRecord) => void;
  health: HealthResponse | null;
  onOpenPalette: () => void;
  onCollapse: () => void;
}) {
  const engineUp = health !== null;
  const recent = history.slice(0, 6);
  const findingCount = history.find((entry) => entry.id === activeScanId)?.findingCount ?? 0;

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-line bg-surface">
      {/* Brand ---------------------------------------------------------- */}
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-accent text-white shadow-xs">
          <ShieldCheck className="h-[15px] w-[15px]" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold leading-4 tracking-[-0.01em] text-ink">
            ZeroDay-Guard
          </span>
          <span className="block text-[11px] leading-4 text-muted">Threat assessment</span>
        </span>
        <button
          type="button"
          onClick={onCollapse}
          title="Collapse sidebar"
          className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors duration-150 hover:bg-surface-3 hover:text-ink-2"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Workspace selector --------------------------------------------- */}
      <div className="px-3 pt-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[7px] border border-line-strong bg-surface px-2.5 py-2 text-left shadow-xs transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] bg-surface-3 text-[10px] font-semibold text-ink-2">
            AS
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium leading-4 text-ink">
              Acme Security
            </span>
            <span className="block truncate text-[11px] leading-4 text-muted">production</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
        </button>
      </div>

      {/* Navigation ----------------------------------------------------- */}
      <nav className="mt-4 px-3">
        <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {NAV.map(({ key, icon: Icon }) => {
            const active = view === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onViewChange(key)}
                  title={VIEW_DESCRIPTIONS[key]}
                  className={[
                    "group relative flex w-full items-center gap-2.5 rounded-[6px] px-2 py-[7px] text-left text-[13px] transition-colors duration-150",
                    active
                      ? "bg-accent-soft font-medium text-accent"
                      : "font-normal text-ink-2 hover:bg-surface-2 hover:text-ink",
                  ].join(" ")}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-accent"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={[
                      "h-[15px] w-[15px] shrink-0",
                      active ? "text-accent" : "text-faint group-hover:text-muted",
                    ].join(" ")}
                    strokeWidth={1.9}
                  />
                  <span className="min-w-0 flex-1 truncate">{VIEW_LABELS[key]}</span>
                  {key === "findings" && findingCount > 0 && (
                    <span className="rounded-[4px] bg-surface-3 px-1 font-mono text-[10px] text-muted">
                      {findingCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Command palette trigger ---------------------------------------- */}
      <div className="px-3 pt-4">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex w-full items-center gap-2 rounded-[6px] border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-150 hover:border-line-strong hover:bg-surface-3"
        >
          <Command className="h-3.5 w-3.5 text-faint" />
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      {/* Recent runs ----------------------------------------------------- */}
      <div className="mt-5 min-h-0 flex-1 overflow-hidden px-3">
        <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
          Recent runs
        </p>
        {recent.length === 0 ? (
          <p className="px-2 text-[12px] leading-relaxed text-faint">
            No scans yet. Runs you start are listed here for this browser.
          </p>
        ) : (
          <ul className="scroll-slim max-h-[38vh] space-y-0.5 overflow-y-auto pr-0.5">
            {recent.map((record) => {
              const active = record.id === activeScanId;
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => onSelectScan(record)}
                    className={[
                      "flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left transition-colors duration-150",
                      active ? "bg-surface-3" : "hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <CircleDot
                      className={[
                        "mt-[3px] h-[10px] w-[10px] shrink-0",
                        STATUS_DOT[record.status],
                        record.status === "running" ? "animate-pulse" : "",
                      ].join(" ")}
                      strokeWidth={3}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={[
                          "block truncate font-mono text-[11.5px] leading-4",
                          active ? "text-ink" : "text-ink-2",
                        ].join(" ")}
                        title={record.target}
                      >
                        {hostOf(record.target)}
                      </span>
                      <span className="block truncate text-[10.5px] leading-4 text-faint">
                        {relativeTime(record.startedAt)}
                        {record.riskScore !== null ? ` · ${record.riskScore}/100` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer ---------------------------------------------------------- */}
      <div className="border-t border-line px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span
              className={[
                "h-1.5 w-1.5 rounded-full",
                engineUp ? "bg-emerald-600" : "bg-red-500",
              ].join(" ")}
              aria-hidden
            />
            {engineUp ? "Engine online" : "Engine unreachable"}
          </span>
          {health && (
            <span className="font-mono text-[10.5px] text-faint">v{health.version}</span>
          )}
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
            RK
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium leading-4 text-ink">R. Kulkarni</span>
            <span className="block truncate text-[11px] leading-4 text-muted">Security engineering</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
