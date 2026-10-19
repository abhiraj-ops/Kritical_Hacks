# ClaimCheck — Finale Pitch (31 Oct – 1 Nov)

Shortlisted? Here's the on-site kit. Build this **after** you submit the online round.

---

## The 3-minute pitch — spoken script

> **[0:00 — Problem]**
> "Misinformation doesn't lose because people are gullible. It loses because checking takes too
> long. By the time anyone verifies a forwarded claim, it's already travelled a thousand shares."
>
> **[0:25 — Demo]**
> "So here's ClaimCheck. I paste a claim —" *(run it live)* "— and in fifteen seconds it gives me
> a verdict, and more importantly, the exact sentences that prove it."
>
> **[1:00 — The innovation]**
> "Every quote on this screen is an exact substring of a live web page. The evidence is
> *extracted, never generated* — so it literally cannot hallucinate its sources. Ctrl+F on the
> original page and you'll find it. That's a guarantee a chatbot cannot make."
>
> **[1:35 — Architecture + cost]**
> "Three TinyFish APIs power it. Search finds sources across news, web and academic indexes.
> Fetch renders real pages and pulls verbatim evidence. Research synthesises a cited deep report.
> And because TinyFish's Search and Fetch are free at consumer scale, the core verdict costs us
> effectively zero to serve — which is what makes both the free tier and the ₹399 Pro tier viable."
>
> **[2:15 — Honesty]**
> "When credible sources disagree you get *Disputed*, not a fake confident answer. When there's no
> quality evidence you get *Unverified*. And the scoring formula is published in the README —
> a wrong verdict can be traced to a specific cue word."
>
> **[2:40 — Ask]**
> "We're live at github.com/\<you\>/claimcheck. We're looking for newsroom pilots and a
> women-in-media partnership for the next phase. Thank you."

**Rehearse out loud, five times, before the day.** Reading slides is not pitching.

---

## Anticipated jury questions

| Question | Answer |
|---|---|
| *"Why TinyFish instead of scraping or another search API?"* | One key gives three capabilities. Highlights returns verbatim passages — that's the anti-hallucination guarantee, and it renders JS and PDFs that naive scraping misses. |
| *"What happens when the verdict is wrong?"* | Confidence thresholds, a `Disputed` state for genuine disagreement, an `Unverified` state that refuses to guess, and a published formula anyone can audit. |
| *"Does this scale? What does it cost at 1M users?"* | Search is free to 12k/day and Fetch to 1k/day per key; multiple keys scale horizontally. Only the optional deep report is metered. |
| *"Why would anyone pay if it's free?"* | A journalist's hour costs hundreds of rupees. ₹399/month is an obvious trade. Team and API tiers price on the value of a verified claim. |
| *"Isn't cue-word stance detection too simple?"* | It's deterministic, free and auditable — deliberately, so a wrong verdict can be traced. We state the limitation openly and it's the first thing we'd upgrade with an LLM classification pass. |
| *"What about privacy?"* | Stateless. No accounts, no storage, no tracking. Claims are hashed for a cache and discarded. |
| *"How do you handle non-English claims?"* | TinyFish supports geo/language targeting so retrieval works; cue words are English-only today. Stated as a known limitation, and it's the top roadmap item. |

---

## Offline backup (assume venue Wi-Fi dies)

- [ ] Repo cloned on a USB stick + your laptop
- [ ] `npm install && npm run build && npm start` tested **on your laptop** beforehand
- [ ] Demo video downloaded locally (not just a streaming link)
- [ ] Screenshots of every key screen in a local folder
- [ ] A printed one-pager of the architecture diagram

---

## Accuracy benchmark (worth doing — juries love a number)

Use `eval/claims.json` — 10 labelled claims including a nonsense control case.

Run each one, record the label ClaimCheck produced vs the expected label, and report:

```
Accuracy: X / 10  (X%)
Breakdown: N correct on clearly-true, N on clearly-false, N on genuinely-disputed
Failure mode analysed: <why the misses happened>
```

Reporting an honest 7/10 with a real analysis of the 3 misses beats claiming 10/10 that nobody
believes.

---

## What to add during the 24h finale (only if the core is stable)

1. **LLM classification pass** as an *optional* enhancement over cue words — show both side by side
2. **Multi-language cue dictionaries** (Hindi at minimum) using TinyFish's `language` param
3. **Share card** — generate a "verified / misleading" image for WhatsApp, which is where the
   problem actually lives in India
4. **Accuracy benchmark dashboard** in the UI
5. **Chrome extension** for verifying the current selection on any page
