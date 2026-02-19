import path from "node:path";
import { promises as fs } from "node:fs";
import { ARTIFACTS_DIR, toPosixPath } from "@/lib/constants";

type PlaywrightAttachment = {
  name?: string;
  path?: string;
  contentType?: string;
};

type PlaywrightError = {
  message?: string;
  stack?: string;
  value?: string;
};

type PlaywrightResult = {
  status?: string;
  duration?: number;
  error?: PlaywrightError;
  errors?: PlaywrightError[];
  attachments?: PlaywrightAttachment[];
  stdout?: unknown[];
  stderr?: unknown[];
};

type PlaywrightTestCase = {
  title?: string;
  projectName?: string;
  status?: string;
  expectedStatus?: string;
  results?: PlaywrightResult[];
};

type PlaywrightSpec = {
  title?: string;
  tests?: PlaywrightTestCase[];
};

type PlaywrightSuite = {
  title?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
};

type PlaywrightReport = {
  suites?: PlaywrightSuite[];
  stats?: {
    duration?: number;
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
};

export type ParsedAttachment = {
  name: string;
  path: string | null;
  url: string | null;
  contentType: string | null;
};

export type ParsedFailingTest = {
  title: string;
  status: string;
  error: string;
  attachments: ParsedAttachment[];
  traceUrl: string | null;
  screenshotUrl: string | null;
  videoUrl: string | null;
};

export type ParsedTestCase = {
  title: string;
  status: string;
  expectedStatus: string | null;
  durationMs: number | null;
  error: string | null;
  stdout: string;
  stderr: string;
  attachments: ParsedAttachment[];
  responseAttachments: ParsedAttachment[];
  traceUrl: string | null;
  screenshotUrl: string | null;
  videoUrl: string | null;
};

export type ParsedReportSummary = {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  durationMs: number;
};

export type ParsedReport = {
  summary: ParsedReportSummary;
  tests: ParsedTestCase[];
  failingTests: ParsedFailingTest[];
  flakyTests: string[];
};

function getErrorMessage(result: PlaywrightResult | undefined) {
  if (!result) {
    return "No failure message available.";
  }

  if (result.error?.message) {
    return result.error.message;
  }

  if (result.errors?.length) {
    const first = result.errors.find((item) => item.message || item.stack || item.value);
    if (first?.message) {
      return first.message;
    }
    if (first?.stack) {
      return first.stack;
    }
    if (first?.value) {
      return first.value;
    }
  }

  return "No failure message available.";
}

function toArtifactUrl(attachmentPath: string | undefined) {
  if (!attachmentPath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(attachmentPath)
    ? attachmentPath
    : path.resolve(process.cwd(), attachmentPath);
  const relativeToArtifacts = path.relative(ARTIFACTS_DIR, resolvedPath);

  if (relativeToArtifacts.startsWith("..") || path.isAbsolute(relativeToArtifacts)) {
    return null;
  }

  return `/artifacts/${toPosixPath(relativeToArtifacts)}`;
}

function normalizeAttachments(attachments: PlaywrightAttachment[] | undefined): ParsedAttachment[] {
  if (!attachments?.length) {
    return [];
  }

  return attachments.map((attachment) => {
    return {
      name: attachment.name ?? "attachment",
      path: attachment.path ?? null,
      contentType: attachment.contentType ?? null,
      url: toArtifactUrl(attachment.path),
    };
  });
}

function pickFinalResult(results: PlaywrightResult[] | undefined) {
  if (!results?.length) {
    return undefined;
  }

  return results[results.length - 1];
}

function getAttachmentUrlByHint(attachments: ParsedAttachment[], hints: string[]) {
  const loweredHints = hints.map((hint) => hint.toLowerCase());

  for (const attachment of attachments) {
    const name = attachment.name.toLowerCase();
    const pathValue = (attachment.path ?? "").toLowerCase();

    if (loweredHints.some((hint) => name.includes(hint) || pathValue.includes(hint))) {
      return attachment.url;
    }
  }

  return null;
}

function parseOutputChunk(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  for (const key of ["text", "message", "value", "body"]) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  try {
    return JSON.stringify(record);
  } catch {
    return String(value);
  }
}

function normalizeOutput(chunks: unknown[] | undefined) {
  if (!chunks?.length) {
    return "";
  }

  return chunks.map(parseOutputChunk).filter(Boolean).join("\n").trim();
}

function normalizeTestStatus(finalStatus: string | undefined, testStatus: string | undefined) {
  const normalizedFinal = finalStatus?.toLowerCase() ?? "";
  const normalizedTest = testStatus?.toLowerCase() ?? "";

  if (normalizedTest === "flaky") {
    return "flaky";
  }

  if (normalizedTest === "expected" && normalizedFinal) {
    return normalizedFinal;
  }

  return normalizedFinal || normalizedTest || "unknown";
}

function isFailingStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized !== "passed" && normalized !== "skipped" && normalized !== "flaky";
}

function isResponseAttachment(attachment: ParsedAttachment) {
  const signal = `${attachment.name} ${attachment.path ?? ""} ${attachment.contentType ?? ""}`.toLowerCase();

  if (
    signal.includes("response") ||
    signal.includes("request") ||
    signal.includes("payload") ||
    signal.includes("body")
  ) {
    return true;
  }

  if (attachment.contentType) {
    if (attachment.contentType.startsWith("application/json")) {
      return true;
    }

    if (attachment.contentType.startsWith("text/")) {
      return true;
    }

    if (attachment.contentType.includes("xml")) {
      return true;
    }
  }

  const attachmentPath = (attachment.path ?? "").toLowerCase();
  return [".json", ".txt", ".log", ".xml", ".html", ".csv", ".md"].some((ext) =>
    attachmentPath.endsWith(ext),
  );
}

function buildTestTitle(prefix: string[], testCase: PlaywrightTestCase) {
  const suffix = testCase.title?.trim();
  if (suffix) {
    return [...prefix, suffix].join(" > ");
  }

  if (prefix.length > 0) {
    return prefix.join(" > ");
  }

  return "Untitled test";
}

function parseTests(report: PlaywrightReport): ParsedTestCase[] {
  const tests: ParsedTestCase[] = [];

  const visitSuite = (suite: PlaywrightSuite, parentTitles: string[]) => {
    const currentTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs ?? []) {
      const specPrefix = spec.title ? [...currentTitles, spec.title] : currentTitles;

      for (const testCase of spec.tests ?? []) {
        const results = testCase.results ?? [];
        const finalResult = pickFinalResult(results);
        const attachments = normalizeAttachments(
          results.flatMap((result) => result.attachments ?? []),
        );
        const status = normalizeTestStatus(finalResult?.status, testCase.status);

        const stdout = results
          .map((result) => normalizeOutput(result.stdout))
          .filter(Boolean)
          .join("\n")
          .trim();
        const stderr = results
          .map((result) => normalizeOutput(result.stderr))
          .filter(Boolean)
          .join("\n")
          .trim();
        const error = isFailingStatus(status) ? getErrorMessage(finalResult) : null;

        tests.push({
          title: buildTestTitle(specPrefix, testCase),
          status,
          expectedStatus: testCase.expectedStatus ?? null,
          durationMs: finalResult?.duration ?? null,
          error,
          stdout,
          stderr,
          attachments,
          responseAttachments: attachments.filter((attachment) => isResponseAttachment(attachment)),
          traceUrl: getAttachmentUrlByHint(attachments, ["trace", ".zip"]),
          screenshotUrl: getAttachmentUrlByHint(attachments, ["screenshot", ".png", ".jpg"]),
          videoUrl: getAttachmentUrlByHint(attachments, ["video", ".webm", ".mp4"]),
        });
      }
    }

    for (const nested of suite.suites ?? []) {
      visitSuite(nested, currentTitles);
    }
  };

  for (const suite of report.suites ?? []) {
    visitSuite(suite, []);
  }

  return tests;
}

function parseSummary(report: PlaywrightReport): ParsedReportSummary {
  const expected = report.stats?.expected ?? 0;
  const unexpected = report.stats?.unexpected ?? 0;
  const flaky = report.stats?.flaky ?? 0;
  const skipped = report.stats?.skipped ?? 0;

  if (expected || unexpected || flaky || skipped) {
    return {
      total: expected + unexpected + flaky + skipped,
      passed: expected,
      failed: unexpected,
      flaky,
      durationMs: report.stats?.duration ?? 0,
    };
  }

  let total = 0;
  let passed = 0;
  let failed = 0;
  let flakyCount = 0;

  const visitSuite = (suite: PlaywrightSuite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const finalResult = pickFinalResult(test.results);
        const status = finalResult?.status;

        if (!status) {
          continue;
        }

        total += 1;

        if (status === "passed") {
          passed += 1;
        } else if (status === "flaky") {
          flakyCount += 1;
        } else if (status !== "skipped") {
          failed += 1;
        }
      }
    }

    for (const nested of suite.suites ?? []) {
      visitSuite(nested);
    }
  };

  for (const suite of report.suites ?? []) {
    visitSuite(suite);
  }

  return {
    total,
    passed,
    failed,
    flaky: flakyCount,
    durationMs: report.stats?.duration ?? 0,
  };
}

function parseFailingTests(tests: ParsedTestCase[]): ParsedFailingTest[] {
  return tests
    .filter((testCase) => isFailingStatus(testCase.status))
    .map((testCase) => ({
      title: testCase.title,
      status: testCase.status,
      error: testCase.error ?? "No failure message available.",
      attachments: testCase.attachments,
      traceUrl: testCase.traceUrl,
      screenshotUrl: testCase.screenshotUrl,
      videoUrl: testCase.videoUrl,
    }));
}

function parseFlakyTests(tests: ParsedTestCase[]) {
  return tests
    .filter((testCase) => testCase.status.toLowerCase() === "flaky")
    .map((testCase) => testCase.title);
}

export async function parseReportFile(reportJsonPath: string): Promise<ParsedReport | null> {
  try {
    const raw = await fs.readFile(reportJsonPath, "utf8");
    const parsed = JSON.parse(raw) as PlaywrightReport;
    const tests = parseTests(parsed);

    return {
      summary: parseSummary(parsed),
      tests,
      failingTests: parseFailingTests(tests),
      flakyTests: parseFlakyTests(tests),
    };
  } catch {
    return null;
  }
}
