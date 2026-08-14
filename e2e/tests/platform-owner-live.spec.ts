import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Platform Owner control center smoke tests.
 *
 * These tests require a Supabase account with `saas_admin` role.
 * They are automatically skipped when no platform-owner credentials are
 * configured (E2E_PLATFORM_EMAIL / E2E_PLATFORM_PASSWORD env vars not set),
 * because the standard QA firm-owner account is NOT a platform owner and
 * correctly stays on the ERP app — not /platform.
 */
const platformEmail = process.env.E2E_PLATFORM_EMAIL;
const platformPassword = process.env.E2E_PLATFORM_PASSWORD;
const hasPlatformCreds = !!(platformEmail && platformPassword);

test.describe("Platform Owner control center", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to the isolated platform application", async ({ page }) => {
    test.skip(
      !hasPlatformCreds,
      "No E2E_PLATFORM_EMAIL/PASSWORD configured — skipping platform-owner tests",
    );

    // Sign in as platform owner
    await page.goto("/");
    await page.getByTestId("auth-email").fill(platformEmail!);
    await page.getByTestId("auth-password").fill(platformPassword!);
    await page.getByTestId("auth-submit").click();
    await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 30_000 });

    await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByText("AVS PLATFORM", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible();
    await expect(page.getByText("Orders", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Gold Book", { exact: true })).toHaveCount(0);
    expectNoPageErrors(page);
  });

  test("sign out is available and returns to authentication", async ({ page }) => {
    test.skip(
      !hasPlatformCreds,
      "No E2E_PLATFORM_EMAIL/PASSWORD configured — skipping platform-owner tests",
    );

    // Sign in as platform owner
    await page.goto("/");
    await page.getByTestId("auth-email").fill(platformEmail!);
    await page.getByTestId("auth-password").fill(platformPassword!);
    await page.getByTestId("auth-submit").click();
    await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 30_000 });

    await page.goto("/platform");
    await page
      .getByRole("button", { name: /sign out/i })
      .first()
      .click();
    await expect(page.getByTestId("auth-form")).toBeVisible({ timeout: 20_000 });
  });
});
