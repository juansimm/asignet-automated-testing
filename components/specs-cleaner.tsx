"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CleanupResponse = {
  dryRun: boolean;
  includeGeneratedTests: boolean;
  total: number;
  files: Array<{
    relativePath: string;
    reason: string;
  }>;
};

export function SpecsCleaner() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const runCleanup = async (dryRun: boolean) => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/specs/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          includeGeneratedTests: true,
        }),
      });

      const payload = (await response.json()) as CleanupResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "La limpieza falló");
      }

      if (dryRun) {
        setMessage(`Simulación: ${payload.total} archivo(s) pueden limpiarse.`);
      } else {
        setMessage(`Se limpiaron ${payload.total} archivo(s). Recargando...`);
        window.setTimeout(() => window.location.reload(), 500);
      }
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" disabled={loading} onClick={() => runCleanup(true)}>
        Previsualizar Limpieza
      </Button>
      <Button size="sm" variant="destructive" disabled={loading} onClick={() => runCleanup(false)}>
        Limpiar Archivos Generados
      </Button>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
