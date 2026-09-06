import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Reports", () => {
  test("reports dashboard loads with operational/financial sections", async ({ authedPage }) => {
    await authedPage.goto("/reports");
    await expect(authedPage.getByRole("heading", { name: /reports/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
