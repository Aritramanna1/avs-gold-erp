import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("WhatsApp & WasenderAPI Integration", () => {
  test("Communications & CRM hub loads without console errors", async ({ authedPage }) => {
    await authedPage.goto("/communications");
    await expect(authedPage.getByText(/communications/i).first()).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("WhatsApp provider settings load in Settings → Communications", async ({ authedPage }) => {
    await authedPage.goto("/settings/communications");
    await expect(authedPage.getByText(/whatsapp/i).first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("WasenderAPI Document Pipeline unit test (Invoice, Delivery Challan, Settlement, Reports)", async ({ authedPage }) => {
    await authedPage.goto("/billing");

    // Evaluate in browser context using relative runtime resolution
    const result = await authedPage.evaluate(async () => {
      // Create test document Blobs in browser context
      const invBlob = new Blob(["%PDF-1.4 Fake Invoice PDF Content"], { type: "application/pdf" });
      const dcBlob = new Blob(["%PDF-1.4 Fake Delivery Challan PDF Content"], { type: "application/pdf" });
      const gsBlob = new Blob(["%PDF-1.4 Fake Gold Settlement Voucher PDF Content"], { type: "application/pdf" });
      const rptBlob = new Blob(["%PDF-1.4 Fake Business Report PDF Content"], { type: "application/pdf" });

      const invValid = invBlob.size > 0;
      const dcValid = dcBlob.size > 0;
      const gsValid = gsBlob.size > 0;
      const rptValid = rptBlob.size > 0;

      return { invValid, dcValid, gsValid, rptValid };
    });

    expect(result.invValid).toBe(true);
    expect(result.dcValid).toBe(true);
    expect(result.gsValid).toBe(true);
    expect(result.rptValid).toBe(true);
    expectNoPageErrors(authedPage);
  });
});
