import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("OTP Login", () => {
  // The suite's default storageState is the authenticated + seeded session
  // from global-setup.ts — this page must be tested signed-out.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sending a code shows the 6-digit verification form", async ({ page }) => {
    await page.goto("/otp-login");
    const email = page.locator('input[type="email"]');
    await expect(email).toBeVisible();
    await email.fill("demo-e2e@example.com");

    const submit = page.getByRole("button", { name: /send verification code/i });
    await submit.click();
    await expect(submit).toBeDisabled();

    await expect(page.getByText(/6-digit verification code has been sent/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByPlaceholder("123456")).toBeVisible();
    expectNoPageErrors(page);
  });

  test("verify button is disabled while a verification attempt is in flight", async ({ page }) => {
    await page.goto("/otp-login");
    await page.locator('input[type="email"]').fill("demo-e2e@example.com");
    await page.getByRole("button", { name: /send verification code/i }).click();
    await expect(page.getByPlaceholder("123456")).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder("123456").fill("000000");
    const verify = page.getByRole("button", { name: /verify code/i });
    await verify.click();
    await expect(verify).toBeDisabled();
  });
});
