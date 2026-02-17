import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ensureDir, PLAYWRIGHT_TESTS_DIR } from "@/lib/constants";

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

function buildTemplate(scenarioSpec: string) {
  const escaped = scenarioSpec.replaceAll("`", "\\`");

  return `import { test, expect } from "@playwright/test";

// TODO(agent): replace this scaffold with agent-generated test steps.
const scenarioSpec = \`${escaped}\`;

test.describe("Generated Scenario", () => {
  test("execute generated scenario", async ({ page }) => {
    // TODO(agent): parse scenarioSpec and map it to actionable browser steps.
    await page.goto("/");

    // Keep one assertion so this generated suite is runnable immediately.
    await expect(page).toHaveURL(/.*/);

    // TODO(agent): use scenarioSpec to drive selectors and assertions.
    console.log("Scenario input length:", scenarioSpec.length);
  });
});
`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateSpecRequest;
  const scenarioSpec = body.scenarioSpec?.trim();

  if (!scenarioSpec) {
    return NextResponse.json({ error: "scenarioSpec is required" }, { status: 400 });
  }

  const filename = `generated_${buildTimestamp()}.spec.ts`;
  const absolutePath = path.join(PLAYWRIGHT_TESTS_DIR, filename);

  await ensureDir(PLAYWRIGHT_TESTS_DIR);
  await fs.writeFile(absolutePath, buildTemplate(scenarioSpec), "utf8");

  return NextResponse.json(
    {
      fileName: filename,
      suiteName: filename,
      relativePath: `playwright/tests/${filename}`,
    },
    { status: 201 },
  );
}
