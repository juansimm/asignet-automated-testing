import path from "node:path";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import { NextResponse } from "next/server";
import { PLAYWRIGHT_TESTS_DIR, SPECS_DIR, toPosixPath } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CleanupRequest = {
  dryRun?: boolean;
  includeGeneratedTests?: boolean;
};

type CleanupItem = {
  relativePath: string;
  reason: string;
};

async function listFiles(baseDir: string, extension: string) {
  const output: string[] = [];

  async function walk(currentDir: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(extension)) {
        output.push(absolute);
      }
    }
  }

  await walk(baseDir);
  return output;
}

function toRelative(absolute: string) {
  return toPosixPath(path.relative(process.cwd(), absolute));
}

const PROTECTED_SPEC_FILES = new Set(["README.md", ".gitkeep"]);

async function collectSpecsFiles() {
  const files = await listFiles(SPECS_DIR, "");
  const matched: CleanupItem[] = [];

  for (const absolute of files) {
    const filename = path.basename(absolute);
    if (PROTECTED_SPEC_FILES.has(filename)) {
      continue;
    }

    matched.push({
      relativePath: toRelative(absolute),
      reason: "generated-spec-file",
    });
  }

  return matched;
}

async function collectGeneratedTests() {
  const files = await listFiles(PLAYWRIGHT_TESTS_DIR, ".spec.ts");
  const matched: CleanupItem[] = [];

  for (const absolute of files) {
    const filename = path.basename(absolute);
    if (filename === "seed.spec.ts") {
      continue;
    }

    let content = "";
    try {
      content = await fs.readFile(absolute, "utf8");
    } catch {
      continue;
    }

    const hasAgentMarkers =
      content.includes("// spec: specs/") && content.includes("// seed: playwright/tests/seed.spec.ts");

    if (!hasAgentMarkers) {
      continue;
    }

    matched.push({
      relativePath: toRelative(absolute),
      reason: "generated-agent-test",
    });
  }

  return matched;
}

async function removeEmptyDirs(baseDir: string) {
  async function walk(currentDir: string): Promise<boolean> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return false;
    }

    let hasContent = false;
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const childHasContent = await walk(absolutePath);
        if (childHasContent) {
          hasContent = true;
        }
      } else {
        hasContent = true;
      }
    }

    if (!hasContent && currentDir !== baseDir) {
      await fs.rmdir(currentDir).catch(() => {});
    }

    return hasContent;
  }

  await walk(baseDir);
}

export async function POST(request: Request) {
  let body: CleanupRequest = {};
  try {
    body = (await request.json()) as CleanupRequest;
  } catch {
    body = {};
  }

  const dryRun = body.dryRun ?? true;
  const includeGeneratedTests = body.includeGeneratedTests ?? true;

  const targets: CleanupItem[] = [];
  targets.push(...(await collectSpecsFiles()));
  if (includeGeneratedTests) {
    targets.push(...(await collectGeneratedTests()));
  }

  if (!dryRun) {
    await Promise.all(
      targets.map(async (item) => {
        const absolute = path.join(process.cwd(), item.relativePath);
        await fs.unlink(absolute);
      }),
    );
    await removeEmptyDirs(SPECS_DIR);
  }

  return NextResponse.json({
    dryRun,
    includeGeneratedTests,
    total: targets.length,
    files: targets,
  });
}
