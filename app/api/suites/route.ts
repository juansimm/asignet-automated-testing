import { NextResponse } from "next/server";
import { listSuites } from "@/lib/suites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const suites = await listSuites();
  return NextResponse.json({ suites });
}
