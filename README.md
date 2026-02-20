# QA Debug UI (Targets + AI + Specs)

Focused workspace for target management, AI scenario input, and Playwright agent requests.

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

1. Open `/targets` and manage base URLs.
2. Open `/ai` and keep `Prompt only (No DBO, recommended)` mode.
3. Fill prompt fields (objective, context, constraints, required assertions).
4. Click **Append no-DBO prompt to scenario**.
5. Click **Generate agent request** (creates `specs/request_<timestamp>.md`).
6. Open `/specs` to review generated request and current `playwright/tests/*.spec.ts`.
7. Use `/specs` cleaner controls to preview/delete generated files when done.

## AI + Playwright Test Agents

- Open `/ai`.
- Build scenario instructions in **Prompt only (No DBO)** mode.
- Click **Append no-DBO prompt to scenario**.
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
# or (Cursor/OpenCode style loop)
bun run agents:init:opencode
```

This creates:

- `.github/agents/playwright-test-planner.agent.md`
- `.github/agents/playwright-test-generator.agent.md`
- `.github/agents/playwright-test-healer.agent.md`
- `.github/prompts/*` prompt templates
- `.opencode/prompts/*` and `opencode.json` (when using `agents:init:opencode`)
- `specs/` plan directory
- `.vscode/mcp.json` MCP wiring

### Keep Definitions In Sync

When Playwright is updated, regenerate agent definitions so prompts/tools stay aligned with Playwright conventions:

```bash
bun run agents:init:vscode
# or your selected loop, e.g.
bun run agents:init:opencode
```

### Agent execution order

1. Run planner against your generated `specs/request_<timestamp>.md` input.
2. Run generator to create executable tests in `playwright/tests/`.
3. Run healer to debug and fix failing tests until green.

## Asignet API Mode (optional)

Only needed if you choose `Asignet API` mode in `/ai`:

- `ASIGNET_BASE_URL` (defaults to `https://dbo.asignet.com/asignetrestapi`)
- `ASIGNET_USERNAME`
- `ASIGNET_PASSWORD`

If you do not have access to `dbo.asignet.com`, use `Manual JSON` or `Public URL JSON` instead.

## Asignet IDE TRIM E2E (private network)

The test `playwright/tests/asignet-trim-service-orders.spec.ts` automates:

1. Login in `https://ide.asignet.com/login`
2. SSO/TRIM entry (`/sso.ashx` + TRIM card)
3. `Service Orders` navigation and submit with footer `OK`
4. `Order Status` verification for the newly created ticket

Required env vars:

- `IDE_BASE_URL` (default: `https://ide.asignet.com/`)
- `IDE_ASIGNET_USERNAME`
- `IDE_ASIGNET_PASSWORD`
- `RUN_IDE_ASIGNET_E2E=1` (explicit opt-in because the test creates a real ticket)

Auth behavior:
- The flow starts at `${IDE_BASE_URL}/sso.ashx`.
- If already logged in, it continues directly to the portal/TRIM card.
- If not logged in, it goes through `${IDE_BASE_URL}/login` with username/password.

Run only this flow:

```bash
RUN_IDE_ASIGNET_E2E=1 npx playwright test playwright/tests/asignet-trim-service-orders.spec.ts --config=playwright/playwright.config.ts
```

## Scripts

- `bun run dev` - Next.js dev server
- `bun run test` - Run Playwright directly
- `bun run agents:init:vscode` - Initialize Playwright test agents for VS Code loop
- `bun run agents:init:claude` - Initialize Playwright test agents for Claude loop
- `bun run agents:init:copilot` - Initialize Playwright test agents for GitHub Copilot loop
- `bun run agents:init:opencode` - Initialize Playwright test agents for OpenCode/Cursor-style loop
- `bun run agents:mcp` - Start Playwright test MCP server
- `bun run clean:generated` - Preview generated files to clean (dry run)
- `bun run clean:generated:yes` - Delete generated request markdown + generated agent tests
- `bun run seed` - Seed database
- `bun run prisma:migrate` - Apply/create local Prisma migration
- `bun run prisma:generate` - Generate Prisma client
