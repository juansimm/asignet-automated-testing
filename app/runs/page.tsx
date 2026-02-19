"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RunDto, TargetDto } from "@/lib/api-types";

type RuntimeConfigDto = {
  runTimeoutMs: number;
  retries: number;
};

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

function formatTimeoutLabel(runTimeoutMs: number) {
  if (runTimeoutMs % 60_000 === 0) {
    return `${runTimeoutMs / 60_000} min`;
  }

  if (runTimeoutMs >= 1000) {
    return `${(runTimeoutMs / 1000).toFixed(0)} sec`;
  }

  return `${runTimeoutMs} ms`;
}

export default function RunsPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<TargetDto[]>([]);
  const [suites, setSuites] = useState<string[]>([]);
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfigDto | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedSuite, setSelectedSuite] = useState("");
  const [mode, setMode] = useState<"headless" | "headed">("headless");
  const [slowMoMs, setSlowMoMs] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    const response = await fetch("/api/runs", { cache: "no-store" });
    const payload = (await response.json()) as {
      runs?: RunDto[];
      runtimeConfig?: RuntimeConfigDto;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load runs");
    }

    setRuns(payload.runs ?? []);
    setRuntimeConfig(payload.runtimeConfig ?? null);
  }, []);

  const loadDependencies = useCallback(async () => {
    const [targetsResponse, suitesResponse] = await Promise.all([
      fetch("/api/targets", { cache: "no-store" }),
      fetch("/api/suites", { cache: "no-store" }),
    ]);

    const targetsPayload = (await targetsResponse.json()) as {
      targets?: TargetDto[];
      error?: string;
    };
    const suitesPayload = (await suitesResponse.json()) as {
      suites?: string[];
      error?: string;
    };

    if (!targetsResponse.ok) {
      throw new Error(targetsPayload.error ?? "Failed to load targets");
    }

    if (!suitesResponse.ok) {
      throw new Error(suitesPayload.error ?? "Failed to load suites");
    }

    const nextTargets = targetsPayload.targets ?? [];
    const nextSuites = suitesPayload.suites ?? [];

    setTargets(nextTargets);
    setSuites(nextSuites);

    setSelectedTargetId((current) => current || nextTargets[0]?.id || "");
    setSelectedSuite((current) => current || nextSuites[0] || "");
  }, []);

  useEffect(() => {
    void Promise.all([loadDependencies(), loadRuns()]).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    });
  }, [loadDependencies, loadRuns]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadRuns().catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [loadRuns]);

  const hasTriggerInputs = useMemo(() => {
    return Boolean(selectedTargetId && selectedSuite);
  }, [selectedSuite, selectedTargetId]);

  const handleTriggerRun = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: selectedTargetId,
          suiteName: selectedSuite,
          mode,
          slowMoMs: Number(slowMoMs || "0"),
        }),
      });

      const payload = (await response.json()) as {
        run?: RunDto;
        error?: string;
      };

      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Failed to trigger run");
      }

      await loadRuns();
      router.push(`/runs/${payload.run.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Runs</h1>
          <p className="text-sm text-slate-600">
            Trigger Playwright runs and track status live. Only one run can execute at a time.
          </p>
        </div>
        <Link
          href="/tests-viewers"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Open Tests Viewers
        </Link>
      </div>

      {runtimeConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Runtime Config</CardTitle>
            <CardDescription>Effective backend values loaded from environment.</CardDescription>
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
          <CardTitle>Trigger Run</CardTitle>
          <CardDescription>Select a target and suite to execute.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Target</p>
              <Select
                value={selectedTargetId}
                onChange={(event) => setSelectedTargetId(event.target.value)}
              >
                <option value="">Select target</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name} ({target.baseUrl})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Suite</p>
              <Select value={selectedSuite} onChange={(event) => setSelectedSuite(event.target.value)}>
                <option value="">Select suite</option>
                {suites.map((suite) => (
                  <option key={suite} value={suite}>
                    {suite}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Mode</p>
              <Select
                value={mode}
                onChange={(event) => setMode(event.target.value as "headless" | "headed")}
              >
                <option value="headless">headless</option>
                <option value="headed">headed</option>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Slow Mo (ms)</p>
              <Input
                type="number"
                min={0}
                value={slowMoMs}
                onChange={(event) => setSlowMoMs(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTriggerRun} disabled={!hasTriggerInputs || loading}>
              Trigger Run
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void Promise.all([loadDependencies(), loadRuns()]).catch((requestError) => {
                  setError(requestError instanceof Error ? requestError.message : String(requestError));
                });
              }}
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Passed/Failed/Flaky</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>{run.target?.name ?? run.targetId}</TableCell>
                  <TableCell className="font-mono text-xs">{run.suiteName}</TableCell>
                  <TableCell>{formatDate(run.startedAt)}</TableCell>
                  <TableCell>{formatDuration(run.durationMs)}</TableCell>
                  <TableCell>
                    {(run.passed ?? 0)}/{(run.failed ?? 0)}/{(run.flaky ?? 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/tests-viewers?runId=${run.id}`}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100"
                      >
                        Viewer
                      </Link>
                      <Link
                        href={`/runs/${run.id}`}
                        className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Open
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {runs.length === 0 && <p className="mt-3 text-sm text-slate-600">No runs yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
