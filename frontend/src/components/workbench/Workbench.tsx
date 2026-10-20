"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  FileText,
  ListTree,
  Wrench,
  ScrollText,
  History as HistoryIcon,
  Copy,
  Eraser,
  Crosshair,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";

import Sidebar from "@/components/shell/Sidebar";
import TopBar from "@/components/shell/TopBar";
import CommandPalette, { type CommandItem } from "@/components/shell/CommandPalette";
import ShortcutsDialog from "@/components/shell/ShortcutsDialog";
import TargetComposer from "@/components/workbench/TargetComposer";
import ActivityLog from "@/components/workbench/ActivityLog";
import RiskSummary from "@/components/workbench/RiskSummary";
import ExecutiveSummary from "@/components/workbench/ExecutiveSummary";
import FindingsTable from "@/components/workbench/FindingsTable";
import PatchPanel from "@/components/workbench/PatchPanel";
import HistoryTable from "@/components/workbench/HistoryTable";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import Kbd from "@/components/ui/Kbd";

import type { AgentEvent, Assessment, HealthResponse } from "@/lib/types";
import { severityToken } from "@/lib/types";
import { clearHistory, loadHistory, upsertScan, type ScanRecord } from "@/lib/scans";
import { VIEW_DESCRIPTIONS, VIEW_LABELS, type ViewKey } from "@/lib/views";
import { hostOf, shortenUrl } from "@/lib/format";

// The API routes live in this same Next.js app, so the default is
// same-origin — which is what a single Netlify deploy needs. Set
// NEXT_PUBLIC_API_URL to point at a separately hosted backend instead.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const SAMPLE_TARGET = "https://nvd.nist.gov/vuln/detail/CVE-2021-44228";

/** How often the client asks the server for job progress. */
const POLL_INTERVAL_MS = 1200;

const VIEW_ICONS: Record<ViewKey, typeof Search> = {
  assessment: Sparkles,
  findings: ListTree,
  patch: Wrench,
  log: ScrollText,
  history: HistoryIcon,
};

export default function Workbench() {
  const [target, setTarget] = useState(SAMPLE_TARGET);
  const [cveId, setCveId] = useState("");
  const [focus, setFocus] = useState("");

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [running, setRunning] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewKey>("assessment");
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenRef = useRef(0);

  /* --- backend health --------------------------------------------------- */
  const refreshHealth = useCallback(() => {
    fetch(`${API_BASE}/api/v1/health`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHealth(data as HealthResponse | null))
      .catch(() => setHealth(null));
  }, []);

  /* --- restoring a previous run ------------------------------------------ */
  const restoreScan = useCallback(async (record: ScanRecord, quiet = false) => {
    setActiveScanId(record.id);
    setTarget(record.target);
    if (!quiet) setError(null);

    try {
      const r = await fetch(`${API_BASE}/api/v1/scan/${record.id}`, { cache: "no-store" });
      if (!r.ok) throw new Error("not found");
      const job = (await r.json()) as {
        events: AgentEvent[];
        assessment: Assessment | null;
      };
      setEvents(job.events ?? []);
      setAssessment(job.assessment);
      seenRef.current = job.events?.length ?? 0;
      setView("assessment");
      return true;
    } catch {
      setEvents([]);
      setAssessment(null);
      if (!quiet) {
        setError(
          "That run is no longer available on the server — job state is kept for one hour. Start a new scan to reproduce it.",
        );
      }
      return false;
    }
  }, []);

  const openScan = useCallback(
    async (record: ScanRecord) => {
      await restoreScan(record, false);
    },
    [restoreScan],
  );

  useEffect(() => {
    refreshHealth();
    const records = loadHistory();
    setHistory(records);

    // Restore the last completed run so a refresh does not land on an empty
    // workspace. Job state lives on the server for an hour, so this usually
    // works; if it does not, the history table still lists the run.
    const last = records.find((record) => record.status === "done");
    if (last) void restoreScan(last, true);
  }, [refreshHealth, restoreScan]);

  /* --- cleanup ---------------------------------------------------------- */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* --- scanning --------------------------------------------------------- */
  const startScan = useCallback(async () => {
    const trimmed = target.trim();
    if (!trimmed) {
      setError("Enter a target URL to scan.");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setEvents([]);
    setAssessment(null);
    setError(null);
    setRunning(true);
    seenRef.current = 0;
    setView("assessment");

    const startedAt = new Date().toISOString();

    try {
      const res = await fetch(`${API_BASE}/api/v1/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: trimmed,
          cve_id: cveId.trim() || null,
          focus: focus.trim() || null,
        }),
      });
      const payload = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !payload.jobId) {
        setError(payload.error ?? "Could not start the scan.");
        setRunning(false);
        return;
      }

      const jobId = payload.jobId;
      setActiveScanId(jobId);
      setHistory((prev) =>
        upsertScan({
          id: jobId,
          target: trimmed,
          status: "running",
          startedAt,
          finishedAt: null,
          riskScore: null,
          severity: null,
          findingCount: 0,
          engine: null,
          error: null,
        }),
      );

      const poll = async () => {
        try {
          const r = await fetch(`${API_BASE}/api/v1/scan/${jobId}`, { cache: "no-store" });
          if (!r.ok) {
            setError("Lost the scan job. Please start a new scan.");
            setRunning(false);
            return;
          }
          const job = (await r.json()) as {
            status: "queued" | "running" | "done" | "error";
            events: AgentEvent[];
            assessment: Assessment | null;
            error: string | null;
          };

          // Append only the events we have not seen yet — this is what makes
          // the log fill up live.
          if (job.events.length > seenRef.current) {
            const fresh = job.events.slice(seenRef.current);
            seenRef.current = job.events.length;
            setEvents((prev) => [...prev, ...fresh]);
          }

          if (job.status === "done") {
            if (job.assessment) setAssessment(job.assessment);
            setRunning(false);
            setHistory((prev) =>
              upsertScan({
                id: jobId,
                target: trimmed,
                status: "done",
                startedAt,
                finishedAt: new Date().toISOString(),
                riskScore: job.assessment?.risk.risk_score ?? null,
                severity: job.assessment?.risk.severity_label ?? null,
                findingCount: job.assessment?.vulnerability_breakdown.length ?? 0,
                engine: job.assessment?.risk.engine ?? null,
                error: null,
              }),
            );
            return;
          }
          if (job.status === "error") {
            setError(job.error ?? "The scan failed.");
            setRunning(false);
            setHistory((prev) =>
              upsertScan({
                id: jobId,
                target: trimmed,
                status: "error",
                startedAt,
                finishedAt: new Date().toISOString(),
                riskScore: null,
                severity: null,
                findingCount: 0,
                engine: null,
                error: job.error ?? "The scan failed.",
              }),
            );
            return;
          }
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } catch {
          setError("Lost connection to the analysis backend.");
          setRunning(false);
        }
      };

      timerRef.current = setTimeout(poll, 300);
    } catch {
      setError("Could not reach the analysis backend.");
      setRunning(false);
    }
  }, [target, cveId, focus]);

  /* --- keyboard --------------------------------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const target_ = event.target as HTMLElement | null;
      const typing =
        target_?.tagName === "INPUT" ||
        target_?.tagName === "TEXTAREA" ||
        target_?.isContentEditable;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (meta && event.key === "Enter") {
        event.preventDefault();
        if (!running) void startScan();
        return;
      }
      if (event.key === "/" && !typing && !paletteOpen) {
        event.preventDefault();
        document.getElementById("target-url")?.focus();
        return;
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === "Escape" && paletteOpen) {
        event.preventDefault();
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running, startScan, paletteOpen]);

  /* --- command palette -------------------------------------------------- */
  const paletteItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

    for (const [key, label] of Object.entries(VIEW_LABELS) as [ViewKey, string][]) {
      const Icon = VIEW_ICONS[key];
      items.push({
        id: `view-${key}`,
        label,
        group: "Views",
        hint: VIEW_DESCRIPTIONS[key],
        icon: <Icon className="h-4 w-4" />,
        keywords: key,
        onSelect: () => setView(key),
      });
    }

    items.push({
      id: "action-new-scan",
      label: "Start a new scan",
      group: "Actions",
      hint: "⌘↵",
      icon: <Crosshair className="h-4 w-4" />,
      keywords: "run assess target",
      onSelect: () => {
        setView("assessment");
        window.setTimeout(() => document.getElementById("target-url")?.focus(), 0);
      },
    });

    if (assessment?.patch?.diff) {
      items.push({
        id: "action-copy-diff",
        label: "Copy the remediation diff",
        group: "Actions",
        icon: <Copy className="h-4 w-4" />,
        keywords: "patch clipboard",
        onSelect: () => {
          void navigator.clipboard.writeText(assessment.patch!.diff);
          setView("patch");
        },
      });
    }

    if (history.length > 0) {
      items.push({
        id: "action-clear-history",
        label: "Clear scan history",
        group: "Actions",
        icon: <Eraser className="h-4 w-4" />,
        keywords: "delete reset",
        onSelect: () => {
          clearHistory();
          setHistory([]);
        },
      });
    }

    for (const record of history.slice(0, 8)) {
      items.push({
        id: `run-${record.id}`,
        label: hostOf(record.target),
        group: "Recent runs",
        hint: record.riskScore !== null ? `${record.riskScore}/100` : record.status,
        icon: <Search className="h-4 w-4" />,
        keywords: record.target,
        onSelect: () => void openScan(record),
      });
    }

    return items;
  }, [assessment, history, openScan]);

  /* --- render ----------------------------------------------------------- */
  const ViewIcon = VIEW_ICONS[view];
  const hasResult = assessment !== null;

  /** The finding whose weakness class the generated patch addresses. */
  const linkedFinding =
    assessment?.patch?.cwe
      ? assessment.vulnerability_breakdown.find(
          (finding) => finding.cwe?.toUpperCase() === assessment.patch?.cwe?.toUpperCase(),
        )
      : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {!sidebarCollapsed && (
        <Sidebar
          view={view}
          onViewChange={setView}
          history={history}
          activeScanId={activeScanId}
          onSelectScan={(record) => void openScan(record)}
          health={health}
          onOpenPalette={() => setPaletteOpen(true)}
          onCollapse={() => setSidebarCollapsed(true)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          view={view}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          sidebarCollapsed={sidebarCollapsed}
          health={health}
          onRefreshHealth={refreshHealth}
          onNewScan={() => {
            setView("assessment");
            window.setTimeout(() => document.getElementById("target-url")?.focus(), 0);
          }}
          running={running}
        />

        <main className="scroll-slim flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1360px] px-5 py-5">
            {/* Page header ------------------------------------------------- */}
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-ink">
                  <ViewIcon className="h-[18px] w-[18px] text-faint" />
                  {VIEW_LABELS[view]}
                </h1>
                <p className="mt-0.5 text-[13px] leading-5 text-muted">
                  {VIEW_DESCRIPTIONS[view]}
                </p>
              </div>
              {hasResult && assessment && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
                  <span className="font-mono">{shortenUrl(assessment.target)}</span>
                  <span className="text-line-strong">|</span>
                  <span>{assessment.vulnerability_breakdown.length} findings</span>
                  <span className="text-line-strong">|</span>
                  <span className="font-mono">{assessment.reasoning_engine}</span>
                </div>
              )}
            </div>

            {/* Composer ---------------------------------------------------- */}
            <TargetComposer
              target={target}
              cveId={cveId}
              focus={focus}
              onTargetChange={setTarget}
              onCveChange={setCveId}
              onFocusChange={setFocus}
              onRun={() => void startScan()}
              running={running}
              error={error}
            />

            {/* Views -------------------------------------------------------- */}
            <div className="mt-4">
              {view === "assessment" && (
                <div className="space-y-4">
                  {hasResult && assessment ? (
                    <>
                      <div className="grid gap-4 xl:grid-cols-12">
                        <div className="xl:col-span-7">
                          <RiskSummary assessment={assessment} />
                        </div>
                        <div className="xl:col-span-5">
                          <ActivityLog events={events} running={running} maxHeight="540px" />
                        </div>
                      </div>
                      <ExecutiveSummary assessment={assessment} />
                      <FindingsTable findings={assessment.vulnerability_breakdown} />
                    </>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-12">
                      <div className="xl:col-span-7">
                        <PipelineExplainer running={running} />
                      </div>
                      <div className="xl:col-span-5">
                        <ActivityLog events={events} running={running} maxHeight="540px" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {view === "findings" && (
                <FindingsTable
                  findings={assessment?.vulnerability_breakdown ?? []}
                />
              )}

              {view === "patch" && (
                <div className="grid gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <PatchPanel patch={assessment?.patch ?? null} />
                  </div>
                  <div className="xl:col-span-4">
                    <Panel
                      eyebrow="Context"
                      title="What this patch addresses"
                      icon={<FileText className="h-4 w-4 text-faint" />}
                      bodyClassName="p-4"
                    >
                      {assessment?.patch ? (
                        <>
                          {linkedFinding ? (
                            <div className="rounded-[7px] border border-line bg-surface-2 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={[
                                    "inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.05em]",
                                    severityToken(linkedFinding.severity).bg,
                                    severityToken(linkedFinding.severity).text,
                                    severityToken(linkedFinding.severity).border,
                                  ].join(" ")}
                                >
                                  {severityToken(linkedFinding.severity).label}
                                </span>
                                <span className="font-mono text-[11px] tabular-nums text-muted">
                                  {Math.round(linkedFinding.confidence * 100)}% confidence
                                </span>
                              </div>
                              <p className="mt-2 text-[12.5px] font-medium leading-5 text-ink">
                                {linkedFinding.title}
                              </p>
                              {linkedFinding.cwe && (
                                <p className="mt-1 font-mono text-[11.5px] text-low-fg">
                                  {linkedFinding.cwe}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[12.5px] leading-relaxed text-muted">
                              No finding in this assessment matches the class of this patch.
                            </p>
                          )}

                          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12px]">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Class</span>
                              <span className="font-mono text-ink-2">
                                {assessment.patch.cwe ?? "—"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Language</span>
                              <span className="font-mono text-ink-2">{assessment.patch.language}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Steps</span>
                              <span className="font-mono text-ink-2">
                                {assessment.patch.steps.length}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">References</span>
                              <span className="font-mono text-ink-2">
                                {assessment.patch.references.length}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Target</span>
                              <span className="truncate font-mono text-ink-2" title={assessment.target}>
                                {hostOf(assessment.target)}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
                            Generated by {assessment.reasoning_engine} from the upstream fix
                            the agent found. Review it against your codebase before applying.
                          </p>
                        </>
                      ) : (
                        <p className="text-[12.5px] leading-relaxed text-muted">
                          Run a scan to generate a remediation patch for the vulnerability the
                          agent finds.
                        </p>
                      )}
                    </Panel>
                  </div>
                </div>
              )}

              {view === "log" && <ActivityLog events={events} running={running} maxHeight="640px" />}

              {view === "history" && (
                <HistoryTable
                  records={history}
                  activeId={activeScanId}
                  onSelect={(record) => void openScan(record)}
                  onClear={() => {
                    clearHistory();
                    setHistory([]);
                  }}
                />
              )}
            </div>

            {/* Footer ------------------------------------------------------ */}
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[11.5px] text-faint">
              <span>
                ZeroDay-Guard AI · TinyFish Search + Fetch + Agent + Research · AST analysis
                and CodeBERT embeddings on the self-hosted tier
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(true)}
                  className="flex items-center gap-1.5 rounded-[4px] px-1 py-0.5 transition-colors duration-150 hover:text-muted"
                >
                  <Kbd>?</Kbd>
                  for shortcuts
                </button>
              </span>
            </footer>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        onClose={() => setPaletteOpen(false)}
      />

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * First-run explainer
 *
 * Four concrete steps, because an empty dashboard should still tell the
 * operator what the system is about to do.
 * ------------------------------------------------------------------ */

const STAGES = [
  {
    title: "Search",
    body: "Queries the advisory, release-note and proof-of-concept indexes for the target and its CVE.",
  },
  {
    title: "Fetch",
    body: "Renders the candidate pages and pulls structured vulnerability records out of them.",
  },
  {
    title: "Analyse",
    body: "Fuses the static analyser with contextual embeddings into a 0–100 risk score.",
  },
  {
    title: "Reason",
    body: "Writes the assessment and produces a unified diff for the fix upstream shipped.",
  },
];

function PipelineExplainer({ running }: { running: boolean }) {
  return (
    <Panel
      eyebrow="Before you start"
      title="How the assessment runs"
      icon={<Sparkles className="h-4 w-4 text-faint" />}
      bodyClassName="p-4"
    >
      <p className="max-w-2xl text-[13px] leading-[1.6] text-ink-2">
        Point the scanner at a URL and four stages run in order. Search and Fetch always
        run; the browser agent is time-boxed and optional, so a scan completes with real
        live-web data even when the agent times out.
      </p>

      <ol className="mt-4 space-y-3">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="flex gap-3">
            <span
              className={[
                "mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                running && index === 0
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-line bg-surface-2 text-muted",
              ].join(" ")}
            >
              {running && index === 0 ? (
                <CircleDashed className="h-3.5 w-3.5 animate-spin" />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0">
              <span className="text-[13px] font-medium text-ink">{stage.title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-[1.6] text-muted">
                {stage.body}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Search and Fetch are free and always run
        </span>
        <Button
          variant="quiet"
          size="xs"
          onClick={() => document.getElementById("target-url")?.focus()}
        >
          Focus the target field
        </Button>
      </div>
    </Panel>
  );
}
