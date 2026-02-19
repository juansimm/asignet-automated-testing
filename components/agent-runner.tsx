"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type AgentRunnerProps = {
  requestFiles: string[];
  planFiles: string[];
};

type RunResponse = {
  phase: "planner" | "generator" | "healer";
  command: string;
  recordFile?: string | null;
  outputPlanFile: string | null;
  exitCode: number;
  stdout: string;
  stderr: string;
  ok: boolean;
  error?: string;
};

export function AgentRunner({ requestFiles, planFiles }: AgentRunnerProps) {
  const [requestFile, setRequestFile] = useState(requestFiles[0] ?? "");
  const [planFile, setPlanFile] = useState(planFiles[0] ?? "");
  const [loadingPhase, setLoadingPhase] = useState<"planner" | "generator" | "healer" | null>(null);
  const [output, setOutput] = useState<string>("");

  const canRunPlanner = Boolean(requestFile);
  const canRunGenerator = Boolean(planFile);

  const runPhase = async (phase: "planner" | "generator" | "healer") => {
    setLoadingPhase(phase);
    setOutput("");

    try {
      const response = await fetch("/api/agents/opencode/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          requestFile,
          planFile,
        }),
      });

      const payload = (await response.json()) as RunResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? `No se pudo ejecutar ${phase}`);
      }

      const chunks = [
        `Fase: ${payload.phase}`,
        `Código de salida: ${payload.exitCode}`,
        payload.recordFile ? `Registro: ${payload.recordFile}` : "",
        payload.outputPlanFile ? `Plan de salida: ${payload.outputPlanFile}` : "",
        "",
        "SALIDA STDOUT:",
        payload.stdout || "(vacío)",
        "",
        "SALIDA STDERR:",
        payload.stderr || "(vacío)",
      ].filter(Boolean);

      setOutput(chunks.join("\n"));
    } catch (requestError) {
      setOutput(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoadingPhase(null);
    }
  };

  const runHelp = useMemo(
    () =>
      "Ejecuta subagentes locales de OpenCode desde esta UI. Requiere `opencode` en PATH y definiciones de agente inicializadas.",
    [],
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-600">{runHelp}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Archivo de Solicitud (Planificador)</p>
          <Select value={requestFile} onChange={(event) => setRequestFile(event.target.value)}>
            {requestFiles.length ? (
              requestFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))
            ) : (
              <option value="">No se encontraron archivos de solicitud</option>
            )}
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Archivo de Plan (Generador)</p>
          <Select value={planFile} onChange={(event) => setPlanFile(event.target.value)}>
            {planFiles.length ? (
              planFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))
            ) : (
              <option value="">No se encontraron archivos plan</option>
            )}
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!canRunPlanner || Boolean(loadingPhase)} onClick={() => runPhase("planner")}>
          {loadingPhase === "planner" ? "Ejecutando planificador..." : "Ejecutar Planificador"}
        </Button>
        <Button size="sm" disabled={!canRunGenerator || Boolean(loadingPhase)} onClick={() => runPhase("generator")}>
          {loadingPhase === "generator" ? "Ejecutando generador..." : "Ejecutar Generador"}
        </Button>
        <Button size="sm" disabled={Boolean(loadingPhase)} onClick={() => runPhase("healer")}>
          {loadingPhase === "healer" ? "Ejecutando corrector..." : "Ejecutar Corrector"}
        </Button>
      </div>
      {output && (
        <pre className="max-h-[24rem] overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {output}
        </pre>
      )}
    </div>
  );
}
