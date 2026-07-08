import { test, expect } from "../fixtures/base";

test.describe("Manufacturing Mode Barcode & Tagging", () => {
  test("barcode cannot be generated before Worker Return + Polishing complete, then generates correctly, updates the Vault + Timeline, and is scannable", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/orders/${seedIds.orderId}`);
    await expect(page.getByTestId("manufacturing-barcode-panel")).toBeVisible({ timeout: 15_000 });

    // Before any issue/return/polishing: generation must be blocked.
    await expect(page.getByTestId("barcode-ineligible-reason")).toBeVisible();
    await expect(page.getByTestId("barcode-generate-button")).toBeDisabled();

    // Complete Gold Issue
    await page.getByTestId("order-issue-gold-material").click();
    await page.getByTestId("issue-worker-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("issue-weight-input").fill("5");
    await page.getByTestId("issue-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Still ineligible — no return yet
    await expect(page.getByTestId("barcode-generate-button")).toBeDisabled();

    // Complete Worker Return (full amount issued, so pending = 0). The Issue
    // dialog defaults to 916 purity — explicitly match it here rather than
    // relying on the Return dialog's default (the seeded order's own item
    // purity, which may differ), so issued and returned fine-gold net to
    // exactly zero.
    await page.getByTestId("order-receive-from-worker").click();
    await expect(page.getByTestId("return-worker-select")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("return-worker-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("return-material-select").click();
    await page.getByRole("option", { name: "Finished Product" }).click();
    await page.getByTestId("return-purity-select").click();
    await page.getByRole("option", { name: "916 · 22K" }).click();
    await page.getByTestId("return-weight-input").fill("5");
    await page.getByTestId("return-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Worker Return complete but Polishing not done — still blocked (default config requires polishing)
    await expect(page.getByTestId("barcode-generate-button")).toBeDisabled();
    await expect(page.getByTestId("barcode-ineligible-reason")).toContainText(/[Pp]olishing/);

    // Complete Polishing: Send then Receive
    await page.getByTestId("order-send-polishing").click();
    await page.getByTestId("polishing-send-polisher-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("polishing-send-product-input").fill("E2E barcode test item");
    await page.getByTestId("polishing-send-weight-input").fill("5");
    await page.getByTestId("polishing-send-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    await page.getByTestId("order-receive-polishing").click();
    await page.getByTestId("polishing-receive-polisher-select").click();
    await page.getByRole("option").first().click();
    await page
      .getByTestId("polishing-receive-product-input")
      .fill("E2E barcode test item, polished");
    await page.getByTestId("polishing-receive-weight-input").fill("4.98");
    await page.getByTestId("polishing-receive-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Now eligible — generate the barcode
    await expect(page.getByTestId("barcode-generate-button")).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId("barcode-product-description").fill("E2E finished bangle");
    await page.getByTestId("barcode-generate-button").click();

    await expect(page.getByTestId("barcode-status-badge")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("barcode-status-badge")).toHaveText("Created");

    const barcodeNumber = await page.getByTestId("barcode-number-value").textContent();
    expect(barcodeNumber?.trim().length).toBeGreaterThan(0);

    // Cannot generate a second barcode for the same order (permanent identity, no duplicates)
    await expect(page.getByTestId("barcode-generate-button")).not.toBeVisible();

    // Timeline shows the Barcode Generated entry
    await expect(page.getByText("Barcode Generated", { exact: true }).first()).toBeVisible();

    // Gold Ledger gained exactly one finished_item_created entry referencing
    // this barcode — query Supabase directly rather than through a fresh
    // dynamic-import store instance, which starts empty and was never
    // populated by this evaluate() call.
    const matchingEntryCount: number = await page.evaluate(async (bn) => {
      const supabaseMod = await import(/* @vite-ignore */ "/src/integrations/supabase/client.ts");
      const { data } = await supabaseMod.supabase
        .from("gold_ledger")
        .select("data")
        .eq("data->>type", "finished_item_created")
        .eq("data->>reference", bn);
      return (data ?? []).length;
    }, barcodeNumber);
    expect(matchingEntryCount).toBe(1);

    // Status can advance forward (Ready for Tag)
    await page.getByTestId("barcode-advance-ready_for_tag").click();
    await expect(page.getByTestId("barcode-status-badge")).toHaveText("Ready for Tag", {
      timeout: 10_000,
    });

    // Print Tag — jewellery tag / barcode label / QR label variants + print history
    await page.getByTestId("barcode-print-tag").click();
    await expect(page.getByTestId("tag-variant-barcode_label")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("tag-variant-barcode_label").click();
    await page.getByTestId("tag-print-copies").fill("2");

    let printTriggered = false;
    await page.exposeFunction("__e2ePrintCalled", () => {
      printTriggered = true;
    });
    await page.evaluate(() => {
      window.print = () => (window as any).__e2ePrintCalled();
    });
    await page.getByTestId("tag-print-submit").click();
    await page.waitForTimeout(300);
    expect(printTriggered).toBe(true);

    // Scanner: look the barcode up and jump to the order
    if (barcodeNumber) {
      await page.goto("/workshop/barcode-scanner");
      const input = page.getByPlaceholder(/Scan barcode/i);
      await input.fill(barcodeNumber.trim());
      await input.press("Enter");
      await expect(page.getByTestId("scanner-result")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("scanner-open-order")).toBeVisible();
    }
  });
});
