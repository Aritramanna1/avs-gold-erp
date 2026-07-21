import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Role Permissions", () => {
  test("Users & Roles tab shows the signed-in account's role", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.getByRole("tab", { name: /users.*roles/i }).click();
    await expect(authedPage.getByText(/role/i).first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  // The suite's default storageState is the authenticated + seeded session
  // (see playwright.config.ts) — override to a genuinely signed-out state,
  // same as auth-login.spec.ts's "(signed out)" tests. Supabase's session
  // lives in localStorage, not cookies, so clearing cookies alone wouldn't
  // sign this page out; without this override the test below was checking
  // the authenticated app shell, never the login form it claims to verify.
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("unauthenticated visitors cannot reach settings — redirected to login", async ({
      page,
    }) => {
      await page.goto("/settings");
      await expect(page.getByTestId("auth-form")).toBeVisible({ timeout: 15_000 });
      expectNoPageErrors(page);
    });
  });
});
