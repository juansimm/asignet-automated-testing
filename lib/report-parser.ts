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
};

type PlaywrightTestCase = {
  title?: string;
  projectName?: string;
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

export type ParsedReportSummary = {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  durationMs: number;
};

export type ParsedReport = {
  summary: ParsedReportSummary;
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

function buildTestTitle(prefix: string[], testCase: PlaywrightTestCase) {
  const suffix = testCase.title?.trim() || "Untitled test";
  return [...prefix, suffix].join(" > ");
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

function parseFailingTests(report: PlaywrightReport): ParsedFailingTest[] {
  const failingTests: ParsedFailingTest[] = [];

  const visitSuite = (suite: PlaywrightSuite, parentTitles: string[]) => {
    const currentTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs ?? []) {
      const specPrefix = spec.title ? [...currentTitles, spec.title] : currentTitles;

      for (const testCase of spec.tests ?? []) {
        const finalResult = pickFinalResult(testCase.results);
        const status = finalResult?.status ?? "unknown";

        if (status === "passed" || status === "skipped" || status === "flaky") {
          continue;
        }

        const results = testCase.results ?? [];
        const combinedAttachments = normalizeAttachments(
          results.flatMap((result) => result.attachments ?? []),
        );

        failingTests.push({
          title: buildTestTitle(specPrefix, testCase),
          status,
          error: getErrorMessage(finalResult),
          attachments: combinedAttachments,
          traceUrl: getAttachmentUrlByHint(combinedAttachments, ["trace", ".zip"]),
          screenshotUrl: getAttachmentUrlByHint(combinedAttachments, ["screenshot", ".png", ".jpg"]),
          videoUrl: getAttachmentUrlByHint(combinedAttachments, ["video", ".webm", ".mp4"]),
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

  return failingTests;
}

function parseFlakyTests(report: PlaywrightReport): string[] {
  const flakyTests: string[] = [];

  const visitSuite = (suite: PlaywrightSuite, parentTitles: string[]) => {
    const currentTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs ?? []) {
      const specPrefix = spec.title ? [...currentTitles, spec.title] : currentTitles;

      for (const testCase of spec.tests ?? []) {
        const finalResult = pickFinalResult(testCase.results);

        if (finalResult?.status !== "flaky") {
          continue;
        }

        flakyTests.push(buildTestTitle(specPrefix, testCase));
      }
    }

    for (const nested of suite.suites ?? []) {
      visitSuite(nested, currentTitles);
    }
  };

  for (const suite of report.suites ?? []) {
    visitSuite(suite, []);
  }

  return flakyTests;
}

export async function parseReportFile(reportJsonPath: string): Promise<ParsedReport | null> {
  try {
    const raw = await fs.readFile(reportJsonPath, "utf8");
    const parsed = JSON.parse(raw) as PlaywrightReport;

    return {
      summary: parseSummary(parsed),
      failingTests: parseFailingTests(parsed),
      flakyTests: parseFlakyTests(parsed),
    };
  } catch {
    return null;
  }
}
