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
        <h1 className="text-2xl font-semibold tracking-tight">Configuraciones y Flujo de Agentes</h1>
        <p className="text-sm text-slate-600">
          Las specs generadas son archivos en disco. Planificador, generador y corrector se ejecutan desde
          tu loop de IDE con agentes, no desde esta web.
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
          <CardTitle>Cómo Ejecutar</CardTitle>
          <CardDescription>Usá tu solicitud generada y corré los tres agentes en orden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p>1. Entrada del planificador: archivo más nuevo en `specs/`</p>
          <p>2. Salida del generador: tests en `playwright/tests/`</p>
          <p>3. Corrector: ejecutar/corregir tests hasta quedar en verde</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Solicitudes de Spec</CardTitle>
            <CardDescription>Solicitudes markdown generadas desde `/ai`.</CardDescription>
          </CardHeader>
          <CardContent>
            {specFiles.length === 0 ? (
              <p className="text-sm text-slate-600">No se encontraron archivos en `specs/`.</p>
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
            <CardTitle>Tests de Playwright</CardTitle>
            <CardDescription>Specs de tests disponibles para ejecutar.</CardDescription>
          </CardHeader>
          <CardContent>
            {testFiles.length === 0 ? (
              <p className="text-sm text-slate-600">No se encontraron archivos en `playwright/tests/`.</p>
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
          <CardTitle>Vista Previa del Último Spec</CardTitle>
          <CardDescription>Primera sección de la solicitud más nueva en `specs/`.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[28rem] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
            {latestSpecPreview || "No hay preview disponible."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
