import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseReportFile } from "@/lib/report-parser";
import { RunService } from "@/lib/run-service";
import { fromStoredPath, toArtifactsUrl } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getRetriesFromEnv() {
  const retriesRaw = Number(process.env.RETRIES ?? "0");

  if (!Number.isFinite(retriesRaw) || retriesRaw < 0) {
    return 0;
  }

  return Math.floor(retriesRaw);
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      target: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const reportAbsolutePath = fromStoredPath(run.reportJsonPath);
  const parsedReport = reportAbsolutePath ? await parseReportFile(reportAbsolutePath) : null;

  return NextResponse.json({
    runtimeConfig: {
      runTimeoutMs: RunService.getTimeoutMsFromEnv(),
      retries: getRetriesFromEnv(),
    },
    run: {
      ...run,
      htmlReportUrl: toArtifactsUrl(run.htmlReportPath),
      stdoutUrl: toArtifactsUrl(run.stdoutPath),
      stderrUrl: toArtifactsUrl(run.stderrPath),
      reportJsonUrl: toArtifactsUrl(run.reportJsonPath),
    },
    summary: {
      total: parsedReport?.summary.total ?? run.total ?? 0,
      passed: parsedReport?.summary.passed ?? run.passed ?? 0,
      failed: parsedReport?.summary.failed ?? run.failed ?? 0,
      flaky: parsedReport?.summary.flaky ?? run.flaky ?? 0,
      durationMs: parsedReport?.summary.durationMs ?? run.durationMs ?? 0,
    },
    tests: parsedReport?.tests ?? [],
    failingTests: parsedReport?.failingTests ?? [],
    flakyTests: parsedReport?.flakyTests ?? [],
  });
}
