import { test } from "@playwright/test";

test.describe("Seed Setup", () => {
  test("seed", async ({ page }) => {
    // Add reusable setup steps for your app (auth, tenant selection, etc.).
    await page.goto("/");
  });
});
