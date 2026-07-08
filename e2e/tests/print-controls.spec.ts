import { test, expect } from "../fixtures/base";

/**
 * Priority 5 print stabilization — paper controls (orientation/margin) on
 * the global PrintPreviewModal. Uses the seeded invoice's real print link
 * rather than a synthetic route, so this exercises the actual click ->
 * global-link-interceptor -> modal-open path real usage goes through.
 */
test.describe("Print preview — paper controls", () => {
  test("orientation/margin selectors render and update the injected @page CSS", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/billing/${seedIds.invoiceId}`);
    await page.getByRole("link", { name: /print/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Archival (A4) is the default print mode for an invoice, so orientation
    // should be visible immediately.
    await expect(page.getByTestId("print-orientation-select")).toBeVisible();
    await expect(page.getByTestId("print-margin-select")).toBeVisible();

    const iframe = page.locator("iframe[title='MTJ ERP Print Frame']");
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    // Give the injected @page style a moment to land after iframe load.
    await page.waitForTimeout(500);
    const initialCss = await page
      .frameLocator("iframe[title='MTJ ERP Print Frame']")
      .locator("#mtj-print-preview-injected-style")
      .innerHTML();
    expect(initialCss).toContain("@page");
    expect(initialCss).toContain("portrait");
    expect(initialCss).toContain("12mm"); // default margin

    // Switch to landscape + wide margin — the SAME injected style element
    // must update live, without needing to reopen the preview.
    await page.getByTestId("print-orientation-select").click();
    await page.getByRole("option", { name: "Landscape" }).click();
    await page.getByTestId("print-margin-select").click();
    await page.getByRole("option", { name: /Wide/i }).click();
    await page.waitForTimeout(300);

    const updatedCss = await page
      .frameLocator("iframe[title='MTJ ERP Print Frame']")
      .locator("#mtj-print-preview-injected-style")
      .innerHTML();
    expect(updatedCss).toContain("landscape");
    expect(updatedCss).toContain("20mm");
  });
});
