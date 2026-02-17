import { createHash } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { PLAYWRIGHT_TESTS_DIR, toPosixPath } from "@/lib/constants";

const SUITE_PATTERN = /\.spec\.(t|j)sx?$/;

function normalizeSuiteName(suiteName: string) {
  return suiteName.replace(/^\/+/, "").trim();
}

export function resolveSuiteAbsolutePath(suiteName: string) {
  const normalized = normalizeSuiteName(suiteName);
  const resolved = path.resolve(PLAYWRIGHT_TESTS_DIR, normalized);
  const root = path.resolve(PLAYWRIGHT_TESTS_DIR);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return resolved;
}

async function walk(currentDir: string, baseDir: string, output: string[]) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, baseDir, output);
      continue;
    }

    if (!SUITE_PATTERN.test(entry.name)) {
      continue;
    }

    const relativePath = path.relative(baseDir, absolutePath);
    output.push(toPosixPath(relativePath));
  }
}

export async function listSuites() {
  try {
    await fs.access(PLAYWRIGHT_TESTS_DIR);
  } catch {
    return [] as string[];
  }

  const suites: string[] = [];
  await walk(PLAYWRIGHT_TESTS_DIR, PLAYWRIGHT_TESTS_DIR, suites);
  return suites.sort((a, b) => a.localeCompare(b));
}

export async function suiteExists(suiteName: string) {
  const normalized = normalizeSuiteName(suiteName);
  const suites = await listSuites();
  return suites.includes(normalized);
}

export async function getSuiteHash(suiteName: string) {
  const suitePath = resolveSuiteAbsolutePath(suiteName);

  if (!suitePath) {
    return null;
  }

  try {
    const content = await fs.readFile(suitePath, "utf8");
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}
