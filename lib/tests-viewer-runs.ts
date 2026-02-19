import path from "node:path";
import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import { ARTIFACTS_DIR, ROOT_DIR, SPECS_DIR, toPosixPath } from "@/lib/constants";
import { tailFile } from "@/lib/logs";
import {
  parseReportFile,
  type ParsedFailingTest,
  type ParsedAttachment,
  type ParsedReportSummary,
  type ParsedTestCase,
} from "@/lib/report-parser";

export type ViewerRunStatus = "QUEUED" | "RUNNING" | "PASSED" | "FAILED";

export type ViewerRun = {
  id: string;
  suiteName: string;
  status: ViewerRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  htmlReportUrl: string | null;
  reportJsonUrl: string | null;
  stdoutUrl: string | null;
  stderrUrl: string | null;
  source: "artifacts";
};

export type ViewerRunDetails = {
  run: ViewerRun;
  summary: ParsedReportSummary;
  tests: ParsedTestCase[];
  failingTests: ParsedFailingTest[];
  flakyTests: string[];
  screenshots: ParsedAttachment[];
  agentContext: AgentContext | null;
  stdout: string;
  stderr: string;
};

type AgentPhase = "planner" | "generator" | "healer";

export type AgentRecord = {
  phase: AgentPhase;
  createdAt: string;
  ok: boolean;
  exitCode: number;
  command: string;
  requestFile: string | null;
  planFile: string | null;
  outputPlanFile: string | null;
  recordFile: string;
  stdout: string;
  stderr: string;
};

export type AgentContext = {
  requestFile: string | null;
  planFile: string | null;
  inputTask: string | null;
  planner: AgentRecord | null;
  generator: AgentRecord | null;
  healer: AgentRecord | null;
};

type RawReport = {
  stats?: {
    startTime?: string;
    duration?: number;
  };
  errors?: unknown[];
  suites?: Array<{ title?: string; suites?: RawReport["suites"]; specs?: Array<{ title?: string }> }>;
};

type AgentRecordFile = {
  createdAt?: string;
  phase?: AgentPhase;
  requestFile?: string | null;
  planFile?: string | null;
  outputPlanFile?: string | null;
  command?: string;
  exitCode?: number;
  ok?: boolean;
  stdout?: string;
  stderr?: string;
};

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toArtifactUrl(absolutePath: string) {
  const relativePath = path.relative(ARTIFACTS_DIR, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return `/artifacts/${toPosixPath(relativePath)}`;
}

function toWorkspaceFileUrl(absolutePath: string) {
  const relativePath = path.relative(ROOT_DIR, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return `/workspace-files/${toPosixPath(relativePath)}`;
}

function toViewerFileUrl(absolutePath: string) {
  const artifactUrl = toArtifactUrl(absolutePath);
  if (artifactUrl) {
    return artifactUrl;
  }

  return toWorkspaceFileUrl(absolutePath);
}

function resolveUnderSpecs(relativePath: string | null | undefined) {
  if (!relativePath) {
    return null;
  }

  const resolved = path.resolve(ROOT_DIR, relativePath);
  const specsRoot = path.resolve(SPECS_DIR);

  if (!resolved.startsWith(`${specsRoot}${path.sep}`)) {
    return null;
  }

  return resolved;
}

function resolveRunDir(runId: string) {
  const candidate = path.resolve(ARTIFACTS_DIR, runId);
  const normalizedRoot = path.resolve(ARTIFACTS_DIR);

  if (candidate === normalizedRoot) {
    return null;
  }

  if (!candidate.startsWith(`${normalizedRoot}${path.sep}`)) {
    return null;
  }

  return candidate;
}

function extractSuiteName(report: RawReport, fallback: string) {
  const visit = (suites: RawReport["suites"] | undefined): string | null => {
    for (const suite of suites ?? []) {
      const title = suite.title?.trim();
      if (title) {
        return title;
      }

      for (const spec of suite.specs ?? []) {
        const specTitle = spec.title?.trim();
        if (specTitle) {
          return specTitle;
        }
      }

      const nested = visit(suite.suites);
      if (nested) {
        return nested;
      }
    }

    return null;
  };

  return visit(report.suites) ?? fallback;
}

async function readRawReport(reportPath: string): Promise<RawReport | null> {
  try {
    const raw = await fs.readFile(reportPath, "utf8");
    return JSON.parse(raw) as RawReport;
  } catch {
    return null;
  }
}

async function readLastRunStatus(runDir: string) {
  const lastRunPath = path.join(runDir, "test-results", ".last-run.json");

  try {
    const raw = await fs.readFile(lastRunPath, "utf8");
    const parsed = JSON.parse(raw) as { status?: string };
    return parsed.status?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function isScreenshotPath(filePath: string) {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
}

function getImageContentType(filePath: string) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}

async function walkFiles(baseDir: string): Promise<string[]> {
  let entries: Dirent[] = [];

  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkFiles(fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function collectRunScreenshots(
  runId: string,
  runDir: string,
  startedAt: string | null,
  finishedAt: string | null,
): Promise<ParsedAttachment[]> {
  const candidateDirs = [runDir];

  if (runId === "manual_run") {
    candidateDirs.push(path.join(ROOT_DIR, "playwright", "tests", "screenshots"));
  }

  const allFiles = (
    await Promise.all(candidateDirs.map((candidateDir) => walkFiles(candidateDir)))
  ).flat();

  const screenshotFiles = allFiles.filter(isScreenshotPath);
  if (screenshotFiles.length === 0) {
    return [];
  }

  const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;
  const finishedAtMs = finishedAt ? new Date(finishedAt).getTime() : null;
  const timeWindowPaddingMs = 10 * 60 * 1000;

  const enriched = await Promise.all(
    screenshotFiles.map(async (filePath) => {
      try {
        const stat = await fs.stat(filePath);
        return { filePath, mtimeMs: stat.mtimeMs };
      } catch {
        return null;
      }
    }),
  );

  const timeFiltered = enriched
    .filter((item): item is { filePath: string; mtimeMs: number } => Boolean(item))
    .filter((item) => {
      if (startedAtMs == null) {
        return true;
      }

      const lowerBound = startedAtMs - timeWindowPaddingMs;
      const upperBound = (finishedAtMs ?? Date.now()) + timeWindowPaddingMs;
      return item.mtimeMs >= lowerBound && item.mtimeMs <= upperBound;
    })
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const fallback = enriched
    .filter((item): item is { filePath: string; mtimeMs: number } => Boolean(item))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const chosen = timeFiltered.length > 0 ? timeFiltered : fallback;
  const dedup = new Set<string>();

  const screenshots: ParsedAttachment[] = [];

  for (const item of chosen) {
    const normalizedPath = path.resolve(item.filePath);
    if (dedup.has(normalizedPath)) {
      continue;
    }
    dedup.add(normalizedPath);

    const url = toViewerFileUrl(normalizedPath);
    if (!url) {
      continue;
    }

    screenshots.push({
      name: path.basename(normalizedPath),
      path: normalizedPath,
      url,
      contentType: getImageContentType(normalizedPath),
    });
  }

  return screenshots;
}

function parseScenarioInput(content: string) {
  const headingMatch = content.match(
    /##\s*(?:Scenario Input|Input del Escenario|Entrada del Escenario)\s*([\s\S]*?)(?:\n##\s|\n#\s|$)/i,
  );
  const section = (headingMatch?.[1] ?? content).trim();

  if (!section) {
    return null;
  }

  return section.length > 9000 ? `${section.slice(0, 9000)}\n\n...` : section;
}

async function findLatestSpecFile(prefix: "request_" | "test-plan_", runStartedAt: string | null) {
  let entries: Dirent[] = [];

  try {
    entries = await fs.readdir(SPECS_DIR, { withFileTypes: true });
  } catch {
    return null;
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const absolutePath = path.join(SPECS_DIR, entry.name);
        const stat = await fs.stat(absolutePath);
        return {
          relativePath: `specs/${entry.name}`,
          mtimeMs: stat.mtimeMs,
        };
      }),
  );

  if (files.length === 0) {
    return null;
  }

  const runStartMs = runStartedAt ? new Date(runStartedAt).getTime() : null;
  const sorted = files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!runStartMs) {
    return sorted[0]?.relativePath ?? null;
  }

  const windowMs = 24 * 60 * 60 * 1000;
  const scoped = sorted.filter((file) => file.mtimeMs <= runStartMs + windowMs);
  return (scoped[0] ?? sorted[0])?.relativePath ?? null;
}

async function readAgentRunRecords() {
  const agentRunsDir = path.join(SPECS_DIR, "agent-runs");
  let entries: Dirent[] = [];

  try {
    entries = await fs.readdir(agentRunsDir, { withFileTypes: true });
  } catch {
    return [] as AgentRecord[];
  }

  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const absolutePath = path.join(agentRunsDir, entry.name);
        const relativePath = `specs/agent-runs/${entry.name}`;

        try {
          const raw = await fs.readFile(absolutePath, "utf8");
          const parsed = JSON.parse(raw) as AgentRecordFile;
          if (!parsed.phase || !parsed.createdAt || !parsed.command) {
            return null;
          }

          return {
            phase: parsed.phase,
            createdAt: parsed.createdAt,
            ok: Boolean(parsed.ok),
            exitCode: Number.isFinite(parsed.exitCode) ? Number(parsed.exitCode) : 1,
            command: parsed.command,
            requestFile: parsed.requestFile ?? null,
            planFile: parsed.planFile ?? null,
            outputPlanFile: parsed.outputPlanFile ?? null,
            recordFile: relativePath,
            stdout: parsed.stdout ?? "",
            stderr: parsed.stderr ?? "",
          } satisfies AgentRecord;
        } catch {
          return null;
        }
      }),
  );

  return records
    .filter((record): record is AgentRecord => Boolean(record))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function findBestAgentRecord(records: AgentRecord[], phase: AgentPhase, runStartedAt: string | null) {
  const scoped = records.filter((record) => record.phase === phase);
  if (scoped.length === 0) {
    return null;
  }

  if (!runStartedAt) {
    return scoped[0];
  }

  const runStartMs = new Date(runStartedAt).getTime();
  const maxDiffMs = 24 * 60 * 60 * 1000;

  let best: AgentRecord | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const record of scoped) {
    const diff = Math.abs(new Date(record.createdAt).getTime() - runStartMs);
    if (diff < bestDiff) {
      best = record;
      bestDiff = diff;
    }
  }

  if (best && bestDiff <= maxDiffMs) {
    return best;
  }

  return scoped[0];
}

async function buildAgentContext(runStartedAt: string | null): Promise<AgentContext | null> {
  const records = await readAgentRunRecords();
  const planner = findBestAgentRecord(records, "planner", runStartedAt);
  const generator = findBestAgentRecord(records, "generator", runStartedAt);
  const healer = findBestAgentRecord(records, "healer", runStartedAt);

  const requestFile =
    planner?.requestFile ??
    generator?.requestFile ??
    (await findLatestSpecFile("request_", runStartedAt));
  const planFile =
    planner?.outputPlanFile ??
    generator?.planFile ??
    (await findLatestSpecFile("test-plan_", runStartedAt));

  const requestAbsolutePath = resolveUnderSpecs(requestFile);
  let inputTask: string | null = null;

  if (requestAbsolutePath) {
    try {
      const content = await fs.readFile(requestAbsolutePath, "utf8");
      inputTask = parseScenarioInput(content);
    } catch {
      inputTask = null;
    }
  }

  if (!planner && !generator && !healer && !requestFile && !planFile && !inputTask) {
    return null;
  }

  return {
    requestFile: requestFile ?? null,
    planFile: planFile ?? null,
    inputTask: inputTask ?? null,
    planner: planner ?? null,
    generator: generator ?? null,
    healer: healer ?? null,
  };
}

function resolveStatus(
  parsedSummary: {
    total: number;
    failed: number;
  },
  rawReport: RawReport | null,
  lastRunStatus: string | null,
): ViewerRunStatus {
  if (lastRunStatus === "failed") {
    return "FAILED";
  }

  if (lastRunStatus === "passed") {
    return "PASSED";
  }

  if (lastRunStatus === "running") {
    return "RUNNING";
  }

  if (parsedSummary.failed > 0) {
    return "FAILED";
  }

  if (parsedSummary.total === 0 && (rawReport?.errors?.length ?? 0) > 0) {
    return "FAILED";
  }

  return "PASSED";
}

async function parseRunFromDir(runId: string): Promise<{ run: ViewerRun; sortMs: number } | null> {
  const runDir = resolveRunDir(runId);
  if (!runDir) {
    return null;
  }

  const reportPath = path.join(runDir, "report.json");
  if (!(await pathExists(reportPath))) {
    return null;
  }

  const parsedReport = await parseReportFile(reportPath);
  if (!parsedReport) {
    return null;
  }

  const rawReport = await readRawReport(reportPath);
  const lastRunStatus = await readLastRunStatus(runDir);
  const status = resolveStatus(parsedReport.summary, rawReport, lastRunStatus);
  const startedAt = rawReport?.stats?.startTime ?? null;
  const durationMs = Math.round(parsedReport.summary.durationMs);
  const finishedAt =
    startedAt && durationMs > 0 ? new Date(new Date(startedAt).getTime() + durationMs).toISOString() : null;

  const htmlReportPath = path.join(runDir, "html-report", "index.html");
  const stdoutPath = path.join(runDir, "stdout.log");
  const stderrPath = path.join(runDir, "stderr.log");

  const reportStat = await fs.stat(reportPath);

  return {
    run: {
      id: runId,
      suiteName: extractSuiteName(rawReport ?? {}, runId),
      status,
      startedAt,
      finishedAt,
      durationMs: durationMs || null,
      total: parsedReport.summary.total,
      passed: parsedReport.summary.passed,
      failed: parsedReport.summary.failed,
      flaky: parsedReport.summary.flaky,
      htmlReportUrl: (await pathExists(htmlReportPath)) ? toArtifactUrl(htmlReportPath) : null,
      reportJsonUrl: toArtifactUrl(reportPath),
      stdoutUrl: (await pathExists(stdoutPath)) ? toArtifactUrl(stdoutPath) : null,
      stderrUrl: (await pathExists(stderrPath)) ? toArtifactUrl(stderrPath) : null,
      source: "artifacts",
    },
    sortMs: startedAt ? new Date(startedAt).getTime() : reportStat.mtimeMs,
  };
}

export async function listViewerRuns() {
  let entries: Dirent[] = [];

  try {
    entries = await fs.readdir(ARTIFACTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const parsedRuns = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => parseRunFromDir(entry.name)),
  );

  return parsedRuns
    .filter((parsed): parsed is { run: ViewerRun; sortMs: number } => Boolean(parsed))
    .sort((a, b) => b.sortMs - a.sortMs)
    .map((parsed) => parsed.run);
}

export async function getViewerRunDetails(runId: string, lines = 600): Promise<ViewerRunDetails | null> {
  const runDir = resolveRunDir(runId);
  if (!runDir) {
    return null;
  }

  const reportPath = path.join(runDir, "report.json");
  if (!(await pathExists(reportPath))) {
    return null;
  }

  const parsedReport = await parseReportFile(reportPath);
  if (!parsedReport) {
    return null;
  }

  const run = await parseRunFromDir(runId);
  if (!run) {
    return null;
  }

  const stdout = await tailFile(path.join(runDir, "stdout.log"), lines);
  const stderr = await tailFile(path.join(runDir, "stderr.log"), lines);
  const screenshots = await collectRunScreenshots(
    runId,
    runDir,
    run.run.startedAt,
    run.run.finishedAt,
  );
  const agentContext = await buildAgentContext(run.run.startedAt);

  return {
    run: run.run,
    summary: parsedReport.summary,
    tests: parsedReport.tests,
    failingTests: parsedReport.failingTests,
    flakyTests: parsedReport.flakyTests,
    screenshots,
    agentContext,
    stdout,
    stderr,
  };
}
