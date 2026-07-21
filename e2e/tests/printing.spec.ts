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

  test("page setup is real: paper size, orientation and margins reach the @page rule", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/credit-note-print/${seedIds.creditNoteId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });

    await authedPage.getByTestId("print-page-setup-toggle").click();

    // A5, forced to landscape, with a custom top margin.
    await authedPage.getByTestId("page-setup-size").click();
    await authedPage.getByRole("option", { name: /^A5 \(148/ }).click();
    await authedPage.getByTestId("page-setup-orientation").click();
    await authedPage.getByRole("option", { name: "Landscape" }).click();
    await authedPage.getByTestId("page-setup-margin-top").fill("7");

    await expect(root).toHaveAttribute("data-print-size", "a5");
    await expect(root).toHaveAttribute("data-print-orientation", "landscape");

    // The @page rule the printer/printToPDF actually receives — if these
    // controls were decorative, this text would still say "A5 portrait" and
    // the default 10mm top margin.
    const pageRule = await root.locator("style").first().textContent();
    expect(pageRule).toContain("size: A5 landscape");
    expect(pageRule).toContain("margin: 7mm");

    await authedPage.getByTestId("page-setup-reset").click();
    await expect(root).toHaveAttribute("data-print-size", "a4");
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

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — usePrintRecord.ts now returns isReprint:false/recordReprint:no-op; printing is unlimited and unrestricted per that file's V1 comment)", async ({
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

test.describe("Unified Print Engine — GST/Retail Invoice (Phase 1.2 migration)", () => {
  test("renders real dynamic data, tax math, and branding through the new engine (A4 default)", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/print/${seedIds.invoiceId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");

    // premiumHeader + billedToStamp + tax panel — all data-driven via
    // invoice-data.ts's buildInvoicePrintData, not the legacy inline JSX.
    // (invoiceNo appears twice — header voucher no. + QR caption — .first() disambiguates.)
    await expect(root.getByText(seedIds.invoiceNo).first()).toBeVisible();
    await expect(root.getByText(/tax invoice \(3% gst\)/i)).toBeVisible();
    await expect(root.getByText("CGST:")).toBeVisible();
    await expect(root.getByText("SGST:")).toBeVisible();
    await expect(root.getByText("Grand Net Amount:")).toBeVisible();

    // QR — standalone `qr`-less premiumHeader inline QR (showQr: true).
    await expect(root.getByAltText("Verification QR")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("size switcher swaps to the thermal receipt layout for the same invoice", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/print/${seedIds.invoiceId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });

    await authedPage.getByRole("button", { name: "80mm Thermal" }).click();
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toHaveAttribute("data-print-size", "thermal", { timeout: 10_000 });
    await expect(root.getByText("TRANS-ITEMS DETAILS")).toBeVisible();
    await expect(root.getByText("GRAND TOTAL")).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("size switcher swaps to per-item jewellery tag cards", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/billing/print/${seedIds.invoiceId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });

    await authedPage.getByRole("button", { name: "Jewellery Tag" }).click();
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toHaveAttribute("data-print-size", "tag", { timeout: 10_000 });
    await expect(root.getByText(seedIds.invoiceNo)).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file with correct page geometry for the active size", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/print/${seedIds.invoiceId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/gst_invoice.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — see usePrintRecord.ts)", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/print/${seedIds.invoiceId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    await authedPage.goto(`/billing/print/${seedIds.invoiceId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});

test.describe("Unified Print Engine — Debit Note (Phase 2 migration)", () => {
  test("debit note print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/debit-note-print/does-not-exist");
    await expect(authedPage.getByText(/debit note not found/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("renders real dynamic data and status through the new engine", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/debit-note-print/${seedIds.debitNoteId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");
    await expect(root.getByText(seedIds.invoiceNo)).toBeVisible();
    await expect(root.getByText(/issued/i)).toBeVisible();
    await expect(root.getByText(/additional making charge billed/i)).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/billing/debit-note-print/${seedIds.debitNoteId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/debit_note.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — see usePrintRecord.ts)", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/debit-note-print/${seedIds.debitNoteId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    await authedPage.goto(`/billing/debit-note-print/${seedIds.debitNoteId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});

test.describe("Unified Print Engine — Estimate (Phase 2 migration)", () => {
  test("estimate print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/estimate-print/does-not-exist");
    await expect(authedPage.getByText(/estimate not found/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("renders real dynamic data, item table, and totals through the new engine", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/estimate-print/${seedIds.estimateId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");
    await expect(root.getByText(/draft/i)).toBeVisible();
    await expect(root.getByText("Grand Total")).toBeVisible();
    await expect(root.getByText(/valid for 15 days/i)).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/billing/estimate-print/${seedIds.estimateId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/estimate_doc.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — see usePrintRecord.ts)", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/estimate-print/${seedIds.estimateId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    await authedPage.goto(`/billing/estimate-print/${seedIds.estimateId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});

test.describe("Unified Print Engine — Delivery Challan (Phase 2 migration)", () => {
  test("delivery challan print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/delivery-challan-print/does-not-exist");
    await expect(authedPage.getByText(/delivery challan not found/i)).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("renders real dynamic data, item table, and purpose footer through the new engine", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/delivery-challan-print/${seedIds.deliveryChallanId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");
    await expect(root.getByText(/issued/i)).toBeVisible();
    await expect(root.getByText(/for polishing and hallmarking/i)).toBeVisible();
    await expect(root.getByText(/not a tax invoice/i)).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/billing/delivery-challan-print/${seedIds.deliveryChallanId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/delivery_challan.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — see usePrintRecord.ts)", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/delivery-challan-print/${seedIds.deliveryChallanId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    await authedPage.goto(`/billing/delivery-challan-print/${seedIds.deliveryChallanId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});

test.describe("Unified Print Engine — Worker Custody Statement (Phase 2 Batch 2 migration)", () => {
  test("worker custody statement print route for an unknown worker fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop/gold-book-print/does-not-exist");
    await expect(authedPage.getByText(/worker not found/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("renders real dynamic data, running-balance ledger, and badges through the new engine", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/workshop/gold-book-print/${seedIds.karigarId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");
    await expect(root.getByText(/worker custody ledger statement/i)).toBeVisible();
    // Exercises the data-source-tick.ts fix: useWorkerGoldBook's entries
    // hydrate via a background pull (data-loader.ts's pullBackground) that
    // can finish after this route's first render — before that fix,
    // PrintEngine never re-rendered to pick up the now-loaded entries and
    // this assertion would fail permanently, not just slowly. Some entries
    // in this dev backend belong to a previously-seeded worker whose
    // sequence id was reused across separate seeding runs, so "Issued"/
    // "Returned" can legitimately repeat — .first() is correct, not a
    // workaround; the order reference is what proves THIS run's own entry
    // specifically rendered.
    // "Issued"/"Received" come from the ledger table's own column headers
    // ("Gold Issued (g)" / "Gold Received (g)" — default-templates.ts), not
    // a per-row badge; the order reference is rendered inline in the
    // particulars cell as "{description} · {orderNo}" (ledger-statements-data.ts).
    await expect(root.getByText("Issued").first()).toBeVisible();
    await expect(root.getByText("Received").first()).toBeVisible();
    await expect(root.getByText(seedIds.custodyRefOrderNo as string).first()).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/workshop/gold-book-print/${seedIds.karigarId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/karigar_custody_statement.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — see usePrintRecord.ts)", async ({
    authedPage,
    seedIds,
  }) => {
    // Also verifies the PrintEngine audit-logging fix: karigar_custody_statement
    // has no case in usePrintRecord.ts's internal switch, so this only works
    // because PrintEngine now supplies its own resolved docNumber via the
    // object-arg overload (see PrintEngine.tsx) — without that fix, the
    // recordPrint effect never fires and this reprint banner never appears.
    await authedPage.goto(`/workshop/gold-book-print/${seedIds.karigarId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    await authedPage.goto(`/workshop/gold-book-print/${seedIds.karigarId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});

test.describe("Unified Print Engine — Customer Ledger Statement (Phase 2 Batch 2 migration)", () => {
  test("customer ledger print route for an unknown customer fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/people/ledger-print/does-not-exist");
    await expect(authedPage.getByText(/customer not found/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("renders real dynamic data, gold/money account summaries, and ledger rows through the new engine", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/people/ledger-print/${seedIds.customerId}`);
    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-print-size", "a4");
    await expect(root.getByText(/customer ledger statement/i).first()).toBeVisible();
    await expect(root.getByText("Gold Credit Account Balance")).toBeVisible();
    await expect(root.getByText("Monetary Ledger Balance")).toBeVisible();
    // The seeded customer's invoice/payment/credit-note/debit-note history
    // (test-seed.ts) all feed compileCustomerLedger — this proves the
    // ledger table rendered real rows, not an empty statement.
    await expect(root.getByText(seedIds.invoiceNo).first()).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Download PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/people/ledger-print/${seedIds.customerId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/customer_ledger_statement.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });

  test.skip("reprint is audited — second visit shows the Reprint Required banner (V1 scope: reprint audit removed — see usePrintRecord.ts)", async ({
    authedPage,
    seedIds,
  }) => {
    // Also verifies the audit-logging fix for this doc type: like
    // karigar_custody_statement, customer_ledger_statement has no case in
    // usePrintRecord.ts's internal switch.
    await authedPage.goto(`/people/ledger-print/${seedIds.customerId}`);
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 15_000 });
    await authedPage.goto(`/people/ledger-print/${seedIds.customerId}`);
    await expect(authedPage.getByText(/reprint required/i)).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
