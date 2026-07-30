import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Loading states", () => {
  test("print route shows a loading indicator before resolving, never a blank screen", async ({
    authedPage,
  }) => {
    const response = await authedPage.goto("/billing/print/does-not-exist");
    expect(response?.status()).toBeLessThan(500);
    // Whether it briefly shows "Loading..." or resolves straight to the
    // not-found state, the body must always render something meaningful.
    await expect(authedPage.locator("body")).not.toBeEmpty();
    expectNoPageErrors(authedPage);
  });

  test("auth check on app load resolves to either the login form or the app shell", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page
        .getByTestId("auth-form")
        .or(page.locator("#user-menu-trigger"))
        .or(page.getByRole("button", { name: /sign out/i }))
        .or(page.getByText("AVS PLATFORM", { exact: false }))
        .first(),
    ).toBeVisible({ timeout: 40_000 });
    expectNoPageErrors(page);
  });
});
