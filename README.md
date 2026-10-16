<div align="center">

<img src="public/logo.svg" alt="EcoPulse AI logo" width="88" />

# EcoPulse AI

### See Environmental Risks Before They Become Disasters.

Monitor real-time environmental threats, coordinate emergency response, and triage ground-level crisis data with TinyFish live web scraping agents.

<p>
  <a href="https://github.com/abhiraj-ops/ecopulse-ai"><img src="https://img.shields.io/github/stars/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=Stars&logo=github" alt="GitHub stars" /></a>
  <a href="https://github.com/abhiraj-ops/ecopulse-ai/network/members"><img src="https://img.shields.io/github/forks/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=Forks&logo=github" alt="GitHub forks" /></a>
  <a href="https://github.com/abhiraj-ops/ecopulse-ai/commits/main"><img src="https://img.shields.io/github/last-commit/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=Last%20Commit&logo=github" alt="Last commit" /></a>
  <img src="https://img.shields.io/github/license/abhiraj-ops/ecopulse-ai?style=for-the-badge&label=License" alt="License" />
</p>

<p>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="Strict TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TinyFish-Live_Agents-2563EB?style=for-the-badge&logo=rss&logoColor=white" alt="TinyFish" />
</p>

<p>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/abhiraj-ops/ecopulse-ai"><img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" /></a>
</p>

</div>

---

## Live Demo

| Environment | URL |
|---|---|
| Local dev | `http://localhost:5173/` (via `npm run dev`) |
| Production | _Add your Netlify URL here after deploy_ |

> Without a TinyFish key the app runs in **simulated demo mode** — every interaction still works.

## Features

- **Live Command Center** — regional crisis overview with urgency-coded clusters (Delhi-NCR Critical, Mumbai High, Chennai Moderate)
- **Interactive hazard map** — click a cluster to filter the whole dashboard by region
- **KPI cards** — Active Live Alerts (14), TinyFish Scraped Sources (42), AI Triage Confidence (96.4%), Avg Response Time (1.2s)
- **Live scraping agent feed** — auto-scrolling disaster reports with source, title, time and AI urgency badges
- **Run TinyFish Web Agent** — animated pipeline: Scanning Live Web → Fetching Markdown → Classifying Severity → Alert Dispatched
- **AI triage table** — incident ID, category, extracted location, urgency score (0–10), AI status
- **Connected sources** — TinyFish Search API, TinyFish Fetch API, Regional News, Municipal Dashboards, Social Feeds
- Fully responsive across desktop, tablet and mobile

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript (strict) |
| Build | Vite 6 |
| Styling | Tailwind CSS 3 + glassmorphism design system |
| Icons | Lucide |
| Live data | TinyFish Search + Fetch APIs (with graceful simulated fallback) |
| Hosting | Netlify (`netlify.toml` + SPA `_redirects` included) |

## Project Structure

```
ecopulse-ai/
├── public/                  # logo, Netlify _redirects
├── src/
│   ├── App.tsx              # full EcoPulse experience (nav, hero, dashboard, sections)
│   ├── main.tsx
│   ├── index.css            # midnight theme, glass utilities, feed/map animations
│   ├── data/ecopulse.ts     # regions, feed, triage rows, demo titles
│   └── services/tinyfish.ts # Search + Fetch clients, urgency classifier
├── index.html
├── netlify.toml
└── .env.example
```

## Getting Started

```bash
npm install
cp .env.example .env.local   # then set VITE_TINYFISH_API_KEY inside
npm run dev                  # → http://localhost:5173/
```

Production build:

```bash
npm run build     # type-check + vite build → dist/
npm run preview
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_TINYFISH_API_KEY` | No (demo works without it) | Key from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys). Enables live Search + Fetch. |
| `VITE_API_BASE_URL` | No | Backend base URL, defaults to `/api`. |
| `VITE_ENVIRONMENT` | No | App environment label. |

> Never commit `.env.local` — it is gitignored. Set `VITE_TINYFISH_API_KEY` in the Netlify dashboard for production.

## TinyFish API Reference

```bash
# Search — ranked live results + snippets
curl "https://api.search.tinyfish.ai?query=delhi+air+quality+emergency" \
  -H "X-API-Key: $TINYFISH_API_KEY"

# Fetch — JS-rendered pages → clean markdown
curl -X POST https://api.fetch.tinyfish.ai \
  -H "X-API-Key: $TINYFISH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com/alert"], "format": "markdown", "ttl": 0}'
```

Docs: [Search API](https://docs.tinyfish.ai/search-api) · [Fetch API](https://docs.tinyfish.ai/fetch-api)

## Roadmap

- [ ] Multilingual SOS triage (Hindi, Marathi, Tamil auto-translation + geo-resolution)
- [ ] 48-hour predictive risk forecast with pre-positioned asset dispatch
- [ ] Open civic API — webhooks + SMS fallback for municipalities

## License

MIT — see [LICENSE](LICENSE).
