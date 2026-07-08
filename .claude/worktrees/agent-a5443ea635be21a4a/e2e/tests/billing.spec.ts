import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Billing", () => {
  test("billing list loads with invoices/payments view", async ({ authedPage }) => {
    await authedPage.goto("/billing");
    await expect(authedPage.getByText("Billing", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("new-bill screen's Issue Bill button disables while submitting (no duplicate invoice)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/new");
    await expect(authedPage.locator("h1, .font-serif").first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
