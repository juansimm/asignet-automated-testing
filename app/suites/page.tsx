"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuitesPage() {
  const [suites, setSuites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSuites = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/suites", { cache: "no-store" });
      const payload = (await response.json()) as { suites?: string[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron cargar las suites");
      }

      setSuites(payload.suites ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuites().catch((requestError) => {
      setError(String(requestError));
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Suites</h1>
        <p className="text-sm text-slate-600">Descubiertas desde `playwright/tests`.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suites Disponibles</CardTitle>
          <CardDescription>Actualizá luego de agregar archivos en `playwright/tests`.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={loadSuites} disabled={loading}>
            Actualizar
          </Button>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <ul className="mt-3 space-y-2">
            {suites.map((suite) => (
              <li key={suite} className="rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm">
                {suite}
              </li>
            ))}
          </ul>

          {!loading && suites.length === 0 && (
            <p className="mt-3 text-sm text-slate-600">Aún no se encontraron suites.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
