import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromStoredPath } from "@/lib/runs";
import { tailFile } from "@/lib/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const linesRaw = Number(searchParams.get("lines") ?? "200");
  const lines = Number.isFinite(linesRaw) ? Math.min(Math.max(linesRaw, 20), 2000) : 200;

  const run = await prisma.run.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      stdoutPath: true,
      stderrPath: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const [stdout, stderr] = await Promise.all([
    tailFile(fromStoredPath(run.stdoutPath), lines),
    tailFile(fromStoredPath(run.stderrPath), lines),
  ]);

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    stdout,
    stderr,
  });
}
