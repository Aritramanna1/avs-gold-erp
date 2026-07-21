import { test, expect } from "../fixtures/base";

/**
 * Priority 5 print stabilization — paper controls (orientation/margin) on
 * the global PrintPreviewModal. Uses the seeded invoice's real "Print
 * Invoice" button (billing.$id.tsx's triggerPrintInvoice -> triggerGlobalPrint),
 * the actual modal-opening trigger real usage goes through — distinct from
 * DocCommActions' "Print A4"/"Thermal" links, which intentionally navigate
 * to the full-page print route instead of opening this modal.
 */
test.describe("Print preview — paper controls", () => {
  test("orientation/margin selectors render and update the injected @page CSS", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/billing/${seedIds.invoiceId}`);
    await page.getByTestId("billing-print-invoice").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Archival (A4) is the default print mode for an invoice, so orientation
    // should be visible immediately. Margins are 4 per-side mm inputs (not a
    // single preset dropdown) — see PrintPreviewModal.tsx's "print-margin-*" testids.
    await expect(page.getByTestId("print-orientation-select")).toBeVisible();
    await expect(page.getByTestId("print-margin-inputs")).toBeVisible();

    const iframe = page.locator("iframe[title='MTJ ERP Print Frame']");
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    // Give the injected @page style a moment to land after iframe load.
    await page.waitForTimeout(500);
    const initialCss = await page
      .frameLocator("iframe[title='MTJ ERP Print Frame']")
      .locator("#mtj-print-preview-page-override")
      .innerHTML();
    expect(initialCss).toContain("@page");
    expect(initialCss).toContain("portrait");
    expect(initialCss).toContain("12mm"); // default margin

    // Switch to landscape + a wider margin on all 4 sides — the SAME
    // injected style element must update live, without reopening the preview.
    await page.getByTestId("print-orientation-select").click();
    await page.getByRole("option", { name: "Landscape" }).click();
    for (const side of ["top", "bottom", "left", "right"]) {
      await page.getByTestId(`print-margin-${side}`).fill("20");
    }
    await page.waitForTimeout(300);

    const updatedCss = await page
      .frameLocator("iframe[title='MTJ ERP Print Frame']")
      .locator("#mtj-print-preview-page-override")
      .innerHTML();
    expect(updatedCss).toContain("landscape");
    expect(updatedCss).toContain("20mm");
  });

  test("Close button dismisses the modal and the page stays interactive (no frozen dialog)", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/billing/${seedIds.invoiceId}`);
    await page.getByTestId("billing-print-invoice").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("iframe[title='MTJ ERP Print Frame']")).toBeVisible({
      timeout: 15_000,
    });

    // Two elements match the accessible name "Close": the footer button and
    // Radix Dialog's own top-right X (sr-only "Close" label) — .first() is
    // the footer button in DOM order.
    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(dialog).toBeHidden();

    // A stuck Radix focus-guard/scroll-lock (the classic cause of a "frozen"
    // page after a modal closes) leaves body non-interactive even though no
    // dialog is visible — clicking something behind it proves it isn't.
    await page.getByTestId("billing-print-settlement-slip").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  });

  test("legacy (non-migrated) print route opens in the modal without a blank preview", async ({
    authedPage: page,
    seedIds,
  }) => {
    // Payment Receipt (billing.receipt.$id.tsx) predates the Unified Print
    // Engine — plain JSX, no PrintEngine/PrintLayout — verifying it renders
    // real content through the SAME modal proves the legacy and new-engine
    // print paths both work through this one shared preview surface.
    await page.goto(`/billing/${seedIds.invoiceId}`);
    await page.getByTestId("billing-print-receipt").click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    const frame = page.frameLocator("iframe[title='MTJ ERP Print Frame']");
    await expect(frame.getByText("Payment Receipt")).toBeVisible({ timeout: 15_000 });
    await expect(frame.getByText(seedIds.invoiceNo).first()).toBeVisible();

    // Two elements match the accessible name "Close": the footer button and
    // Radix Dialog's own top-right X (sr-only "Close" label) — .first() is
    // the footer button in DOM order.
    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("switching preview documents while open replaces the iframe content, not a stuck/blank frame", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/billing/${seedIds.invoiceId}`);
    await page.getByTestId("billing-print-invoice").click();
    const frame = page.frameLocator("iframe[title='MTJ ERP Print Frame']");
    await expect(frame.locator('[data-testid="print-layout-root"]')).toBeVisible({
      timeout: 15_000,
    });
    // Two elements match the accessible name "Close": the footer button and
    // Radix Dialog's own top-right X (sr-only "Close" label) — .first() is
    // the footer button in DOM order.
    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByTestId("billing-print-settlement-slip").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await expect(frame.getByTestId("settlement-slip-doc")).toBeVisible({ timeout: 15_000 });
  });
});
