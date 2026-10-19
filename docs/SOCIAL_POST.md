# ClaimCheck — Ready-to-Paste Social Posts

Both must be **public** — the jury has to open them without logging in.
Verify each in an **incognito window** before you submit the link on Unstop.

Replace `<you>` with your GitHub username and `<demo-link>` with your video link.

---

## LinkedIn (best single choice — jury will likely open this one)

```
Anyone can generate misinformation. Verifying it still takes an hour.

So I built ClaimCheck — paste any claim, get a verdict in ~15 seconds.

What makes it different: it shows you the exact sentences that prove the verdict, quoted
word-for-word from live web pages. The evidence is extracted, never generated — so it literally
cannot hallucinate its sources. Ctrl+F any quote on the original page and it's right there.

How it works:
→ TinyFish Search fans out live queries across news, web and research papers
→ TinyFish Fetch renders the real pages (JS and all) and pulls verbatim evidence passages
→ A transparent scoring model weights each source by authority and stance — the formula is
   published, not hidden in a black box

Because TinyFish's Search and Fetch are free at consumer scale, a verification costs almost
nothing to run. That's what makes a free tier viable.

Built for student researchers, journalists and teachers drowning in unverified forwards.

🧑‍💻 Open source → github.com/<you>/claimcheck
🎥 2-min demo → <demo-link>

#AI #Misinformation #FactCheck #WebDevelopment #TinyFish
```

**Attach:** a GIF or 2–3 screenshots (pipeline stages, verdict card, evidence panel).
A post with media gets far more attention than text alone.

---

## X / Twitter (shorter, punchier)

```
built ClaimCheck: paste a claim → verdict in 15s → shows the *verbatim* sentences that prove it,
quoted word-for-word from live pages.

evidence is extracted, not generated. so it can't hallucinate its sources. Ctrl+F and see.

3 TinyFish APIs power it (Search + Fetch + Research) — and the core runs on their free tier,
so a check costs ~₹0.

🧑‍💻 github.com/<you>/claimcheck
🎥 <demo-link>
```

---

## If you have extra time — a reply-comment that scores points

Post this as the first comment on your own LinkedIn post (it shows technical depth):

```
The part I'm happiest with: the scoring is auditable.

confidence = Σ(source_authority × stance) / Σ(source_authority)

A fact-checker weighs 1.0, a wire service 0.9, a government source 0.75, a blog 0.3, social
media 0.1. When credible sources disagree, you get "Disputed" instead of a fake confident answer.
When there's no quality evidence, it says "Unverified" rather than guessing.

Deterministic, free, and a wrong verdict can always be traced to a specific cue word.
```

---

## Checklist before you submit the links

- [ ] Post is **public** (not "connections only")
- [ ] Repo link present and the repo is **public**
- [ ] Video link plays
- [ ] Opens correctly in an incognito window
- [ ] Screenshots/GIF attached
- [ ] You've copied the post URL for the Unstop form
