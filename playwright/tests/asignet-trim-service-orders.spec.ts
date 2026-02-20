import { expect, test, type Dialog, type Frame, type Locator, type Page } from "@playwright/test";

const IDE_BASE_URL = (process.env.IDE_BASE_URL?.trim() ?? "https://ide.asignet.com/").replace(/\/+$/g, "");
const IDE_LOGIN_URL = `${IDE_BASE_URL}/login`;
const IDE_SSO_URL = `${IDE_BASE_URL}/sso.ashx`;
const IDE_HOSTNAME = new URL(IDE_BASE_URL).hostname;

const RUN_IDE_ASIGNET_E2E = process.env.RUN_IDE_ASIGNET_E2E === "1";
const IDE_ASIGNET_USERNAME = process.env.IDE_ASIGNET_USERNAME?.trim();
const IDE_ASIGNET_PASSWORD = process.env.IDE_ASIGNET_PASSWORD?.trim();

type SearchContext = Page | Frame;
type LocatorFactory = (ctx: SearchContext) => Locator;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TRIM_SHELL_URL_RE = new RegExp(`${escapeRegex(IDE_HOSTNAME)}\\/page\\.ashx`, "i");
const IDE_AUTH_OR_PORTAL_URL_RE = new RegExp(`${escapeRegex(IDE_HOSTNAME)}\\/(?:login|sso\\.ashx|page\\.ashx)`, "i");

const USERNAME_FIELD_FACTORIES: LocatorFactory[] = [
  (ctx) => ctx.getByLabel(/username|usuario|correo|email/i),
  (ctx) => ctx.locator("input[name*='user' i], input[id*='user' i], input[type='email'], input[type='text']"),
];

const PASSWORD_FIELD_FACTORIES: LocatorFactory[] = [
  (ctx) => ctx.getByLabel(/password|contraseñ|clave/i),
  (ctx) => ctx.locator("input[type='password'], input[name*='pass' i], input[id*='pass' i]"),
];

const LOGIN_SUBMIT_FACTORIES: LocatorFactory[] = [
  (ctx) => ctx.getByRole("button", { name: /sign in|login|ingresar|entrar|acceder|continue/i }),
  (ctx) => ctx.locator("button[type='submit'], input[type='submit'], button:has-text('Login'), button:has-text('Ingresar')"),
];

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function searchContexts(page: Page): SearchContext[] {
  return [page, ...page.frames()];
}

function contextLabel(ctx: SearchContext): string {
  if ("mainFrame" in ctx) {
    return "page";
  }

  const url = ctx.url();
  return url ? `frame(${url})` : "frame";
}

async function findFirstVisibleLocator(page: Page, factories: LocatorFactory[], timeoutMs = 4_000): Promise<Locator | null> {
  for (const ctx of searchContexts(page)) {
    for (const createLocator of factories) {
      const candidate = createLocator(ctx).first();
      if ((await candidate.count()) === 0) {
        continue;
      }

      try {
        await candidate.waitFor({ state: "visible", timeout: timeoutMs });
        return candidate;
      } catch {
        // Try next locator strategy.
      }
    }
  }

  return null;
}

async function fillFirstVisible(
  page: Page,
  description: string,
  value: string,
  factories: LocatorFactory[],
  timeoutMs = 8_000,
) {
  const locator = await findFirstVisibleLocator(page, factories, timeoutMs);
  if (!locator) {
    throw new Error(`Unable to find ${description} input field.`);
  }

  await locator.fill(value);
}

async function clickFirstVisible(
  page: Page,
  description: string,
  factories: LocatorFactory[],
  timeoutMs = 8_000,
) {
  const errors: string[] = [];

  for (const ctx of searchContexts(page)) {
    for (const createLocator of factories) {
      const candidate = createLocator(ctx).first();
      if ((await candidate.count()) === 0) {
        continue;
      }

      try {
        await candidate.waitFor({ state: "visible", timeout: timeoutMs });
        await candidate.scrollIntoViewIfNeeded();
        await candidate.click({ timeout: timeoutMs });
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        errors.push(`${contextLabel(ctx)}: ${reason}`);
      }
    }
  }

  throw new Error(`Unable to click ${description}. ${errors.slice(0, 4).join(" | ")}`);
}

async function clickTrimNavbar(page: Page, menuNameRe: RegExp) {
  await clickFirstVisible(page, `TRIM menu (${menuNameRe})`, [
    (ctx) => ctx.getByRole("link", { name: menuNameRe }),
    (ctx) => ctx.getByRole("menuitem", { name: menuNameRe }),
    (ctx) => ctx.getByRole("button", { name: menuNameRe }),
    (ctx) => ctx.locator("a,button,[role='button'],[role='menuitem']").filter({ hasText: menuNameRe }),
  ]);
}

async function isIdeLoginScreen(page: Page): Promise<boolean> {
  const usernameField = await findFirstVisibleLocator(page, USERNAME_FIELD_FACTORIES, 2_000);
  const passwordField = await findFirstVisibleLocator(page, PASSWORD_FIELD_FACTORIES, 2_000);
  return Boolean(usernameField && passwordField);
}

async function ensureIdeAuthenticated(page: Page, username: string, password: string) {
  await page.goto(IDE_SSO_URL, { waitUntil: "domcontentloaded" });

  if (!(await isIdeLoginScreen(page))) {
    return;
  }

  if (!/\/login(?:[/?#]|$)/i.test(page.url())) {
    await page.goto(IDE_LOGIN_URL, { waitUntil: "domcontentloaded" });
  }

  await fillFirstVisible(page, "username", username, USERNAME_FIELD_FACTORIES);
  await fillFirstVisible(page, "password", password, PASSWORD_FIELD_FACTORIES);
  await clickFirstVisible(page, "login submit", LOGIN_SUBMIT_FACTORIES);
  await page.waitForLoadState("domcontentloaded");

  if (await isIdeLoginScreen(page)) {
    throw new Error("Login form is still visible after submit. Credentials may be invalid or login failed.");
  }

  if (!/sso\.ashx/i.test(page.url()) && !TRIM_SHELL_URL_RE.test(page.url())) {
    await page.goto(IDE_SSO_URL, { waitUntil: "domcontentloaded" });
  }
}

async function collectOrderStatusRows(page: Page, maxRows = 15): Promise<string[]> {
  const rowSelectors = [
    "table tbody tr",
    ".x-grid3-row",
    ".rgMasterTable tr",
    ".k-grid-content tr",
    "[role='row']",
    "table tr",
  ];

  for (const ctx of searchContexts(page)) {
    for (const selector of rowSelectors) {
      const rows = ctx.locator(selector);
      const count = await rows.count();
      if (count === 0) {
        continue;
      }

      const texts: string[] = [];
      const limit = Math.min(count, maxRows);
      for (let i = 0; i < limit; i += 1) {
        const text = normalizeText(await rows.nth(i).innerText().catch(() => ""));
        if (text.length >= 8) {
          texts.push(text);
        }
      }

      const unique = Array.from(new Set(texts));
      const looksLikeData = unique.some((row) => /\d/.test(row));
      if (unique.length > 0 && looksLikeData) {
        return unique;
      }
    }
  }

  return [];
}

function extractTicketId(messages: string[]): string | null {
  for (const rawMessage of messages) {
    const message = normalizeText(rawMessage);

    const prefixedId = message.match(/\b(?:SO|SR|REQ|TKT)[\s-]?\d{4,}\b/i);
    if (prefixedId) {
      return prefixedId[0].replace(/\s+/g, "");
    }

    const numericId = message.match(/\b\d{6,}\b/);
    if (numericId) {
      return numericId[0];
    }
  }

  return null;
}

function buildUserTokens(username: string, profileName: string | null): string[] {
  const baseTokens: string[] = [];
  const normalizedUsername = username.toLowerCase();
  baseTokens.push(normalizedUsername);

  const usernameLocalPart = normalizedUsername.split("@")[0] ?? "";
  if (usernameLocalPart.length > 1) {
    baseTokens.push(usernameLocalPart);
    baseTokens.push(...usernameLocalPart.split(/[._-]/g).filter((chunk) => chunk.length >= 2));
  }

  if (profileName) {
    const normalizedProfile = profileName.toLowerCase();
    baseTokens.push(normalizedProfile);
    baseTokens.push(...normalizedProfile.split(/\s+/g).filter((chunk) => chunk.length >= 2));
  }

  return Array.from(new Set(baseTokens)).filter(Boolean);
}

async function detectTopRightProfileName(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const blockedWords = /^(microsoft|trim|home|service|order|about|management|inventory|reports)$/i;
    const nameRe = /^[a-z]{2,}(?:\s+[a-z]{2,}){1,2}$/i;
    let bestMatch: { text: string; score: number } | null = null;

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    for (const node of nodes) {
      if (node.children.length > 0) {
        continue;
      }

      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!nameRe.test(text)) {
        continue;
      }

      if (text.split(/\s+/g).some((chunk) => blockedWords.test(chunk))) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      if (rect.top < 0 || rect.top > 220) {
        continue;
      }

      if (rect.left < window.innerWidth * 0.55) {
        continue;
      }

      // Prefer elements closer to the top-right corner.
      const distanceScore = Math.abs(window.innerWidth - rect.right) + Math.abs(rect.top);
      if (!bestMatch || distanceScore < bestMatch.score) {
        bestMatch = { text, score: distanceScore };
      }
    }

    return bestMatch?.text ?? null;
  });
}

test.use({ ignoreHTTPSErrors: true });

test.describe("Asignet IDE TRIM - Service Orders", () => {
  test.skip(
    !RUN_IDE_ASIGNET_E2E,
    "Set RUN_IDE_ASIGNET_E2E=1 to run this flow (it creates a real Service Order ticket).",
  );
  test.skip(
    !IDE_ASIGNET_USERNAME || !IDE_ASIGNET_PASSWORD,
    "Set IDE_ASIGNET_USERNAME and IDE_ASIGNET_PASSWORD to run this private-network flow.",
  );

  test("create a Service Order and verify it in Order Status", async ({ page }) => {
    test.setTimeout(8 * 60_000);

    const username = IDE_ASIGNET_USERNAME ?? "";
    const password = IDE_ASIGNET_PASSWORD ?? "";

    let beforeRows: string[] = [];
    let afterRows: string[] = [];
    let capturedTicketId: string | null = null;
    let profileName: string | null = null;

    await test.step("Authenticate into Asignet IDE (SSO-first)", async () => {
      await ensureIdeAuthenticated(page, username, password);
      await expect(page).toHaveURL(IDE_AUTH_OR_PORTAL_URL_RE, { timeout: 90_000 });
    });

    await test.step("Open TRIM project", async () => {
      if (!TRIM_SHELL_URL_RE.test(page.url())) {
        await clickFirstVisible(page, "TRIM card", [
          (ctx) => ctx.getByRole("link", { name: /^\s*trim\s*$/i }),
          (ctx) => ctx.getByRole("button", { name: /^\s*trim\s*$/i }),
          (ctx) => ctx.locator("a,button,[role='button']").filter({ hasText: /^\s*trim\s*$/i }),
          (ctx) => ctx.getByText(/^\s*trim\s*$/i),
        ]);
      }

      await page.waitForURL(TRIM_SHELL_URL_RE, { timeout: 90_000 });
      await expect(page.getByText(/TRIM - Telecom Resources Information Management/i).first()).toBeVisible({
        timeout: 90_000,
      });

      profileName = await detectTopRightProfileName(page);
    });

    await test.step("Capture current Order Status rows", async () => {
      await clickTrimNavbar(page, /order status/i);
      await page.waitForLoadState("domcontentloaded");
      beforeRows = await collectOrderStatusRows(page);
    });

    await test.step("Create a Service Order using footer OK", async () => {
      await clickTrimNavbar(page, /service orders/i);
      await page.waitForLoadState("domcontentloaded");

      for (let i = 0; i < 8; i += 1) {
        await page.mouse.wheel(0, 1_500);
        await page.waitForTimeout(150);
      }

      const dialogMessages: string[] = [];
      const dialogHandler = async (dialog: Dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      };

      page.on("dialog", dialogHandler);
      try {
        await clickFirstVisible(page, "Service Orders footer OK button", [
          (ctx) => ctx.getByRole("button", { name: /^\s*ok\s*$/i }),
          (ctx) => ctx.getByRole("button", { name: /create|save|submit|confirm/i }),
          (ctx) => ctx.locator("input[type='button'][value='OK'], input[type='submit'][value='OK']"),
          (ctx) => ctx.locator("button:has-text('OK'), a:has-text('OK'), span:has-text('OK')"),
        ]);
      } finally {
        page.off("dialog", dialogHandler);
      }

      await page.waitForTimeout(2_500);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);

      const inlineMessages = await page
        .locator(".alert, .message, .notification, [role='alert'], .toast, .success")
        .allInnerTexts()
        .catch(() => []);

      capturedTicketId = extractTicketId([...dialogMessages, ...inlineMessages]);
    });

    await test.step("Validate ticket appears in Order Status", async () => {
      await clickTrimNavbar(page, /home/i);
      await page.waitForLoadState("domcontentloaded");

      await clickTrimNavbar(page, /order status/i);
      await page.waitForLoadState("domcontentloaded");

      afterRows = await collectOrderStatusRows(page);
      expect(afterRows.length, "No data rows were found in Order Status after creating the ticket.").toBeGreaterThan(0);

      const normalizedAfterRows = afterRows.map((row) => row.toLowerCase());
      const userTokens = buildUserTokens(username, profileName);
      const rowMatchesUser = normalizedAfterRows.some((row) => userTokens.some((token) => row.includes(token)));

      if (capturedTicketId) {
        expect(
          normalizedAfterRows.join(" "),
          `Created ticket ${capturedTicketId} was not found in Order Status rows.`,
        ).toContain(capturedTicketId.toLowerCase());
      } else {
        const beforeSet = new Set(beforeRows);
        const newRows = afterRows.filter((row) => !beforeSet.has(row));
        expect(
          newRows.length > 0 || rowMatchesUser,
          [
            "Could not confirm new ticket row in Order Status.",
            `User tokens: ${userTokens.join(", ")}`,
            `Rows before: ${beforeRows.slice(0, 3).join(" || ") || "none"}`,
            `Rows after: ${afterRows.slice(0, 3).join(" || ") || "none"}`,
          ].join("\n"),
        ).toBeTruthy();
      }
    });
  });
});
