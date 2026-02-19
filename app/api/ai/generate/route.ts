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

  return `# Solicitud de Agente Playwright

- Generado en: ${generatedAt}
- Archivo semilla: \`${seedFile}\`
- Agentes: planificador -> generador -> corrector

## Input del Escenario

${scenarioSpec}

## Salida Requerida

1. Planificador: crear un plan de pruebas detallado en markdown dentro de \`specs/\`.
2. Generador: producir tests ejecutables de Playwright dentro de \`playwright/tests/\`.
3. Corrector: ejecutar tests, depurar fallos y corregir tests inestables/rotos hasta quedar en verde.

## Restricciones

- Usar assertions explícitas para cada paso crítico de usuario.
- Mantener nombres de tests enfocados en comportamiento y determinísticos.
- Priorizar locators estables (role, label, test id) sobre selectores CSS frágiles.
`;
}

function buildSeedTemplate() {
  return `import { test } from "@playwright/test";

test.describe("Seed Setup", () => {
  test("seed", async ({ page }) => {
    // Mantené este archivo como referencia estable de setup para planificador/generador.
    // Agregá pasos de setup reutilizables para tu app (auth, selección de tenant, etc.).
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
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  const scenarioSpec = body.scenarioSpec?.trim();

  if (!scenarioSpec) {
    return NextResponse.json({ error: "scenarioSpec es obligatorio" }, { status: 400 });
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
