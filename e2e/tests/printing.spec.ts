import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Printing (A4 / Thermal / PDF)", () => {
  test("billing print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/print/does-not-exist");
    await expect(authedPage.getByRole("heading", { name: /invoice loading failure/i })).toBeVisible(
      { timeout: 15_000 },
    );
    expectNoPageErrors(authedPage);
  });

  test("people print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/people/print/does-not-exist");
    await expect(authedPage.getByText(/record not found|not found/i)).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("print routes render outside the ERP shell (no sidebar/nav chrome leaking into output)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/people/print/does-not-exist");
    // The app shell's sidebar/header must not be present on a print route.
    await expect(authedPage.locator("#user-menu-trigger")).toHaveCount(0);
  });
});

test.describe("Unified Print Engine — Credit Note (Phase 1 migration)", () => {
  test("credit note print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/credit-note-print/does-not-exist");
    await expect(authedPage.getByText(/credit note not found/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("renders real dynamic data, branding, and status through the new engine", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/credit-note-print/${seedIds.creditNoteId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");

    // Dynamic data from the seeded record, resolved via the new
    // data-mapper (data-mapper.ts's credit_note builder) rather than the
    // legacy route's inline JSX.
    await expect(root.getByText(seedIds.invoiceNo)).toBeVisible();
    await expect(root.getByText(/issued/i)).toBeVisible();
    await expect(root.getByText(/price adjustment agreed with customer/i)).toBeVisible();

    // Company/branch branding — PrintLayout's own header, unchanged.
    await expect(root.getByText(/credit note/i)).toBeVisible();

    // QR — PrintLayout's default header QR, since the seeded template
    // doesn't override it (default-templates.ts's credit_note template
    // intentionally has no "qr"/showQr override).
    await expect(root.getByAltText("Verification QR")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file via the consolidated generateDocumentPdf pipeline", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/credit-note-print/${seedIds.creditNoteId}`);
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/credit_note.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test("reprint is audited — second visit shows the Reprint Required banner", async ({
    authedPage,
    seedIds,
  }) => {
    // First visit auto-records the print event (usePrintRecord's mount
    // effect) — reused unchanged from the legacy route via PrintEngine.
    await authedPage.goto(`/billing/credit-note-print/${seedIds.creditNoteId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });

    // A second, fresh navigation to the same document is a reprint.
    await authedPage.goto(`/billing/credit-note-print/${seedIds.creditNoteId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
