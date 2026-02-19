import path from "node:path";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentRunner } from "@/components/agent-runner";
import { SpecsCleaner } from "@/components/specs-cleaner";
import { PLAYWRIGHT_TESTS_DIR, SPECS_DIR, toPosixPath } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileSummary = {
  name: string;
  relativePath: string;
  mtimeMs: number;
};

async function listFiles(baseDir: string, extension: string) {
  const rows: FileSummary[] = [];

  async function walk(currentDir: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.name.endsWith(extension)) {
        continue;
      }

      const stat = await fs.stat(absolutePath);
      rows.push({
        name: entry.name,
        relativePath: toPosixPath(path.relative(process.cwd(), absolutePath)),
        mtimeMs: stat.mtimeMs,
      });
    }
  }

  await walk(baseDir);
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readLatestSpecPreview(specs: FileSummary[]) {
  const latest = specs[0];
  if (!latest) {
    return "";
  }

  const absolutePath = path.join(process.cwd(), latest.relativePath);
  try {
    const content = await fs.readFile(absolutePath, "utf8");
    return content.length > 2500 ? `${content.slice(0, 2500)}\n\n...` : content;
  } catch {
    return "";
  }
}

export default async function SpecsPage() {
  const [specFiles, testFiles] = await Promise.all([
    listFiles(SPECS_DIR, ".md"),
    listFiles(PLAYWRIGHT_TESTS_DIR, ".spec.ts"),
  ]);
  const latestSpecPreview = await readLatestSpecPreview(specFiles);
  const requestFiles = specFiles
    .map((file) => file.relativePath)
    .filter((relativePath) => path.basename(relativePath).startsWith("request_"));
  const planFiles = specFiles
    .map((file) => file.relativePath)
    .filter((relativePath) => path.basename(relativePath).startsWith("test-plan_"));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-5">
        <h1 className="text-2xl font-semibold tracking-tight">Specs And Agent Flow</h1>
        <p className="text-sm text-slate-600">
          Generated specs are files on disk. Planner, generator, and healer run from your agent-enabled IDE loop, not this web app.
        </p>
        <div className="mt-3">
          <SpecsCleaner />
        </div>
        <div className="mt-3">
          <AgentRunner requestFiles={requestFiles} planFiles={planFiles} />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>How To Run</CardTitle>
          <CardDescription>Use your generated request file and run the three agents in order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>1. Planner input: newest file in `specs/`</p>
          <p>2. Generator output: test files in `playwright/tests/`</p>
          <p>3. Healer: run/fix tests until green</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Spec Requests</CardTitle>
            <CardDescription>Markdown requests generated from `/ai`.</CardDescription>
          </CardHeader>
          <CardContent>
            {specFiles.length === 0 ? (
              <p className="text-sm text-slate-600">No files found in `specs/`.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {specFiles.map((file) => (
                  <li key={file.relativePath} className="font-mono text-xs text-slate-700">
                    {file.relativePath}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Playwright Tests</CardTitle>
            <CardDescription>Current test specs available for execution.</CardDescription>
          </CardHeader>
          <CardContent>
            {testFiles.length === 0 ? (
              <p className="text-sm text-slate-600">No files found in `playwright/tests/`.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {testFiles.map((file) => (
                  <li key={file.relativePath} className="font-mono text-xs text-slate-700">
                    {file.relativePath}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Latest Spec Preview</CardTitle>
          <CardDescription>First section of the newest request file in `specs/`.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[28rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
            {latestSpecPreview || "No preview available."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
