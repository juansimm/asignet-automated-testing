import { NextResponse } from "next/server";
import { listViewerRuns } from "@/lib/tests-viewer-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await listViewerRuns();
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json(
      { error: "Failed to read local Playwright artifacts." },
      { status: 500 },
    );
  }
}
