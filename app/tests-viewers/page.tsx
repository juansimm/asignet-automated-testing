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
  AgentContextDto,
  AgentPhaseDto,
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
  agentContext?: AgentContextDto | null;
  stdout?: string;
  stderr?: string;
  error?: string;
};

type TestFilter = "all" | "passed" | "failed" | "flaky" | "skipped";
type IndexedTest = {
  index: number;
  key: string;
  testCase: ParsedTestCaseDto;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-AR");
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

function toWorkspaceFileUrl(relativePath: string | null | undefined) {
  if (!relativePath) {
    return null;
  }

  const normalized = relativePath.replace(/^\.\//, "");
  const segments = normalized.split("/").map((segment) => encodeURIComponent(segment));
  return `/workspace-files/${segments.join("/")}`;
}

function formatAgentPhase(phase: AgentPhaseDto) {
  if (phase === "planner") {
    return "Planificador";
  }

  if (phase === "generator") {
    return "Generador";
  }

  return "Corrector";
}

function formatRunStatusLabel(status: ViewerRunDto["status"]) {
  if (status === "PASSED") {
    return "APROBADO";
  }

  if (status === "FAILED") {
    return "FALLIDO";
  }

  if (status === "RUNNING") {
    return "EJECUTANDO";
  }

  return "EN ESPERA";
}

function formatTestStatusLabel(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "passed" || normalized === "expected") {
    return "APROBADO";
  }

  if (normalized === "failed" || normalized === "unexpected") {
    return "FALLIDO";
  }

  if (normalized === "flaky") {
    return "INESTABLE";
  }

  if (normalized === "skipped") {
    return "OMITIDO";
  }

  return status.toUpperCase();
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
  const label = formatTestStatusLabel(status);

  if (group === "passed") {
    return <Badge variant="success">{label}</Badge>;
  }

  if (group === "flaky") {
    return <Badge variant="warning">{label}</Badge>;
  }

  if (group === "skipped") {
    return <Badge variant="secondary">{label}</Badge>;
  }

  return <Badge variant="destructive">{label}</Badge>;
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
        throw new Error("No se pudo cargar el adjunto");
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
            Abrir archivo
          </Link>
        ) : (
          <p className="text-xs text-slate-500">Sin URL de artefacto</p>
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
            {loading ? "Cargando..." : "Vista previa"}
          </Button>
        )}
      </div>
      {attachment.path && <p className="mt-1 font-mono text-xs text-slate-500">{attachment.path}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {content != null && (
        <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {content || "(respuesta vacía)"}
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
  const [agentContext, setAgentContext] = useState<AgentContextDto | null>(null);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [search, setSearch] = useState("");
  const [testFilter, setTestFilter] = useState<TestFilter>("all");
  const [focusedTestIndex, setFocusedTestIndex] = useState<number | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async (preferredRunId?: string) => {
    const response = await fetch("/api/tests-viewers/runs", { cache: "no-store" });
    const payload = (await response.json()) as RunsResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudieron cargar las ejecuciones");
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
      throw new Error(detailsPayload.error ?? "No se pudo cargar el detalle de la ejecución");
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
    setAgentContext(detailsPayload.agentContext ?? null);
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
          setAgentContext(null);
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

  useEffect(() => {
    setFocusedTestIndex(null);
  }, [selectedRunId]);

  useEffect(() => {
    if (focusedTestIndex != null && !tests[focusedTestIndex]) {
      setFocusedTestIndex(null);
    }
  }, [focusedTestIndex, tests]);

  const runOutput = useMemo(() => {
    if (!stdout && !stderr) {
      return "Sin salida por el momento.";
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

  const indexedTests = useMemo<IndexedTest[]>(
    () =>
      tests.map((testCase, index) => ({
        index,
        key: `${testCase.title}-${index}`,
        testCase,
      })),
    [tests],
  );

  const filteredTests = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();

    return indexedTests.filter((item) => {
      const { testCase } = item;
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
  }, [indexedTests, search, testFilter]);

  const metricsRuns = useMemo(() => {
    return [...runs].slice(0, 10).reverse();
  }, [runs]);

  const metrics = useMemo(() => {
    const totals = runs.reduce(
      (acc, item) => {
        acc.passed += item.passed;
        acc.failed += item.failed;
        acc.flaky += item.flaky;
        return acc;
      },
      { passed: 0, failed: 0, flaky: 0 },
    );
    const total = totals.passed + totals.failed + totals.flaky;

    return {
      ...totals,
      total,
      passRate: total > 0 ? Math.round((totals.passed / total) * 100) : 0,
    };
  }, [runs]);

  const focusedTest = focusedTestIndex != null ? tests[focusedTestIndex] ?? null : null;
  const focusedVisibleIndex = focusedTestIndex == null
    ? -1
    : filteredTests.findIndex((item) => item.index === focusedTestIndex);

  const goToFocusedRelative = (direction: -1 | 1) => {
    if (focusedVisibleIndex < 0) {
      return;
    }
    const next = filteredTests[focusedVisibleIndex + direction];
    if (!next) {
      return;
    }
    setFocusedTestIndex(next.index);
  };

  const noRuns = !loadingRuns && runs.length === 0;

  return (
    <div className="space-y-3.5 text-[0.95rem]">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-sky-50 to-slate-100 p-4 shadow-sm">
        <h1 className="text-[1.55rem] font-semibold">Visor de Tests</h1>
        <p className="mt-1 text-[0.92rem] text-slate-700">
          Explorá ejecuciones locales de Playwright (`bun run test` y corridas del flujo IA) con
          resultado por test, salida, respuestas, contexto de agentes y capturas.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Selección de Ejecución</CardTitle>
          <CardDescription>Elegí una corrida para inspeccionar. Las más nuevas aparecen primero.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)}>
              <option value="" disabled>
                {loadingRuns ? "Cargando ejecuciones..." : "Seleccionar ejecución"}
              </option>
              {runs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id.slice(0, 8)} | {item.suiteName} | {formatRunStatusLabel(item.status)} | {formatDate(item.startedAt)}
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
              Actualizar
            </Button>
          </div>
          {noRuns && (
            <p className="text-sm text-slate-600">
              Todavía no hay ejecuciones en artefactos locales. Corré tests con `bun run test` desde el flujo IA.
            </p>
          )}
        </CardContent>
      </Card>

      {runs.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Dashboard de Métricas</CardTitle>
            <CardDescription>
              Tendencia de aprobados/fallidos/inestables por corrida (últimas {metricsRuns.length}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2.5 md:grid-cols-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-emerald-700">Aprobados</p>
                <p className="mt-1 text-lg font-semibold text-emerald-900">{metrics.passed}</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2.5">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-red-700">Fallidos</p>
                <p className="mt-1 text-lg font-semibold text-red-900">{metrics.failed}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-amber-700">Inestables</p>
                <p className="mt-1 text-lg font-semibold text-amber-900">{metrics.flaky}</p>
              </div>
              <div className="rounded-md border border-sky-200 bg-sky-50 p-2.5">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-sky-700">Tasa de Aprobación</p>
                <p className="mt-1 text-lg font-semibold text-sky-900">{metrics.passRate}%</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-2.5">
              <div className="mb-2 flex flex-wrap items-center gap-2.5 text-[0.76rem]">
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  aprobados
                </span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  fallidos
                </span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  inestables
                </span>
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="flex h-32 min-w-max items-end gap-1.5">
                  {metricsRuns.map((metricRun) => {
                    const total = Math.max(metricRun.passed + metricRun.failed + metricRun.flaky, 1);
                    const passedPct = (metricRun.passed / total) * 100;
                    const failedPct = (metricRun.failed / total) * 100;
                    const flakyPct = (metricRun.flaky / total) * 100;
                    const isSelected = metricRun.id === selectedRunId;

                    return (
                      <button
                        key={metricRun.id}
                        type="button"
                        onClick={() => setSelectedRunId(metricRun.id)}
                        className="group flex w-20 shrink-0 flex-col items-center"
                        title={`${metricRun.id} | A:${metricRun.passed} F:${metricRun.failed} I:${metricRun.flaky}`}
                      >
                        <div
                          className={`relative flex h-24 w-full flex-col justify-end overflow-hidden rounded-md border ${
                            isSelected ? "border-sky-500 shadow-sm" : "border-slate-200"
                          }`}
                        >
                          <div className="w-full bg-emerald-500/90" style={{ height: `${passedPct}%` }} />
                          <div className="w-full bg-red-500/90" style={{ height: `${failedPct}%` }} />
                          <div className="w-full bg-amber-500/90" style={{ height: `${flakyPct}%` }} />
                        </div>
                        <p className="mt-1 w-full truncate text-center font-mono text-[10px] text-slate-600">
                          {metricRun.id.slice(0, 6)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {run && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Ejecución Seleccionada</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-8">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ejecución</p>
              <p className="mt-1 font-mono text-xs">{run.id}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
              <div className="mt-1">
                <StatusBadge status={run.status} />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Inicio</p>
              <p className="mt-1 text-sm">{formatDate(run.startedAt)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Duración</p>
              <p className="mt-1 text-sm">{formatDuration(summary.durationMs)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Aprobados</p>
              <p className="mt-1 text-sm font-semibold">{summary.passed}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Fallidos</p>
              <p className="mt-1 text-sm font-semibold">{summary.failed}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Inestables</p>
              <p className="mt-1 text-sm font-semibold">{summary.flaky}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Capturas</p>
              <p className="mt-1 text-sm font-semibold">{runScreenshots.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {run && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Salida de la Ejecución</CardTitle>
            <CardDescription>Último stream de stdout/stderr de esta corrida.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[24rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
              {runOutput}
            </pre>
          </CardContent>
        </Card>
      )}

      {run && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Contexto de Agentes</CardTitle>
            <CardDescription>
              Información detectada de planificador/generador/corrector y de la entrada de tarea.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Archivo de Solicitud
                </p>
                {agentContext?.requestFile ? (
                  <Link
                    href={toWorkspaceFileUrl(agentContext.requestFile) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block font-mono text-xs underline"
                  >
                    {agentContext.requestFile}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">No detectado para esta corrida.</p>
                )}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Archivo de Plan
                </p>
                {agentContext?.planFile ? (
                  <Link
                    href={toWorkspaceFileUrl(agentContext.planFile) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block font-mono text-xs underline"
                  >
                    {agentContext.planFile}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">No detectado para esta corrida.</p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Entrada Recibida (Tarea del Usuario)
              </p>
              {agentContext?.inputTask ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                  {agentContext.inputTask}
                </pre>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  No se detectó entrada de tarea para esta ejecución.
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[agentContext?.planner, agentContext?.generator, agentContext?.healer].map((record, index) => (
                <div key={record?.phase ?? index} className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatAgentPhase(record?.phase ?? (index === 0 ? "planner" : index === 1 ? "generator" : "healer"))}
                  </p>
                  {record ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-700">
                        Estado:{" "}
                        <span className={record.ok ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                          {record.ok ? "OK" : `Error (${record.exitCode})`}
                        </span>
                      </p>
                      <p className="text-xs text-slate-700">
                        Ejecutado: {new Date(record.createdAt).toLocaleString("es-AR")}
                      </p>
                      <p className="truncate font-mono text-[11px] text-slate-600">{record.command}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link
                          href={toWorkspaceFileUrl(record.recordFile) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline"
                        >
                          Registro
                        </Link>
                        {record.requestFile && (
                          <Link
                            href={toWorkspaceFileUrl(record.requestFile) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline"
                          >
                            Solicitud
                          </Link>
                        )}
                        {(record.outputPlanFile ?? record.planFile) && (
                          <Link
                            href={toWorkspaceFileUrl(record.outputPlanFile ?? record.planFile) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline"
                          >
                            Plan
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">Sin ejecución registrada.</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {run && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle id="run-screenshots">Capturas de la Corrida</CardTitle>
            <CardDescription>
              Capturas manuales y capturas de resultados detectadas para esta corrida.
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
                        No disponible
                      </div>
                    )}
                    <p className="mt-2 truncate text-xs text-slate-700">{screenshot.name}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No se detectaron capturas para esta corrida.</p>
            )}
          </CardContent>
        </Card>
      )}

      {run && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Tests</CardTitle>
            <CardDescription>
              Cada test incluye resultado, salida y artefactos disponibles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Filtrar tests por título, estado o error..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                value={testFilter}
                onChange={(event) => setTestFilter(event.target.value as TestFilter)}
              >
                <option value="all">
                  todos ({tests.length})
                </option>
                <option value="passed">
                  aprobados ({testCounts.passed})
                </option>
                <option value="failed">
                  fallidos ({testCounts.failed})
                </option>
                <option value="flaky">
                  inestables ({testCounts.flaky})
                </option>
                <option value="skipped">
                  omitidos ({testCounts.skipped})
                </option>
              </Select>
            </div>

            {loadingDetails && <p className="text-sm text-slate-600">Cargando detalle de tests...</p>}

            <div className="space-y-3">
              {filteredTests.map((item) => {
                const { testCase, index, key } = item;
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
                    key={key}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{testCase.title}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          duración: {formatDuration(testCase.durationMs)} | esperado:{" "}
                          {testCase.expectedStatus ? formatTestStatusLabel(testCase.expectedStatus) : "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFocusedTestIndex(index)}
                        >
                          Inspector
                        </Button>
                        <TestResultBadge status={testCase.status} />
                      </div>
                    </div>

                    {testCase.error && (
                      <pre className="mt-3 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                        {testCase.error}
                      </pre>
                    )}

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Salida
                        </p>
                        {output ? (
                          <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                            {output}
                          </pre>
                        ) : (
                          <p className="text-sm text-slate-600">No hay salida capturada a nivel test.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Captura
                        </p>
                        {testCase.screenshotUrl ? (
                          <Link href={testCase.screenshotUrl} target="_blank" rel="noreferrer">
                            <Image
                              src={testCase.screenshotUrl}
                              alt={`captura de ${testCase.title}`}
                              width={1400}
                              height={900}
                              unoptimized
                              className="h-auto max-h-64 w-full rounded-md border border-slate-200 object-contain"
                            />
                          </Link>
                        ) : (
                          <p className="text-sm text-slate-600">
                            {runScreenshots.length > 0
                              ? `No hay captura asociada al test. Hay ${runScreenshots.length} captura(s) de corrida arriba.`
                              : "No hay capturas disponibles."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Respuestas
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
                        <p className="text-sm text-slate-600">
                          No se detectaron adjuntos de respuesta.
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      {testCase.traceUrl && (
                        <Link href={testCase.traceUrl} target="_blank" rel="noreferrer" className="underline">
                          Abrir traza
                        </Link>
                      )}
                      {testCase.videoUrl && (
                        <Link href={testCase.videoUrl} target="_blank" rel="noreferrer" className="underline">
                          Abrir video
                        </Link>
                      )}
                      {run?.htmlReportUrl && (
                        <Link href={run.htmlReportUrl} target="_blank" rel="noreferrer" className="underline">
                          Abrir reporte HTML
                        </Link>
                      )}
                    </div>

                    {otherAttachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Otros Adjuntos
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
                No hay tests que coincidan con el filtro. Probá cambiar estado/búsqueda o correr otra suite.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {focusedTest && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]"
          onClick={() => setFocusedTestIndex(null)}
        >
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Inspector de Test</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{focusedTest.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <TestResultBadge status={focusedTest.status} />
                  <Button type="button" variant="secondary" size="sm" onClick={() => setFocusedTestIndex(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Duración</p>
                  <p className="text-sm font-medium">{formatDuration(focusedTest.durationMs)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Esperado</p>
                  <p className="text-sm font-medium">
                    {focusedTest.expectedStatus ? formatTestStatusLabel(focusedTest.expectedStatus) : "-"}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Posición</p>
                  <p className="text-sm font-medium">
                    {focusedVisibleIndex >= 0 ? `${focusedVisibleIndex + 1} / ${filteredTests.length}` : "-"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={focusedVisibleIndex <= 0}
                  onClick={() => goToFocusedRelative(-1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={focusedVisibleIndex < 0 || focusedVisibleIndex >= filteredTests.length - 1}
                  onClick={() => goToFocusedRelative(1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              {focusedTest.error && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Error</p>
                  <pre className="mt-2 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    {focusedTest.error}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Salida</p>
                {focusedTest.stdout || focusedTest.stderr ? (
                  <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                    {[focusedTest.stdout ? `[stdout]\n${focusedTest.stdout}` : "", focusedTest.stderr ? `[stderr]\n${focusedTest.stderr}` : ""]
                      .filter(Boolean)
                      .join("\n\n")}
                  </pre>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No hay salida capturada a nivel test.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Captura</p>
                {focusedTest.screenshotUrl ? (
                  <Link href={focusedTest.screenshotUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                    <Image
                      src={focusedTest.screenshotUrl}
                      alt={`captura de ${focusedTest.title}`}
                      width={1400}
                      height={900}
                      unoptimized
                      className="h-auto max-h-[22rem] w-full rounded-md border border-slate-200 object-contain"
                    />
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No hay captura asociada a este test.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Respuestas</p>
                {focusedTest.responseAttachments.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {focusedTest.responseAttachments.map((attachment, responseIndex) => (
                      <ResponseAttachmentViewer
                        key={`${attachment.name}-${attachment.path}-${responseIndex}`}
                        attachment={attachment}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No se detectaron adjuntos de respuesta.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Navegación de Artefactos</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {focusedTest.traceUrl && (
                    <Link href={focusedTest.traceUrl} target="_blank" rel="noreferrer" className="underline">
                      Abrir traza
                    </Link>
                  )}
                  {focusedTest.videoUrl && (
                    <Link href={focusedTest.videoUrl} target="_blank" rel="noreferrer" className="underline">
                      Abrir video
                    </Link>
                  )}
                  {run?.htmlReportUrl && (
                    <Link href={run.htmlReportUrl} target="_blank" rel="noreferrer" className="underline">
                      Abrir reporte HTML
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
