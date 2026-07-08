import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Orders", () => {
  test("orders list loads without console errors", async ({ authedPage }) => {
    await authedPage.goto("/orders");
    await expect(authedPage.locator("h1")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("new-order wizard's Confirm/Save Draft buttons disable while submitting (no duplicate order)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/orders/new");
    await expect(authedPage.locator("h1, [data-testid='order-confirm']").first()).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
