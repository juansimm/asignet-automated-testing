import path from "node:path";
import { promises as fs } from "node:fs";

export const ROOT_DIR = process.cwd();
export const ARTIFACTS_DIR = path.join(ROOT_DIR, "artifacts");
export const PLAYWRIGHT_DIR = path.join(ROOT_DIR, "playwright");
export const PLAYWRIGHT_TESTS_DIR = path.join(PLAYWRIGHT_DIR, "tests");

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function toPosixPath(inputPath: string) {
  return inputPath.split(path.sep).join("/");
}
