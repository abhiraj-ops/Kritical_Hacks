# ClaimCheck — Unstop Submission Kit (copy-paste ready)

Fill the `<brackets>`, hit submit **hours before** the deadline. Unstop gets slow at midnight.

---

## Field: Project name

```
ClaimCheck — verify any claim against the live web, with verbatim proof
```

## Field: One-line description

```
Paste a claim, get a verdict in ~15 seconds — with the exact sentences that prove it, quoted
word-for-word from live pages. The evidence is extracted, never generated, so it cannot
hallucinate its sources.
```

## Field: GitHub repo link

```
https://github.com/<you>/claimcheck
```

## Field: Demo video link

```
<your YouTube-unlisted or Loom link>
```

## Field: Social media post link

```
<your public LinkedIn or X post URL>
```

## Field: How is TinyFish used? (⚠️ this field is worth up to 20 points — do not skip it)

```
TinyFish is the engine of the product, not an add-on. ClaimCheck uses three of its five API
surfaces:

1. SEARCH (GET api.search.tinyfish.ai) — the claim is fanned out into 3–5 search angles
   (fact check, evidence, official statements, and an academic angle for science claims) and
   queried across news, web and research_paper content types, geo-targeted to India. This is
   how ClaimCheck finds sources; there is no other data source.

2. FETCH + HIGHLIGHTS (POST api.fetch.tinyfish.ai) — the top 10 sources are fetched in a single
   batched call. TinyFish renders JavaScript-heavy pages and extracts PDF text, then the
   Highlights feature returns passages answering the claim as exact substrings of the page.
   This is the anti-hallucination guarantee the entire product rests on: because the passages
   are extracted rather than generated, the evidence cannot be fabricated. Ctrl+F any quote on
   the original page and it is there.

3. RESEARCH (POST agent.tinyfish.ai/v1/automation/run-research) — an optional "deep report"
   button runs a cited synthesis over SSE and streams progress live into the UI. Runs are cached
   by claim hash and replayed via GET /v1/research-run/{id}, which keeps us inside the beta
   limit of 5 runs/day.

Cost structure: the core verdict uses only Search and Fetch, which are free at 12,000 searches
and 1,000 fetches per day. That means a consumer-scale verification costs effectively zero to
serve, which is what makes our free tier and ₹399 Pro tier both economically viable.

Fallbacks are built in: if Highlights returns 403 (beta, enabled per-account) the app degrades
to full-text keyword-window extraction; if Research returns its 429 daily limit the core verdict
is unaffected. TinyFish is load-bearing for this product.
```

## Field: Problem statement / what it solves

```
Misinformation doesn't lose because people are gullible — it loses because checking takes too
long. A forwarded claim on WhatsApp, a screenshot on X, a headline taken out of context: by the
time someone verifies it, it has already spread.

Existing options are a bad trade. Ask a chatbot and you get confident prose that may cite
sources that don't exist. Hire a fact-checker and you wait hours and pay for a human hour.
ClaimCheck collapses that to fifteen seconds and near-zero cost — and, critically, it shows you
the proof rather than asking you to trust it. Every quote is an exact substring of a live page,
so the user can verify the verification itself.
```

## Field: Who is it for?

```
Primary: student researchers and educators, who are drowning in unverified forwards and cannot
afford a fact-checking subscription.
Secondary: freelance and regional journalists who need a fast first pass before committing an
hour to a story.
Tertiary: newsrooms and election-observation NGOs, via the Team and API tiers.
```

## Field: Tech stack

```
Next.js 15 (App Router) · TypeScript (strict, zero any) · Tailwind CSS 4 · TinyFish Search /
Fetch / Research APIs · Vercel · Vitest

Streaming NDJSON API routes so the UI animates each pipeline stage live. No database, no user
accounts, no tracking — verification is stateless.
```

## Field: Team members

```
<your name> — <your role/college>
```

---

## ⏳ Final 10-minute check before you hit submit

- [ ] Repo is **public** and `README.md` renders properly on GitHub
- [ ] No API key anywhere in the repo (`git log -p | grep -i TINYFISH_API_KEY`)
- [ ] Demo video link plays in an incognito window
- [ ] Social post is **public** and opens without login
- [ ] Deployed app URL loads
- [ ] All five fields above filled — **especially the TinyFish one**
- [ ] ✅ Submitted

Then close the laptop. Seriously. You need to be sharp for the finale on 31 Oct.
