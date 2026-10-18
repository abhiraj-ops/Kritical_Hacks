<div align="center">

<img src="public/logo.svg" alt="EcoPulse AI logo" width="88" />

# EcoPulse AI

### See Environmental Risks Before They Become Disasters.

Real-time environmental and disaster intelligence. Live hazard feeds are fetched **server-side by Netlify
Functions**, normalized into one schema, and rendered on a Leaflet map with AI triage — powered by
[TinyFish](https://tinyfish.ai) live web agents.

<p>
  <a href="https://github.com/abhiraj-ops/ecopulse-ai"><img src="https://img.shields.io/github/stars/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=Stars&logo=github" alt="GitHub stars" /></a>
  <a href="https://github.com/abhiraj-ops/ecopulse-ai/network/members"><img src="https://img.shields.io/github/forks/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=Forks&logo=github" alt="GitHub forks" /></a>
  <a href="https://github.com/abhiraj-ops/ecopulse-ai/commits/main"><img src="https://img.shields.io/github/last-commit/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=Last%20Commit&logo=github" alt="Last commit" /></a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="Strict TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-1E6B3A?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Netlify_Functions-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify" />
</p>

<p>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/abhiraj-ops/ecopulse-ai"><img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" /></a>
</p>

</div>

---

## Data sources — live vs. demo

**Every alert in the UI comes from a real upstream feed.** Nothing is fabricated. When a source needs a key
you have not set, the UI says *"Key needed"* and that layer simply stays empty.

| Source | Key needed | What it provides | Endpoint |
|---|---|---|---|
| **USGS Earthquakes** | No | M2.5+ earthquakes, magnitude → severity | `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` |
| **GDACS** | No | Global multi-hazard alerts (storm, flood, quake, volcano) | `www.gdacs.org/xml/rss.xml` |
| **Open-Meteo** | No | Temperature, wind gusts, rainfall probability | `api.open-meteo.com/v1/forecast` |
| **OpenAQ** | `OPENAQ_API_KEY` | PM2.5 / PM10 from CPCB and India stations | `api.openaq.org/v3/locations/latest` |
| **NASA FIRMS** | `NASA_FIRMS_MAP_KEY` | VIIRS active fire hotspots | `firms.modaps.eosdis.nasa.gov/api/area/csv` |
| **TinyFish Search + Fetch** | `TINYFISH_API_KEY` | Live web search → markdown extraction → AI classification | `api.search.tinyfish.ai`, `api.fetch.tinyfish.ai` |

With only the three keyless sources configured you still get **~250 real records** per response.
The three no-key feeds are free and unlimited; OpenAQ and FIRMS are the only ones gated.

## Environment variables

Set these in the Netlify dashboard (Site settings → Environment variables) or in a local `.env` file.

| Variable | Required | Purpose |
|---|---|---|
| `TINYFISH_API_KEY` | For the agent button | Enables *Run TinyFish Web Agent*. Get one at [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys) |
| `OPENAQ_API_KEY` | Optional | Enables live air-quality layer |
| `NASA_FIRMS_MAP_KEY` | Optional | Enables live fire-hotspot layer |
| `NASA_FIRMS_DAY` | Optional | Days of FIRMS data to request (default `1`) |

Keys are read **only inside Netlify Functions**. Nothing secret is bundled into the browser — there is no
`VITE_`-prefixed key anywhere in this repo. `.env` and `.env.local` are gitignored; `.env.example` holds
names only.

## Getting started

```bash
npm install
cp .env.example .env.local     # add whichever keys you have
npm run dev:full               # API on :8888 + Vite on :5173
```

Open <http://localhost:5173>.

Other scripts:

```bash
npm run dev              # Vite only (needs the API already running)
npm run dev:api          # local Netlify-Function equivalent on :8888
npm run build            # type-check + production build
npm run type-check       # src **and** netlify/functions
npm run lint             # eslint, zero warnings tolerated
npm run test:functions   # live smoke test against the real upstream APIs
```

`npm run dev:full` uses `scripts/dev-api.ts`, a dependency-free local runner for the same handlers —
`netlify dev` also works if you have the Netlify CLI installed.

## Deploying to Netlify

1. Push the repo, then **Add new site → Import an existing project → GitHub** and pick
   `abhiraj-ops/ecopulse-ai`.
2. Build settings come from `netlify.toml`:
   - command `npm run build`, publish `dist`
   - functions directory `netlify/functions`, esbuild bundler
3. Add your environment variables under **Site settings → Environment variables**.
4. Deploy. `/api/*` is rewritten to the functions before the SPA fallback, so routing works as-is.

## Architecture

```
netlify/functions/
├── alerts.ts              # GET /api/alerts — aggregates + normalizes + caches 5 min
├── agent.ts               # POST /api/agent — TinyFish search → fetch → classify
└── _shared/
    ├── core.ts            # schema, severity rules, TTL cache, stale fallback, region mapping
    ├── usgs.ts            # earthquake GeoJSON  → normalized alerts
    ├── gdacs.ts           # disaster RSS        → normalized alerts
    ├── openmeteo.ts       # weather             → normalized alerts (thresholds)
    ├── openaq.ts          # air quality         → normalized alerts (needs key)
    └── fires.ts           # fire hotspots       → normalized alerts (needs key)

src/
├── App.tsx                # composition + section layout
├── api/client.ts          # typed fetch wrappers, error types
├── hooks/
│   ├── useEcoData.ts      # fetch state, region↔URL sync, filtering, agent runner
│   └── useTheme.ts        # 4 themes + localStorage persistence
├── components/            # Navbar, Hero, HazardMap, AlertFeed, StatCards,
│                          # AgentPanel, TriageTable, DetailsPanel, ThemeSwitcher
└── lib/                   # severity/format helpers, layer definitions
```

### Normalized alert schema

Every source is mapped to this single shape, so the client never branches on provider:

```ts
interface Alert {
  id: string;
  type: 'earthquake' | 'weather' | 'air_quality' | 'fire' | 'flood' | 'storm' | 'news';
  severity: 'low' | 'medium' | 'high' | 'critical';
  region: string;      // "Delhi-NCR" | "Mumbai" | "Chennai" | "Global"
  regionId: string;
  lat: number;
  lng: number;
  timestamp: string;   // ISO 8601
  source: string;
  sourceUrl: string | null;
  summary: string;
  metrics?: Record<string, number | string>;
  aiGenerated?: boolean;   // true for TinyFish agent results
}
```

### Honest failure behaviour

- **Upstream fails** → the function serves the last-known-good copy for that source and flags the response
  `degraded`; the UI shows *"showing the last successful response"*.
- **Key missing** → that source reports `missing_key`, renders as *"Key needed"*, and contributes nothing.
- **Everything down** → an explicit *"Data unavailable"* panel. **No alert is ever invented to fill a gap.**

## Features

- **Live Command Center** — Leaflet + OpenStreetMap tiles, severity-coloured markers, marker clustering at
  low zoom, per-hazard layer toggles, legend with live counts.
- **Region filters** — Global / Delhi-NCR / Mumbai / Chennai update the map, the stats and the alert list, and
  are written to the URL (`?region=delhi`) so a filtered view is shareable.
- **LIVE badge** — reflects real fetch status (`LIVE` / `DEGRADED` / `OFFLINE`) and the actual last-updated
  time, not a decorative dot.
- **TinyFish agent** — a real server-side scrape: live search → markdown fetch → severity classification,
  with per-stage progress and honest error reporting.
- **AI Triage Log** — sortable, filterable, searchable table with severity and type filters, CSV export and
  pagination. AI-generated rows are labelled.
- **Details panel** — click any map marker or feed row for source, time, severity, measurements and a link to
  the original report.
- **4 themes** — Midnight, Aurora, Frost, Graphite. Applied before first paint (no flash), persisted to
  `localStorage`, `prefers-color-scheme` aware, full keyboard + ARIA support.

## Accessibility & performance

- WCAG AA contrast in all four themes; `prefers-reduced-motion` disables the animated feed, ping effects and
  grain overlay.
- `backdrop-filter: blur(16px) saturate(140%)` glass surfaces with an `@supports not` fallback.
- Design tokens for spacing (4/8/12/16/24) and radii (8/12/16/24); transitions kept to 150–250 ms.
- Skeleton loaders, empty states and error states throughout; responsive from 360 px up with a collapsing nav.

## Roadmap

- [ ] Multilingual SOS triage (Hindi, Marathi, Tamil auto-translation + geo-resolution)
- [ ] 48-hour predictive risk forecast driving pre-positioned assets
- [ ] Open civic API — webhooks with SMS fallback for low-connectivity districts

## License

MIT — see [LICENSE](LICENSE).