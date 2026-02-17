import path from "node:path";
import { ARTIFACTS_DIR, ROOT_DIR, toPosixPath } from "@/lib/constants";

export type RunPaths = {
  runArtifactsDir: string;
  stdoutPath: string;
  stderrPath: string;
  reportJsonPath: string;
  htmlReportDir: string;
  testResultsDir: string;
};

export function getRunPaths(runId: string): RunPaths {
  const runArtifactsDir = path.join(ARTIFACTS_DIR, runId);

  return {
    runArtifactsDir,
    stdoutPath: path.join(runArtifactsDir, "stdout.log"),
    stderrPath: path.join(runArtifactsDir, "stderr.log"),
    reportJsonPath: path.join(runArtifactsDir, "report.json"),
    htmlReportDir: path.join(runArtifactsDir, "html-report"),
    testResultsDir: path.join(runArtifactsDir, "test-results"),
  };
}

export function toStoredPath(absolutePath: string) {
  return toPosixPath(path.relative(ROOT_DIR, absolutePath));
}

export function fromStoredPath(storedPath: string | null | undefined) {
  if (!storedPath) {
    return null;
  }

  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }

  return path.resolve(ROOT_DIR, storedPath);
}

export function toArtifactsUrl(storedPath: string | null | undefined) {
  if (!storedPath) {
    return null;
  }

  const normalized = storedPath.replace(/^\.\//, "");

  if (!normalized.startsWith("artifacts/")) {
    return null;
  }

  return `/${normalized}`;
}
