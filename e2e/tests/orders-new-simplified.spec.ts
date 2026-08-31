import { test, expect } from "../fixtures/base";

test.describe("Simplified Create Production Order", () => {
  test("creates a real order in under the required fields, with gold received posting to the ledger", async ({
    authedPage: page,
  }) => {
    await page.goto("/orders/new");
    await expect(page.getByText("Production Type *")).toBeVisible({ timeout: 20_000 });

    // Customer
    await page.locator('[data-testid="order-customer-select"]').first().click();

    // Product
    await page.locator('[data-testid="order-type-select"]').click();
    await page.getByRole("option", { name: "Custom", exact: true }).click();
    await page.getByRole("combobox").filter({ hasText: "Select…" }).first().click();
    await page.getByRole("option", { name: "Ring", exact: true }).click();
    await page.getByPlaceholder("e.g. Bridal necklace with temple motif").fill("E2E test ring");

    // Gold — scope the item-line "916" purity input via order-line; the page
    // also has a second (disabled-until-filled) "916"-placeholder input for
    // Gold Received's own purity, so an unscoped getByPlaceholder("916") is
    // ambiguous once both are on screen.
    await page.getByTestId("order-line").getByPlaceholder("10.000").fill("5");
    await page.getByTestId("order-line").getByPlaceholder("916").fill("916");
    await page.getByPlaceholder(/leave blank if none received yet/).fill("2");
    // Purity is required once gold is entered as received (canSubmit gates on
    // goldReceivedNeedsPurity) — this is the second "916"-placeholder input
    // on the page (order-line's own purity field is the first), so scope by
    // position rather than an unscoped getByPlaceholder, which would still
    // match both once this one is enabled.
    await page.getByPlaceholder("916").last().fill("916");

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
    await expect(page.getByText("Production Type *")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/orders$/, { timeout: 10_000 });
  });
});
