import { test, expect } from "../fixtures/base";

test.describe("Global search (command palette records)", () => {
  test("typing a seeded invoice number surfaces a record result and navigates on select", async ({
    authedPage: page,
    seedIds,
  }) => {
    // Visit /billing first so useBilling's invoices are actually loaded
    // into memory — global search reads live client-side store state, not
    // a separate index, so the relevant store must have fetched its data
    // at least once already (exactly how a real user would have gotten
    // there: by having used the app, not searching cold on first paint).
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Control+f");
    await expect(page.locator("[cmdk-input]")).toBeVisible();

    // Search by a distinctive fragment of the seeded invoice number.
    const fragment = seedIds.invoiceNo.slice(-6);
    await page.locator("[cmdk-input]").fill(fragment);
    await page.waitForTimeout(300);

    await expect(page.getByText("Records", { exact: true })).toBeVisible();
    const resultItem = page.locator("[cmdk-item]", { hasText: seedIds.invoiceNo });
    await expect(resultItem).toBeVisible();

    await resultItem.click();
    await page.waitForURL(new RegExp(seedIds.invoiceId), { timeout: 5000 });
    await expect(page.locator("[cmdk-input]")).not.toBeVisible();
  });

  test("an empty query shows no record results, only modules", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+f");
    await expect(page.locator("[cmdk-input]")).toBeVisible();
    await expect(page.getByText("Records", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Modules", { exact: true })).toBeVisible();
  });
});
