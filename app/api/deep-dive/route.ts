import { NextRequest } from "next/server";
import { researchStream, getResearchRun, TinyFishError } from "@/lib/tinyfish";
import { claimKey, researchRunCache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Research is genuinely slow (5–20 min) — but we stream, so the user sees progress.
export const maxDuration = 300;

interface DeepEvent {
  type: "meta" | "progress" | "report" | "done" | "error";
  event?: string;
  runId?: string;
  replayed?: boolean;
  message?: string;
  report?: string;
  citations?: string[];
  sources?: number;
  hint?: string;
}

/** Pull the report + citations out of a saved run, whatever shape it arrives in. */
function extractReport(run: Record<string, unknown>): { report: string; citations: string[] } {
  const deep = run.deep_result as { result?: string; citations?: string[] } | undefined;
  const quick = run.quick_result as { answer?: string; citations?: string[] } | undefined;

  const report = deep?.result ?? (run.quick_result_summary as string) ?? quick?.answer ?? "";
  const citations = deep?.citations ?? quick?.citations ?? [];
  return { report: String(report), citations: Array.isArray(citations) ? citations.map(String) : [] };
}

export async function POST(req: NextRequest) {
  let claim = "";
  let priorRunId: string | undefined;
  try {
    const body = await req.json();
    claim = typeof body?.claim === "string" ? body.claim.trim() : "";
    priorRunId = typeof body?.runId === "string" ? body.runId : undefined;
  } catch {
    /* handled below */
  }

  if (claim.length < 8) {
    return Response.json({ error: "A fuller claim is needed for deep research." }, { status: 400 });
  }

  const key = claimKey(claim);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (e: DeepEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      try {
        /* Fast path: replay a run we already paid for. Costs nothing, returns
           instantly, and keeps us inside the 5-runs/day beta limit. */
        const replayId = priorRunId ?? (researchRunCache.get(key) as string | undefined);
        if (replayId) {
          const saved = await getResearchRun(replayId);
          if (saved && saved.status === "COMPLETED") {
            const { report, citations } = extractReport(saved);
            send({ type: "meta", runId: replayId, replayed: true });
            send({ type: "report", report, citations });
            send({ type: "done" });
            return;
          }
        }

        send({
          type: "meta",
          message: "Starting deep research — this can take several minutes.",
        });

        const question =
          `Fact-check this claim with cited evidence: "${claim}". ` +
          `State whether it is true, false, or misleading, and cite every source.`;

        let runId: string | undefined;

        for await (const event of researchStream(question, { mode: "deep", stream: true })) {
          const name = String(event.event ?? "");

          if (name === "created") {
            runId = String(event.research_run_id ?? "");
            // Cache immediately so a disconnect doesn't waste the run.
            if (runId) researchRunCache.set(key, runId);
            send({ type: "meta", runId });
            continue;
          }

          if (name === "plan_updated" || name === "sources_searched" || name === "source_fetched") {
            send({ type: "progress", event: name });
            continue;
          }

          if (name === "partial_summary") {
            send({ type: "progress", event: name, message: "Synthesising…" });
            continue;
          }

          if (name === "final_result") {
            const report = String(event.result ?? "");
            const citations = Array.isArray(event.citations) ? (event.citations as string[]).map(String) : [];
            send({ type: "report", report, citations });
            continue;
          }

          if (name === "run_stats") {
            send({ type: "progress", event: name, sources: Number(event.sources_searched ?? 0) });
            continue;
          }

          if (name === "error") {
            send({
              type: "error",
              message: String((event as { message?: string }).message ?? "Research pipeline error."),
            });
            return;
          }

          if (name === "done") break;
        }

        send({ type: "done" });
      } catch (err) {
        // Surface beta limits honestly rather than failing silently.
        const isLimit = err instanceof TinyFishError && (err.status === 429 || err.code === "DAILY_LIMIT_EXCEEDED");
        const isOff = err instanceof TinyFishError && err.status === 403;
        send({
          type: "error",
          message: isLimit
            ? "Deep research is rate-limited right now (5 runs/day during TinyFish's beta)."
            : isOff
              ? "Deep research isn't enabled on this TinyFish account yet."
              : err instanceof Error
                ? err.message
                : "Deep research failed.",
          hint: isLimit
            ? "The core verdict above still works — it uses the free Search + Fetch APIs."
            : "The core verdict above still works.",
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
      "X-Accel-Buffering": "no",
    },
  });
}
