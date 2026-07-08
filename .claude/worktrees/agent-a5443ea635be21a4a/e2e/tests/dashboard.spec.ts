import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Dashboard", () => {
  test("loads after login with a heading and no console errors", async ({ authedPage }) => {
    await authedPage.goto("/");
    await expect(authedPage.locator("h1")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
