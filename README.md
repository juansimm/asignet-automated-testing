# QA Debug UI (Next.js + Playwright)

A local MVP for running Playwright suites against multiple targets, streaming live logs, and opening debugging artifacts.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind + shadcn-style UI components
- Prisma + SQLite
- Playwright CLI execution via `npx`

## Setup (bun)

1. Install dependencies:

```bash
bun install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Run Prisma migration + client generation:

```bash
bun run prisma:migrate
bun run prisma:generate
```

4. Seed sample target (optional):

```bash
bun run seed
```

5. Start dev server:

```bash
bun run dev
```

## Usage

1. Open `/targets` and add a target (name + base URL).
2. Add suites under `playwright/tests` (a `smoke.spec.ts` is included).
3. Open `/runs`, pick a target + suite, trigger a run.
4. Open run details at `/runs/[id]` to watch logs and inspect failing tests.
5. Use **Re-run Failed Only** to execute only previously failing cases.
6. Open HTML report and per-test attachments (trace/screenshot/video) from run detail.

## Runtime Controls

- Single-run concurrency guard: only one run can be `RUNNING` at a time.
- Global timeout: set `RUN_TIMEOUT_MS` (default `900000`, i.e. 15 minutes).
- Playwright retries: set `RETRIES` in env (default `0`).

## AI + Playwright Test Agents

- Open `/ai`.
- Fetch Wayfast logs and select the rows you want to include.
- Click **Append selected to scenario** to build structured scenario context.
- Click **Generate agent request** to create `specs/request_<timestamp>.md`.

The app also ensures `playwright/tests/seed.spec.ts` exists so the request is directly usable by the Playwright agents workflow.

### Initialize agent setup

Use one loop provider:

```bash
bun run agents:init:vscode
# or
bun run agents:init:claude
# or
bun run agents:init:copilot
```

This creates:

- `.github/agents/playwright-test-planner.agent.md`
- `.github/agents/playwright-test-generator.agent.md`
- `.github/agents/playwright-test-healer.agent.md`
- `.github/prompts/*` prompt templates
- `specs/` plan directory
- `.vscode/mcp.json` MCP wiring

### Agent execution order

1. Run planner against your generated `specs/request_<timestamp>.md` input.
2. Run generator to create executable tests in `playwright/tests/`.
3. Run healer to debug and fix failing tests until green.

## Wayfast Logs (optional)

Configure these environment variables to pull Wayfast log request data in `/ai`:

- `ASIGNET_BASE_URL` (defaults to `https://dbo.asignet.com/asignetrestapi`)
- `ASIGNET_USERNAME`
- `ASIGNET_PASSWORD`

Then use the **Wayfast Logs** card to fetch logs by email/date range, select rows, and append them as a structured scenario draft.

## Artifacts

All run output is stored under:

```text
artifacts/<runId>/
```

Expected files include:

- `stdout.log`
- `stderr.log`
- `report.json`
- `html-report/index.html`
- `test-results/*` (trace/screenshot/video attachments)

Artifacts are served in dev mode via:

```text
/artifacts/<runId>/...
```

with path traversal checks in the route handler.

## Scripts

- `bun run dev` - Next.js dev server
- `bun run test` - Run Playwright directly
- `bun run agents:init:vscode` - Initialize Playwright test agents for VS Code loop
- `bun run agents:init:claude` - Initialize Playwright test agents for Claude loop
- `bun run agents:init:copilot` - Initialize Playwright test agents for GitHub Copilot loop
- `bun run agents:mcp` - Start Playwright test MCP server
- `bun run seed` - Seed database
- `bun run prisma:migrate` - Apply/create local Prisma migration
- `bun run prisma:generate` - Generate Prisma client
