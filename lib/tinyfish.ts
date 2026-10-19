/**
 * TinyFish clients — plain `fetch`, no SDK.
 *
 * Deliberate: the README and the demo video want to show the *actual* HTTP
 * calls, headers and payloads. That is the integration proof, not a wrapper.
 */

import { z } from "zod";

const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const AGENT_URL = "https://agent.tinyfish.ai";

export class TinyFishError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TinyFishError";
  }
}

function authHeaders(): Record<string, string> {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) {
    throw new TinyFishError(
      "TINYFISH_API_KEY is not set. Copy .env.example to .env.local and add your key.",
      undefined,
      "MISSING_KEY",
    );
  }
  return { "X-API-Key": key, "Content-Type": "application/json" };
}

async function readError(res: Response): Promise<TinyFishError> {
  let body: unknown;
  let code: string | undefined;
  try {
    body = await res.json();
    const maybe = (body as { error?: { code?: string; message?: string } })?.error;
    code = maybe?.code;
  } catch {
    body = undefined;
  }
  return new TinyFishError(
    `TinyFish ${res.status}${code ? ` (${code})` : ""}`,
    res.status,
    code,
  );
}

/* ------------------------------------------------------------------ Search */

export const SearchHit = z.object({
  position: z.number().optional(),
  site_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  url: z.string(),
});
export type SearchHit = z.infer<typeof SearchHit>;

export const SearchResponse = z.object({
  results: z.array(SearchHit).default([]),
  total_results: z.number().optional(),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

export interface SearchOpts {
  domainType?: "web" | "news" | "research_paper";
  location?: string;
  language?: string;
  recencyMinutes?: number;
  purpose?: string;
  maxRetries?: number;
}

/** GET https://api.search.tinyfish.ai — free tier: 12,000 requests/day. */
export async function search(query: string, opts: SearchOpts = {}): Promise<SearchHit[]> {
  const params = new URLSearchParams({ query });
  if (opts.domainType) params.set("domain_type", opts.domainType);
  if (opts.location) params.set("location", opts.location);
  if (opts.language) params.set("language", opts.language);
  if (opts.recencyMinutes) params.set("recency_minutes", String(opts.recencyMinutes));
  if (opts.purpose) params.set("purpose", opts.purpose);

  const maxRetries = opts.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!res.ok) throw await readError(res);
      const parsed = SearchResponse.safeParse(await res.json());
      if (!parsed.success) return []; // schema drift should never break the product
      return parsed.data.results;
    } catch (err) {
      lastError = err;
      // Only retry on transient failures, not auth problems.
      if (err instanceof TinyFishError && err.status && err.status < 500 && err.status !== 429) break;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  // A single failed angle must not sink the whole verification.
  console.warn("[tinyfish] search failed:", lastError);
  return [];
}

/* ------------------------------------------------------------------- Fetch */

const HighlightItem = z.union([
  z.string(),
  z
    .object({
      text: z.string().optional(),
      quote: z.string().optional(),
      snippet: z.string().optional(),
      content: z.string().optional(),
      score: z.number().optional(),
    })
    .passthrough(),
]);

export interface PageContent {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  text: string;
  /** Verbatim passages extracted by TinyFish Highlights — exact substrings of the page. */
  highlights: string[];
  highlightsAvailable: boolean;
}

const FetchResult = z.object({
  url: z.string(),
  final_url: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  text: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  highlights: z.array(HighlightItem).optional(),
  not_modified: z.boolean().optional(),
});

const FetchResponse = z.object({
  results: z.array(FetchResult).default([]),
  // `error` is usually a string, but selector failures carry a structured
  // payload with unmatched_selectors + candidate_selectors retry hints.
  errors: z
    .array(z.object({ url: z.string(), error: z.unknown() }))
    .default([]),
});

function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

/** TinyFish Highlights is beta and enabled per-account — a 403 is expected, not fatal. */
export class HighlightsUnavailable extends Error {
  constructor() {
    super("Highlights not enabled for this account — falling back to keyword windows.");
    this.name = "HighlightsUnavailable";
  }
}

function normaliseHighlights(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => {
      if (typeof h === "string") return h.trim();
      if (h && typeof h === "object") {
        const o = h as Record<string, unknown>;
        const t = o.text ?? o.quote ?? o.snippet ?? o.content;
        return typeof t === "string" ? t.trim() : "";
      }
      return "";
    })
    .filter((t) => t.length > 0);
}

function stringifyText(text: unknown): string {
  if (typeof text === "string") return text;
  if (text && typeof text === "object") {
    // `format: "json"` returns a document tree — flatten it.
    try {
      return JSON.stringify(text);
    } catch {
      return "";
    }
  }
  return "";
}

export interface FetchOpts {
  /** Seconds; 0 = force a live fetch, omit = accept any cached entry. */
  ttl?: number;
  /** Ask for verbatim passages answering this question. */
  highlightQuery?: string;
  maxSnippets?: number;
  /**
   * Scope extraction to matching elements (1–20 CSS selectors).
   * When Highlights isn't beta-enabled on an account, this is the closest
   * substitute: scoped content is returned verbatim with boilerplate bypassed.
   */
  includeSelectors?: string[];
}

export interface FetchBatch {
  pages: PageContent[];
  failed: { url: string; error: string }[];
  highlightsAvailable: boolean;
  /** True when include_selectors matched nothing — caller should widen the scope. */
  selectorMiss: boolean;
}

/**
 * POST https://api.fetch.tinyfish.ai — up to 10 URLs per request.
 * Free tier: 1,000 URLs/day. Renders JS, extracts PDF text.
 */
export async function fetchPages(urls: string[], opts: FetchOpts = {}): Promise<FetchBatch> {
  const target = urls.slice(0, 10);
  if (target.length === 0) {
    return { pages: [], failed: [], highlightsAvailable: false, selectorMiss: false };
  }

  const body: Record<string, unknown> = {
    urls: target,
    format: "markdown",
  };
  if (opts.ttl === 0) body.ttl = 0;
  if (opts.includeSelectors && opts.includeSelectors.length > 0) {
    body.include_selectors = opts.includeSelectors.slice(0, 20);
  }
  if (opts.highlightQuery) {
    body.highlights = {
      query: opts.highlightQuery,
      max_snippets: opts.maxSnippets ?? 3,
    };
  }

  const res = await fetch(FETCH_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });

  // 403 on a highlights request means the beta feature isn't enabled for this key.
  if (res.status === 403 && opts.highlightQuery) throw new HighlightsUnavailable();
  if (!res.ok) throw await readError(res);

  const parsed = FetchResponse.safeParse(await res.json());
  if (!parsed.success) {
    return {
      pages: [],
      failed: target.map((u) => ({ url: u, error: "unparseable response" })),
      highlightsAvailable: false,
      selectorMiss: false,
    };
  }

  let highlightsAvailable = false;
  let selectorMiss = false;
  const pages: PageContent[] = [];

  for (const r of parsed.data.results) {
    const highlights = normaliseHighlights(r.highlights);
    if (highlights.length > 0) highlightsAvailable = true;
    pages.push({
      url: r.url,
      finalUrl: r.final_url ?? r.url,
      title: r.title ?? null,
      description: r.description ?? null,
      text: stringifyText(r.text),
      highlights,
      highlightsAvailable: highlights.length > 0,
    });
  }

  const failed = parsed.data.errors.map((e) => ({ url: e.url, error: errorText(e.error) }));
  if (failed.some((f) => f.error.includes("selector_not_matched"))) selectorMiss = true;

  return { pages, failed, highlightsAvailable, selectorMiss };
}

/* ---------------------------------------------------------------- Research */

export interface ResearchEvent {
  event: string;
  [key: string]: unknown;
}

/**
 * POST https://agent.tinyfish.ai/v1/automation/run-research (SSE).
 * Beta: 5 runs/account/day, 5–20 min. Callers must treat this as optional.
 */
export async function* researchStream(
  query: string,
  opts: { mode?: "deep" | "max"; stream?: boolean } = {},
): AsyncGenerator<ResearchEvent> {
  const res = await fetch(`${AGENT_URL}/v1/automation/run-research`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, mode: opts.mode ?? "deep", stream: opts.stream ?? true }),
    signal: AbortSignal.timeout(30 * 60_000),
    cache: "no-store",
  });

  // 403 = Research not enabled for this account. 429 = 5/day beta limit hit.
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new TinyFishError("Empty Research stream", undefined, "NO_BODY");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload) as ResearchEvent;
      } catch {
        // Partial/keepalive lines are safe to skip.
      }
    }
  }
}

/** GET a previously completed run — instant, and doesn't consume the daily budget. */
export async function getResearchRun(runId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${AGENT_URL}/v1/research-run/${encodeURIComponent(runId)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw await readError(res);
  return (await res.json()) as Record<string, unknown>;
}
