import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Logout", () => {
  test("signing out from the user menu returns to the login form", async ({ authedPage }) => {
    await authedPage.goto("/");
    // Wait for initial queries and layout to settle
    await authedPage.waitForLoadState("networkidle");
    await authedPage.waitForTimeout(3000);

    // Signal intentional logout via localStorage so addInitScript skips re-injection
    // on the subsequent hard page reload triggered by handleSignOut.
    // localStorage persists across same-tab navigations unlike sessionStorage.
    await authedPage.evaluate(() => {
      window.localStorage.setItem("e2e-logout-signal", "1");
    });

    // Block token refresh so the Supabase client can't silently restore the session.
    await authedPage.route("**/auth/v1/token*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Session expired" }),
      });
    });

    await authedPage.locator("#user-menu-trigger").click();
    await authedPage.waitForTimeout(1000); // Let dropdown animation complete and become stable
    await authedPage.getByRole("menuitem", { name: /sign out/i }).click();

    // Wait for the page to navigate back to "/" after the hard redirect in handleSignOut
    await authedPage.waitForURL("/", { timeout: 15_000 });
    // Give the React app time to boot and render the auth gate
    await authedPage.waitForLoadState("networkidle");

    await expect(authedPage.getByTestId("auth-form")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
