import path from "node:path";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";

const ROOT_DIR = process.cwd();
const SPECS_DIR = path.join(ROOT_DIR, "specs");
const PLAYWRIGHT_TESTS_DIR = path.join(ROOT_DIR, "playwright", "tests");

type CleanupItem = {
  absolutePath: string;
  relativePath: string;
  reason: string;
};

function toPosixPath(inputPath: string) {
  return inputPath.split(path.sep).join("/");
}

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

async function collectSpecMarkdowns() {
  const files = await listFiles(SPECS_DIR, ".md");
  const matched: CleanupItem[] = [];

  for (const absolute of files) {
    const filename = path.basename(absolute);
    if (filename.startsWith("request_") || filename.startsWith("test-plan_")) {
      matched.push({
        absolutePath: absolute,
        relativePath: toPosixPath(path.relative(ROOT_DIR, absolute)),
        reason: "generated-spec-markdown",
      });
    }
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
      absolutePath: absolute,
      relativePath: toPosixPath(path.relative(ROOT_DIR, absolute)),
      reason: "generated-agent-test",
    });
  }

  return matched;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = !args.has("--yes");
  const includeGeneratedTests = !args.has("--specs-only");

  const targets: CleanupItem[] = [];
  targets.push(...(await collectSpecMarkdowns()));
  if (includeGeneratedTests) {
    targets.push(...(await collectGeneratedTests()));
  }

  if (!targets.length) {
    console.log("No generated files found.");
    return;
  }

  console.log(`Found ${targets.length} generated file(s):`);
  for (const item of targets) {
    console.log(`- ${item.relativePath} (${item.reason})`);
  }

  if (dryRun) {
    console.log("\nDry run only. Re-run with --yes to delete.");
    return;
  }

  await Promise.all(targets.map((item) => fs.unlink(item.absolutePath)));
  console.log(`\nDeleted ${targets.length} generated file(s).`);
}

void main();
