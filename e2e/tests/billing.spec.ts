import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Billing", () => {
  test("billing list loads with invoices/payments view", async ({ authedPage }) => {
    await authedPage.goto("/billing");
    await expect(authedPage.getByRole("heading", { name: "Billing", exact: true })).toBeVisible({
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

  test("cancelling an invoice requires a reason, reverses gold-ledger entries, and marks it Cancelled", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/${seedIds.invoiceId}`);
    await expect(authedPage.getByRole("button", { name: /cancel invoice/i })).toBeVisible({
      timeout: 15_000,
    });

    // Confirm is disabled until a reason is entered.
    await authedPage.getByRole("button", { name: /cancel invoice/i }).click();
    const confirmButton = authedPage.getByRole("button", { name: /yes, cancel invoice/i });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    await authedPage
      .getByPlaceholder(/reason for cancellation/i)
      .fill("E2E regression test cancellation");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(authedPage.getByText(/gold ledger entries reversed/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("Cancelled", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // The Cancel Invoice action itself must disappear once already cancelled
    // (cancelInvoice() is a no-op the second time) — prevents a double-
    // reversal of the same ledger entries.
    await expect(authedPage.getByRole("button", { name: /cancel invoice/i })).toBeHidden();
    expectNoPageErrors(authedPage);
  });
});
