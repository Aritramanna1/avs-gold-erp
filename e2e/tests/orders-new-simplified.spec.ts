import { test, expect } from "../fixtures/base";

test.describe("Simplified Create Production Order", () => {
  test("creates a real order in under the required fields, with gold received posting to the ledger", async ({
    authedPage: page,
  }) => {
    await page.goto("/orders/new");
    await expect(page.getByText("Product Type *")).toBeVisible();

    // Customer
    await page.locator('[data-testid="order-customer-select"]').first().click();

    // Product
    await page.locator('[data-testid="order-type-select"]').click();
    await page.getByRole("option", { name: "Custom Manufacturing" }).click();
    await page.getByRole("combobox").filter({ hasText: "Select…" }).first().click();
    await page.getByRole("option", { name: "Ring", exact: true }).click();
    await page.getByPlaceholder("e.g. Bridal necklace with temple motif").fill("E2E test ring");

    // Gold
    await page.getByPlaceholder("10.000").fill("5");
    await page.getByPlaceholder("916").fill("916");
    await page.getByPlaceholder(/leave blank if none received yet/).fill("2");

    await expect(page.getByText(/Fine gold equivalent/)).toBeVisible();
    await expect(page.getByText(/Fine gold received/)).toBeVisible();

    const submitBtn = page.getByTestId("order-create-submit");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page).toHaveURL(/\/orders\/[a-zA-Z0-9_-]+$/, { timeout: 15_000 });
    await expect(page.getByText(/E2E test ring/)).toBeVisible({ timeout: 10_000 });
  });

  test("Esc returns to the orders list", async ({ authedPage: page }) => {
    await page.goto("/orders/new");
    await expect(page.getByText("Product Type *")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/orders$/, { timeout: 10_000 });
  });
});
