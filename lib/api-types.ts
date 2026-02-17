export type TargetDto = {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
};

export type RunStatusDto = "QUEUED" | "RUNNING" | "PASSED" | "FAILED";

export type RunDto = {
  id: string;
  targetId: string;
  target?: TargetDto;
  suiteName: string;
  suiteHash: string | null;
  mode: string | null;
  slowMoMs: number | null;
  status: RunStatusDto;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  total: number | null;
  passed: number | null;
  failed: number | null;
  flaky: number | null;
  durationMs: number | null;
  stdoutPath: string | null;
  stderrPath: string | null;
  reportJsonPath: string | null;
  htmlReportPath: string | null;
  artifactsDir: string | null;
  htmlReportUrl?: string | null;
  stdoutUrl?: string | null;
  stderrUrl?: string | null;
  reportJsonUrl?: string | null;
};

export type ParsedAttachmentDto = {
  name: string;
  path: string | null;
  url: string | null;
  contentType: string | null;
};

export type ParsedFailingTestDto = {
  title: string;
  status: string;
  error: string;
  attachments: ParsedAttachmentDto[];
  traceUrl: string | null;
  screenshotUrl: string | null;
  videoUrl: string | null;
};

export type RunSummaryDto = {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  durationMs: number;
};
