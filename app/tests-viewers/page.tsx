"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  ParsedAttachmentDto,
  ParsedTestCaseDto,
  RunSummaryDto,
  ViewerRunDto,
} from "@/lib/api-types";

type RunsResponse = {
  runs?: ViewerRunDto[];
  error?: string;
};

type RunDetailsResponse = {
  run?: ViewerRunDto;
  summary?: RunSummaryDto;
  tests?: ParsedTestCaseDto[];
  screenshots?: ParsedAttachmentDto[];
  stdout?: string;
  stderr?: string;
  error?: string;
};

type TestFilter = "all" | "passed" | "failed" | "flaky" | "skipped";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function getTestStatusGroup(status: string): Exclude<TestFilter, "all"> {
  const normalized = status.toLowerCase();

  if (normalized === "passed" || normalized === "expected") {
    return "passed";
  }

  if (normalized === "flaky") {
    return "flaky";
  }

  if (normalized === "skipped") {
    return "skipped";
  }

  return "failed";
}

function isTextPreviewable(attachment: ParsedAttachmentDto) {
  const contentType = (attachment.contentType ?? "").toLowerCase();
  const attachmentPath = (attachment.path ?? "").toLowerCase();

  if (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("javascript")
  ) {
    return true;
  }

  return [".json", ".txt", ".log", ".xml", ".csv", ".md", ".html"].some((ext) =>
    attachmentPath.endsWith(ext),
  );
}

function TestResultBadge({ status }: { status: string }) {
  const group = getTestStatusGroup(status);

  if (group === "passed") {
    return <Badge variant="success">{status.toUpperCase()}</Badge>;
  }

  if (group === "flaky") {
    return <Badge variant="warning">FLAKY</Badge>;
  }

  if (group === "skipped") {
    return <Badge variant="secondary">SKIPPED</Badge>;
  }

  return <Badge variant="destructive">{status.toUpperCase()}</Badge>;
}

function ResponseAttachmentViewer({ attachment }: { attachment: ParsedAttachmentDto }) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPreview = Boolean(attachment.url && isTextPreviewable(attachment));

  const handleLoadPreview = async () => {
    if (!attachment.url) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(attachment.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load attachment");
      }

      const raw = await response.text();
      setContent(raw.slice(0, 5000));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{attachment.name}</p>
        {attachment.contentType && <Badge variant="secondary">{attachment.contentType}</Badge>}
        {attachment.url ? (
          <Link
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-900 underline"
          >
            Open File
          </Link>
        ) : (
          <p className="text-xs text-slate-500">No artifact URL</p>
        )}
        {canPreview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleLoadPreview();
            }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Preview"}
          </Button>
        )}
      </div>
      {attachment.path && <p className="mt-1 font-mono text-xs text-slate-500">{attachment.path}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {content != null && (
        <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {content || "(empty response)"}
        </pre>
      )}
    </div>
  );
}

export default function TestsViewersPage() {
  const [requestedRunId, setRequestedRunId] = useState("");
  const [runs, setRuns] = useState<ViewerRunDto[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [run, setRun] = useState<ViewerRunDto | null>(null);
  const [summary, setSummary] = useState<RunSummaryDto>({
    total: 0,
    passed: 0,
    failed: 0,
    flaky: 0,
    durationMs: 0,
  });
  const [tests, setTests] = useState<ParsedTestCaseDto[]>([]);
  const [runScreenshots, setRunScreenshots] = useState<ParsedAttachmentDto[]>([]);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [search, setSearch] = useState("");
  const [testFilter, setTestFilter] = useState<TestFilter>("all");
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async (preferredRunId?: string) => {
    const response = await fetch("/api/tests-viewers/runs", { cache: "no-store" });
    const payload = (await response.json()) as RunsResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load runs");
    }

    const nextRuns = payload.runs ?? [];
    const fallbackRunId = preferredRunId && nextRuns.some((item) => item.id === preferredRunId)
      ? preferredRunId
      : (nextRuns[0]?.id ?? "");

    setRuns(nextRuns);
    setSelectedRunId(fallbackRunId);

    return fallbackRunId;
  }, []);

  const loadRunDetails = useCallback(async (runId: string) => {
    const detailsResponse = await fetch(`/api/tests-viewers/runs/${runId}?lines=600`, {
      cache: "no-store",
    });
    const detailsPayload = (await detailsResponse.json()) as RunDetailsResponse;

    if (!detailsResponse.ok) {
      throw new Error(detailsPayload.error ?? "Failed to load run details");
    }

    setRun(detailsPayload.run ?? null);
    setSummary(
      detailsPayload.summary ?? {
        total: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        durationMs: 0,
      },
    );
    setTests(detailsPayload.tests ?? []);
    setRunScreenshots(detailsPayload.screenshots ?? []);
    setStdout(detailsPayload.stdout ?? "");
    setStderr(detailsPayload.stderr ?? "");
  }, []);

  const refreshRuns = useCallback(
    async (preferredRunId?: string) => {
      setLoadingRuns(true);
      setError(null);

      try {
        const runId = await loadRuns(preferredRunId);
        if (!runId) {
          setRun(null);
          setTests([]);
          setSummary({
            total: 0,
            passed: 0,
            failed: 0,
            flaky: 0,
            durationMs: 0,
          });
          setRunScreenshots([]);
          setStdout("");
          setStderr("");
        }

        return runId;
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
        return "";
      } finally {
        setLoadingRuns(false);
      }
    },
    [loadRuns],
  );

  const refreshRunDetails = useCallback(
    async (runId: string) => {
      if (!runId) {
        return;
      }

      setLoadingDetails(true);
      setError(null);

      try {
        await loadRunDetails(runId);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      } finally {
        setLoadingDetails(false);
      }
    },
    [loadRunDetails],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queryRunId = new URLSearchParams(window.location.search).get("runId")?.trim() ?? "";
    setRequestedRunId(queryRunId);
  }, []);

  useEffect(() => {
    void refreshRuns(requestedRunId);
  }, [refreshRuns, requestedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    void refreshRunDetails(selectedRunId);
  }, [refreshRunDetails, selectedRunId]);

  useEffect(() => {
    const runsIntervalId = setInterval(() => {
      void refreshRuns(selectedRunId);
    }, 10_000);

    return () => clearInterval(runsIntervalId);
  }, [refreshRuns, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId || run?.status !== "RUNNING") {
      return;
    }

    const detailsIntervalId = setInterval(() => {
      void refreshRunDetails(selectedRunId);
    }, 3_000);

    return () => clearInterval(detailsIntervalId);
  }, [refreshRunDetails, run?.status, selectedRunId]);

  const runOutput = useMemo(() => {
    if (!stdout && !stderr) {
      return "No output yet.";
    }

    return [stdout ? `[stdout]\n${stdout}` : "", stderr ? `[stderr]\n${stderr}` : ""]
      .filter(Boolean)
      .join("\n\n");
  }, [stderr, stdout]);

  const testCounts = useMemo(() => {
    return tests.reduce(
      (acc, testCase) => {
        const group = getTestStatusGroup(testCase.status);
        acc[group] += 1;
        return acc;
      },
      { passed: 0, failed: 0, flaky: 0, skipped: 0 },
    );
  }, [tests]);

  const filteredTests = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();

    return tests.filter((testCase) => {
      const group = getTestStatusGroup(testCase.status);
      const matchesFilter = testFilter === "all" || testFilter === group;

      if (!matchesFilter) {
        return false;
      }

      if (!loweredSearch) {
        return true;
      }

      return (
        testCase.title.toLowerCase().includes(loweredSearch) ||
        testCase.status.toLowerCase().includes(loweredSearch) ||
        (testCase.error ?? "").toLowerCase().includes(loweredSearch)
      );
    });
  }, [search, testFilter, tests]);

  const noRuns = !loadingRuns && runs.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tests Viewers</h1>
        <p className="text-sm text-slate-600">
          Explore runs from local Playwright artifacts (`bun run test` and triggered runs) with
          per-test result, output, responses, and screenshots.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Run Selection</CardTitle>
          <CardDescription>Pick a run to inspect. Newer runs appear first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)}>
              <option value="" disabled>
                {loadingRuns ? "Loading runs..." : "Select run"}
              </option>
              {runs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id.slice(0, 8)} | {item.suiteName} | {item.status} | {formatDate(item.startedAt)}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={() => {
                void refreshRuns(selectedRunId).then((runId) => {
                  if (runId) {
                    return refreshRunDetails(runId);
                  }
                  return undefined;
                });
              }}
            >
              Refresh
            </Button>
            <Link
              href="/runs"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100"
            >
              Open Runs Page
            </Link>
          </div>
          {noRuns && (
            <p className="text-sm text-slate-600">
              No runs found yet. Trigger one from <Link href="/runs" className="underline">Runs</Link>.
            </p>
          )}
        </CardContent>
      </Card>

      {run && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Run</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-7">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Run</p>
              <p className="mt-1 font-mono text-xs">{run.id}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <div className="mt-1">
                <StatusBadge status={run.status} />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Started</p>
              <p className="mt-1 text-sm">{formatDate(run.startedAt)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
              <p className="mt-1 text-sm">{formatDuration(summary.durationMs)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Passed</p>
              <p className="mt-1 text-sm font-semibold">{summary.passed}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Failed</p>
              <p className="mt-1 text-sm font-semibold">{summary.failed}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Flaky</p>
              <p className="mt-1 text-sm font-semibold">{summary.flaky}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {run && (
        <Card>
          <CardHeader>
            <CardTitle>Run Output</CardTitle>
            <CardDescription>Latest stdout/stderr stream from this run.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[24rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
              {runOutput}
            </pre>
          </CardContent>
        </Card>
      )}

      {run && (
        <Card>
          <CardHeader>
            <CardTitle id="run-screenshots">Run Screenshots</CardTitle>
            <CardDescription>
              Manual captures and test-result screenshots detected for this run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runScreenshots.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {runScreenshots.map((screenshot, index) => (
                  <Link
                    key={`${screenshot.path}-${index}`}
                    href={screenshot.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-slate-200 bg-slate-50 p-2 hover:bg-slate-100"
                  >
                    {screenshot.url ? (
                      <Image
                        src={screenshot.url}
                        alt={screenshot.name}
                        width={800}
                        height={500}
                        unoptimized
                        className="h-40 w-full rounded object-contain"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded bg-slate-200 text-xs text-slate-500">
                        Unavailable
                      </div>
                    )}
                    <p className="mt-2 truncate text-xs text-slate-700">{screenshot.name}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No run screenshots detected.</p>
            )}
          </CardContent>
        </Card>
      )}

      {run && (
        <Card>
          <CardHeader>
            <CardTitle>Tests</CardTitle>
            <CardDescription>Each test includes result, output, and available artifacts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Filter tests by title, status, or error..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                value={testFilter}
                onChange={(event) => setTestFilter(event.target.value as TestFilter)}
              >
                <option value="all">
                  all ({tests.length})
                </option>
                <option value="passed">
                  passed ({testCounts.passed})
                </option>
                <option value="failed">
                  failed ({testCounts.failed})
                </option>
                <option value="flaky">
                  flaky ({testCounts.flaky})
                </option>
                <option value="skipped">
                  skipped ({testCounts.skipped})
                </option>
              </Select>
            </div>

            {loadingDetails && <p className="text-sm text-slate-600">Loading test details...</p>}

            <div className="space-y-3">
              {filteredTests.map((testCase, index) => {
                const output = [
                  testCase.stdout ? `[stdout]\n${testCase.stdout}` : "",
                  testCase.stderr ? `[stderr]\n${testCase.stderr}` : "",
                ]
                  .filter(Boolean)
                  .join("\n\n");
                const otherAttachments = testCase.attachments.filter(
                  (attachment) =>
                    !testCase.responseAttachments.some(
                      (responseAttachment) =>
                        responseAttachment.path === attachment.path &&
                        responseAttachment.name === attachment.name,
                    ) &&
                    attachment.url !== testCase.screenshotUrl,
                );

                return (
                  <div
                    key={`${testCase.title}-${index}`}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{testCase.title}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          duration: {formatDuration(testCase.durationMs)} | expected:{" "}
                          {testCase.expectedStatus ?? "-"}
                        </p>
                      </div>
                      <TestResultBadge status={testCase.status} />
                    </div>

                    {testCase.error && (
                      <pre className="mt-3 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                        {testCase.error}
                      </pre>
                    )}

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Output
                        </p>
                        {output ? (
                          <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                            {output}
                          </pre>
                        ) : (
                          <p className="text-sm text-slate-600">No test-level output captured.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Screenshot
                        </p>
                        {testCase.screenshotUrl ? (
                          <Link href={testCase.screenshotUrl} target="_blank" rel="noreferrer">
                            <Image
                              src={testCase.screenshotUrl}
                              alt={`${testCase.title} screenshot`}
                              width={1400}
                              height={900}
                              unoptimized
                              className="h-auto max-h-64 w-full rounded-md border border-slate-200 object-contain"
                            />
                          </Link>
                        ) : (
                          <p className="text-sm text-slate-600">
                            {runScreenshots.length > 0
                              ? `No test-bound screenshot. ${runScreenshots.length} run screenshot(s) available above.`
                              : "No screenshot available."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Responses
                      </p>
                      {testCase.responseAttachments.length > 0 ? (
                        <div className="space-y-2">
                          {testCase.responseAttachments.map((attachment, responseIndex) => (
                            <ResponseAttachmentViewer
                              key={`${attachment.name}-${attachment.path}-${responseIndex}`}
                              attachment={attachment}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">No response attachments detected.</p>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      {testCase.traceUrl && (
                        <Link href={testCase.traceUrl} target="_blank" rel="noreferrer" className="underline">
                          Open trace
                        </Link>
                      )}
                      {testCase.videoUrl && (
                        <Link href={testCase.videoUrl} target="_blank" rel="noreferrer" className="underline">
                          Open video
                        </Link>
                      )}
                      {run?.htmlReportUrl && (
                        <Link href={run.htmlReportUrl} target="_blank" rel="noreferrer" className="underline">
                          Open HTML report
                        </Link>
                      )}
                    </div>

                    {otherAttachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Other Attachments
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {otherAttachments.map((attachment, attachmentIndex) => (
                            attachment.url ? (
                              <Link
                                key={`${attachment.name}-${attachment.path}-${attachmentIndex}`}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-100"
                              >
                                {attachment.name}
                              </Link>
                            ) : (
                              <span
                                key={`${attachment.name}-${attachment.path}-${attachmentIndex}`}
                                className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500"
                              >
                                {attachment.name}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredTests.length === 0 && (
              <p className="text-sm text-slate-600">
                No tests match this filter. Try changing status/search or run another suite.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
