import { describe, it, expect } from "vitest";
import { scoreEvidence, THRESHOLDS } from "@/lib/scoring";
import type { PageContent } from "@/lib/tinyfish";

function page(url: string, text: string, highlights: string[] = []): PageContent {
  return {
    url,
    finalUrl: url,
    title: null,
    description: null,
    text,
    highlights,
    highlightsAvailable: highlights.length > 0,
  };
}

const CLAIM = "Drinking papaya leaf juice cures dengue completely in 24 hours";

describe("scoreEvidence", () => {
  it("returns MISLEADING when fact-checkers refute with high authority", () => {
    const verdict = scoreEvidence({
      claim: CLAIM,
      sources: [
        { url: "https://www.altnews.in/foo", title: "Fact check", site: "altnews.in" },
        { url: "https://www.reuters.com/foo", title: "Health check", site: "reuters.com" },
        { url: "https://www.thehindu.com/foo", title: "Report", site: "thehindu.com" },
      ],
      pages: [
        page("https://www.altnews.in/foo", "", [
          "Papaya leaf juice does not cure dengue. The claim is misleading and unsupported by medical evidence.",
        ]),
        page("https://www.reuters.com/foo", "", [
          "Fact check: the claim that papaya juice cures dengue is false, doctors say there is no evidence.",
        ]),
        page("https://www.thehindu.com/foo", "", [
          "Doctors debunked the claim that papaya leaf juice can cure dengue in 24 hours, calling it unsupported.",
        ]),
      ],
    });

    expect(verdict.label).toBe("MISLEADING");
    expect(verdict.confidence).toBeLessThanOrEqual(-THRESHOLDS.strong);
    expect(verdict.stats.refute).toBe(3);
  });

  it("returns VERIFIED when reputable sources support the claim", () => {
    const verdict = scoreEvidence({
      claim: "The Bharatiya Nyaya Sanhita replaced the Indian Penal Code on 1 July 2024",
      sources: [
        { url: "https://www.pib.gov.in/foo", title: "Press release", site: "pib.gov.in" },
        { url: "https://www.thehindu.com/foo", title: "Report", site: "thehindu.com" },
      ],
      pages: [
        page("https://www.pib.gov.in/foo", "", [
          "The Bharatiya Nyaya Sanhita came into force on 1 July 2024, replacing the Indian Penal Code.",
        ]),
        page("https://www.thehindu.com/foo", "", [
          "Evidence shows the new criminal laws took effect on 1 July 2024, as confirmed by official records.",
        ]),
      ],
    });

    expect(verdict.label).toBe("VERIFIED");
    expect(verdict.confidence).toBeGreaterThanOrEqual(THRESHOLDS.strong);
  });

  it("returns UNVERIFIED when there is barely any evidence", () => {
    const verdict = scoreEvidence({
      claim: "Xyloquantic flux capacitors were banned in 1998",
      sources: [{ url: "https://random-blog.example.com/x", title: null, site: "random-blog.example.com" }],
      pages: [],
    });

    expect(verdict.label).toBe("UNVERIFIED");
  });

  it("lets a high-authority wire report outweigh an anonymous blog", () => {
    const verdict = scoreEvidence({
      claim: CLAIM,
      sources: [
        { url: "https://spammy-blog.example.com/a", title: "Miracle cure!", site: "spammy-blog.example.com" },
        { url: "https://apnews.com/a", title: "Health fact check", site: "apnews.com" },
      ],
      pages: [
        page("https://spammy-blog.example.com/a", "", [
          "This cure is confirmed and works, evidence shows amazing results.",
        ]),
        page("https://apnews.com/a", "", [
          "Fact check rated false: there is no evidence that this cures dengue. The claim is misleading.",
        ]),
      ],
    });

    // Authority weighting must not let a 0.3-weight blog beat a 0.9-weight wire.
    expect(verdict.confidence).toBeLessThan(0);
  });
});
