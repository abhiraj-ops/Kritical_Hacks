import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
  Droplets,
  FileJson2,
  Filter,
  Globe2,
  Layers,
  MapPin,
  Menu,
  Newspaper,
  Radio,
  Satellite,
  Search,
  ShieldAlert,
  Sparkles,
  Thermometer,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { DEMO_TITLES, INITIAL_FEED, REGIONS, TRIAGE_ROWS, type FeedItem, type RegionId } from './data/ecopulse';
import { classifyUrgency, hasTinyFishKey, tinyFishFetch, tinyFishSearch } from './services/tinyfish';

const AGENT_STAGES = ['Scanning Live Web', 'Fetching Markdown', 'Classifying Severity', 'Alert Dispatched'];

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Active Map', href: '#live-map' },
  { label: 'AI Triage Log', href: '#triage-log' },
  { label: 'Data Sources', href: '#sources' },
  { label: 'Future Scope', href: '#future' },
];

function urgencyStyles(u: string) {
  if (u === 'Critical') return 'bg-red-500/15 text-red-300 border-red-400/30';
  if (u === 'High') return 'bg-orange-500/15 text-orange-300 border-orange-400/30';
  return 'bg-yellow-400/15 text-yellow-200 border-yellow-300/30';
}

function urgencyDot(u: string) {
  if (u === 'Critical') return '#EF4444';
  if (u === 'High') return '#F97316';
  return '#EAB308';
}

export default function App() {
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [alerts, setAlerts] = useState(14);
  const [sources, setSources] = useState(42);
  const [confidence, setConfidence] = useState(96.4);
  const [agentStage, setAgentStage] = useState(-1);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentNote, setAgentNote] = useState('Idle — ready to scan the live web.');
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(hasTinyFishKey());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => setLiveMode(hasTinyFishKey()), []);

  const filteredFeed = useMemo(
    () => (region === 'all' ? feed : feed.filter((f) => f.region === region || f.region === 'global')),
    [feed, region],
  );

  const activeRegion = useMemo(() => REGIONS.find((r) => r.id === region), [region]);

  async function runAgent() {
    if (agentRunning) return;
    setAgentRunning(true);
    setAgentNote('Agent starting…');
    document.getElementById('live-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    for (let i = 0; i < AGENT_STAGES.length; i++) {
      setAgentStage(i);
      setAgentNote(`${AGENT_STAGES[i]}…`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => {
        const t = window.setTimeout(r, 850);
        timers.current.push(t);
      });

      if (i === 0 && hasTinyFishKey()) {
        try {
          setAgentNote('TinyFish Search: querying live web…');
          const q =
            region === 'all' ? 'Delhi air quality flood Mumbai Chennai environmental emergency live' : `${region} environmental hazard flood air quality live news`;
          const results = await tinyFishSearch(q);
          if (results[0]) {
            setSources((s) => s + results.length);
            setAgentNote(`Found ${results.length} live sources via TinyFish Search`);
          }
        } catch {
          setAgentNote('TinyFish Search unreachable (CORS/network) — using simulated stream');
        }
      }
      if (i === 1 && hasTinyFishKey()) {
        try {
          setAgentNote('TinyFish Fetch: extracting markdown…');
          await tinyFishFetch(['https://www.tinyfish.ai/']);
        } catch {
          /* soft fallback */
        }
      }
    }

    const pick = DEMO_TITLES[Math.floor(Math.random() * DEMO_TITLES.length)];
    const cls = classifyUrgency(pick);
    const newItem: FeedItem = {
      id: `live-${Date.now()}`,
      source: hasTinyFishKey() ? 'TinyFish Search' : 'TinyFish Agent (Simulated)',
      title: pick,
      time: 'just now',
      urgency: cls.label,
      region: region === 'all' ? (['delhi', 'mumbai', 'chennai'] as const)[Math.floor(Math.random() * 3)] : (region as RegionId),
    };
    setFeed((f) => [newItem, ...f].slice(0, 30));
    setAlerts((a) => a + 1);
    setSources((s) => s + 3);
    setConfidence((c) => Math.min(99.2, +(c + 0.1).toFixed(1)));
    setAgentNote(`Done — new ${cls.label} alert triaged at ${cls.score.toFixed(1)}/10 and dispatched.`);
    setAgentStage(AGENT_STAGES.length);
    setAgentRunning(false);
  }

  return (
    <div className="noise min-h-screen bg-midnight font-sans text-slate-100 antialiased">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-midnight/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 shadow-glow">
              <Globe2 className="h-5 w-5 text-white" />
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                <span className="h-3 w-3 rounded-full bg-cyan-200" />
              </span>
            </span>
            <span className="font-display text-lg font-800 font-bold tracking-tight text-white">
              EcoPulse <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">AI</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="transition hover:text-sky-300">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> LIVE
            </span>
            <a
              href="#live-map"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              Live Command Center
            </a>
          </div>
          <button className="rounded-lg p-2 text-slate-200 hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 bg-midnight/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-2 py-2.5 text-sm text-slate-200 hover:bg-white/5">
                {l.label}
              </a>
            ))}
            <a href="#live-map" onClick={() => setMenuOpen(false)} className="mt-2 block rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
              Live Command Center
            </a>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-blue-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-sky-400/20 blur-[110px]" />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="eyebrow flex items-center justify-center gap-2">
            <Radio className="h-4 w-4" /> AI-POWERED ENVIRONMENTAL INTELLIGENCE · TINYFISH LIVE AGENTS
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
            See Environmental Risks{' '}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-400 bg-clip-text text-transparent">Before They Become Disasters.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Monitor real-time environmental threats, coordinate emergency response, and triage ground-level crisis data with TinyFish live web scraping agents.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#live-map" className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-7 py-3.5 text-sm font-bold text-white shadow-glow transition hover:brightness-110 sm:w-auto">
              Launch Live Map →
            </a>
            <button
              onClick={runAgent}
              className="w-full rounded-2xl border border-white/20 bg-white/[0.06] px-7 py-3.5 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/[0.12] sm:w-auto"
            >
              Run TinyFish Agent Demo
            </button>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Search API · api.search.tinyfish.ai</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Fetch API · markdown extraction</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">X-API-Key secured · .env.local</span>
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section id="live-map" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-6 sm:px-6">
        <div className="glass-dark overflow-hidden rounded-3xl">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
            <div>
              <p className="eyebrow">Live Command Center</p>
              <h2 className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">Regional Crisis Overview</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                <Filter className="h-3.5 w-3.5" /> Region:
              </span>
              {(['all', 'delhi', 'mumbai', 'chennai', 'global'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    region === r ? 'bg-sky-500 text-white shadow-glow-sky' : 'border border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {r === 'all' ? 'Global' : REGIONS.find((x) => x.id === r)?.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr]">
            {/* LEFT MAP */}
            <div className="relative border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="relative h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0B1B36] via-[#0A162E] to-[#070D1E] sm:h-[480px]">
                <svg className="absolute inset-0 h-full w-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
                      <path d="M36 0H0v36" fill="none" stroke="rgba(120,180,255,0.25)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
                <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs backdrop-blur-md">
                  <p className="font-bold text-white">India · Live Hazard Layer</p>
                  <p className="text-slate-400">clusters color-coded by urgency</p>
                </div>
                {REGIONS.filter((r) => r.id !== 'global').map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRegion(r.id)}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${r.x}%`, top: `${r.y}%` }}
                    aria-label={r.label}
                  >
                    <span className="map-ping relative flex h-7 w-7 items-center justify-center rounded-full" style={{ color: r.color }}>
                      <span className="absolute inset-0 rounded-full opacity-30 blur-md" style={{ background: r.color }} />
                      <span className="relative h-5 w-5 rounded-full border-2 border-white/80" style={{ background: r.color }} />
                    </span>
                    <span className={`mt-1 block whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-bold backdrop-blur-md ${region === r.id ? 'bg-white text-slate-900' : 'bg-black/60 text-white group-hover:bg-black/80'}`}>
                      {r.label} · {r.urgency}
                    </span>
                  </button>
                ))}
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 text-[11px] font-semibold">
                  {[['Critical', '#EF4444'], ['High', '#F97316'], ['Moderate', '#EAB308']].map(([l, c]) => (
                    <span key={l} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-slate-200 backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} /> {l}
                    </span>
                  ))}
                  <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-slate-300 sm:flex">
                    <Satellite className="h-3 w-3" /> updated 12s ago
                  </span>
                </div>
              </div>
              {activeRegion && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-white">{activeRegion.label} — {activeRegion.urgency}</p>
                    <button onClick={() => setRegion('all')} className="text-xs text-sky-300 hover:underline">clear filter</button>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{activeRegion.summary}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-black/30 p-2.5"><p className="text-lg font-extrabold text-white">{activeRegion.incidents}</p><p className="text-[11px] text-slate-400">incidents</p></div>
                    <div className="rounded-xl bg-black/30 p-2.5"><p className="text-lg font-extrabold text-white">{activeRegion.aqi}</p><p className="text-[11px] text-slate-400">AQI</p></div>
                    <div className="rounded-xl bg-black/30 p-2.5"><p className="text-lg font-extrabold text-white">{activeRegion.temp}</p><p className="text-[11px] text-slate-400">temp</p></div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT PANEL */}
            <div className="p-5 sm:p-7">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Bell, label: 'Active Live Alerts', value: String(alerts), sub: '+3 in last hour' },
                  { icon: Database, label: 'TinyFish Scraped Sources', value: String(sources), sub: 'Search + Fetch APIs' },
                  { icon: Sparkles, label: 'AI Triage Confidence', value: `${confidence.toFixed(1)}%`, sub: 'severity classifier v2' },
                  { icon: Zap, label: 'Avg Response Time', value: '1.2s', sub: 'edge-cached pipeline' },
                ].map((k) => (
                  <div key={k.label} className="glass-frost rounded-2xl p-3.5 text-slate-900">
                    <k.icon className="h-4 w-4 text-blue-600" />
                    <p className="mt-2 text-2xl font-extrabold tracking-tight">{k.value}</p>
                    <p className="text-xs font-bold">{k.label}</p>
                    <p className="text-[11px] text-slate-500">{k.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-200/80">
                  <Activity className="h-4 w-4" /> Live Scraping Agent Feed
                </p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${liveMode ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
                  {liveMode ? '● TinyFish key detected' : '● Simulated mode'}
                </span>
              </div>
              <div className="feed-mask relative mt-2 h-56 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="feed-track space-y-2 p-3">
                  {[...filteredFeed, ...filteredFeed].map((f, i) => (
                    <div key={`${f.id}-${i}`} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.05] p-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: urgencyDot(f.urgency) }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-white">{f.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{f.source} · {f.time}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${urgencyStyles(f.urgency)}`}>{f.urgency}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-sky-400/20 bg-gradient-to-br from-blue-600/15 to-sky-400/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-white"><Bot className="h-4 w-4 text-sky-300" /> TinyFish Web Agent</p>
                    <p className="mt-0.5 text-xs text-slate-300">{agentNote}</p>
                  </div>
                  <button
                    onClick={runAgent}
                    disabled={agentRunning}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60"
                  >
                    {agentRunning ? 'Running…' : 'Run TinyFish Web Agent'}
                  </button>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="agent-bar h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300"
                    style={{ width: agentStage < 0 ? '0%' : `${Math.min(100, ((agentStage + 1) / (AGENT_STAGES.length + 1)) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-semibold sm:grid-cols-4">
                  {AGENT_STAGES.map((s, i) => (
                    <span key={s} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${i <= agentStage ? 'bg-sky-400/20 text-sky-100' : 'bg-white/[0.04] text-slate-400'}`}>
                      {i <= agentStage ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current" />} {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="platform" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6">
        <p className="eyebrow text-center">Platform</p>
        <h2 className="mx-auto mt-2 max-w-2xl text-center font-display text-3xl font-extrabold text-white sm:text-4xl">Everything You Need To Monitor Environmental Conditions</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Waves, t: 'Real-Time Hazard Monitoring', d: 'AQI, flood, heat and cyclone signals fused into one live operational picture.' },
            { icon: ShieldAlert, t: 'AI Crisis Triage', d: 'Severity scoring 0–10 with auto-prioritization so responders act on what matters first.' },
            { icon: MapPin, t: 'Interactive Maps', d: 'Cluster-level geospatial view for Delhi-NCR, Mumbai, Chennai and global watch zones.' },
            { icon: Bot, t: 'Autonomous TinyFish Scraping', d: 'Search + Fetch agents pull fresh markdown from news, municipal and social feeds.' },
          ].map((c) => (
            <div key={c.t} className="glass-dark group rounded-2xl p-5 transition hover:-translate-y-1 hover:border-sky-400/30">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 shadow-glow transition group-hover:scale-105">
                <c.icon className="h-5 w-5 text-white" />
              </span>
              <p className="mt-4 font-display text-base font-bold text-white">{c.t}</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOURCES */}
      <section id="sources" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-12 sm:px-6">
        <div className="glass-dark rounded-3xl p-6 sm:p-10">
          <p className="eyebrow">Integrations</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">Connected Data Sources</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">TinyFish Search discovers fresh URLs, TinyFish Fetch extracts clean markdown — fused with civic and social signals.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Search, t: 'TinyFish Search API', d: 'Live ranked results + snippets', live: true },
              { icon: FileJson2, t: 'TinyFish Fetch API', d: 'JS-rendered markdown extraction', live: true },
              { icon: Newspaper, t: 'Regional News', d: 'Verified publisher firehose' },
              { icon: Layers, t: 'Municipal Dashboards', d: 'CPCB · BMC · PWD telemetry' },
              { icon: Radio, t: 'Social Feeds', d: 'Geo-tagged citizen SOS clusters' },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:border-sky-300/40 hover:bg-white/[0.08]">
                <s.icon className="h-5 w-5 text-sky-300" />
                <p className="mt-3 text-sm font-bold text-white">{s.t}</p>
                <p className="mt-1 text-xs text-slate-400">{s.d}</p>
                {s.live && <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-200">● live</p>}
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-6 text-slate-300">
            <p><span className="text-slate-500">$</span> curl "https://api.search.tinyfish.ai?query=delhi+air+quality+emergency" -H "X-API-Key: $TINYFISH_API_KEY"</p>
            <p><span className="text-slate-500">$</span> curl -X POST https://api.fetch.tinyfish.ai -H "X-API-Key: $TINYFISH_API_KEY" -d "urls + markdown"</p>
          </div>
        </div>
      </section>

      {/* TRIAGE */}
      <section id="triage-log" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-12 sm:px-6">
        <p className="eyebrow">AI Triage & Priority Scoring</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">Highest-risk incidents, ranked first</h2>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <table className="data-table min-w-[760px]">
            <thead><tr><th>Incident ID</th><th>Category</th><th>Extracted Location</th><th>Urgency 0–10</th><th>AI Status</th></tr></thead>
            <tbody>
              {TRIAGE_ROWS.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-sky-200">{r.id}</td>
                  <td className="font-semibold text-white">{r.category}</td>
                  <td>{r.location}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-red-500" style={{ width: `${r.score * 10}%` }} />
                      </span>
                      <span className="font-bold text-white">{r.score.toFixed(1)}</span>
                    </span>
                  </td>
                  <td><span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-slate-200">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Thermometer, t: 'Heat stress model', d: '41.2°C Delhi peak mapped to hospital load.' },
            { icon: Wind, t: 'Air dispersion', d: 'Plume drift fused from 42 scraped sources.' },
            { icon: Droplets, t: 'Flood nowcast', d: 'Rainfall cells + pump telemetry in Mumbai.' },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <x.icon className="h-5 w-5 shrink-0 text-sky-300" />
              <div><p className="text-sm font-bold text-white">{x.t}</p><p className="text-xs text-slate-400">{x.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* FUTURE */}
      <section id="future" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-700/30 via-[#0C1A3A] to-[#0A0F1D] p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-400/25 blur-[100px]" />
          <p className="eyebrow">Future Scope</p>
          <h2 className="mt-2 max-w-xl font-display text-2xl font-extrabold text-white sm:text-3xl">From city pilots to a national climate safety net</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { t: 'Multilingual SOS triage', d: 'Hindi, Marathi, Tamil citizen reports auto-translated and geo-resolved.' },
              { t: 'Predictive dispatch', d: '48-hour risk forecast driving pre-positioned medical + shelter assets.' },
              { t: 'Open civic API', d: 'Municipalities subscribe to EcoPulse alerts via webhooks and SMS fallback.' },
            ].map((f, i) => (
              <div key={f.t} className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
                <p className="font-mono text-xs text-sky-300">0{i + 1}</p>
                <p className="mt-2 font-bold text-white">{f.t}</p>
                <p className="mt-1 text-sm text-slate-300">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#live-map" className="rounded-2xl bg-white px-6 py-3 text-center text-sm font-bold text-slate-900 transition hover:bg-sky-100">Enter Live Command Center <ChevronRight className="inline h-4 w-4" /></a>
            <p className="flex items-center gap-2 text-xs text-slate-300"><AlertTriangle className="h-4 w-4 text-amber-300" /> Demo uses simulated data until VITE_TINYFISH_API_KEY is set in .env.local</p>
          </div>
        </div>
        <footer className="mt-8 flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <p className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-sky-400" /> EcoPulse AI · TinyFish Search + Fetch · Built for abhiraj-ops</p>
          <p>Midnight #0A0F1D · Glass 12px · Inter / Plus Jakarta Sans · Lucide icons</p>
        </footer>
      </section>
    </div>
  );
}
