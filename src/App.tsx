import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Globe2, RefreshCw } from 'lucide-react';
import type { Alert, HazardType } from '@/api/client';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { StatCards } from '@/components/StatCards';
import { AlertFeed, DataUnavailable } from '@/components/AlertFeed';
import { AgentPanel } from '@/components/AgentPanel';
import { HazardMap, LayerToggles, MapLegend } from '@/components/HazardMap';
import { LAYERS } from '@/lib/layers';
import { DetailsPanel } from '@/components/DetailsPanel';
import { TriageTable } from '@/components/TriageTable';
import { DataSources, Features, FutureScope } from '@/components/Sections';
import { useTheme } from '@/hooks/useTheme';
import {
  REGION_IDS,
  REGION_LABELS,
  filterAlerts,
  useAlerts,
  useMergedAlerts,
  useRegionFromUrl,
  useTinyFishAgent,
  type RegionId,
} from '@/hooks/useEcoData';

export default function App() {
  const { theme, setTheme } = useTheme();
  const [region, setRegion] = useRegionFromUrl();
  const { data, error, loading, refreshing, lastUpdated, refresh } = useAlerts();
  const agent = useTinyFishAgent();

  const [activeLayers, setActiveLayers] = useState<Set<HazardType>>(new Set(LAYERS.map((l) => l.id)));
  const [selected, setSelected] = useState<Alert | null>(null);

  const serverAlerts = useMemo(() => data?.alerts, [data]);
  const agentAlerts = useMemo<Alert[]>(
    () =>
      (agent.result?.results ?? []).map((r) => {
        const { lat, lng } = coordsFor(r.regionId);
        return {
          id: r.id,
          type: r.type,
          severity: r.severity,
          region: r.region,
          regionId: r.regionId,
          lat,
          lng,
          timestamp: r.timestamp,
          source: r.source,
          sourceUrl: r.sourceUrl,
          summary: r.summary,
          excerpt: r.excerpt,
          aiGenerated: true,
        };
      }),
    [agent.result],
  );

  const all = useMergedAlerts(serverAlerts, agentAlerts);
  const scoped = useMemo(() => filterAlerts(all, { region }), [all, region]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of scoped) c[a.severity] += 1;
    return c;
  }, [scoped]);

  const toggleLayer = useCallback((t: HazardType) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const scrollToMap = useCallback(() => {
    document.getElementById('live-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const runAgent = useCallback(async () => {
    await agent.run({ region });
    scrollToMap();
  }, [agent, region, scrollToMap]);

  // Auto-refresh every 5 minutes so the LIVE badge stays honest.
  useEffect(() => {
    const t = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const status = data?.meta.status ?? (error ? 'unavailable' : 'ok');
  const nothingLive = status === 'unavailable' && all.length === 0;

  return (
    <div className="noise min-h-screen antialiased">
      <Navbar
        theme={theme}
        onThemeChange={setTheme}
        live={status === 'ok'}
        lastUpdated={lastUpdated}
        status={status}
      />

      <Hero onRunAgent={runAgent} agentRunning={agent.running} onLaunchMap={scrollToMap} />

      <main>
        {/* ============ COMMAND CENTER ============ */}
        <section id="live-map" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-6 sm:px-6">
          <div className="glass overflow-hidden">
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="eyebrow">Live Command Center</p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl" style={{ color: 'var(--text)' }}>
                  {REGION_LABELS[region]} hazard overview
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by region">
                  {REGION_IDS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="chip"
                      aria-pressed={region === r}
                      onClick={() => setRegion(r as RegionId)}
                    >
                      {REGION_LABELS[r]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost !px-2.5 !py-2"
                  onClick={refresh}
                  disabled={refreshing}
                  aria-label="Refresh data"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_1fr]">
              {/* MAP */}
              <div className="border-b p-4 sm:p-6 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      India · Live Hazard Layer
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {scoped.length} record{scoped.length === 1 ? '' : 's'} · click a marker for details
                    </p>
                  </div>
                </div>

                <LayerToggles active={activeLayers} onToggle={toggleLayer} />

                <div className="relative mt-3 h-[420px] overflow-hidden rounded-2xl border sm:h-[500px]" style={{ borderColor: 'var(--border)' }}>
                  {loading ? (
                    <div className="skeleton h-full w-full" />
                  ) : scoped.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" style={{ background: 'var(--bg-deep)' }}>
                      <AlertTriangle className="h-7 w-7" style={{ color: 'var(--text-subtle)' }} />
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        No hazards in view
                      </p>
                      <p className="max-w-xs text-xs" style={{ color: 'var(--text-subtle)' }}>
                        Either every active layer is switched off, or no upstream source is currently reporting
                        for {REGION_LABELS[region]}.
                      </p>
                    </div>
                  ) : (
                    <>
                      <HazardMap
                        alerts={scoped}
                        region={region}
                        activeLayers={activeLayers}
                        onSelect={setSelected}
                      />
                      <MapLegend counts={counts} />
                    </>
                  )}
                </div>

                {data?.meta.stale && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--severity-high)' }}>
                    Showing cached data — one or more upstream sources failed on the last refresh.
                  </p>
                )}
              </div>

              {/* INTELLIGENCE PANEL */}
              <div className="p-4 sm:p-6">
                <StatCards alerts={scoped} agentCount={agentAlerts.length} loading={loading} />

                <div className="mb-2 mt-5 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
                    Live Scraping Agent Feed
                  </p>
                  {lastUpdated && (
                    <span className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                      updated {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {error && all.length > 0 && (
                  <p
                    className="mb-2 rounded-lg p-2.5 text-xs"
                    style={{
                      background: 'color-mix(in srgb, var(--severity-high) 12%, transparent)',
                      color: 'var(--severity-high)',
                    }}
                  >
                    Refresh failed ({error}) — showing the last successful response.
                  </p>
                )}

                {nothingLive ? <DataUnavailable message={error} /> : <AlertFeed alerts={scoped} loading={loading} onSelect={setSelected} />}

                <div className="mt-4">
                  <AgentPanel
                    running={agent.running}
                    result={agent.result}
                    error={agent.error}
                    onRun={runAgent}
                    regionLabel={REGION_LABELS[region]}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PLATFORM ============ */}
        <section id="platform" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6">
          <p className="eyebrow text-center">Platform</p>
          <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-extrabold sm:text-4xl" style={{ color: 'var(--text)' }}>
            Everything you need to monitor environmental conditions
          </h2>
          <div className="mt-8">
            <Features />
          </div>
        </section>

        {/* ============ SOURCES ============ */}
        <section id="sources" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-12 sm:px-6">
          <div className="glass p-6 sm:p-10" style={{ borderRadius: 'var(--radius-xl)' }}>
            <p className="eyebrow">Integrations</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl" style={{ color: 'var(--text)' }}>
              Connected data sources
            </h2>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>
              Every source below is fetched by a Netlify Function, normalized to one schema and cached for five
              minutes. Providers that need a key say so plainly instead of showing made-up numbers.
            </p>
            <div className="mt-6">
              <DataSources
                sources={data?.meta.sources ?? []}
                tinyFishConfigured={Boolean(data?.meta.tinyfishConfigured)}
              />
            </div>
          </div>
        </section>

        {/* ============ TRIAGE LOG ============ */}
        <section id="triage-log" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-12 sm:px-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">AI Triage &amp; Priority Scoring</p>
              <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl" style={{ color: 'var(--text)' }}>
                Incident log
              </h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              Highest-severity records sort first. AI-classified rows are labelled.
            </p>
          </div>

          <div className="glass p-4 sm:p-6" style={{ borderRadius: 'var(--radius-xl)' }}>
            {loading ? (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : nothingLive ? (
              <DataUnavailable message={error} />
            ) : (
              <TriageTable alerts={all} region={region} onSelect={setSelected} />
            )}
          </div>
        </section>

        {/* ============ FUTURE ============ */}
        <section id="future" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-14 sm:px-6">
          <div
            className="relative overflow-hidden rounded-3xl border p-6 sm:p-10"
            style={{
              borderColor: 'var(--border)',
              background: 'linear-gradient(140deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%)',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
              style={{ background: 'var(--glow-2)', filter: 'blur(90px)' }}
            />
            <p className="eyebrow">Future Scope</p>
            <h2 className="mt-2 max-w-xl text-2xl font-extrabold sm:text-3xl" style={{ color: 'var(--text)' }}>
              From city pilots to a national climate safety net
            </h2>
            <div className="mt-6">
              <FutureScope />
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={scrollToMap} className="btn btn-primary">
                Enter Live Command Center
                <ChevronRight className="h-4 w-4" />
              </button>
              <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--severity-high)' }} />
                Alert counts come from live upstream feeds. No alert is ever fabricated.
              </p>
            </div>
          </div>

          <footer className="mt-8 flex flex-col items-center justify-between gap-2 text-xs sm:flex-row" style={{ color: 'var(--text-subtle)' }}>
            <p className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              EcoPulse AI · TinyFish Search + Fetch · USGS · GDACS · Open-Meteo
            </p>
            <p>All data shown comes from the providers listed above.</p>
          </footer>
        </section>
      </main>

      <DetailsPanel alert={selected} onClose={() => setSelected(null)} />

      {/* Live region for status changes, announced to screen readers */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === 'ok'
          ? `Data live. ${scoped.length} alerts in view.`
          : status === 'degraded'
          ? 'Some data sources are degraded. Showing available data.'
          : 'Data sources unavailable.'}
      </p>
    </div>
  );
}

/** Agent results have no coordinates of their own — anchor them to their region. */
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  global: { lat: 21, lng: 78 },
};

function coordsFor(regionId: string) {
  return REGION_COORDS[regionId] ?? REGION_COORDS.global;
}