"use client";

import { ChevronRight, Search, RefreshCw, PanelLeftOpen, Activity } from "lucide-react";

import Button from "@/components/ui/Button";
import Kbd from "@/components/ui/Kbd";
import type { HealthResponse } from "@/lib/types";
import { VIEW_LABELS, type ViewKey } from "@/lib/views";

export default function TopBar({
  view,
  onOpenPalette,
  onToggleSidebar,
  sidebarCollapsed,
  health,
  onRefreshHealth,
  onNewScan,
  running,
}: {
  view: ViewKey;
  onOpenPalette: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  health: HealthResponse | null;
  onRefreshHealth: () => void;
  onNewScan: () => void;
  running: boolean;
}) {
  const engineUp = health !== null;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-[6px]">
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Show sidebar"
          className="grid h-8 w-8 place-items-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Breadcrumb ----------------------------------------------------- */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="hidden shrink-0 text-muted lg:inline">Acme Security</span>
        <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-faint lg:inline" />
        <span className="hidden shrink-0 text-muted md:inline">Assessments</span>
        <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-faint md:inline" />
        <span className="truncate font-medium text-ink">{VIEW_LABELS[view]}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Search trigger ---------------------------------------------- */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden h-8 items-center gap-2 rounded-[6px] border border-line-strong bg-surface-2 pl-2.5 pr-1.5 text-[12.5px] text-muted shadow-xs transition-colors duration-150 hover:border-[#B9B9B2] hover:bg-surface md:flex"
        >
          <Search className="h-3.5 w-3.5 text-faint" />
          <span className="pr-4">Search</span>
          <Kbd>⌘K</Kbd>
        </button>

        {/* Engine status ------------------------------------------------ */}
        <button
          type="button"
          onClick={onRefreshHealth}
          title="Refresh engine status"
          className="flex h-8 items-center gap-1.5 rounded-[6px] border border-line bg-surface px-2.5 text-[12px] text-ink-2 transition-colors duration-150 hover:bg-surface-2"
        >
          <Activity
            className={[
              "h-3.5 w-3.5",
              engineUp ? "text-emerald-600" : "text-red-500",
            ].join(" ")}
          />
          <span className="hidden sm:inline">{engineUp ? "Online" : "Offline"}</span>
          <RefreshCw className="h-3 w-3 text-faint" />
        </button>

        {/* Primary action ----------------------------------------------- */}
        <Button variant="primary" size="sm" onClick={onNewScan} disabled={running}>
          {running ? "Scanning…" : "New scan"}
        </Button>
      </div>
    </header>
  );
}
