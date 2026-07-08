import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Melt Account", () => {
  test("melt account page loads with gold operations view", async ({ authedPage }) => {
    await authedPage.goto("/melt");
    await expect(authedPage.getByText("Melt Account", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
