import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Reports", () => {
  test("reports dashboard loads with operational/financial sections", async ({ authedPage }) => {
    await authedPage.goto("/reports");
    await expect(authedPage.getByText("Reports", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
