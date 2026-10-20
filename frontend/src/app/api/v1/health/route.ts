import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/zeroday/tinyfish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Service status and effective configuration (never leaks the key). */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "ZeroDay-Guard AI",
      version: "1.0.0",
      tier: "netlify-serverless",
      config: {
        app_name: "ZeroDay-Guard AI",
        version: "1.0.0",
        demo_mode: isDemoMode(),
        tinyfish_configured: !isDemoMode(),
        llm_provider: "tinyfish-research",
        codebert_enabled: false,
        codebert_model: "microsoft/codebert-base (self-hosted Python tier)",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
