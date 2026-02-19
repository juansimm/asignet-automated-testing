"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    `- Source: LogRequestList`,
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
    if (meta) {
      lines.push(`- Meta: ${meta}`);
    }
    if (entry.value) {
      lines.push(`- Signal: ${compact(entry.value, 140)}`);
    }
    if (entry.parameters) {
      lines.push(`- Parameters: ${compact(entry.parameters, 140)}`);
    }
    lines.push("- Expected: Verify this action succeeds and UI reflects the operation.");
    lines.push("");
  }

  return lines.join("\n").trim();
}

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
  const [logEntries, setLogEntries] = useState<WayfastEntry[]>([]);
  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [logScenarioDraft, setLogScenarioDraft] = useState("");
  const [showRawLogs, setShowRawLogs] = useState(false);

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

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate spec file");
      }

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

      const payload = (await response.json()) as {
        data?: unknown;
        entries?: WayfastEntry[];
        scenarioDraft?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to fetch log data");
      }

      const data = payload.data ?? payload;
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      const formatted =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);

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

    if (!content) {
      return;
    }

    setScenarioSpec((current) => (current ? `${current}\n\n${content}` : content));
  };

  const handleClearLogs = () => {
    setLogError(null);
    setLogOutput("");
    setLogEntries([]);
    setSelectedLogIds([]);
    setLogScenarioDraft("");
    setShowRawLogs(false);
  };

  const handleToggleLogEntry = (entryId: number) => {
    setSelectedLogIds((current) => {
      if (current.includes(entryId)) {
        return current.filter((id) => id !== entryId);
      }
      return [...current, entryId];
    });
  };

  const canFetchLogs = Boolean(logEmail.trim() && logStartDate && logEndDate);
  const hasLogOutput = Boolean(logOutput.trim() || logEntries.length);
  const selectedCount = selectedLogIds.length;
  const allSelected = logEntries.length > 0 && selectedCount === logEntries.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI Spec Generator (MVP)</h1>
        <p className="text-sm text-slate-600">
          Build scenario input from Wayfast logs, then create an agent-ready test plan request in `specs`.
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
              Append selected to scenario
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelectedLogIds(logEntries.map((entry) => entry.id))}
              disabled={!logEntries.length || allSelected}
            >
              Select all rows
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelectedLogIds([])}
              disabled={!selectedCount}
            >
              Clear selected
            </Button>
            <Button variant="secondary" onClick={() => setShowRawLogs((current) => !current)} disabled={!logOutput}>
              {showRawLogs ? "Hide raw JSON" : "Show raw JSON"}
            </Button>
            <Button variant="secondary" onClick={handleClearLogs} disabled={!logOutput && !logError}>
              Clear
            </Button>
          </div>
          {logEntries.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Selected {selectedCount} of {logEntries.length} entries for scenario append.
              </p>
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
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleLogEntry(entry.id)}
                            aria-label={`Select log entry ${entry.id + 1}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{compact(entry.date, 26) || "-"}</TableCell>
                        <TableCell className="text-xs">{compact(entry.host, 28) || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {compact([entry.projectName, entry.pageName].filter(Boolean).join(" / "), 36) || "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {compact([entry.eventType, entry.key].filter(Boolean).join(" / "), 36) || "-"}
                        </TableCell>
                        <TableCell className="text-xs">{compact(entry.value, 44) || "-"}</TableCell>
                        <TableCell className="text-xs">{entry.duration ?? "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No parsed log rows yet.</p>
          )}
          {showRawLogs && (
            <pre className="max-h-[20rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
              {logOutput || "No log data fetched yet."}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate Agent Request</CardTitle>
          <CardDescription>
            Creates a markdown request in `specs` for planner/generator/healer and links it to `playwright/tests/seed.spec.ts`.
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
            Generate agent request
          </Button>
          {createdFile && <p className="text-sm text-emerald-700">Created: {createdFile}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
