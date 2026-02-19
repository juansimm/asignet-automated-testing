import path from "node:path";
import { spawn } from "node:child_process";
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
    "Use the attached request markdown as the source of truth.",
    "Follow the Playwright planner conventions from .opencode/prompts/playwright-test-planner.md.",
    `Create a comprehensive test plan and save it to ${outputPlanPath}.`,
    "Include clear scenarios, detailed steps, and explicit assertions.",
  ].join(" ");
}

function buildGeneratorPrompt(planFile: string) {
  return [
    `Use ${planFile} as the test plan.`,
    "Follow .opencode/prompts/playwright-test-generator.md conventions.",
    "Generate executable Playwright tests under playwright/tests/.",
    "Use playwright/tests/seed.spec.ts as seed reference.",
    "Do not overwrite playwright/tests/seed.spec.ts.",
    "Follow stable locator and explicit assertion best practices.",
    "Add screenshot evidence: after each critical assertion, capture page.screenshot(); when validating key text/element, also capture locator.screenshot().",
  ].join(" ");
}

function buildHealerPrompt() {
  return [
    "Follow .opencode/prompts/playwright-test-healer.md conventions.",
    "Run Playwright tests in this repository, debug failures, and fix tests until green.",
    "Avoid deprecated APIs and keep fixes maintainable.",
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
      "Unable to execute OpenCode agent CLI.",
      "Tried binaries:",
      ...candidates.map((candidate) => `- ${candidate}`),
      "",
      "Set OPENCODE_BIN in your .env to the full binary path, for example:",
      'OPENCODE_BIN="/full/path/to/opencode"',
      "",
      "Last errors:",
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const phase = body.phase;
  if (!phase) {
    return NextResponse.json({ error: "phase is required" }, { status: 400 });
  }

  let args: string[] = [];
  let outputPlanFile: string | null = null;

  if (phase === "planner") {
    const requestFile = body.requestFile?.trim();
    if (!requestFile) {
      return NextResponse.json({ error: "requestFile is required for planner" }, { status: 400 });
    }
    if (!resolveUnderSpecs(requestFile)) {
      return NextResponse.json({ error: "requestFile must be under specs/" }, { status: 400 });
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
      return NextResponse.json({ error: "planFile is required for generator" }, { status: 400 });
    }
    if (!resolveUnderSpecs(planFile)) {
      return NextResponse.json({ error: "planFile must be under specs/" }, { status: 400 });
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

  return NextResponse.json({
    phase,
    command: `${result.commandBin} ${args.join(" ")}`,
    outputPlanFile: result.code === 0 ? outputPlanFile : null,
    exitCode: result.code,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
    ok: result.code === 0,
  });
}
