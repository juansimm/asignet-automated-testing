"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AiPage() {
  const [scenarioSpec, setScenarioSpec] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdFile, setCreatedFile] = useState<string | null>(null);
  const [logEmail, setLogEmail] = useState("");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [logHost, setLogHost] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logOutput, setLogOutput] = useState("");

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

  const handleFetchLogs = async () => {
    const email = logEmail.trim();
    const startDate = logStartDate.trim();
    const endDate = logEndDate.trim();
    const host = logHost.trim();

    if (!email || !startDate || !endDate) {
      setLogError("Email, start date, and end date are required.");
      return;
    }

    setLogLoading(true);
    setLogError(null);

    try {
      const response = await fetch("/api/wayfast/log-request-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          startDate,
          endDate,
          host: host || undefined,
        }),
      });

      const payload = (await response.json()) as { data?: unknown; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to fetch log data");
      }

      const data = payload.data ?? payload;
      const formatted =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);

      setLogOutput(formatted);
    } catch (requestError) {
      setLogError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLogLoading(false);
    }
  };

  const handleAppendToScenario = () => {
    const trimmedOutput = logOutput.trim();
    if (!trimmedOutput) {
      return;
    }

    setScenarioSpec((current) => (current ? `${current}\n\n${trimmedOutput}` : trimmedOutput));
  };

  const handleClearLogs = () => {
    setLogError(null);
    setLogOutput("");
  };

  const canFetchLogs = Boolean(logEmail.trim() && logStartDate && logEndDate);
  const hasLogOutput = Boolean(logOutput.trim());

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
          <CardTitle>Wayfast Logs</CardTitle>
          <CardDescription>Fetch log request data by email and date range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logError && <p className="text-sm text-red-600">{logError}</p>}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Email</p>
              <Input
                type="email"
                value={logEmail}
                onChange={(event) => setLogEmail(event.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Start Date</p>
              <Input
                type="date"
                value={logStartDate}
                onChange={(event) => setLogStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">End Date</p>
              <Input
                type="date"
                value={logEndDate}
                onChange={(event) => setLogEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Host (optional)</p>
              <Input
                value={logHost}
                onChange={(event) => setLogHost(event.target.value)}
                placeholder="Host filter"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleFetchLogs} disabled={!canFetchLogs || logLoading}>
              {logLoading ? "Fetching..." : "Fetch logs"}
            </Button>
            <Button variant="secondary" onClick={handleAppendToScenario} disabled={!hasLogOutput}>
              Append to scenario
            </Button>
            <Button variant="secondary" onClick={handleClearLogs} disabled={!logOutput && !logError}>
              Clear
            </Button>
          </div>
          <pre className="max-h-[20rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
            {logOutput || "No log data fetched yet."}
          </pre>
        </CardContent>
      </Card>

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
