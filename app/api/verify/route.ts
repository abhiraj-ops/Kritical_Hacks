import { NextRequest } from "next/server";
import { fanout } from "@/lib/fanout";
import { search, fetchPages, HighlightsUnavailable } from "@/lib/tinyfish";
import { scoreEvidence, type RawSource } from "@/lib/scoring";
import { authorityFor, hostnameOf } from "@/lib/authority";
import { claimKey, verdictCache } from "@/lib/cache";
import type { Verdict, VerifyEvent } from "@/lib/types";

// Node runtime: we need streaming + AbortSignal.timeout + long timeouts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Max sources we hand to Fetch (TinyFish caps a batch at 10). */
const FETCH_BUDGET = 10;
/** Max distinct hosts, so one outlet can't dominate the panel. */
const MAX_PER_HOST = 2;

function stripTracking(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|ref_src|mc_|igshid)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** Merge hits from every angle, kill duplicates, rank by source authority. */
function rankSources(hits: { url: string; title: string | null; site: string | null }[]): RawSource[] {
  const byUrl = new Map<string, RawSource>();
  const perHost = new Map<string, number>();

  for (const hit of hits) {
    if (!hit.url || !/^https?:\/\//i.test(hit.url)) continue;
    const key = stripTracking(hit.url);
    if (byUrl.has(key)) continue;

    const host = hostnameOf(hit.url);
    const seen = perHost.get(host) ?? 0;
    if (seen >= MAX_PER_HOST) continue;
    perHost.set(host, seen + 1);

    byUrl.set(key, { url: hit.url, title: hit.title, site: hit.site });
  }

  return [...byUrl.values()].sort(
    (a, b) => authorityFor(b.url).weight - authorityFor(a.url).weight,
  );
}

export async function POST(req: NextRequest) {
  let claim = "";
  try {
    const body = await req.json();
    claim = typeof body?.claim === "string" ? body.claim.trim().replace(/\s+/g, " ") : "";
  } catch {
    /* handled below */
  }

  if (claim.length < 8) {
    return Response.json(
      { error: "Enter a fuller claim to verify — a short sentence works best." },
      { status: 400 },
    );
  }
  if (claim.length > 500) {
    return Response.json(
      { error: "That claim is too long. Keep it under 500 characters." },
      { status: 400 },
    );
  }

  const key = claimKey(claim);
  const cached = verdictCache.get(key) as Verdict | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: VerifyEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        // Repeat claims are free and instant — protects our TinyFish budget
        // and makes judge demos reliable.
        if (cached) {
          send({ type: "stage", stage: "search", status: "start", detail: "Checking cache" });
          send({ type: "stage", stage: "score", status: "done", detail: "Cached result" });
          send({ type: "verdict", verdict: cached, cached: true });
          return;
        }

        const angles = fanout(claim);

        /* ---- 1. Search: fan out across content types ------------------ */
        send({
          type: "stage",
          stage: "search",
          status: "start",
          detail: `${angles.length} live searches`,
          count: angles.length,
        });

        const settled = await Promise.allSettled(
          angles.map((angle) =>
            search(angle.query, {
              domainType: angle.domainType,
              // India-first, but not exclusive — international sources still rank in.
              location: "IN",
              purpose: angle.purpose,
              recencyMinutes: angle.domainType === "news" ? 60 * 24 * 365 : undefined,
            }),
          ),
        );

        const hits = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
        const sources = rankSources(
          hits.map((h) => ({ url: h.url, title: h.title ?? null, site: h.site_name ?? null })),
        ).slice(0, FETCH_BUDGET);

        send({
          type: "stage",
          stage: "search",
          status: "done",
          detail: `${hits.length} results → ${sources.length} sources`,
          count: sources.length,
        });

        if (sources.length === 0) {
          send({
            type: "error",
            message: "No usable web sources found for that claim.",
            hint: "Try rephrasing it as a single specific, checkable statement.",
          });
          return;
        }

        /* ---- 2. Fetch: pull pages + verbatim Highlights ---------------- */
        send({
          type: "stage",
          stage: "fetch",
          status: "start",
          detail: `Fetching ${sources.length} pages`,
          count: sources.length,
        });

        // Three-tier evidence extraction, best first:
        //   1. Highlights      — ranked verbatim passages (needs beta opt-in)
        //   2. include_selectors — verbatim *scoped* content from article/main
        //   3. full text       — markdown + local keyword-window selection
        // Tier 2 exists because it still returns verbatim, un- paraphrased
        // content — the anti-hallucination property survives, only the
        // query-ranking is lost.
        let extractMode: "highlights" | "selectors" | "fulltext" = "highlights";
        let batch;
        try {
          batch = await fetchPages(
            sources.map((s) => s.url),
            { ttl: 0, highlightQuery: claim, maxSnippets: 3 },
          );
        } catch (err) {
          if (!(err instanceof HighlightsUnavailable)) throw err;

          extractMode = "selectors";
          const scoped = await fetchPages(
            sources.map((s) => s.url),
            {
              ttl: 0,
              // Landmarks first; class hints last so a miss on one selector
              // doesn't void the whole URL.
              includeSelectors: ["article", "main", "[role='main']", "[class*='article']", "[class*='content']"],
            },
          );

          if (scoped.selectorMiss || scoped.pages.length === 0) {
            extractMode = "fulltext";
            batch = await fetchPages(sources.map((s) => s.url), { ttl: 0 });
          } else {
            batch = scoped;
          }
        }

        const MODE_DETAIL: Record<typeof extractMode, string> = {
          highlights: `${batch.pages.length} pages · verbatim Highlights extracted`,
          selectors: `${batch.pages.length} pages · verbatim article-scoped extraction`,
          fulltext: `${batch.pages.length} pages · full text + keyword windows`,
        };

        send({
          type: "stage",
          stage: "fetch",
          status: "done",
          detail: MODE_DETAIL[extractMode],
          count: batch.pages.length,
        });

        /* ---- 3. Extract ----------------------------------------------- */
        send({ type: "stage", stage: "extract", status: "start", detail: "Reading evidence" });

        /* ---- 4. Score: consensus across authority × stance ------------- */
        send({ type: "stage", stage: "score", status: "start", detail: "Scoring consensus" });

        const verdict = scoreEvidence({ claim, sources, pages: batch.pages });
        verdict.stats.searched = angles.length;
        verdict.stats.found = hits.length;
        verdict.stats.failed = batch.failed.length;

        verdictCache.set(key, verdict);

        send({ type: "stage", stage: "score", status: "done", detail: "Verdict ready" });
        send({ type: "verdict", verdict, cached: false });
      } catch (err) {
        console.error("[verify] pipeline failed:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Verification failed.",
          hint: "Check TINYFISH_API_KEY in .env.local, then try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Some proxies buffer responses — that would kill the live stage animation.
      "X-Accel-Buffering": "no",
    },
  });
}
