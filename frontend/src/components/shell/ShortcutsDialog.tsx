"use client";

import { useEffect } from "react";

import Kbd from "@/components/ui/Kbd";

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["⌘", "K"], description: "Open the command palette" },
  { keys: ["⌘", "↵"], description: "Run a scan on the current target" },
  { keys: ["/"], description: "Focus the target URL field" },
  { keys: ["↑", "↓"], description: "Move through palette results" },
  { keys: ["↵"], description: "Run the highlighted palette result" },
  { keys: ["Esc"], description: "Close the palette or dialog" },
];

export default function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        aria-label="Close shortcuts"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/20 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-[420px] animate-scale-in overflow-hidden rounded-[12px] border border-line bg-surface shadow-pop">
        <div className="panel-bar">
          <h2 className="panel-title">Keyboard shortcuts</h2>
        </div>
        <dl className="divide-y divide-line">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <dt className="text-[12.5px] text-ink-2">{shortcut.description}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
