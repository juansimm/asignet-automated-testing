import path from "node:path";
import { NextResponse } from "next/server";
import { Prisma, RunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseReportFile } from "@/lib/report-parser";
import {
  buildFailedOnlyGrepPattern,
  RunConcurrencyError,
  runService,
  RunService,
} from "@/lib/run-service";
import { fromStoredPath, getRunPaths, toArtifactsUrl, toStoredPath } from "@/lib/runs";
import { getSuiteHash, suiteExists } from "@/lib/suites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateRunRequest = {
  targetId?: string;
  suiteName?: string;
  mode?: "headless" | "headed";
  slowMoMs?: number;
  rerunFailedOnlyFromRunId?: string;
};

function normalizeSuiteName(input: string) {
  return input.replace(/^\/+/, "").trim();
}

function getRetriesFromEnv() {
  const retriesRaw = Number(process.env.RETRIES ?? "0");

  if (!Number.isFinite(retriesRaw) || retriesRaw < 0) {
    return 0;
  }

  return Math.floor(retriesRaw);
}

async function resolveFailedOnlyPattern(sourceRunId: string) {
  const sourceRun = await prisma.run.findUnique({
    where: { id: sourceRunId },
    select: {
      id: true,
      targetId: true,
      suiteName: true,
      reportJsonPath: true,
    },
  });

  if (!sourceRun) {
    return { error: "source run not found" } as const;
  }

  const reportPath = fromStoredPath(sourceRun.reportJsonPath);

  if (!reportPath) {
    return { error: "source run does not have a JSON report" } as const;
  }

  const parsed = await parseReportFile(reportPath);
  const failedTitles =
    parsed?.failingTests
      .map((testCase) => testCase.title.split(" > ").at(-1)?.trim() ?? testCase.title)
      .filter((title) => title.length > 0) ?? [];
  const grepPattern = buildFailedOnlyGrepPattern(failedTitles);

  if (!grepPattern) {
    return { error: "source run has no failed tests to re-run" } as const;
  }

  return {
    sourceRun,
    grepPattern,
  } as const;
}

export async function GET() {
  try {
    const runs = await prisma.run.findMany({
      include: {
        target: true,
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 200,
    });

    return NextResponse.json({
      runtimeConfig: {
        runTimeoutMs: RunService.getTimeoutMsFromEnv(),
        retries: getRetriesFromEnv(),
      },
      runs: runs.map((run) => ({
        ...run,
        htmlReportUrl: toArtifactsUrl(run.htmlReportPath),
        stdoutUrl: toArtifactsUrl(run.stdoutPath),
        stderrUrl: toArtifactsUrl(run.stderrPath),
      })),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        {
          error:
            "Database schema is not initialized. Run `bun run prisma:migrate` and `bun run seed`.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateRunRequest;

  let targetId = body.targetId?.trim() ?? "";
  let suiteName = body.suiteName ? normalizeSuiteName(body.suiteName) : "";
  const rerunFailedOnlyFromRunId = body.rerunFailedOnlyFromRunId?.trim();
  const mode = body.mode === "headed" ? "headed" : "headless";
  const slowMoMs = Number.isFinite(body.slowMoMs) ? Math.max(Number(body.slowMoMs), 0) : 0;
  const timeoutMs = RunService.getTimeoutMsFromEnv();

  let grepPattern: string | null = null;

  if (rerunFailedOnlyFromRunId) {
    const failedOnly = await resolveFailedOnlyPattern(rerunFailedOnlyFromRunId);

    if ("error" in failedOnly) {
      return NextResponse.json({ error: failedOnly.error }, { status: 400 });
    }

    grepPattern = failedOnly.grepPattern;

    if (!targetId) {
      targetId = failedOnly.sourceRun.targetId;
    }

    if (!suiteName) {
      suiteName = failedOnly.sourceRun.suiteName;
    }
  }

  if (!targetId || !suiteName) {
    return NextResponse.json(
      { error: "targetId and suiteName are required" },
      { status: 400 },
    );
  }

  if (!(await suiteExists(suiteName))) {
    return NextResponse.json({ error: "suiteName was not found" }, { status: 400 });
  }

  const target = await prisma.target.findUnique({ where: { id: targetId } });

  if (!target) {
    return NextResponse.json({ error: "target not found" }, { status: 404 });
  }

  await runService.reconcileStaleRunningRuns();

  const runningCount = await prisma.run.count({ where: { status: RunStatus.RUNNING } });

  if (runService.hasActiveRuns() || runningCount > 0) {
    return NextResponse.json(
      { error: "another run is currently running; wait for it to finish" },
      { status: 409 },
    );
  }

  const runId = crypto.randomUUID();
  const runPaths = getRunPaths(runId);
  const suiteHash = await getSuiteHash(suiteName);

  const run = await prisma.run.create({
    data: {
      id: runId,
      targetId,
      suiteName,
      suiteHash,
      mode,
      slowMoMs,
      status: RunStatus.RUNNING,
      startedAt: new Date(),
      stdoutPath: toStoredPath(runPaths.stdoutPath),
      stderrPath: toStoredPath(runPaths.stderrPath),
      reportJsonPath: toStoredPath(runPaths.reportJsonPath),
      htmlReportPath: toStoredPath(path.join(runPaths.htmlReportDir, "index.html")),
      artifactsDir: toStoredPath(runPaths.runArtifactsDir),
    },
    include: {
      target: true,
    },
  });

  try {
    await runService.startRun({
      runId: run.id,
      targetBaseUrl: target.baseUrl,
      suiteName,
      mode,
      slowMoMs,
      timeoutMs,
      grepPattern,
    });
  } catch (error) {
    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.FAILED,
        exitCode: -1,
        finishedAt: new Date(),
      },
    });

    if (error instanceof RunConcurrencyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "failed to start run process" }, { status: 500 });
  }

  return NextResponse.json(
    {
      run: {
        ...run,
        htmlReportUrl: toArtifactsUrl(run.htmlReportPath),
      },
    },
    { status: 201 },
  );
}
