import { Bot, CheckCircle2, Layers, MapPin, Radio, ShieldAlert, Waves } from 'lucide-react';
import type { SourceStatus } from '@/api/client';

export function Features() {
  const cards = [
    {
      icon: Waves,
      t: 'Real-Time Hazard Monitoring',
      d: 'USGS earthquakes, GDACS global alerts and Open-Meteo severe weather fused into one operational picture, refreshed every 5 minutes.',
    },
    {
      icon: ShieldAlert,
      t: 'AI Crisis Triage',
      d: 'Every record is scored low → critical so responders act on the highest-risk signal first, with the original source always one click away.',
    },
    {
      icon: MapPin,
      t: 'Interactive Maps',
      d: 'OpenStreetMap tiles with severity-coloured markers, clustering at low zoom and toggleable layers per hazard type.',
    },
    {
      icon: Bot,
      t: 'Autonomous TinyFish Scraping',
      d: 'A server-side agent searches the live web and extracts clean markdown, then classifies each result. Keys never reach the browser.',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <article
          key={c.t}
          className="glass group p-5 transition hover:-translate-y-1"
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--accent-strong), var(--accent))',
              boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 30%, transparent)',
            }}
          >
            <c.icon className="h-5 w-5" style={{ color: 'var(--accent-contrast)' }} />
          </span>
          <h3 className="mt-4 text-base font-bold" style={{ color: 'var(--text)' }}>
            {c.t}
          </h3>
          <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
            {c.d}
          </p>
        </article>
      ))}
    </div>
  );
}

const SOURCE_META: Record<string, { icon: typeof Layers; kind: 'keyless' | 'keyed' | 'agent' }> = {
  usgs: { icon: Radio, kind: 'keyless' },
  gdacs: { icon: Radio, kind: 'keyless' },
  'open-meteo': { icon: Layers, kind: 'keyless' },
  openaq: { icon: Layers, kind: 'keyed' },
  firms: { icon: Layers, kind: 'keyed' },
  tinyfish: { icon: Bot, kind: 'agent' },
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  usgs: 'Live M2.5+ earthquakes worldwide, refreshed every minute.',
  gdacs: 'EU/global multi-hazard alerts: storms, floods, quakes, volcanoes.',
  'open-meteo': 'Temperature, wind gusts and rainfall probability for tracked regions.',
  openaq: 'CPCB and India station particulate readings (PM2.5 / PM10).',
  firms: 'VIIRS active fire detections with confidence and radiative power.',
  tinyfish: 'Live web search plus markdown extraction, classified by AI.',
};

export function DataSources({ sources, tinyFishConfigured }: { sources: SourceStatus[]; tinyFishConfigured: boolean }) {
  const rows = [
    ...sources.map((s) => ({ ...s, kind: SOURCE_META[s.id]?.kind ?? 'keyless' })),
    {
      id: 'tinyfish',
      label: 'TinyFish Search + Fetch',
      live: tinyFishConfigured,
      count: 0,
      kind: 'agent' as const,
      reason: tinyFishConfigured ? undefined : ('missing_key' as const),
      message: tinyFishConfigured ? undefined : 'Set TINYFISH_API_KEY to enable the live agent.',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((s) => {
        const Icon = SOURCE_META[s.id]?.icon ?? Layers;
        return (
          <div
            key={s.id}
            className="rounded-2xl border p-4 transition"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <Icon className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
              <StatusPill live={s.live} reason={s.reason} />
            </div>
            <p className="mt-3 text-sm font-bold" style={{ color: 'var(--text)' }}>
              {s.label}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-subtle)' }}>
              {SOURCE_DESCRIPTIONS[s.id] ?? ''}
            </p>
            {s.live && s.count > 0 && (
              <p className="mt-2 text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {s.count} record{s.count === 1 ? '' : 's'} in this response
              </p>
            )}
            {!s.live && s.message && (
              <p className="mt-2 text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                {s.message}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ live, reason }: { live: boolean; reason?: string }) {
  if (live) {
    return (
      <span
        className="badge"
        style={{
          color: '#6ee7b7',
          borderColor: 'rgba(52,211,153,0.4)',
          background: 'rgba(52,211,153,0.12)',
        }}
      >
        Live
      </span>
    );
  }
  return (
    <span
      className="badge"
      style={{
        color: 'var(--text-subtle)',
        borderColor: 'var(--border-strong)',
        background: 'var(--panel-inner)',
      }}
      title={reason === 'missing_key' ? 'API key not configured' : 'Upstream error'}
    >
      {reason === 'missing_key' ? 'Key needed' : 'Unavailable'}
    </span>
  );
}

export function FutureScope() {
  const items = [
    {
      t: 'Multilingual SOS triage',
      d: 'Hindi, Marathi and Tamil citizen reports auto-translated, de-duplicated and geo-resolved before scoring.',
    },
    {
      t: 'Predictive dispatch',
      d: '48-hour risk forecast driving pre-positioned medical, shelter and evacuation assets.',
    },
    {
      t: 'Open civic API',
      d: 'Municipalities subscribe to EcoPulse alerts over webhooks, with an SMS fallback for low-connectivity districts.',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((f, i) => (
        <div key={f.t} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-deep) 35%, transparent)' }}>
          <p className="font-mono text-xs" style={{ color: 'var(--accent)' }}>
            0{i + 1}
          </p>
          <h3 className="mt-2 font-bold" style={{ color: 'var(--text)' }}>
            {f.t}
          </h3>
          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
            {f.d}
          </p>
        </div>
      ))}
    </div>
  );
}

export { CheckCircle2 };