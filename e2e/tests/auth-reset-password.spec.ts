import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Reset Password", () => {
  // The suite's default storageState is the authenticated + seeded session
  // from global-setup.ts — this page must be tested signed-out, otherwise
  // hasSession resolves true and the "Recovery Expired" state never renders.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("without a valid recovery session, shows the expired/invalid state (not a crash)", async ({
    page,
  }) => {
    // Visiting directly with no recovery token in the URL hash — Supabase
    // never establishes a session, so the page must show a graceful
    // "expired/invalid" state rather than a blank screen or crash.
    await page.goto("/reset-password");
    await expect(page.getByText(/recovery expired|invalid|request a fresh/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /request new reset link/i })).toBeVisible();
    expectNoPageErrors(page);
  });
});
