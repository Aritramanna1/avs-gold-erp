import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Logout", () => {
  test("signing out from the user menu returns to the login form", async ({ authedPage }) => {
    await authedPage.goto("/");
    await authedPage.locator("#user-menu-trigger").click();
    await authedPage.getByRole("menuitem", { name: /sign out/i }).click();

    await expect(authedPage.getByTestId("auth-form")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
