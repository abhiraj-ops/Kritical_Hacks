"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollText, Search, Loader2 } from "lucide-react";

import Panel from "@/components/ui/Panel";
import type { AgentEvent, EventLevel } from "@/lib/types";
import { LEVEL_STYLES } from "@/lib/types";

const FILTERS: { key: EventLevel | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "agent", label: "Agent" },
  { key: "success", label: "OK" },
  { key: "info", label: "Info" },
  { key: "warn", label: "Warn" },
  { key: "error", label: "Error" },
];

function clockOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: "UTC",
  });
}

/**
 * The pipeline trace.
 *
 * Presented as a log an analyst would read — timestamped, levelled and
 * filterable — rather than as a simulated terminal with a scanline.
 */
export default function ActivityLog({
  events,
  running,
  className = "",
  maxHeight = "420px",
}: {
  events: AgentEvent[];
  running: boolean;
  className?: string;
  maxHeight?: string;
}) {
  const [level, setLevel] = useState<EventLevel | "all">("all");
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (level !== "all" && event.level !== level) return false;
      if (!q) return true;
      return (
        event.message.toLowerCase().includes(q) || event.step.toLowerCase().includes(q)
      );
    });
  }, [events, level, query]);

  // Follow the tail as new events arrive.
  useEffect(() => {
    const node = scrollRef.current;
    if (node && level === "all" && !query) {
      node.scrollTop = node.scrollHeight;
    }
  }, [events.length, level, query]);

  const counts = useMemo(() => {
    const acc = { warn: 0, error: 0 };
    for (const event of events) {
      if (event.level === "warn") acc.warn += 1;
      if (event.level === "error") acc.error += 1;
    }
    return acc;
  }, [events]);

  return (
    <Panel
      className={className}
      eyebrow="Pipeline trace"
      title="Run log"
      icon={<ScrollText className="h-4 w-4 text-faint" />}
      actions={
        <div className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-accent">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live
            </span>
          )}
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter output"
              className="h-7 w-[150px] rounded-[6px] border border-line bg-surface-2 pl-7 pr-2 text-[12px] text-ink outline-none transition-colors duration-150 placeholder:text-faint hover:border-line-strong focus:border-accent focus:bg-surface focus:shadow-[0_0_0_3px_rgba(29,78,216,0.12)]"
            />
          </div>
        </div>
      }
    >
      {/* Level filters ------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
        {FILTERS.map((filter) => {
          const active = level === filter.key;
          const token = filter.key === "all" ? null : LEVEL_STYLES[filter.key as EventLevel];
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setLevel(filter.key)}
              className={[
                "inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-[3px] text-[11.5px] font-medium transition-colors duration-150",
                active
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-transparent bg-transparent text-muted hover:bg-surface-3 hover:text-ink",
              ].join(" ")}
            >
              {token && (
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    token.dot,
                    active ? "opacity-100" : "opacity-70",
                  ].join(" ")}
                />
              )}
              {filter.label}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[11px] text-faint">
          {visible.length}/{events.length}
        </span>
      </div>

      {/* Log body ------------------------------------------------------ */}
      <div
        ref={scrollRef}
        className="scroll-slim overflow-y-auto bg-surface"
        style={{ maxHeight }}
      >
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <ScrollText className="h-5 w-5 text-line-strong" />
            <p className="text-[13px] text-muted">
              {events.length === 0
                ? "No output yet."
                : "No events match the current filter."}
            </p>
            <p className="max-w-xs text-[12px] text-faint">
              {events.length === 0
                ? "Start a scan and every stage the pipeline executes is recorded here."
                : "Clear the filter to see the full trace."}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <tbody>
              {visible.map((event, index) => {
                const token = LEVEL_STYLES[event.level] ?? LEVEL_STYLES.info;
                return (
                  <tr
                    key={`${event.timestamp}-${index}`}
                    className="border-b border-line/70 last:border-b-0 align-top"
                  >
                    <td className="w-[76px] whitespace-nowrap py-[7px] pl-3 pr-2 align-middle">
                      <span className="font-mono text-[11px] tabular-nums text-faint">
                        {clockOf(event.timestamp)}
                      </span>
                    </td>
                    <td className="w-[62px] py-[7px] pr-2 align-middle">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-[3px] px-1 py-[1px] font-mono text-[10px] font-semibold tracking-[0.04em]",
                          token.text,
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "h-1.5 w-1.5 rounded-full",
                            token.dot,
                          ].join(" ")}
                        />
                        {token.label}
                      </span>
                    </td>
                    <td className="py-[7px] pr-2 align-middle">
                      <span className="text-[12.5px] leading-5 text-ink-2">
                        {event.message}
                      </span>
                    </td>
                    <td className="hidden py-[7px] pl-2 pr-3 text-right align-middle md:table-cell">
                      <span className="font-mono text-[10.5px] text-faint">{event.step}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer -------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-3 py-2 text-[11.5px] text-muted">
        <span>
          {events.length} event{events.length === 1 ? "" : "s"}
          {counts.warn > 0 && <span className="text-amber-700"> · {counts.warn} warning{counts.warn === 1 ? "" : "s"}</span>}
          {counts.error > 0 && <span className="text-red-700"> · {counts.error} error{counts.error === 1 ? "" : "s"}</span>}
        </span>
        <span className="font-mono text-[10.5px] text-faint">timestamps in UTC</span>
      </div>
    </Panel>
  );
}
