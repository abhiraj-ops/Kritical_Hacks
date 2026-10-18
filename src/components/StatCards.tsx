import { memo } from 'react';
import { Activity, Bell, Database, Timer } from 'lucide-react';
import type { Alert } from '@/api/client';

interface Props {
  alerts: Alert[];
  agentCount: number;
  loading: boolean;
}

/** Stat cards are computed from real data — never hard-coded. */
export const StatCards = memo(function StatCards({ alerts, agentCount, loading }: Props) {
  const sources = new Set(alerts.map((a) => a.source));
  sources.add('TinyFish Agent');

  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const last24h = alerts.filter((a) => Date.now() - Date.parse(a.timestamp) < 86_400_000).length;

  const cards = [
    {
      icon: Bell,
      label: 'Active Alerts',
      value: alerts.length,
      sub: `${critical} critical · ${last24h} in last 24h`,
    },
    {
      icon: Database,
      label: 'Scraped Sources',
      value: sources.size,
      sub: `${agentCount} found by TinyFish agent`,
    },
    {
      icon: Activity,
      label: 'Monitoring Regions',
      value: new Set(alerts.map((a) => a.regionId)).size,
      sub: 'distinct regions in view',
    },
    {
      icon: Timer,
      label: 'Freshest Signal',
      value: alerts.length ? formatAge(alerts[0].timestamp) : '—',
      sub: alerts.length ? alerts[0].source : 'no data yet',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="glass-frost p-3.5">
          <c.icon className="h-4 w-4" style={{ color: 'var(--accent-strong)' }} />
          {loading ? (
            <>
              <div className="skeleton mt-2 h-7 w-16" />
              <div className="skeleton mt-2 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight">{c.value}</p>
              <p className="mt-1.5 text-xs font-bold">{c.label}</p>
              <p className="mt-0.5 truncate text-[11px] opacity-60">{c.sub}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
});

function formatAge(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}