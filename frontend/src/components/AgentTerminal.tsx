"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Terminal,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Shield,
} from "lucide-react";
import type { AgentEvent, EventLevel } from "@/lib/types";

const LEVEL_META: Record<
  EventLevel,
  { icon: typeof Radio; color: string; label: string }
> = {
  agent: { icon: Radio, color: "text-emerald-400", label: "AGENT" },
  success: { icon: CheckCircle2, color: "text-emerald-400", label: "OK" },
  info: { icon: Shield, color: "text-sky-400", label: "INFO" },
  warn: { icon: AlertTriangle, color: "text-amber-400", label: "WARN" },
  error: { icon: XCircle, color: "text-rose-400", label: "ERR" },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "UTC",
    });
  } catch {
    return "--:--:--";
  }
}

export default function AgentTerminal({
  events,
  running,
  target,
}: {
  events: AgentEvent[];
  running: boolean;
  target: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view as the stream arrives.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [events.length]);

  return (
    <section className="panel flex h-full min-h-[26rem] flex-col overflow-hidden">
      <header className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" />
          Agent Terminal
        </span>
        <span className="flex items-center gap-2 normal-case tracking-normal">
          {running ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
              <span className="text-emerald-400">live</span>
            </>
          ) : (
            <span className="text-slate-600">idle</span>
          )}
        </span>
      </header>

      <div
        ref={scrollRef}
        className="terminal-scroll relative flex-1 overflow-y-auto px-3 py-3 font-mono text-[12px] leading-relaxed"
      >
        <div className="scanline" aria-hidden />

        {events.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
            <Terminal className="h-6 w-6" />
            <p className="text-[11px]">
              Awaiting target. Enter a URL to start the agent.
            </p>
          </div>
        )}

        <ul className="space-y-1">
          {events.map((event, index) => {
            const meta = LEVEL_META[event.level] ?? LEVEL_META.info;
            const Icon = meta.icon;
            return (
              <motion.li
                key={`${event.timestamp}-${index}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex gap-2"
              >
                <span className="shrink-0 text-slate-700">
                  {formatTime(event.timestamp)}
                </span>
                <Icon className={`mt-[3px] h-3 w-3 shrink-0 ${meta.color}`} />
                <span className="shrink-0 text-slate-600">[{meta.label}]</span>
                <span className="min-w-0 break-words text-slate-300">
                  {event.message}
                </span>
              </motion.li>
            );
          })}
        </ul>

        {running && (
          <div className="mt-1 flex gap-2">
            <span className="shrink-0 text-slate-700">--:--:--</span>
            <span className="inline-block h-3.5 w-2 animate-blink bg-emerald-400" />
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--line)] px-3 py-2 font-mono text-[10px] text-slate-600">
        <span className="text-slate-500">target:</span>{" "}
        <span className="text-slate-400">{target || "—"}</span>
      </footer>
    </section>
  );
}
