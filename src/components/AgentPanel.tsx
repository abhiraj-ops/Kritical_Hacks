import { Bot, CheckCircle2, ExternalLink, Loader2, Search } from 'lucide-react';
import type { AgentPayload } from '@/api/client';

interface Props {
  running: boolean;
  result: AgentPayload | null;
  error: string | null;
  onRun: () => void;
  regionLabel: string;
}

const STAGES = ['Scanning live web', 'Fetching markdown', 'Classifying severity', 'Alert dispatched'];

/** Runs the real TinyFish agent via /api/agent and reports every stage honestly. */
export function AgentPanel({ running, result, error, onRun, regionLabel }: Props) {
  const stageByName = new Map(result?.stages?.map((s) => [s.name, s]) ?? []);

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
        background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text)' }}>
            <Bot className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            TinyFish Web Agent
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {running
              ? 'Running live web search and page extraction…'
              : error
              ? error
              : result?.ok
              ? `${result.results?.length ?? 0} live sources retrieved${result.fetchedPages ? ` · ${result.fetchedPages} pages fetched` : ''}`
              : `Searches the live web for ${regionLabel} hazards. Requires TINYFISH_API_KEY on the server.`}
          </p>
        </div>
        <button type="button" onClick={onRun} disabled={running} className="btn btn-primary shrink-0">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {running ? 'Running…' : 'Run TinyFish Web Agent'}
        </button>
      </div>

      {/* Stage progress */}
      <ol className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] font-semibold sm:grid-cols-4">
        {STAGES.map((s) => {
          const st = stageByName.get(s);
          const done = st?.status === 'ok';
          const failed = st?.status === 'error';
          const active = running && !result && !error;
          return (
            <li
              key={s}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              title={st?.detail}
              style={{
                background: done || failed ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'var(--panel)',
                color: done || failed ? 'var(--accent)' : 'var(--text-subtle)',
              }}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : failed ? (
                <span className="h-3 w-3 rounded-full" style={{ background: 'var(--severity-critical)' }} />
              ) : (
                <span className="h-3 w-3 shrink-0 rounded-full border border-current" />
              )}
              <span className="truncate">
                {s}
                {active && '…'}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <p
          className="mt-3 rounded-lg p-3 text-xs"
          style={{
            background: 'color-mix(in srgb, var(--severity-critical) 12%, transparent)',
            color: 'var(--severity-critical)',
          }}
        >
          {error}
        </p>
      )}

      {result?.ok && result.results && result.results.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {result.results.slice(0, 8).map((r) => (
            <li key={r.id}>
              <a
                href={r.sourceUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg border p-2.5 transition"
                style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
              >
                <span
                  className="badge shrink-0"
                  style={{
                    color: `var(--severity-${r.severity})`,
                    borderColor: `var(--severity-${r.severity})`,
                    background: `color-mix(in srgb, var(--severity-${r.severity}) 14%, transparent)`,
                  }}
                >
                  {r.severity}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold" style={{ color: 'var(--text)' }}>
                    {r.summary.slice(0, 110)}
                  </span>
                  <span className="block truncate text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                    {r.source}
                  </span>
                </span>
                <ExternalLink className="h-3 w-3 shrink-0" style={{ color: 'var(--text-subtle)' }} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}