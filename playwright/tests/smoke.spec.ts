import { test, expect } from "@playwright/test";

test("base URL is reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/.*/);
});
