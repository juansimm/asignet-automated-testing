import path from "node:path";
import { defineConfig } from "@playwright/test";

const runId = process.env.RUN_ID ?? "manual_run";
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const isHeadless = process.env.HEADLESS !== "0";
const slowMoMs = Number(process.env.SLOW_MO_MS ?? "0");
const retriesRaw = Number(process.env.RETRIES ?? "0");
const retries = Number.isFinite(retriesRaw) && retriesRaw >= 0 ? Math.floor(retriesRaw) : 0;

const runArtifactsDir = path.join(process.cwd(), "artifacts", runId);

export default defineConfig({
  testDir: path.join(process.cwd(), "playwright", "tests"),
  timeout: 90_000,
  retries,
  fullyParallel: false,
  reporter: [
    ["html", { outputFolder: path.join(runArtifactsDir, "html-report"), open: "never" }],
    ["json", { outputFile: path.join(runArtifactsDir, "report.json") }],
  ],
  outputDir: path.join(runArtifactsDir, "test-results"),
  use: {
    baseURL: baseUrl,
    headless: isHeadless,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      slowMo: Number.isFinite(slowMoMs) ? slowMoMs : 0,
    },
  },
});
