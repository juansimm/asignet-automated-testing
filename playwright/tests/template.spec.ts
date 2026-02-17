import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * QA Template (AAA: Arrange, Act, Assert)
 *
 * Copy this file and rename it, for example:
 * playwright/tests/checkout_happy_path.spec.ts
 *
 * Recommended workflow:
 * 1) Record the flow with `npx playwright codegen <BASE_URL>`.
 * 2) Paste actions into the Act section.
 * 3) Keep / add explicit assertions in Assert.
 */

type UserData = {
  email: string;
  password: string;
};

function buildUserData(): UserData {
  return {
    email: process.env.QA_EMAIL ?? "qa.user@example.com",
    password: process.env.QA_PASSWORD ?? "ChangeMe123!",
  };
}

async function safeFill(locator: Locator, value: string) {
  await expect(locator).toBeVisible();
  await locator.fill(value);
  await expect(locator).toHaveValue(value);
}

async function loginIfNeeded(page: Page, user: UserData) {
  // Adjust selectors to your app.
  const emailInput = page.getByLabel(/email/i);
  const passwordInput = page.getByLabel(/password/i);
  const submitButton = page.getByRole("button", { name: /sign in|login|ingresar/i });

  if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
    return;
  }

  await safeFill(emailInput, user.email);
  await safeFill(passwordInput, user.password);
  await submitButton.click();
}

test.describe("QA Template", () => {
  test("critical user flow", async ({ page }) => {
    const user = buildUserData();

    // Arrange: open app and prepare test state.
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Optional auth step. If your app has no login, this helper exits immediately.
    await loginIfNeeded(page, user);

    // Act: replace with your flow actions from codegen.
    // Example placeholders:
    // await page.getByRole("link", { name: /products/i }).click();
    // await page.getByRole("button", { name: /add to cart/i }).first().click();
    // await page.getByRole("button", { name: /checkout/i }).click();

    // Assert: do not rely on "test didn’t crash".
    // Add business-result validations here.
    await expect(page).toHaveURL(/.*/);

    // Example assertions to adapt:
    // await expect(page.getByText(/order confirmed/i)).toBeVisible();
    // await expect(page.getByTestId("order-total")).toHaveText("$99.00");
    // await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible();
  });
});
