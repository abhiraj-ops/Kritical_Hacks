/**
 * Consensus engine: turn extracted evidence into a verdict.
 *
 * Pure and dependency-free so it can be unit-tested and reasoned about.
 *
 *   confidence = Σ (authority(source) × stance_weight(source)) / Σ authority(source)
 *
 * stance_weight: support = +1,  refute = −1,  unclear = 0
 * The denominator normalises to [−1, 1], so a unanimous set of high-authority
 * refutations drives confidence to −1 and a lone blog can't outweigh a wire report.
 */

import { authorityFor, hostnameOf } from "./authority";
import type { Evidence, Verdict, VerdictLabel } from "./types";
import type { PageContent } from "./tinyfish";
import { detectStance, keywordWindow } from "./stance";

export interface RawSource {
  url: string;
  title: string | null;
  site: string | null;
}

export interface ScoreInput {
  claim: string;
  sources: RawSource[];
  pages: PageContent[];
}

export const THRESHOLDS = {
  strong: 0.45,
  lean: 0.15,
  /** Below this much total authority weight, we refuse to guess. */
  minEvidence: 0.6,
} as const;

function labelFor(confidence: number, totalAuthority: number): VerdictLabel {
  if (totalAuthority < THRESHOLDS.minEvidence) return "UNVERIFIED";
  if (confidence >= THRESHOLDS.strong) return "VERIFIED";
  if (confidence <= -THRESHOLDS.strong) return "MISLEADING";
  // Meaningful sources disagree — that is itself the answer.
  if (Math.abs(confidence) >= THRESHOLDS.lean) return "DISPUTED";
  return "UNVERIFIED";
}

const SUMMARIES: Record<VerdictLabel, (c: number) => string> = {
  VERIFIED: () =>
    "The weight of available evidence supports this claim. Sources with strong editorial or official standing back it up.",
  MISLEADING: () =>
    "The evidence contradicts this claim. Reputable sources — including dedicated fact-checkers — report it as false or misleading.",
  DISPUTED: (c) =>
    `Sources disagree on this claim (consensus ${c > 0 ? "leaning true" : "leaning false"}). Treat it as contested until stronger evidence emerges.`,
  UNVERIFIED: () =>
    "There isn't enough high-quality evidence on the live web to call this either way. It may be new, niche, or simply unverifiable.",
};

export function scoreEvidence(input: ScoreInput): Verdict {
  const pagesByUrl = new Map<string, PageContent>();
  for (const p of input.pages) {
    pagesByUrl.set(p.url, p);
    pagesByUrl.set(hostnameOf(p.url), p);
  }

  const evidence: Evidence[] = [];
  let support = 0;
  let refute = 0;
  let unclear = 0;
  let highAuthority = 0;
  let weightedSum = 0;
  let totalAuthority = 0;

  for (const src of input.sources) {
    const page =
      pagesByUrl.get(src.url) ??
      pagesByUrl.get(hostnameOf(src.url)) ??
      // Last resort: match on finalUrl.
      input.pages.find((p) => p.finalUrl === src.url || hostnameOf(p.finalUrl) === hostnameOf(src.url));

    const { weight, label, isFactChecker } = authorityFor(src.url, {
      title: src.title ?? page?.title ?? null,
    });

    // Build the passage set: TinyFish verbatim Highlights, else keyword windows.
    const quotes =
      page && page.highlights.length > 0
        ? page.highlights
        : page
          ? keywordWindow(page.text, input.claim)
          : [];

    // Judge stance on the extracted evidence. The title is *always* included:
    // fact-check headlines ("Fact check: X doesn't cure Y") are among the most
    // diagnostic sentences on the whole page, and relying on them costs nothing.
    const evidenceText = [src.title ?? page?.title ?? "", ...quotes].filter(Boolean).join("\n");
    const { stance, score, hits } = detectStance(evidenceText, { isFactChecker });

    if (stance === "support") support++;
    else if (stance === "refute") refute++;
    else unclear++;
    if (weight >= 0.8) highAuthority++;

    const stanceWeight = stance === "support" ? 1 : stance === "refute" ? -1 : 0;
    weightedSum += weight * stanceWeight;
    totalAuthority += weight;

    evidence.push({
      url: src.url,
      title: src.title ?? page?.title ?? null,
      site: src.site ?? hostnameOf(src.url),
      domain: hostnameOf(src.url),
      authority: weight,
      authorityLabel: label,
      stance,
      stanceScore: score,
      cueHits: hits,
      quotes,
    });
  }

  // Sort: strongest authority first, and let a decisive fact-checker lead the panel.
  evidence.sort((a, b) => {
    if (a.authority !== b.authority) return b.authority - a.authority;
    return Math.abs(b.stanceScore) - Math.abs(a.stanceScore);
  });

  const confidence = totalAuthority > 0 ? weightedSum / totalAuthority : 0;
  const label = labelFor(confidence, totalAuthority);
  // Strength = how much we can trust the *amount* of evidence, independent of direction.
  const strength = Math.round(Math.min(1, totalAuthority / 3) * 100);

  return {
    label,
    confidence: Number(confidence.toFixed(3)),
    strength,
    summary: SUMMARIES[label](Number(confidence.toFixed(2))),
    claim: input.claim,
    sources: evidence,
    checkedAt: new Date().toISOString(),
    stats: {
      searched: 0,
      found: 0,
      fetched: input.pages.length,
      failed: 0,
      support,
      refute,
      unclear,
      highAuthority,
    },
  };
}
