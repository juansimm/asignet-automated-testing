"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParsedFailingTestDto, RunDto, RunSummaryDto } from "@/lib/api-types";

type RuntimeConfigDto = {
  runTimeoutMs: number;
  retries: number;
};

function formatDuration(durationMs: number) {
  if (!durationMs) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatTimeoutLabel(runTimeoutMs: number) {
  if (runTimeoutMs % 60_000 === 0) {
    return `${runTimeoutMs / 60_000} min`;
  }

  if (runTimeoutMs >= 1000) {
    return `${(runTimeoutMs / 1000).toFixed(0)} sec`;
  }

  return `${runTimeoutMs} ms`;
}

type RunDetailsResponse = {
  runtimeConfig?: RuntimeConfigDto;
  run: RunDto;
  summary: RunSummaryDto;
  failingTests: ParsedFailingTestDto[];
  flakyTests: string[];
  error?: string;
};

type RunLogsResponse = {
  status: string;
  stdout: string;
  stderr: string;
  error?: string;
};

export default function RunDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const runId = params.id;

  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfigDto | null>(null);
  const [run, setRun] = useState<RunDto | null>(null);
  const [summary, setSummary] = useState<RunSummaryDto>({
    total: 0,
    passed: 0,
    failed: 0,
    flaky: 0,
    durationMs: 0,
  });
  const [failingTests, setFailingTests] = useState<ParsedFailingTestDto[]>([]);
  const [flakyTests, setFlakyTests] = useState<string[]>([]);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const isRunning = run?.status === "RUNNING";

  const combinedLogs = useMemo(() => {
    if (!stdout && !stderr) {
      return "Waiting for logs...";
    }

    const logChunks = [
      stdout ? `[stdout]\n${stdout}` : "",
      stderr ? `[stderr]\n${stderr}` : "",
    ].filter(Boolean);

    return logChunks.join("\n\n");
  }, [stderr, stdout]);

  const loadDetails = useCallback(async () => {
    const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
    const payload = (await response.json()) as RunDetailsResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load run details");
    }

    setRuntimeConfig(payload.runtimeConfig ?? null);
    setRun(payload.run);
    setSummary(payload.summary);
    setFailingTests(payload.failingTests ?? []);
    setFlakyTests(payload.flakyTests ?? []);
  }, [runId]);

  const loadLogs = useCallback(async () => {
    const response = await fetch(`/api/runs/${runId}/logs?lines=250`, { cache: "no-store" });
    const payload = (await response.json()) as RunLogsResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load logs");
    }

    setStdout(payload.stdout ?? "");
    setStderr(payload.stderr ?? "");
  }, [runId]);

  useEffect(() => {
    void Promise.all([loadDetails(), loadLogs()]).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    });
  }, [loadDetails, loadLogs]);

  useEffect(() => {
    const detailsInterval = setInterval(() => {
      loadDetails().catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      });
    }, 2000);

    return () => clearInterval(detailsInterval);
  }, [loadDetails]);

  useEffect(() => {
    const logsInterval = setInterval(() => {
      loadLogs().catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      });
    }, 1000);

    return () => clearInterval(logsInterval);
  }, [loadLogs]);

  const handleRerun = async () => {
    if (!run) {
      return;
    }

    setLoadingAction(true);
    setError(null);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: run.targetId,
          suiteName: run.suiteName,
          mode: run.mode ?? "headless",
          slowMoMs: run.slowMoMs ?? 0,
        }),
      });

      const payload = (await response.json()) as { run?: RunDto; error?: string };

      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Failed to trigger re-run");
      }

      router.push(`/runs/${payload.run.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRerunFailedOnly = async () => {
    if (!run || failingTests.length === 0) {
      return;
    }

    setLoadingAction(true);
    setError(null);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: run.targetId,
          suiteName: run.suiteName,
          mode: run.mode ?? "headless",
          slowMoMs: run.slowMoMs ?? 0,
          rerunFailedOnlyFromRunId: run.id,
        }),
      });

      const payload = (await response.json()) as { run?: RunDto; error?: string };

      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Failed to trigger failed-only re-run");
      }

      router.push(`/runs/${payload.run.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancel = async () => {
    if (!run) {
      return;
    }

    setLoadingAction(true);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${run.id}/cancel`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to cancel run");
      }

      await loadDetails();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Run {runId}</h1>
          <p className="text-sm text-slate-600">Live logs and report details for this execution.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tests-viewers?runId=${runId}`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Open in Tests Viewers
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              void Promise.all([loadDetails(), loadLogs()]).catch((requestError) => {
                setError(requestError instanceof Error ? requestError.message : String(requestError));
              });
            }}
          >
            Refresh
          </Button>
          <Button onClick={handleRerun} disabled={!run || loadingAction}>
            Re-run
          </Button>
          <Button
            variant="secondary"
            onClick={handleRerunFailedOnly}
            disabled={!run || loadingAction || isRunning || failingTests.length === 0}
          >
            Re-run Failed Only
          </Button>
          {isRunning && (
            <Button variant="destructive" onClick={handleCancel} disabled={loadingAction}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {runtimeConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Runtime Config</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Run Timeout</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTimeoutLabel(runtimeConfig.runTimeoutMs)} ({runtimeConfig.runTimeoutMs} ms)
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Retries</p>
              <p className="mt-1 text-sm font-semibold">{runtimeConfig.retries}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Run Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <div className="mt-2">{run ? <StatusBadge status={run.status} /> : "-"}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Target</p>
            <p className="mt-2 text-sm">{run?.target?.name ?? "-"}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-2 text-sm font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Passed</p>
            <p className="mt-2 text-sm font-semibold">{summary.passed}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Failed / Flaky</p>
            <p className="mt-2 text-sm font-semibold">
              {summary.failed} / {summary.flaky}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
            <p className="mt-2 text-sm font-semibold">{formatDuration(summary.durationMs)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artifacts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {run?.htmlReportUrl ? (
            <Link
              href={run.htmlReportUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open HTML Report
            </Link>
          ) : (
            <p className="text-sm text-slate-600">No HTML report path yet.</p>
          )}
          {run?.reportJsonUrl && (
            <Link
              href={run.reportJsonUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
            >
              Open JSON Report
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Failing Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>HTML Report</TableHead>
                <TableHead>Trace</TableHead>
                <TableHead>Screenshot</TableHead>
                <TableHead>Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failingTests.map((testCase, index) => (
                <TableRow key={`${testCase.title}-${index}`}>
                  <TableCell className="font-medium">{testCase.title}</TableCell>
                  <TableCell className="max-w-md whitespace-pre-wrap text-xs text-slate-700">
                    {testCase.error}
                  </TableCell>
                  <TableCell>
                    {run?.htmlReportUrl ? (
                      <Link
                        href={run.htmlReportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-slate-900 underline"
                      >
                        Open
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {testCase.traceUrl ? (
                      <Link
                        href={testCase.traceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-slate-900 underline"
                      >
                        Trace
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {testCase.screenshotUrl ? (
                      <div className="space-y-1">
                        <Link href={testCase.screenshotUrl} target="_blank" rel="noreferrer">
                          <Image
                            src={testCase.screenshotUrl}
                            alt={`${testCase.title} screenshot`}
                            width={320}
                            height={180}
                            unoptimized
                            className="h-auto max-h-24 w-40 rounded-md border border-slate-200 object-contain"
                          />
                        </Link>
                        <Link
                          href={testCase.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-900 underline"
                        >
                          Open
                        </Link>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {testCase.videoUrl ? (
                      <Link
                        href={testCase.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-slate-900 underline"
                      >
                        Video
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {failingTests.length === 0 && (
            <p className="mt-3 text-sm text-slate-600">No failing tests parsed yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flaky Tests</CardTitle>
        </CardHeader>
        <CardContent>
          {flakyTests.length > 0 ? (
            <ul className="space-y-2">
              {flakyTests.map((title) => (
                <li key={title} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  {title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No flaky tests detected in this run.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[26rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
            {combinedLogs}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
