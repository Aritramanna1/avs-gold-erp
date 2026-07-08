import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Forgot Password", () => {
  test("requesting a reset link shows a success state and no duplicate submits", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    const email = page.locator('input[type="email"]');
    await expect(email).toBeVisible();
    await email.fill("demo-e2e@example.com");

    const submit = page.getByRole("button", { name: /send reset link/i });
    await submit.click();
    await expect(submit).toBeDisabled();

    await expect(page.getByText(/dispatched|check your inbox/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(page);
  });

  test("back-to-login link returns to the auth form", async ({ page }) => {
    await page.goto("/forgot-password");
    await page
      .getByRole("button", { name: /back to login/i })
      .first()
      .click();
    await expect(page.getByTestId("auth-form")).toBeVisible();
  });
});
