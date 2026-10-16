# EcoPulse AI — Environmental & Disaster Intelligence

AI-powered real-time environmental and disaster intelligence platform with TinyFish live web agents.

## Stack
React 18 + TypeScript + Vite + Tailwind CSS + Lucide icons

## TinyFish integration
- Search API: `GET https://api.search.tinyfish.ai?query=...` with `X-API-Key` header
- Fetch API: `POST https://api.fetch.tinyfish.ai` with `{ urls, format: "markdown", ttl: 0 }`
- Key lives only in `.env.local` (gitignored) as `VITE_TINYFISH_API_KEY`
- Without a key the UI runs in simulated demo mode and never breaks

## Run
```bash
npm install
cp .env.example .env.local   # then set VITE_TINYFISH_API_KEY
npm run dev
npm run build
```
