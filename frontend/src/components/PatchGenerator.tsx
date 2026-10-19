"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Code2,
  FileCode2,
  CheckCircle2,
  Copy,
  ChevronDown,
  Wrench,
  Link2,
} from "lucide-react";
import type { PatchFix } from "@/lib/types";

/** Classify a diff line for colouring. */
function diffClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "diff-hunk";
  if (line.startsWith("@@")) return "diff-hunk";
  if (line.startsWith("+")) return "diff-add";
  if (line.startsWith("-")) return "diff-remove";
  return "text-slate-500";
}

export default function PatchGenerator({ patch }: { patch: PatchFix | null }) {
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(true);

  if (!patch) {
    return (
      <section className="panel p-6 text-center">
        <Wrench className="mx-auto h-6 w-6 text-slate-700" />
        <p className="mt-2 text-[12px] text-slate-600">
          No patch generated yet.
        </p>
      </section>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(patch.diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the diff is still selectable */
    }
  };

  const diffLines = patch.diff ? patch.diff.split("\n") : [];

  return (
    <section className="panel overflow-hidden">
      <header className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5" />
          Remediation Patch
        </span>
        {patch.cwe && (
          <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] text-sky-300 normal-case tracking-normal">
            {patch.cwe}
          </span>
        )}
      </header>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-200">{patch.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">
          {patch.description}
        </p>

        {diffLines.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <FileCode2 className="h-3 w-3" />
                {patch.language}
              </span>
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 transition hover:text-emerald-400"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="terminal-scroll max-h-72 overflow-auto bg-[#080b12] px-3 py-2">
              <code>
                {diffLines.map((line, i) => (
                  <span key={i} className={`diff-line ${diffClass(line)}`}>
                    {line || " "}
                  </span>
                ))}
              </code>
            </pre>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-200">
            No automatic diff was produced. An unverified patch is worse than none, so the
            remediation guidance below is given as steps instead.
          </div>
        )}

        {patch.steps.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 transition hover:text-emerald-400"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showSteps ? "" : "-rotate-90"}`}
              />
              Remediation steps
            </button>
            {showSteps && (
              <motion.ol
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 space-y-1.5"
              >
                {patch.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-slate-400">
                    <span className="font-mono text-emerald-500/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 break-words">{step}</span>
                  </li>
                ))}
              </motion.ol>
            )}
          </div>
        )}

        {patch.references.length > 0 && (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
              <Link2 className="h-3 w-3" />
              References
            </h4>
            <ul className="space-y-1">
              {patch.references.slice(0, 6).map((ref, i) => (
                <li key={i} className="truncate text-[11.5px]">
                  <a
                    href={ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400/80 underline-offset-2 hover:underline"
                  >
                    {ref}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
