import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Alert } from '@/api/client';
import { SEVERITY_META, TYPE_META, relativeTime } from '@/lib/format';

interface Props {
  alert: Alert | null;
  onClose: () => void;
}

/** Slide-over details panel for a clicked map marker or alert row. */
export function DetailsPanel({ alert, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!alert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [alert, onClose]);

  if (!alert) return null;

  const sev = SEVERITY_META[alert.severity];

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close details panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(2,6,16,0.55)', backdropFilter: 'blur(3px)' }}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Alert details"
        className="glass relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto rounded-none rounded-l-3xl p-6 outline-none sm:rounded-l-3xl"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <span
              className="badge"
              style={{
                color: `var(${sev.varName})`,
                borderColor: `var(${sev.varName})`,
                background: `color-mix(in srgb, var(${sev.varName}) 14%, transparent)`,
              }}
            >
              {sev.label}
            </span>
            <h3 className="mt-3 text-lg font-bold" style={{ color: 'var(--text)' }}>
              {TYPE_META[alert.type].label}
            </h3>
          </div>
          <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
          {alert.summary}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Field label="Region" value={alert.region} />
          <Field label="Type" value={TYPE_META[alert.type].label} />
          <Field label="Severity" value={sev.label} />
          <Field label="Time" value={relativeTime(alert.timestamp)} />
          <Field label="Source" value={alert.source} />
          <Field
            label="Coordinates"
            value={`${alert.lat.toFixed(3)}, ${alert.lng.toFixed(3)}`}
          />
        </dl>

        {alert.metrics && Object.keys(alert.metrics).length > 0 && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <p className="eyebrow">Measurements</p>
            <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {Object.entries(alert.metrics)
                .filter(([, v]) => v !== '' && v !== 'unknown')
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span>{humanizeKey(k)}</span>
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>
                      {String(v)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {alert.aiGenerated && (
          <p
            className="mt-4 rounded-xl border p-3 text-xs"
            style={{
              borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              color: 'var(--text-muted)',
            }}
          >
            Severity and category were classified by AI. Verify against the original source before acting.
          </p>
        )}

        <div className="mt-auto pt-6">
          {alert.sourceUrl ? (
            <a className="btn btn-primary w-full" href={alert.sourceUrl} target="_blank" rel="noopener noreferrer">
              Open original source ↗
            </a>
          ) : (
            <p className="text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
              No source link available for this record.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <dt className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>
        {label}
      </dt>
      <dd className="mt-1 font-semibold" style={{ color: 'var(--text)' }}>
        {value}
      </dd>
    </div>
  );
}

function humanizeKey(k: string): string {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}