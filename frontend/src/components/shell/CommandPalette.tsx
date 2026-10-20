"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, CornerDownLeft } from "lucide-react";

import Kbd from "@/components/ui/Kbd";

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon?: ReactNode;
  keywords?: string;
  onSelect: () => void;
}

/**
 * A command palette in the style of a real power-user tool: type to filter,
 * arrow keys to move, Enter to run. Groups are preserved in the order the
 * items were supplied so the most relevant section is always on top.
 */
export default function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.label, item.group, item.hint, item.keywords]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [items, query]);

  // Reset state each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus after paint so the caret lands in the field.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Clamp the cursor when the result set shrinks.
  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Keep the highlighted row in view.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (filtered.length === 0 ? 0 : (c + 1) % filtered.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (filtered.length === 0 ? 0 : (c - 1 + filtered.length) % filtered.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[cursor];
      if (item) {
        item.onSelect();
        onClose();
      }
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/20 backdrop-blur-[2px]"
      />

      <div
        onKeyDown={onKeyDown}
        className="relative w-full max-w-[560px] animate-scale-in overflow-hidden rounded-[12px] border border-line bg-surface shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search views, runs and actions…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} className="scroll-slim max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted">
              Nothing matches “{query}”.
            </p>
          ) : (
            filtered.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const active = index === cursor;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <div className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint first:pt-1">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => {
                      item.onSelect();
                      onClose();
                    }}
                    className={[
                      "flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors duration-100",
                      active ? "bg-accent-soft" : "hover:bg-surface-2",
                    ].join(" ")}
                  >
                    {item.icon && (
                      <span className={active ? "text-accent" : "text-faint"}>{item.icon}</span>
                    )}
                    <span
                      className={[
                        "min-w-0 flex-1 truncate text-[13px]",
                        active ? "font-medium text-accent" : "text-ink",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="shrink-0 font-mono text-[11px] text-faint">{item.hint}</span>
                    )}
                    {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-3.5 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> select
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>⌘K</Kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
