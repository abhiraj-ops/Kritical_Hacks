/**
 * Stance detection over *verbatim* extracted passages.
 *
 * Design note: this is deliberately a transparent, rule-based classifier rather
 * than an LLM call. Three reasons, all of which we state openly in the README:
 *   1. Deterministic — the same page always yields the same verdict (reproducible).
 *   2. Free — no per-verification model cost, so consumer pricing is viable.
 *   3. Auditable — a wrong verdict can be traced to a specific cue word.
 * We operate on passages TinyFish extracted from the live page, never on model memory.
 */

export type Stance = "support" | "refute" | "unclear";

const REFUTE_CUES = [
  // Verdict language
  "false", "misleading", "misleading claim", "unsupported", "debunked", "debunking",
  "hoax", "fake", "busted", "disproved", "incorrect", "wrong", "rated false",
  "claim is false", "not true", "no truth to", "unsubstantiated", "baseless",
  "fabricated", "distorted", "cherry-picked", "out of context", "exaggerated",
  // Absence-of-evidence language (very common in health fact-checks)
  "no evidence", "no scientific evidence", "no clinical evidence", "no data",
  "no medical basis", "no basis", "no basis for", "not backed by evidence",
  "not supported by evidence", "lacks evidence", "cannot be verified",
  "unverified", "missing context",
  // Advisory language — a doctor cautioning against something is a refutation
  "not recommended", "no recommendation", "not advisable", "cautions against",
  "cautioned against", "warning against", "warned against", "should not be used",
  "not a substitute", "delay medical", "can be dangerous", "is dangerous",
  "has not been", "have not been", "hasn't been", "haven't been",
  // Plain-English negations seen in real fact-check headlines
  "does not prove", "does not cure", "doesn't cure", "does not work", "doesn't work",
  "not a cure", "no cure", "cannot cure", "can't cure", "won't cure",
  "no link between", "no connection", "no relationship", "has no effect",
  "not related to", "is not caused by", "isn't caused by",
  "myth", "conspiracy", "false claim", "false statement",
];

const SUPPORT_CUES = [
  "confirmed", "verified", "accurate", "is accurate", "checks out", "confirmed by",
  "evidence shows", "evidence confirms", "study finds", "study found", "studies show",
  "research shows", "research found", "research confirms", "is correct",
  "data shows", "data confirms", "according to", "official records", "peer-reviewed",
  "established fact", "is true", "actually happened", "clinically proven",
  "proven to", "is effective", "backed by evidence", "supported by evidence",
  "experts confirm", "doctors confirm", "authorities confirm",
];

export interface StanceResult {
  stance: Stance;
  /** support strength minus refute strength; positive leans support. */
  score: number;
  hits: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countCues(text: string, cues: string[]): { count: number; hits: string[] } {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  let count = 0;
  for (const cue of cues) {
    const re = new RegExp(`\\b${escapeRegExp(cue)}\\b`, "gi");
    const matches = lower.match(re);
    if (matches && matches.length > 0) {
      count += matches.length;
      hits.push(cue);
    }
  }
  return { count, hits };
}

/**
 * Score a passage for/against a claim.
 * Fact-checker sources get a boost on refute cues because their verdict language
 * ("rated false", "missing context") is explicit and deliberate.
 */
export function detectStance(
  passage: string,
  opts: { isFactChecker?: boolean } = {},
): StanceResult {
  const ref = countCues(passage, REFUTE_CUES);
  const sup = countCues(passage, SUPPORT_CUES);

  const refWeight = ref.count * (opts.isFactChecker ? 1.5 : 1);
  const supWeight = sup.count;
  const score = refWeight - supWeight;

  if (score >= 1) return { stance: "refute", score, hits: ref.hits };
  if (score <= -1) return { stance: "support", score, hits: sup.hits };
  return { stance: "unclear", score, hits: [...ref.hits, ...sup.hits] };
}

/**
 * Fallback evidence extractor for when TinyFish Highlights is unavailable (403):
 * pull a ±2-sentence window around the densest cluster of claim keywords.
 */
export function keywordWindow(text: string, claim: string, maxQuotes = 3): string[] {
  const keywords = claim
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4)
    // Cheap stopword prune — enough to focus on content words.
    .filter((w) => !["the", "and", "for", "with", "that", "this", "from", "have", "been", "were"].includes(w));

  if (keywords.length === 0 || !text) return [];

  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 600);

  const scored = sentences
    .map((s, i) => {
      const lower = s.toLowerCase();
      const hits = keywords.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0);
      return { s, i, hits };
    })
    .filter((x) => x.hits >= 2)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, maxQuotes);

  // Include one neighbouring sentence for readability.
  return scored.map(({ s, i }) => {
    const prev = sentences[i - 1];
    return prev && prev.length < 300 ? `${prev} ${s}` : s;
  });
}
