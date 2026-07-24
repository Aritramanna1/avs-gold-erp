import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Happy-path invite acceptance: code + email -> set password -> account usable.
 *
 * Requires a pending invitation row already present in the target Supabase
 * project with code TEST-INV-001 / email e2e-invite-test@example.com
 * (inserted directly via SQL for this run, not through the UI — this test
 * only covers the accept side, not invite creation).
 */
test.describe("Invite accept (happy path)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("valid invitation resolves, accepting it sets a password and activates the account", async ({
    page,
  }) => {
    await page.goto("/invite/accept?code=TEST-INV-001&email=e2e-invite-test%40example.com");

    // Invitation must resolve as valid before the setup form appears.
    await expect(page.locator("#invite-name")).toBeVisible({ timeout: 20_000 });

    await page.locator("#invite-name").fill("E2E Invite Test");
    await page.locator("#invite-phone").fill("9999999999");
    await page.locator("#invite-password").fill("TestPass!2026");
    await page.locator("#invite-confirm-password").fill("TestPass!2026");

    const acceptButton = page.getByRole("button", { name: /activate account/i });
    await expect(acceptButton).toBeEnabled({ timeout: 10_000 });
    await acceptButton.click();

    // "Welcome to {shopName}!" success screen, or a redirect straight into
    // the app — either is the real success signal per the route's own code.
    await expect(
      page
        .getByText(/welcome to/i)
        .first()
        .or(page.locator('[data-testid="app-shell"]').first()),
    ).toBeVisible({ timeout: 25_000 });

    expectNoPageErrors(page);
  });
});
