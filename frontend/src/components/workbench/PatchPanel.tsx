"use client";

import { useMemo, useState } from "react";
import { Wrench, FileCode2, Copy, Check, Download, Link2, ListOrdered, Terminal } from "lucide-react";

import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import type { PatchFix } from "@/lib/types";

type Tab = "diff" | "steps" | "references";

const TABS: { key: Tab; label: string; icon: typeof FileCode2 }[] = [
  { key: "diff", label: "Diff", icon: FileCode2 },
  { key: "steps", label: "Steps", icon: ListOrdered },
  { key: "references", label: "References", icon: Link2 },
];

/** Classify a diff line for colouring. */
function diffClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
    return "diff-hunk";
  }
  if (line.startsWith("+")) return "diff-add";
  if (line.startsWith("-")) return "diff-remove";
  return "text-ink-2";
}

export default function PatchPanel({
  patch,
  className = "",
}: {
  patch: PatchFix | null;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("diff");
  const [copied, setCopied] = useState(false);

  const diffLines = useMemo(
    () => (patch?.diff ? patch.diff.split("\n") : []),
    [patch?.diff],
  );

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of diffLines) {
      if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
      else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
    }
    return { added, removed };
  }, [diffLines]);

  if (!patch) {
    return (
      <Panel
        className={className}
        eyebrow="Auto-generated"
        title="Remediation"
        icon={<Wrench className="h-4 w-4 text-faint" />}
        bodyClassName="p-8 text-center"
      >
        <Wrench className="mx-auto h-6 w-6 text-line-strong" />
        <p className="mt-2.5 text-[13px] text-muted">No patch produced for this assessment.</p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-faint">
          The generator only emits a diff when it can find an upstream fix and match the
          vulnerability class. An unverified patch is worse than none.
        </p>
      </Panel>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(patch.diff);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the diff stays selectable */
    }
  };

  const download = () => {
    const blob = new Blob([patch.diff], { type: "text/x-diff;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(patch.cwe ?? "remediation").replace(/[^a-zA-Z0-9.-]/g, "_")}.diff`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      className={className}
      eyebrow="Auto-generated"
      title="Remediation"
      icon={<Wrench className="h-4 w-4 text-faint" />}
      actions={
        <>
          {patch.cwe && (
            <span className="rounded-[4px] border border-low-line bg-low-bg px-1.5 py-[1px] font-mono text-[10.5px] text-low-fg">
              {patch.cwe}
            </span>
          )}
          <Button variant="secondary" size="xs" onClick={copy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </>
      }
      bodyClassName=""
    >
      <div className="p-4">
        <h3 className="text-[14px] font-semibold leading-5 text-ink">{patch.title}</h3>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-[1.6] text-ink-2">
          {patch.description}
        </p>
      </div>

      {/* Tabs ------------------------------------------------------------- */}
      <div className="flex items-center gap-1 border-t border-line px-3 pt-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const count =
            key === "steps"
              ? patch.steps.length
              : key === "references"
                ? patch.references.length
                : diffLines.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "relative flex items-center gap-1.5 px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-150",
                active ? "text-ink" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="font-mono text-[10.5px] text-faint">{count}</span>
              {active && (
                <span className="absolute inset-x-1 -bottom-px h-[2px] rounded-t-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body --------------------------------------------------------- */}
      {tab === "diff" && (
        <div className="px-4 pb-4">
          {diffLines.length > 0 ? (
            <div className="overflow-hidden rounded-[7px] border border-line">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-3 px-3 py-1.5">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
                  <FileCode2 className="h-3.5 w-3.5 text-faint" />
                  {patch.language}
                </span>
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-700">+{stats.added}</span>
                  <span className="text-red-700">−{stats.removed}</span>
                </span>
              </div>
              <pre className="scroll-slim max-h-[340px] overflow-auto bg-surface px-3 py-2.5">
                <code>
                  {diffLines.map((line, index) => (
                    <span key={index} className={`diff-line ${diffClass(line)}`}>
                      {line || " "}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          ) : (
            <div className="rounded-[7px] border border-medium-line bg-medium-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-medium-fg">
              No automatic diff was produced. The remediation guidance is given as steps
              instead — an unverified patch is worse than none.
            </div>
          )}
        </div>
      )}

      {tab === "steps" && (
        <div className="px-4 pb-4">
          {patch.steps.length === 0 ? (
            <p className="text-[12.5px] text-muted">No manual steps were generated.</p>
          ) : (
            <ol className="space-y-2.5">
              {patch.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-px font-mono text-[11.5px] tabular-nums text-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[12.5px] leading-[1.6] text-ink-2">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === "references" && (
        <div className="px-4 pb-4">
          {patch.references.length === 0 ? (
            <p className="text-[12.5px] text-muted">No references were captured.</p>
          ) : (
            <ul className="space-y-1.5">
              {patch.references.map((reference, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-faint" />
                  <a
                    href={reference}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-accent underline-offset-2 hover:underline"
                    title={reference}
                  >
                    {reference}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "diff" && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <Terminal className="h-3.5 w-3.5 text-faint" />
            Apply with <span className="font-mono text-ink-2">git apply</span>
          </span>
          <Button variant="quiet" size="xs" onClick={download}>
            <Download className="h-3 w-3" />
            Download .diff
          </Button>
        </div>
      )}
    </Panel>
  );
}
