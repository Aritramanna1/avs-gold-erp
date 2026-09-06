import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Customer portal security boundaries", () => {
  test("company user cannot open the customer portal directly", async ({ authedPage }) => {
    await authedPage.goto("/customer-portal");
    await expect(authedPage).not.toHaveURL(/\/customer-portal(?:$|\?)/, { timeout: 10_000 });
    expectNoPageErrors(authedPage);
  });

  test.describe("Anonymous access", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("customer portal route is not rendered as a public anonymous page", async ({ page }) => {
      await page.goto("/customer-portal");
      await expect(page.getByText(/welcome,/i)).toHaveCount(0);
      await expect(page.getByTestId("auth-form")).toBeVisible({ timeout: 10_000 });
      expectNoPageErrors(page);
    });
  });
});

