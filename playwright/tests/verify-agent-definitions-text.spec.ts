import { test, expect } from "@playwright/test";

test.describe("Verify Text Existence on Documentation Page", () => {
  test("should verify agent definitions text exists on Playwright docs", async ({ page }) => {
    // 1. Navigate to the target URL
    await page.goto("https://playwright.dev/docs/test-agents#agent-definitions");
    await expect(page).toHaveURL(/playwright\.dev\/docs\/test-agents/);
    await page.screenshot({ path: "playwright/tests/screenshots/01-navigated.png" });

    // 2. Wait for page content to load
    await expect(page).toHaveTitle(/Playwright/);
    await page.screenshot({ path: "playwright/tests/screenshots/02-page-loaded.png" });

    // 3. Locate the target text on the page
    const targetText = "Start with adding Playwright Test Agent definitions to your project";
    const textLocator = page.getByText(targetText, { exact: false });
    await expect(textLocator).toBeVisible();
    await textLocator.screenshot({ path: "playwright/tests/screenshots/03-target-text.png" });
    await page.screenshot({ path: "playwright/tests/screenshots/03-page-with-text.png" });

    // 4. Verify text context - verify we're in the correct section
    const headingLocator = page.locator("h1, h2, h3").filter({ hasText: /Agent definitions/i });
    await expect(headingLocator.first()).toBeVisible();
    await headingLocator.first().screenshot({ path: "playwright/tests/screenshots/04-heading-section.png" });
    await page.screenshot({ path: "playwright/tests/screenshots/04-final.png" });
  });
});
