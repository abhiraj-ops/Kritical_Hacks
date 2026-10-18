import { memo, useMemo } from 'react';
import { AlertTriangle, Inbox, Radio } from 'lucide-react';
import type { Alert } from '@/api/client';
import { SEVERITY_META, TYPE_META, relativeTime } from '@/lib/format';

interface Props {
  alerts: Alert[];
  loading: boolean;
  onSelect: (a: Alert) => void;
}

/**
 * Auto-scrolling live feed. Pauses on hover and on focus for keyboard users.
 *
 * Only the newest FEED_WINDOW records are rendered (twice, for a seamless
 * scroll loop). The full set lives in the triage table below — rendering all
 * ~250 here produced 500 buttons and made every theme switch and region filter
 * take over a second.
 */
const FEED_WINDOW = 18;

function AlertFeedImpl({ alerts, loading, onSelect }: Props) {
  const items = useMemo(() => {
    const win = alerts.slice(0, FEED_WINDOW);
    return [...win, ...win];
  }, [alerts]);

  const shown = alerts.length > FEED_WINDOW;

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading alerts">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[62px] w-full" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Inbox className="h-7 w-7" style={{ color: 'var(--text-subtle)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          No alerts match this filter
        </p>
        <p className="max-w-xs text-xs" style={{ color: 'var(--text-subtle)' }}>
          Try a different region, or widen the severity filter. Upstream feeds are polled every 5 minutes.
        </p>
      </div>
    );
  }

  return (
    <div
      className="feed-mask relative h-72 overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-deep) 45%, transparent)' }}
      tabIndex={0}
      aria-label={`Live alert feed, showing newest ${Math.min(alerts.length, FEED_WINDOW)} of ${alerts.length} alerts`}
    >
      <div className="feed-track space-y-2 p-2.5">
        {items.map((a, i) => {
          const sev = SEVERITY_META[a.severity];
          return (
            <button
              key={`${a.id}-${i}`}
              type="button"
              onClick={() => onSelect(a)}
              className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition"
              style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-inner)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--panel)')}
            >
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: `var(${sev.varName})` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  {a.summary}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                  <Radio className="h-3 w-3" />
                  {a.source} · {TYPE_META[a.type].label} · {relativeTime(a.timestamp)}
                  {a.aiGenerated && (
                    <span
                      className="ml-1 rounded px-1 py-px text-[9px] font-bold uppercase"
                      style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--accent)' }}
                    >
                      AI
                    </span>
                  )}
                </span>
              </span>
              <span
                className="badge shrink-0"
                style={{
                  color: `var(${sev.varName})`,
                  borderColor: `var(${sev.varName})`,
                  background: `color-mix(in srgb, var(${sev.varName}) 14%, transparent)`,
                }}
              >
                {sev.label}
              </span>
            </button>
          );
        })}
      </div>
      {shown && (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-subtle)' }}>
          Newest {FEED_WINDOW} of {alerts.length} alerts · full list in the triage log below
        </p>
      )}
    </div>
  );
}

export const AlertFeed = memo(AlertFeedImpl);

/** Shown when the upstream providers are unreachable. */
export function DataUnavailable({ message }: { message?: string | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-8 text-center"
      style={{ borderColor: 'color-mix(in srgb, var(--severity-high) 40%, transparent)', background: 'var(--panel)' }}
    >
      <AlertTriangle className="h-7 w-7" style={{ color: 'var(--severity-high)' }} />
      <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
        Data unavailable
      </p>
      <p className="max-w-sm text-xs" style={{ color: 'var(--text-subtle)' }}>
        {message ?? 'No upstream hazard feed responded. Nothing is being shown because no verified data exists.'}
      </p>
    </div>
  );
}