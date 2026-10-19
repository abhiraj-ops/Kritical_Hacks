"use client";

/** Render the Research API's markdown-ish report without pulling in a renderer. */
function ReportBody({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 40);

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const heading = /^#{1,6}\s+/.test(block);
        const cleaned = block.replace(/^#{1,6}\s+/, "").trim();

        if (heading) {
          return (
            <h3 key={i} className="text-[15px] font-semibold text-[var(--ink)]">
              {cleaned}
            </h3>
          );
        }
        if (/^[-*]\s+/m.test(block)) {
          const items = cleaned
            .split(/\n/)
            .map((l) => l.replace(/^[-*]\s+/, "").trim())
            .filter(Boolean);
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5 text-[var(--muted)]">
              {items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[var(--muted)]">
            {cleaned}
          </p>
        );
      })}
    </div>
  );
}

export default function DeepReport({
  status,
  message,
  report,
  citations,
  error,
  hint,
}: {
  status: "idle" | "running" | "done" | "error";
  message?: string;
  report?: string;
  citations?: string[];
  error?: string;
  hint?: string;
}) {
  if (status === "idle") return null;

  return (
    <section className="panel animate-fade-up p-5 sm:p-6">
      <header className="flex items-center gap-2.5">
        <span className="text-lg">🔬</span>
        <h2 className="text-lg font-semibold">Deep research report</h2>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">
          TinyFish Research
        </span>
      </header>

      {status === "running" && (
        <div className="mt-4 flex items-center gap-3 text-sm text-[var(--muted)]">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          <span>{message ?? "Researching…"}</span>
        </div>
      )}

      {status === "error" && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm text-amber-200">{error}</p>
          {hint && <p className="mt-1 text-[12px] text-[var(--muted)]">{hint}</p>}
        </div>
      )}

      {status === "done" && report && (
        <div className="mt-4">
          <ReportBody text={report} />

          {citations && citations.length > 0 && (
            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <h4 className="mb-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
                Citations ({citations.length})
              </h4>
              <ul className="flex flex-col gap-1">
                {citations.slice(0, 12).map((c, i) => (
                  <li key={i} className="truncate text-[12px]">
                    <a
                      href={c}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-300/80 hover:underline"
                    >
                      {c}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
