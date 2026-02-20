import { test, expect } from "@playwright/test";

test.describe("Playwright Definitions API Docs", () => {
  test("Verify Text Presence on Documentation Page", async ({ page }) => {
    // 1. Navigate to target URL
    await page.goto("https://playwright.dev/docs/test-agents#agent-definitions");
    await expect(page).toHaveURL(/#agent-definitions/);
    await page.screenshot({
      path: "playwright/testsEvidence/scenario1-step1-navigate.png",
      fullPage: true,
    });

    // 2. Verify page title
    const title = await page.title();
    expect(title).toContain("Playwright");
    expect(title).toContain("Agents");
    await page.screenshot({
      path: "playwright/testsEvidence/scenario1-step2-title.png",
      fullPage: true,
    });

    // 3. Verify main heading is visible
    const heading = page.getByRole("heading", {
      name: "Playwright Test Agents",
      level: 1,
    });
    await expect(heading).toBeVisible();
    await heading.screenshot({
      path: "playwright/testsEvidence/scenario1-step3-heading.png",
    });

    // 4. Verify target code snippet exists in page content
    const codeSnippet = page.getByText("npx playwright init-agents --loop=vscode").first();
    await expect(codeSnippet).toBeVisible();
    await codeSnippet.screenshot({
      path: "playwright/testsEvidence/scenario1-step4-code-snippet.png",
    });

    // 5. Verify the snippet is in a code block
    const codeElement = page.locator("code").filter({
      hasText: "npx playwright init-agents --loop=vscode",
    }).first();
    await expect(codeElement).toBeVisible();
    await codeElement.screenshot({
      path: "playwright/testsEvidence/scenario1-step5-code-element.png",
    });

    // 6. Verify the anchor link works
    const currentUrl = page.url();
    expect(currentUrl).toContain("#agent-definitions");
    await page.screenshot({
      path: "playwright/testsEvidence/scenario1-step6-url.png",
      fullPage: true,
    });
  });

  test("Verify Tabbed Interface Functionality", async ({ page }) => {
    // 1. Navigate to target URL
    await page.goto("https://playwright.dev/docs/test-agents#agent-definitions");
    await page.screenshot({
      path: "playwright/testsEvidence/scenario2-step1-navigate.png",
      fullPage: true,
    });

    // 2. Verify VS Code tab is active
    const vsCodeTab = page.getByRole("tab", { name: "VS Code" });
    await expect(vsCodeTab).toBeVisible();
    await expect(vsCodeTab).toHaveAttribute("aria-selected", "true");
    await vsCodeTab.screenshot({
      path: "playwright/testsEvidence/scenario2-step2-vscode-tab.png",
    });

    // 3. Verify command is displayed in active tab
    const activeTabPanel = page.getByRole("tabpanel").first();
    const activeTabCode = activeTabPanel.locator("code").filter({
      hasText: "npx playwright init-agents --loop=vscode",
    }).first();
    await expect(activeTabCode).toBeVisible();
    await activeTabCode.screenshot({
      path: "playwright/testsEvidence/scenario2-step3-command-visible.png",
    });
    await expect(activeTabCode.first()).toBeVisible();
    await activeTabCode.first().screenshot({
      path: "playwright/testsEvidence/scenario2-step3-command-visible.png",
    });
  });

  test("Navigation and Page Structure Validation", async ({ page }) => {
    // 1. Navigate to target URL
    await page.goto("https://playwright.dev/docs/test-agents#agent-definitions");
    await page.screenshot({
      path: "playwright/testsEvidence/scenario3-step1-navigate.png",
      fullPage: true,
    });

    // 2. Verify sidebar navigation exists
    const sidebar = page.locator("aside.theme-doc-sidebar-container, .theme-doc-sidebar-container").first();
    await expect(sidebar).toBeVisible();
    await sidebar.screenshot({
      path: "playwright/testsEvidence/scenario3-step2-sidebar.png",
    });

    // 3. Verify "On This Page" TOC exists
    const toc = page.locator("nav[class*='toc'], [class*='tableOfContents']").first();
    await expect(toc).toBeVisible();
    await toc.screenshot({
      path: "playwright/testsEvidence/scenario3-step3-toc.png",
    });

    // 4. Verify breadcrumb navigation
    const breadcrumb = page.locator("nav.breadcrumbs, [class*='breadcrumb']").first();
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.screenshot({
      path: "playwright/testsEvidence/scenario3-step4-breadcrumb.png",
    });
  });
});
