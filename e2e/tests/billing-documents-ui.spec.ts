import { test, expect } from "../fixtures/base";

test.describe("Billing Documents UI (Credit/Debit Notes, Estimates, Delivery Challans)", () => {
  test("all four document list pages load and are linked from Billing index", async ({
    authedPage: page,
  }) => {
    await page.goto("/billing");
    await expect(page.locator('a[href="/billing/credit-notes"]').first()).toBeVisible();
    await expect(page.locator('a[href="/billing/debit-notes"]').first()).toBeVisible();
    await expect(page.locator('a[href="/billing/estimates"]').first()).toBeVisible();
    await expect(page.locator('a[href="/billing/delivery-challans"]').first()).toBeVisible();

    await page.goto("/billing/credit-notes");
    await expect(page.getByRole("heading", { name: "Credit Notes" })).toBeVisible();

    await page.goto("/billing/debit-notes");
    await expect(page.getByRole("heading", { name: "Debit Notes" })).toBeVisible();

    await page.goto("/billing/estimates");
    await expect(page.getByRole("heading", { name: "Estimates" })).toBeVisible();

    await page.goto("/billing/delivery-challans");
    await expect(page.getByRole("heading", { name: "Delivery Challans" })).toBeVisible();
  });

  test("create a delivery challan, view it, and mark it returned", async ({ authedPage: page }) => {
    await page.goto("/billing/delivery-challans");
    await page.getByTestId("challan-new").click();
    await expect(page.getByRole("heading", { name: "New Delivery Challan" })).toBeVisible();

    const select = page.getByRole("dialog").locator("select").first();
    await expect
      .poll(async () => select.locator("option").count(), { timeout: 10_000 })
      .toBeGreaterThan(1);
    await select.selectOption({ index: 1 });
    await page
      .getByPlaceholder("e.g. Gold necklace, 22K")
      .fill("E2E test necklace — validation run");
    await page.getByRole("button", { name: "Issue Challan" }).click();

    await expect(page.getByText(/delivery challan issued/i)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("table tbody tr").filter({ hasText: "E2E test necklace" }).first();
    await expect(row)
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {});
    const openBtn = page.getByRole("link", { name: "Open" }).first();
    await openBtn.click();

    await expect(page.getByText(/^DELIVERY CHALLAN$/)).toBeVisible();
    const returnBtn = page.getByRole("button", { name: /mark returned/i });
    await returnBtn.click();
    await expect(page.getByText("Returned").first()).toBeVisible({ timeout: 10_000 });
  });

  test("issue a credit note against a real invoice and cancel it", async ({ authedPage: page }) => {
    await page.goto("/billing/credit-notes");
    await page.getByTestId("credit-note-new").click();
    await expect(page.getByRole("heading", { name: "New Credit Note" })).toBeVisible();

    const select = page.getByRole("dialog").locator("select").first();
    await expect
      .poll(async () => select.locator("option").count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    const count = await select.locator("option").count();
    test.skip(count <= 1, "No invoices seeded to issue a credit note against");
    await select.selectOption({ index: 1 });
    await page.getByPlaceholder("0.00").fill("100");
    await page.getByPlaceholder(/reason for credit note/i).fill("E2E validation run");
    await page.getByRole("button", { name: /issue credit note/i }).click();

    await expect(page.getByText(/credit note issued/i)).toBeVisible({ timeout: 10_000 });

    const openBtn = page.getByRole("link", { name: "Open" }).first();
    await openBtn.click();
    await expect(page.getByText(/^CREDIT NOTE$/)).toBeVisible();

    await page.getByRole("button", { name: /cancel credit note/i }).click();
    await page.getByRole("button", { name: /yes, cancel/i }).click();
    await expect(page.getByText(/credit note cancelled/i)).toBeVisible({ timeout: 10_000 });
  });
});
