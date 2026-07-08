import { test, expect, expectNoPageErrors } from "../fixtures/base";

// Invitation flow: admin login uses the same E2E_EMAIL / E2E_PASSWORD account
// as every other authenticated suite (via the `authedPage` fixture, which
// reads process.env.E2E_EMAIL / process.env.E2E_PASSWORD and fails with a
// clear error if either is unset — see e2e/fixtures/base.ts).

test.describe("Invitation (signed out)", () => {
  // The suite's default storageState is the authenticated + seeded session
  // from global-setup.ts — the invite-accept flow is for a signed-out
  // visitor and must be tested that way.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("invalid invitation code/email shows an accurate error, not a generic one", async ({
    page,
  }) => {
    await page.goto("/invite/accept?code=INV-000000&email=nobody@example.com");
    await expect(page.getByText(/invalid invitation/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(page);
  });

  test("code-entry form requires both code and email before validating", async ({ page }) => {
    await page.goto("/invite/accept");
    const validateBtn = page.getByRole("button", { name: /validate invitation/i });
    await expect(validateBtn).toBeDisabled();

    await page.getByLabel(/invitation code/i).fill("INV-123456");
    await expect(validateBtn).toBeDisabled();

    await page.getByLabel(/your email/i).fill("someone@example.com");
    await expect(validateBtn).toBeEnabled();
  });
});

test.describe("Invitation (signed in)", () => {
  test("admin can open the Send Invitation panel in Settings", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.getByRole("tab", { name: /users.*roles/i }).click();
    await expect(authedPage.getByRole("button", { name: /send invite/i })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
