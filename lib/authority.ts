/**
 * Source authority model.
 *
 * Not all web sources are equal evidence. This is the transparent, documented
 * weighting used in the verdict formula — it lives in the README on purpose:
 * a black box can't be trusted, a published table can be argued with.
 */

export interface AuthorityInfo {
  weight: number;
  label: string;
  isFactChecker: boolean;
}

interface Rule {
  re: RegExp;
  weight: number;
  label: string;
  isFactChecker?: boolean;
}

// Order matters: first match wins, so most-authoritative groups come first.
const RULES: Rule[] = [
  // IFCN-aligned / dedicated fact-checkers — their entire job is verification.
  {
    re: /(altnews|boomlive|boom\.co|factchecker\.in|factcheck\.org|snopes|politifact|fullfact|afp\.com\/fact|reuters\.com\/factcheck|thequint\.com\/webqoofi|newschecker|vishvasnews|livelaws|thenewsminute|indiatoday\/integrity|theprint\/fact|news18\/fact)/i,
    weight: 1.0,
    label: "Fact-checker",
    isFactChecker: true,
  },
  // Global news wires — strong primary reporting.
  {
    re: /(reuters|apnews|ap\.org|bloomberg|afp\.com|presstrust|ptinews|unitednews)/i,
    weight: 0.9,
    label: "News wire",
  },
  // Reputed national / regional dailies.
  {
    re: /(thehindu|indianexpress|hindustantimes|timesofindia|ndtv|scroll\.in|theprint|business-standard|livemint|jagran|amarujala|eenadu|mathrubhumi|indiatoday|cnbc|bbc\.com|cnn|thewire|newsminute|opindia|scoopwhoop)/i,
    weight: 0.8,
    label: "News organisation",
  },
  // Official / government / multilateral bodies.
  {
    re: /(gov\.in|nic\.in|pib\.gov|prsindia|indiabudget|rbi\.org\.in|sebi\.gov|eci\.gov|who\.int|un\.org|unesco|worldbank|imf\.org)/i,
    weight: 0.75,
    label: "Official / govt",
  },
  // Academic and peer-reviewed.
  {
    re: /(\.edu$|\.ac\.in|arxiv|pubmed|nih\.gov|ncbi\.nlm|scholar\.google|thelancet|nature\.com|sciencedirect|springer|bmj\.com)/i,
    weight: 0.7,
    label: "Academic / research",
  },
  // Encyclopedic.
  {
    re: /(wikipedia\.org|britannica)/i,
    weight: 0.6,
    label: "Encyclopedic",
  },
  // Opinion / self-published.
  {
    re: /(medium\.com|substack|blogspot|wordpress|quora|hubpages)/i,
    weight: 0.3,
    label: "Blog / opinion",
  },
  // User-generated social content — near-zero evidentiary value on its own.
  {
    re: /(facebook|twitter|^x\.com$|instagram|youtube|tiktok|reddit|telegram|whatsapp|snapchat|meme)/i,
    weight: 0.1,
    label: "Social / UGC",
  },
];

const DEFAULT: AuthorityInfo = { weight: 0.5, label: "Web source", isFactChecker: false };

/**
 * Page-level signals that a source is acting as a fact-checker even when its
 * domain isn't on the whitelist. Real-world case that motivated this: a
 * legitimate "TNM Fact Check: …" article on a general news domain, which a
 * domain-only model would have undervalued at 0.5.
 */
const FACT_CHECK_SIGNAL =
  /(fact[\s-]?check|factcheck|rating:\s*(false|true|misleading)|verdict:\s*(false|true)|debunk|myth[-\s]buster)/i;

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface AuthorityContext {
  title?: string | null;
}

export function authorityFor(url: string, context: AuthorityContext = {}): AuthorityInfo {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { weight: 0.2, label: "Unparsable URL", isFactChecker: false };
  }

  for (const rule of RULES) {
    // Match against both the bare host and the full URL (fact-check paths live in paths).
    if (rule.re.test(host) || rule.re.test(url)) {
      return { weight: rule.weight, label: rule.label, isFactChecker: rule.isFactChecker ?? false };
    }
  }

  // Not on any whitelist — but is this individual page acting as a fact-check?
  // Promote it, capped so a random blog calling itself "fact check" can't
  // masquerade as an IFCN signatory.
  const signals = `${context.title ?? ""} ${url}`;
  if (FACT_CHECK_SIGNAL.test(signals)) {
    return { weight: 0.85, label: "Fact-check article", isFactChecker: true };
  }

  return DEFAULT;
}
