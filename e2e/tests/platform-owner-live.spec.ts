import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Platform Owner control center", () => {
  test("redirects to the isolated platform application", async ({ authedPage }) => {
    await authedPage.goto("/");
    await expect(authedPage).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
    await expect(authedPage.getByText("AVS PLATFORM", { exact: false }).first()).toBeVisible();
    await expect(authedPage.getByRole("button", { name: /sign out/i }).first()).toBeVisible();
    await expect(authedPage.getByText("Orders", { exact: true })).toHaveCount(0);
    await expect(authedPage.getByText("Gold Book", { exact: true })).toHaveCount(0);
    expectNoPageErrors(authedPage);
  });

  test("platform navigation stays inside control-plane views", async ({ authedPage }) => {
    await authedPage.goto("/platform");
    for (const view of ["firms", "tickets", "billing", "settings"]) {
      await authedPage.goto(`/platform?view=${view}`);
      await expect(authedPage).toHaveURL(new RegExp(`/platform\\?view=${view}`));
      await expect(authedPage.getByText("Page not found", { exact: false })).toHaveCount(0);
    }
    expectNoPageErrors(authedPage);
  });

  test("sign out is available and returns to authentication", async ({ authedPage }) => {
    await authedPage.goto("/platform");
    await authedPage
      .getByRole("button", { name: /sign out/i })
      .first()
      .click();
    await expect(authedPage.getByTestId("auth-form")).toBeVisible({ timeout: 20_000 });
  });
});
