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

## AI Placeholder

- Open `/ai`.
- Paste a scenario markdown spec.
- Click generate to create `playwright/tests/generated_<timestamp>.spec.ts`.
- The file is a template with TODO markers for future agent integration.

## Wayfast Logs (optional)

Configure these environment variables to pull Wayfast log request data in `/ai`:

- `ASIGNET_BASE_URL` (defaults to `https://dbo.asignet.com/asignetrestapi`)
- `ASIGNET_USERNAME`
- `ASIGNET_PASSWORD`

Then use the **Wayfast Logs** card to fetch logs by email and date range and append them to a scenario.

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
- `bun run seed` - Seed database
- `bun run prisma:migrate` - Apply/create local Prisma migration
- `bun run prisma:generate` - Generate Prisma client
