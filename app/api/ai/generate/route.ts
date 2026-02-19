import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ensureDir, PLAYWRIGHT_TESTS_DIR, SPECS_DIR } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateSpecRequest = {
  scenarioSpec?: string;
};

function buildTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function buildAgentRequestTemplate(scenarioSpec: string, seedFile: string) {
  const generatedAt = new Date().toISOString();

  return `# Playwright Agent Request

- Generated at: ${generatedAt}
- Seed file: \`${seedFile}\`
- Agents: planner -> generator -> healer

## Scenario Input

${scenarioSpec}

## Required Output

1. Planner: create a comprehensive test plan markdown file under \`specs/\`.
2. Generator: produce executable Playwright tests under \`playwright/tests/\`.
3. Healer: run tests, debug failures, and fix flaky/broken tests until green.

## Constraints

- Use explicit assertions for every critical user step.
- Keep test names behavior-focused and deterministic.
- Prefer stable locators (role, label, test id) over brittle CSS selectors.
`;
}

function buildSeedTemplate() {
  return `import { test } from "@playwright/test";

test.describe("Seed Setup", () => {
  test("seed", async ({ page }) => {
    // Keep this file as a stable setup reference for planner/generator.
    // Add reusable setup steps for your app (auth, tenant selection, etc.).
    await page.goto("/");
  });
});
`;
}

export async function POST(request: Request) {
  let body: GenerateSpecRequest;
  try {
    body = (await request.json()) as GenerateSpecRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scenarioSpec = body.scenarioSpec?.trim();

  if (!scenarioSpec) {
    return NextResponse.json({ error: "scenarioSpec is required" }, { status: 400 });
  }

  const filename = `request_${buildTimestamp()}.md`;
  const absolutePath = path.join(SPECS_DIR, filename);
  const seedAbsolutePath = path.join(PLAYWRIGHT_TESTS_DIR, "seed.spec.ts");
  const seedRelativePath = "playwright/tests/seed.spec.ts";

  await ensureDir(SPECS_DIR);
  await ensureDir(PLAYWRIGHT_TESTS_DIR);

  try {
    await fs.access(seedAbsolutePath);
  } catch {
    await fs.writeFile(seedAbsolutePath, buildSeedTemplate(), "utf8");
  }

  await fs.writeFile(absolutePath, buildAgentRequestTemplate(scenarioSpec, seedRelativePath), "utf8");

  return NextResponse.json(
    {
      fileName: filename,
      specPath: `specs/${filename}`,
      seedFile: seedRelativePath,
    },
    { status: 201 },
  );
}
