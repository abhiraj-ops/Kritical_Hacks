/**
 * Query fan-out: one vague claim in, several precise search angles out.
 * A single search of a claim is easy to fool; multiple angles across different
 * content types is what gives the consensus engine something to reason over.
 */

export type DomainType = "web" | "news" | "research_paper";

export interface Angle {
  query: string;
  domainType: DomainType;
  /** Why this angle exists — surfaced in the UI as human-readable detail. */
  purpose: string;
}

const STOP_INITIAL_CAPS = new Set([
  "The", "This", "That", "These", "Those", "A", "An", "Is", "Are", "Was", "Were",
  "Did", "Does", "Do", "Can", "Could", "Has", "Have", "Had", "Will", "Would",
  "Should", "May", "Might", "Must", "Not", "No", "Yes", "If", "When", "While",
  "And", "Or", "But", "So", "Because", "According", "Report", "Claim", "Says",
  "Said", "Study", "Research", "New", "Latest", "Fact", "Drinking", "Eating",
  "Taking", "Using", "Every", "Anyone", "People", "Experts",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pull content-ish tokens: proper nouns and numbers.
 *
 * Two guards against junk, both learned from testing real claims:
 *  1. The first token is skipped — its capital is sentence-initial, not a noun.
 *     Without this, "Drinking papaya leaf juice…" produced the entity "Drinking".
 *  2. A word that also appears lowercased elsewhere in the claim is a common
 *     noun wearing a capital, not a name ("Census" in a claim that also says "census").
 */
function extractEntities(text: string): string[] {
  const quoted = text.match(/"([^"]+)"/g) ?? [];
  const quotedTerms = quoted.map((q) => q.replace(/"/g, "").trim()).filter((q) => q.length > 2);

  const lower = text.toLowerCase();
  const words = text.split(/[^\p{L}\p{N}'.:-]+/u);
  const out: string[] = [];

  words.forEach((w, idx) => {
    if (w.length < 3) return;
    if (idx === 0) return;

    if (/^\d/.test(w)) {
      out.push(w);
      return;
    }

    if (/^[A-Z][a-z]/.test(w) && !STOP_INITIAL_CAPS.has(w)) {
      const escaped = escapeRegExp(w.toLowerCase());
      const occurrences = lower.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length ?? 0;
      // Appears in lowercase too → common noun, not a proper noun.
      if (occurrences > 1) return;
      out.push(w);
    }
  });

  return Array.from(new Set([...quotedTerms, ...out])).slice(0, 6);
}

const RESEARCH_HINT = /\b(study|research|vaccine|cancer|disease|virus|trial|clinical|cure|treatment|efficacy|randomi[sz]ed|meta-analysis|carbon|emission|climate)\b/i;

export function fanout(claim: string): Angle[] {
  const clean = claim.trim().replace(/\s+/g, " ");
  const entities = extractEntities(clean);

  const angles: Angle[] = [
    {
      query: clean,
      domainType: "news",
      purpose: "Recent news coverage of the claim",
    },
    {
      query: `${clean} fact check`,
      domainType: "web",
      purpose: "Dedicated fact-checks of this claim",
    },
    {
      query: `${clean} evidence`,
      domainType: "web",
      purpose: "Primary evidence for or against",
    },
  ];

  if (entities.length > 0) {
    angles.push({
      query: `${entities.join(" ")} official statement`,
      domainType: "web",
      purpose: "Official sources on the entities involved",
    });
  }

  // Academic angle only for claims that plausibly have research behind them.
  if (RESEARCH_HINT.test(clean)) {
    angles.push({
      query: clean,
      domainType: "research_paper",
      purpose: "Peer-reviewed literature",
    });
  }

  return angles.slice(0, 5);
}
