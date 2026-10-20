import { NextResponse } from "next/server";
import { getJob } from "@/lib/zeroday/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Poll a scan job.
 *
 * Returns the full event trace so far plus the assessment once it is ready.
 * The client appends only the events it has not seen yet, which is what
 * makes the terminal fill up live.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Unknown or expired job id." }, { status: 404 });
  }

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      target: job.target,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      events: job.events,
      assessment: job.assessment,
      error: job.error,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
