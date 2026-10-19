# ClaimCheck — Demo Video Shot List (2–3 min)

Record with **Loom** (free, gives you a shareable link instantly) or **OBS** (local file → upload
to YouTube as *unlisted*). 1080p. Kill notifications. Zoom in on small text.

## ⚠️ Before you hit record

- [ ] `npm run dev` running, app loaded, **no errors in the terminal**
- [ ] Pick your 5 sample claims and run each one once — confirm every verdict is sane
- [ ] **Pre-warm Deep Dive** on your hero claim ~15 min before recording. It caches by claim,
      so when you click it live it replays instantly instead of taking 10 minutes
- [ ] Close every other tab. Notifications OFF. Phone on silent
- [ ] Have the source page of one quote open in a second tab (for the Ctrl+F moment)

---

## The script

### 0:00–0:15 — Hook
**Screen:** claim text typed on screen, blurred source pages behind it
**Say:** "A false claim can reach millions of minutes before anyone checks it. Verifying it used
to take a journalist an hour."

### 0:15—0:35 — Intro
**Screen:** you on camera, or a clean title card: **ClaimCheck**
**Say:** "This is ClaimCheck. Paste any statement, and it verifies it against the live web in
about fifteen seconds — and shows you the proof."

### 0:35–1:20 — ⭐ Main demo (the most important 45 seconds)
**Screen:** app only, cursor visible
1. Click a sample chip (a **false** one plays best — e.g. the papaya/dengue claim)
2. Let the four pipeline stages animate: *Searching → Fetching → Extracting → Scoring*
3. Verdict card lands — read the label out loud
4. Scroll slowly through 2–3 evidence cards, **read one quote aloud**

**Say:** "I hit verify. It fans out live searches, pulls the real pages, and extracts the exact
sentences that support or contradict the claim. Every quote here is copied word-for-word from the
page — the evidence is extracted, never generated."

### 1:20–1:35 — ⭐ The Ctrl+F proof
**Screen:** switch to the actual source page in the other tab
**Do:** `Ctrl+F`, paste one of the quoted sentences, let the browser highlight it
**Say:** "See? Ctrl+F on the real page. That's why it can't hallucinate its sources — the quote
is a literal substring of what's published."

> This 15 seconds is worth more than any feature you could have built. **Do not skip it.**

### 1:35–2:00 — Deep Dive
**Screen:** back in the app, click "Run deep research report"
**Do:** show the live progress ("Planning sub-questions… Reading sources… Synthesising…") then
the cited report streaming in
**Say:** "For a full cited report, Deep Dive runs TinyFish's Research API and streams the
synthesis live — with every source listed."

*(If Deep Dive is slow or rate-limited, don't fight it — say "optional deep reports" and move on.)*

### 2:00–2:25 — Architecture
**Screen:** the Mermaid diagram from the README
**Say:** "Three TinyFish APIs power it. Search finds the sources. Fetch renders the real pages
and pulls verbatim evidence. Research synthesises the cited report. The core verdict uses
TinyFish's free tier — twelve thousand searches and a thousand fetches a day — so a check costs
us almost nothing. That's what makes the free tier and the ₹399 Pro tier both work."

### 2:25–2:50 — Who it's for + pricing
**Screen:** simple text card
**Say:** "Built for student researchers, journalists and teachers who drown in unverified
forwards. Free for five checks a day, ₹399 a month for unlimited, and a team and API tier for
newsrooms."

### 2:50–3:00 — Close
**Screen:** repo URL + name
**Say:** "Open source at github.com/\<you\>/claimcheck. Try it — paste any claim."

---

## Recording tips
- **One clean take per section**, then stitch. You will not nail 3 minutes in one go
- Speak ~20% slower than feels natural
- If you flub a line, pause 2 seconds and repeat it — editing out silence is easy
- Keep the cursor moving slowly; fast mouse movement looks frantic on video
- Total runtime target: **2:30**. Under 3 minutes is a hard preference in the rubric

## After recording
- [ ] Watch it end-to-end **once**, sound on
- [ ] Upload → YouTube *unlisted* or Loom
- [ ] Play the shared link in an incognito window to confirm it works
