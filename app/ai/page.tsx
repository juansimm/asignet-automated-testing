"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function AiPage() {
  const [scenarioSpec, setScenarioSpec] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdFile, setCreatedFile] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setCreatedFile(null);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioSpec }),
      });

      const payload = (await response.json()) as {
        fileName?: string;
        relativePath?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate spec file");
      }

      setCreatedFile(payload.relativePath ?? payload.fileName ?? null);
      setScenarioSpec("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI Spec Generator (MVP)</h1>
        <p className="text-sm text-slate-600">
          Paste scenario markdown and create a generated placeholder suite in `playwright/tests`.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Spec File</CardTitle>
          <CardDescription>
            This creates a template file with TODO markers. Real agent integration is intentionally not wired yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={14}
            value={scenarioSpec}
            onChange={(event) => setScenarioSpec(event.target.value)}
            placeholder="# Scenario\n- User opens checkout\n- User submits invalid card\n- Error banner should be visible"
          />
          <Button onClick={handleGenerate} disabled={loading || !scenarioSpec.trim()}>
            Generate spec file
          </Button>
          {createdFile && <p className="text-sm text-emerald-700">Created: {createdFile}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
