import type { ChildProcess } from "node:child_process";

type RunProcessEntry = {
  child: ChildProcess;
  startedAtMs: number;
};

const globalForRunProcesses = globalThis as unknown as {
  runProcesses?: Map<string, RunProcessEntry>;
};

export const runProcesses = globalForRunProcesses.runProcesses ?? new Map<string, RunProcessEntry>();

if (!globalForRunProcesses.runProcesses) {
  globalForRunProcesses.runProcesses = runProcesses;
}
