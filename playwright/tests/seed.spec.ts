import { test } from "@playwright/test";

test.describe("Seed Setup", () => {
  test("seed", async ({ page }) => {
    await page.goto("/");
  });
});
