import path from "node:path";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ROOT_DIR, SPECS_DIR } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunPhase = "planner" | "generator" | "healer";

type RunRequest = {
  phase?: RunPhase;
  requestFile?: string;
  planFile?: string;
};

function stripAnsi(input: string) {
  return input
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B\][^\u0007]*(\u0007|\u001B\\)/g, "")
    .replace(/\u009B[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "");
}

function resolveUnderSpecs(relativePath: string) {
  const resolved = path.resolve(ROOT_DIR, relativePath);
  const specsRoot = path.resolve(SPECS_DIR);
  if (!resolved.startsWith(`${specsRoot}${path.sep}`)) {
    return null;
  }
  return resolved;
}

function buildPlannerPrompt(outputPlanPath: string) {
  return [
    "Usá el markdown de solicitud adjunto como fuente de verdad.",
    "Seguí las convenciones del planificador en .opencode/prompts/playwright-test-planner.md.",
    `Creá un plan de pruebas completo y guardalo en ${outputPlanPath}.`,
    "Incluí escenarios claros, pasos detallados y assertions explícitas.",
  ].join(" ");
}

function buildGeneratorPrompt(planFile: string) {
  return [
    `Usá ${planFile} como plan de pruebas.`,
    "Seguí las convenciones de .opencode/prompts/playwright-test-generator.md.",
    "Generá tests ejecutables de Playwright dentro de playwright/tests/.",
    "Usá playwright/tests/seed.spec.ts como referencia de semilla.",
    "No sobrescribas playwright/tests/seed.spec.ts.",
    "Aplicá buenas prácticas de locators estables y assertions explícitas.",
    "Agregá evidencia de capturas: luego de cada assertion crítica, guardá page.screenshot(); cuando valides texto/elemento clave, guardá también locator.screenshot().",
  ].join(" ");
}

function buildHealerPrompt() {
  return [
    "Seguí las convenciones de .opencode/prompts/playwright-test-healer.md.",
    "Ejecutá los tests de Playwright en este repositorio, depurá fallos y corregí tests hasta quedar en verde.",
    "Evitá APIs deprecadas y mantené correcciones mantenibles.",
  ].join(" ");
}

function buildTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function shellQuote(input: string) {
  return `'${input.replace(/'/g, `'\\''`)}'`;
}

function getAgentRunsDir() {
  return path.join(SPECS_DIR, "agent-runs");
}

function buildAgentRunRecordFilename(phase: RunPhase) {
  return `agent-run_${buildTimestamp()}_${phase}.json`;
}

async function runWithCandidates(args: string[]) {
  const configured = process.env.OPENCODE_BIN?.trim();
  const candidates = [configured, "opencode", "/usr/local/bin/opencode", "/home/rowler/.local/bin/opencode"]
    .filter(Boolean) as string[];

  const failures: string[] = [];
  for (const candidate of candidates) {
    const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
      const command = `${candidate} ${args.map(shellQuote).join(" ")}`;
      const child = spawn("bash", ["-lc", command], {
        cwd: ROOT_DIR,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => {
        resolve({ stdout, stderr, code: code ?? 1 });
      });
      child.on("error", (error) => {
        resolve({ stdout, stderr: `${stderr}\n${String(error)}`.trim(), code: 1 });
      });
    });

    if (result.code === 0) {
      return {
        ...result,
        commandBin: candidate,
      };
    }
    failures.push(`[${candidate}] exit=${result.code}\n${result.stderr || "(no stderr)"}`.trim());
  }

  return {
    stdout: "",
    stderr: [
      "No se pudo ejecutar la CLI de OpenCode.",
      "Binarios probados:",
      ...candidates.map((candidate) => `- ${candidate}`),
      "",
      "Definí OPENCODE_BIN en tu .env con la ruta completa al binario, por ejemplo:",
      'OPENCODE_BIN="/full/path/to/opencode"',
      "",
      "Últimos errores:",
      failures.join("\n\n"),
    ].join("\n"),
    code: 1,
    commandBin: candidates[0] ?? "opencode",
  };
}

export async function POST(request: Request) {
  let body: RunRequest;
  try {
    body = (await request.json()) as RunRequest;
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  const phase = body.phase;
  if (!phase) {
    return NextResponse.json({ error: "phase es obligatorio" }, { status: 400 });
  }

  let args: string[] = [];
  let outputPlanFile: string | null = null;

  if (phase === "planner") {
    const requestFile = body.requestFile?.trim();
    if (!requestFile) {
      return NextResponse.json({ error: "requestFile es obligatorio para planner" }, { status: 400 });
    }
    if (!resolveUnderSpecs(requestFile)) {
      return NextResponse.json({ error: "requestFile debe estar dentro de specs/" }, { status: 400 });
    }

    outputPlanFile = `specs/test-plan_${buildTimestamp()}.md`;
    args = [
      "run",
      "--file",
      requestFile,
      "--",
      buildPlannerPrompt(outputPlanFile),
    ];
  } else if (phase === "generator") {
    const planFile = body.planFile?.trim();
    if (!planFile) {
      return NextResponse.json({ error: "planFile es obligatorio para generator" }, { status: 400 });
    }
    if (!resolveUnderSpecs(planFile)) {
      return NextResponse.json({ error: "planFile debe estar dentro de specs/" }, { status: 400 });
    }

    args = [
      "run",
      "--file",
      planFile,
      "--",
      buildGeneratorPrompt(planFile),
    ];
  } else {
    args = [
      "run",
      "--",
      buildHealerPrompt(),
    ];
  }

  const result = await runWithCandidates(args);
  const agentRunsDir = getAgentRunsDir();
  const recordFilename = buildAgentRunRecordFilename(phase);
  const recordAbsolutePath = path.join(agentRunsDir, recordFilename);
  const recordRelativePath = `specs/agent-runs/${recordFilename}`;

  try {
    await fs.mkdir(agentRunsDir, { recursive: true });
    await fs.writeFile(
      recordAbsolutePath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          phase,
          requestFile: body.requestFile ?? null,
          planFile: body.planFile ?? null,
          outputPlanFile: result.code === 0 ? outputPlanFile : null,
          command: `${result.commandBin} ${args.join(" ")}`,
          exitCode: result.code,
          ok: result.code === 0,
          stdout: stripAnsi(result.stdout),
          stderr: stripAnsi(result.stderr),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // Non-blocking: do not fail agent execution response if writing the record fails.
  }

  return NextResponse.json({
    phase,
    command: `${result.commandBin} ${args.join(" ")}`,
    recordFile: recordRelativePath,
    outputPlanFile: result.code === 0 ? outputPlanFile : null,
    exitCode: result.code,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
    ok: result.code === 0,
  });
}
