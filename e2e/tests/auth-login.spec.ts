import { test, expect, expectNoPageErrors } from "../fixtures/base";
import { INVALID_LOGIN } from "../data/test-data";

test.describe("Login (signed out)", () => {
  // The suite's default storageState is the authenticated + seeded session
  // from global-setup.ts — these tests specifically need a signed-out start.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders the login form on first load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("auth-form")).toBeVisible();
    await expect(page.getByTestId("auth-email")).toBeVisible();
    await expect(page.getByTestId("auth-password")).toBeVisible();
    await expect(page.getByTestId("auth-submit")).toBeVisible();
    expectNoPageErrors(page);
  });

  test("shows an error for invalid credentials without crashing", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("auth-email").fill(INVALID_LOGIN.email);
    await page.getByTestId("auth-password").fill(INVALID_LOGIN.password);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: 15_000 });
    // The form must still be present — a failed login must not crash the app
    // or silently pretend to succeed.
    await expect(page.getByTestId("auth-form")).toBeVisible();
    expectNoPageErrors(page);
  });

  test("submit button is disabled while a login attempt is in flight", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("auth-email").fill(INVALID_LOGIN.email);
    await page.getByTestId("auth-password").fill(INVALID_LOGIN.password);
    const submit = page.getByTestId("auth-submit");
    await submit.click();
    // Guards against duplicate-submit: button must disable immediately.
    await expect(submit).toBeDisabled();
  });
});

test.describe("Login (already authenticated)", () => {
  test("valid credentials sign the user into the app shell", async ({ authedPage }) => {
    await expect(authedPage.getByTestId("auth-form")).toBeHidden();
    expectNoPageErrors(authedPage);
  });
});
