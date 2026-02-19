"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type WayfastEntry = {
  id: number;
  date: string;
  host: string;
  projectName: string;
  pageName: string;
  eventType: string;
  key: string;
  value: string;
  duration: number | null;
  parameters: string;
};

type LogSourceMode = "promptOnly" | "manual" | "publicUrl" | "asignetApi";

function compact(input: string, max = 90) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 3)}...`;
}

function buildScenarioFromSelectedEntries(entries: WayfastEntry[]) {
  if (!entries.length) {
    return "";
  }

  const lines = [
    "# Scenario Context (Wayfast Logs)",
    "",
    "- Source: LogRequestList",
    `- Selected entries: ${entries.length}`,
    "",
    "## Observed Flow",
  ];

  for (const [index, entry] of entries.entries()) {
    const title = [entry.eventType, entry.key].filter(Boolean).join(" - ") || "Observed action";
    const location = [entry.projectName, entry.pageName].filter(Boolean).join(" / ");
    const meta = [
      entry.date ? `date=${entry.date}` : "",
      entry.host ? `host=${entry.host}` : "",
      location ? `location=${location}` : "",
      entry.duration !== null ? `duration=${entry.duration}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    lines.push(`### ${index + 1}. ${title}`);
    if (meta) lines.push(`- Meta: ${meta}`);
    if (entry.value) lines.push(`- Signal: ${compact(entry.value, 140)}`);
    if (entry.parameters) lines.push(`- Parameters: ${compact(entry.parameters, 140)}`);
    lines.push("- Expected: Verify this action succeeds and UI reflects the operation.");
    lines.push("");
  }

  return lines.join("\n").trim();
}

function buildNoDboPrompt(goal: string, context: string, constraints: string, assertions: string) {
  const lines = [
    "# Scenario Context (No DBO)",
    "",
    "## Objective",
    goal || "Describe the user journey to automate.",
    "",
    "## Product Context",
    context || "Describe app area, user role, and preconditions.",
    "",
    "## Constraints",
    constraints || "List technical/business rules, forbidden actions, and stable locator expectations.",
    "",
    "## Required Assertions",
    assertions || "List required checks after each critical step and final business outcome.",
    "",
    "## Agent Instructions",
    "- Translate this into deterministic Playwright steps.",
    "- Prefer role/label/test-id selectors.",
    "- Add explicit assertions after critical actions.",
    "- Keep test names behavior-focused.",
  ];

  return lines.join("\n").trim();
}

export default function AiPage() {
  const [scenarioSpec, setScenarioSpec] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdFile, setCreatedFile] = useState<string | null>(null);

  const [logSourceMode, setLogSourceMode] = useState<LogSourceMode>("promptOnly");
  const [manualLogJson, setManualLogJson] = useState("");
  const [publicLogUrl, setPublicLogUrl] = useState("");
  const [logEmail, setLogEmail] = useState("");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [logHost, setLogHost] = useState("");

  const [promptGoal, setPromptGoal] = useState("");
  const [promptContext, setPromptContext] = useState("");
  const [promptConstraints, setPromptConstraints] = useState("");
  const [promptAssertions, setPromptAssertions] = useState("");

  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logOutput, setLogOutput] = useState("");
  const [logEntries, setLogEntries] = useState<WayfastEntry[]>([]);
  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [logScenarioDraft, setLogScenarioDraft] = useState("");
  const [showRawLogs, setShowRawLogs] = useState(false);

  const modeHint = useMemo(() => {
    if (logSourceMode === "promptOnly") return "No DBO mode: build scenario instructions directly with structured prompt fields.";
    if (logSourceMode === "manual") return "Paste raw JSON logs from any source.";
    if (logSourceMode === "publicUrl") return "Fetch JSON logs from a public URL (private/local hosts are blocked).";
    return "Optional fallback: call Asignet API if credentials/access are available.";
  }, [logSourceMode]);

  const clearLogState = () => {
    setLogError(null);
    setLogOutput("");
    setLogEntries([]);
    setSelectedLogIds([]);
    setLogScenarioDraft("");
    setShowRawLogs(false);
  };

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
        specPath?: string;
        relativePath?: string;
        seedFile?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Failed to generate agent request");

      const created = payload.specPath ?? payload.relativePath ?? null;
      const seed = payload.seedFile ? `\nSeed: ${payload.seedFile}` : "";
      setCreatedFile(created ? `${created}${seed}` : null);
      setScenarioSpec("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleAppendNoDboPrompt = () => {
    const prompt = buildNoDboPrompt(promptGoal.trim(), promptContext.trim(), promptConstraints.trim(), promptAssertions.trim());
    setScenarioSpec((current) => (current ? `${current}\n\n${prompt}` : prompt));
  };

  const handleFetchLogs = async () => {
    setLogLoading(true);
    setLogError(null);

    try {
      let endpoint = "/api/wayfast/ingest";
      let body: Record<string, string | undefined> = {};

      if (logSourceMode === "manual") {
        const rawJson = manualLogJson.trim();
        if (!rawJson) throw new Error("Paste JSON logs first.");
        body = { rawJson };
      } else if (logSourceMode === "publicUrl") {
        const url = publicLogUrl.trim();
        if (!url) throw new Error("Public URL is required.");
        body = { url };
      } else {
        const email = logEmail.trim();
        const startDate = logStartDate.trim();
        const endDate = logEndDate.trim();
        const host = logHost.trim();

        if (!email || !startDate || !endDate) throw new Error("Email, start date, and end date are required.");

        endpoint = "/api/wayfast/log-request-list";
        body = { email, startDate, endDate, host: host || undefined };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        data?: unknown;
        entries?: WayfastEntry[];
        scenarioDraft?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Failed to load log data");

      const data = payload.data ?? payload;
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      const formatted = typeof data === "string" ? data : JSON.stringify(data, null, 2);

      setLogOutput(formatted);
      setLogEntries(entries);
      setSelectedLogIds(entries.map((entry) => entry.id));
      setLogScenarioDraft(payload.scenarioDraft ?? "");
      setShowRawLogs(false);
    } catch (requestError) {
      setLogError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLogLoading(false);
    }
  };

  const handleAppendToScenario = () => {
    const selectedEntries = logEntries.filter((entry) => selectedLogIds.includes(entry.id));
    const selectedDraft = buildScenarioFromSelectedEntries(selectedEntries).trim();
    const fallback = logScenarioDraft.trim() || logOutput.trim();
    const content = selectedDraft || fallback;
    if (!content) return;
    setScenarioSpec((current) => (current ? `${current}\n\n${content}` : content));
  };

  const handleToggleLogEntry = (entryId: number) => {
    setSelectedLogIds((current) => (current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]));
  };

  const hasLogOutput = Boolean(logOutput.trim() || logEntries.length);
  const selectedCount = selectedLogIds.length;
  const allSelected = logEntries.length > 0 && selectedCount === logEntries.length;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-5">
        <h1 className="text-2xl font-semibold tracking-tight">AI Test Input Builder</h1>
        <p className="mt-1 text-sm text-slate-600">Default flow is no-DBO prompt authoring, then generate a planner/generator/healer request under `specs/`.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Scenario Source</CardTitle>
          <CardDescription>{modeHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 md:max-w-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Input Mode</p>
            <Select
              value={logSourceMode}
              onChange={(event) => {
                setLogSourceMode(event.target.value as LogSourceMode);
                clearLogState();
              }}
            >
              <option value="promptOnly">Prompt only (No DBO, recommended)</option>
              <option value="manual">Manual JSON logs</option>
              <option value="publicUrl">Public URL JSON logs</option>
              <option value="asignetApi">Asignet API (optional)</option>
            </Select>
          </div>

          {logSourceMode === "promptOnly" && (
            <div className="space-y-3">
              <Input value={promptGoal} onChange={(event) => setPromptGoal(event.target.value)} placeholder="Objective: e.g. validate checkout failure for invalid card" />
              <Textarea rows={4} value={promptContext} onChange={(event) => setPromptContext(event.target.value)} placeholder="Product context: user role, environment, required setup, navigation start point" />
              <Textarea rows={4} value={promptConstraints} onChange={(event) => setPromptConstraints(event.target.value)} placeholder="Constraints: disallowed actions, data rules, stable locators, timing constraints" />
              <Textarea rows={4} value={promptAssertions} onChange={(event) => setPromptAssertions(event.target.value)} placeholder="Required assertions: exact expected banners/messages/URL/state changes" />
              <Button onClick={handleAppendNoDboPrompt}>Append no-DBO prompt to scenario</Button>
            </div>
          )}

          {logSourceMode === "publicUrl" && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Public URL</p>
              <Input value={publicLogUrl} onChange={(event) => setPublicLogUrl(event.target.value)} placeholder="https://example.com/logs.json" />
            </div>
          )}

          {logSourceMode === "manual" && (
            <Textarea rows={8} value={manualLogJson} onChange={(event) => setManualLogJson(event.target.value)} placeholder='Paste raw JSON payload (array or object with "data" array)' />
          )}

          {logSourceMode === "asignetApi" && (
            <div className="grid gap-3 md:grid-cols-4">
              <Input type="email" value={logEmail} onChange={(event) => setLogEmail(event.target.value)} placeholder="user@example.com" />
              <Input type="date" value={logStartDate} onChange={(event) => setLogStartDate(event.target.value)} />
              <Input type="date" value={logEndDate} onChange={(event) => setLogEndDate(event.target.value)} />
              <Input value={logHost} onChange={(event) => setLogHost(event.target.value)} placeholder="Host filter" />
            </div>
          )}

          {logSourceMode !== "promptOnly" && (
            <>
              {logError && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{logError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleFetchLogs} disabled={logLoading}>{logLoading ? "Loading..." : "Load logs"}</Button>
                <Button variant="secondary" onClick={handleAppendToScenario} disabled={!hasLogOutput}>Append selected to scenario</Button>
                <Button variant="secondary" onClick={() => setSelectedLogIds(logEntries.map((entry) => entry.id))} disabled={!logEntries.length || allSelected}>Select all rows</Button>
                <Button variant="secondary" onClick={() => setSelectedLogIds([])} disabled={!selectedCount}>Clear selected</Button>
                <Button variant="secondary" onClick={() => setShowRawLogs((current) => !current)} disabled={!logOutput}>{showRawLogs ? "Hide raw JSON" : "Show raw JSON"}</Button>
                <Button variant="secondary" onClick={clearLogState} disabled={!logOutput && !logError}>Clear output</Button>
              </div>

              {logEntries.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">Selected {selectedCount} of {logEntries.length} entries for scenario append.</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Use</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead className="w-16">Dur.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logEntries.map((entry) => {
                        const checked = selectedLogIds.includes(entry.id);
                        return (
                          <TableRow key={entry.id} data-state={checked ? "selected" : undefined}>
                            <TableCell><input type="checkbox" checked={checked} onChange={() => handleToggleLogEntry(entry.id)} aria-label={`Select log entry ${entry.id + 1}`} /></TableCell>
                            <TableCell className="font-mono text-xs">{compact(entry.date, 26) || "-"}</TableCell>
                            <TableCell className="text-xs">{compact(entry.host, 28) || "-"}</TableCell>
                            <TableCell className="text-xs">{compact([entry.projectName, entry.pageName].filter(Boolean).join(" / "), 36) || "-"}</TableCell>
                            <TableCell className="text-xs">{compact([entry.eventType, entry.key].filter(Boolean).join(" / "), 36) || "-"}</TableCell>
                            <TableCell className="text-xs">{compact(entry.value, 44) || "-"}</TableCell>
                            <TableCell className="text-xs">{entry.duration ?? "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-slate-600">No parsed rows yet.</p>
              )}

              {showRawLogs && <pre className="max-h-[20rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">{logOutput || "No log data loaded yet."}</pre>}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Generate Agent Request</CardTitle>
          <CardDescription>Creates a markdown request in `specs/` and links it to `playwright/tests/seed.spec.ts`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={14}
            value={scenarioSpec}
            onChange={(event) => setScenarioSpec(event.target.value)}
            placeholder="# Scenario\n- User opens checkout\n- User submits invalid card\n- Error banner should be visible"
          />
          <Button onClick={handleGenerate} disabled={loading || !scenarioSpec.trim()}>{loading ? "Generating..." : "Generate agent request"}</Button>
          {createdFile && <p className="whitespace-pre-line rounded-md bg-emerald-50 p-2 text-sm text-emerald-700">Created: {createdFile}</p>}
          {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
