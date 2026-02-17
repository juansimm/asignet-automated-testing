import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Prisma, RunStatus } from "@prisma/client";
import { ensureDir, ROOT_DIR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { parseReportFile } from "@/lib/report-parser";
import { fromStoredPath, getRunPaths } from "@/lib/runs";

type ActiveRun = {
  child: ChildProcess;
  startedAtMs: number;
  timeoutHandle: NodeJS.Timeout;
  timedOut: boolean;
  forcedExitCode?: number;
};

type StartRunInput = {
  runId: string;
  targetBaseUrl: string;
  suiteName: string;
  mode: "headless" | "headed";
  slowMoMs: number;
  timeoutMs: number;
  grepPattern?: string | null;
};

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const FORCE_KILL_GRACE_MS = 5_000;

export class RunConcurrencyError extends Error {
  constructor(message = "another run is already executing") {
    super(message);
    this.name = "RunConcurrencyError";
  }
}

export class RunService {
  private activeRuns = new Map<string, ActiveRun>();
  private isStartingRun = false;

  hasActiveRuns() {
    return this.activeRuns.size > 0 || this.isStartingRun;
  }

  isRunActive(runId: string) {
    return this.activeRuns.has(runId);
  }

  static getTimeoutMsFromEnv() {
    const raw = Number(process.env.RUN_TIMEOUT_MS ?? "");

    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_TIMEOUT_MS;
    }

    return Math.floor(raw);
  }

  async reconcileStaleRunningRuns() {
    const runningRuns = await prisma.run.findMany({
      where: { status: RunStatus.RUNNING },
      select: { id: true },
    });

    const staleRunIds = runningRuns
      .map((run) => run.id)
      .filter((runId) => !this.activeRuns.has(runId));

    if (staleRunIds.length === 0) {
      return;
    }

    await prisma.run.updateMany({
      where: {
        id: { in: staleRunIds },
        status: RunStatus.RUNNING,
      },
      data: {
        status: RunStatus.FAILED,
        exitCode: -2,
        finishedAt: new Date(),
      },
    });
  }

  private buildCliArgs(input: StartRunInput) {
    const args = [
      "playwright",
      "test",
      `playwright/tests/${input.suiteName}`,
      "--config=playwright/playwright.config.ts",
    ];

    if (input.mode === "headed") {
      args.push("--headed");
    }

    if (input.grepPattern) {
      args.push("--grep", input.grepPattern);
    }

    return args;
  }

  private killWithGrace(activeRun: ActiveRun) {
    activeRun.child.kill("SIGTERM");

    setTimeout(() => {
      activeRun.child.kill("SIGKILL");
    }, FORCE_KILL_GRACE_MS).unref();
  }

  private async finalizeRun(
    runId: string,
    options: {
      exitCode: number;
      status: RunStatus;
    },
  ) {
    const run = await prisma.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        reportJsonPath: true,
      },
    });

    if (!run) {
      return;
    }

    const reportAbsolutePath = fromStoredPath(run.reportJsonPath);
    const parsedReport = reportAbsolutePath ? await parseReportFile(reportAbsolutePath) : null;

    try {
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: options.status,
          finishedAt: new Date(),
          exitCode: options.exitCode,
          total: parsedReport?.summary.total,
          passed: parsedReport?.summary.passed,
          failed: parsedReport?.summary.failed,
          flaky: parsedReport?.summary.flaky,
          durationMs: parsedReport?.summary.durationMs,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return;
      }

      throw error;
    }
  }

  async startRun(input: StartRunInput) {
    if (this.hasActiveRuns()) {
      throw new RunConcurrencyError();
    }

    this.isStartingRun = true;

    try {
      const runPaths = getRunPaths(input.runId);
      await ensureDir(runPaths.runArtifactsDir);

      const stdoutStream = createWriteStream(runPaths.stdoutPath, { flags: "a" });
      const stderrStream = createWriteStream(runPaths.stderrPath, { flags: "a" });

      const child = spawn("npx", this.buildCliArgs(input), {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          BASE_URL: input.targetBaseUrl,
          RUN_ID: input.runId,
          SLOW_MO_MS: String(input.slowMoMs),
          HEADLESS: input.mode === "headless" ? "1" : "0",
          FORCE_COLOR: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      // `pipe` is append-only and applies backpressure, so log streaming stays non-blocking.
      child.stdout.pipe(stdoutStream);
      child.stderr.pipe(stderrStream);

      const activeRun: ActiveRun = {
        child,
        startedAtMs: Date.now(),
        timeoutHandle: setTimeout(() => {
          const running = this.activeRuns.get(input.runId);

          if (!running) {
            return;
          }

          running.timedOut = true;
          running.forcedExitCode = 124;
          stderrStream.write(
            `\n[timeout] Run exceeded ${input.timeoutMs} ms. Sending SIGTERM...\n`,
          );
          this.killWithGrace(running);
        }, input.timeoutMs),
        timedOut: false,
      };

      let finalized = false;

      const finalize = async (exitCode: number, status: RunStatus) => {
        if (finalized) {
          return;
        }

        finalized = true;
        this.activeRuns.delete(input.runId);
        clearTimeout(activeRun.timeoutHandle);

        await Promise.all([
          new Promise<void>((resolve) => stdoutStream.end(resolve)),
          new Promise<void>((resolve) => stderrStream.end(resolve)),
        ]);

        await this.finalizeRun(input.runId, {
          status,
          exitCode,
        });
      };

      child.on("error", async (error) => {
        stderrStream.write(`\n[spawn-error] ${String(error)}\n`);
        await finalize(-1, RunStatus.FAILED);
      });

      child.on("close", async (code) => {
        const exitCode =
          activeRun.forcedExitCode ?? (typeof code === "number" ? code : activeRun.timedOut ? 124 : -1);
        const status = exitCode === 0 ? RunStatus.PASSED : RunStatus.FAILED;
        await finalize(exitCode, status);
      });

      this.activeRuns.set(input.runId, activeRun);
    } finally {
      this.isStartingRun = false;
    }
  }

  async cancelRun(runId: string) {
    const activeRun = this.activeRuns.get(runId);

    if (!activeRun) {
      return false;
    }

    activeRun.timedOut = false;
    activeRun.forcedExitCode = 130;
    this.killWithGrace(activeRun);
    return true;
  }
}

const globalForRunService = globalThis as unknown as {
  runService?: RunService;
};

export const runService = globalForRunService.runService ?? new RunService();

if (!globalForRunService.runService) {
  globalForRunService.runService = runService;
}

export function buildFailedOnlyGrepPattern(failedTitles: string[]) {
  const uniqueTitles = [...new Set(failedTitles.map((title) => title.trim()).filter(Boolean))];

  if (uniqueTitles.length === 0) {
    return null;
  }

  const escaped = uniqueTitles.map((title) =>
    title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  return `(${escaped.join("|")})`;
}
