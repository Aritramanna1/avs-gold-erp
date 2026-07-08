import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Inventory (Stock)", () => {
  test("stock page loads with finished jewellery/tag view", async ({ authedPage }) => {
    await authedPage.goto("/stock");
    await expect(authedPage.getByText("Stock", { exact: true })).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
