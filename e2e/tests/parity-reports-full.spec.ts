/**
 * Full reports parity — every index route + book-print variants.
 * Real authenticated firm data only (E2E_LIVE_DATA + .env.e2e session).
 */
import { test, expect } from "../fixtures/base";
import {
  assertNoCrashBody,
  exerciseReportPrintExportOrPreview,
  gotoReportReady,
} from "../helpers/parity-live";

const REPORT_INDEX_ROUTES = [
  "/reports",
  "/reports/account-balance",
  "/reports/approvals",
  "/reports/audit-log",
  "/reports/auditor",
  "/reports/bank-transactions",
  "/reports/barcode-stock",
  "/reports/branch",
  "/reports/bullion-ledger",
  "/reports/cash-flow",
  "/reports/city-wise",
  "/reports/communication-analytics",
  "/reports/daily-close",
  "/reports/daily-gold-flow",
  "/reports/daily-summary",
  "/reports/dar-rojmel",
  "/reports/dealer",
  "/reports/deleted-bills",
  "/reports/delivery-summary",
  "/reports/dhadi-book",
  "/reports/erp-audit",
  "/reports/exceptions",
  "/reports/fine-margin",
  "/reports/fine-rojmel",
  "/reports/financial-statements",
  "/reports/gold-ledger",
  "/reports/gold-loss",
  "/reports/gold-outstanding",
  "/reports/gold-position",
  "/reports/gold-reconciliation",
  "/reports/gold-stock",
  "/reports/gold-summary",
  "/reports/gst-returns",
  "/reports/hsn-summary",
  "/reports/inventory-ageing",
  "/reports/item-jama-nave",
  "/reports/item-transaction",
  "/reports/itc04",
  "/reports/ledgers",
  "/reports/manufacturing",
  "/reports/manufacturing-reconciliation",
  "/reports/metal-position",
  "/reports/month-end-close",
  "/reports/outside-work",
  "/reports/purchase-register",
  "/reports/reconciliation-center",
  "/reports/reminders",
  "/reports/sales-register",
  "/reports/scheme",
  "/reports/settlement-reconciliation",
  "/reports/settlements",
  "/reports/stock-valuation",
  "/reports/tally-export",
  "/reports/tanch-hishob",
  "/reports/vault-reconciliation",
  "/reports/worker",
  "/reports/day-wise",
];

const BOOK_PRINT_ROUTES = [
  "/reports/book-print/fine_rojmel?from=2026-08-01&to=2026-08-31",
  "/reports/book-print/item_jama_nave?from=2026-08-01&to=2026-08-31&mode=item",
  "/reports/book-print/daily_jewellery_summary?from=2026-08-01&to=2026-08-31",
  "/reports/book-print/dhadi_book?from=2026-08-01&to=2026-08-31",
  "/reports/book-print/dar_rojmel?from=2026-08-01&to=2026-08-31",
  "/reports/book-print/barcode_stock",
];

test.describe("Reports full parity (5190)", () => {
  test.setTimeout(300_000);
  test.skip(() => process.env.E2E_LIVE_DATA !== "true", "Requires E2E_LIVE_DATA=true");

  for (const route of REPORT_INDEX_ROUTES) {
    test(`loads real data: ${route}`, async ({ authedPage }) => {
      const errors: string[] = [];
      authedPage.on("console", (msg) => {
        if (msg.type() === "error" && /57014|statement timeout/i.test(msg.text())) {
          errors.push(msg.text());
        }
      });
      await gotoReportReady(authedPage, route);
      const body = (await authedPage.locator("body").innerText()).trim();
      expect(body.length, `${route} blank`).toBeGreaterThan(50);
      await assertNoCrashBody(body, route);
      expect(errors, errors.join("\n")).toHaveLength(0);
    });
  }

  for (const route of REPORT_INDEX_ROUTES) {
    test(`print or export chain: ${route}`, async ({ authedPage }) => {
      await exerciseReportPrintExportOrPreview(authedPage, route);
    });
  }

  for (const route of BOOK_PRINT_ROUTES) {
    test(`book print preview + PDF: ${route}`, async ({ authedPage }) => {
      await authedPage.goto(route, { waitUntil: "domcontentloaded" });
      await authedPage.waitForTimeout(3_000);
      const body = await authedPage.locator("body").innerText();
      await assertNoCrashBody(body, route);
      const root = authedPage.getByTestId("print-layout-root");
      await expect(root).toBeVisible({ timeout: 45_000 });
      const pdfBtn = authedPage.getByRole("button", { name: /download pdf/i });
      await expect(pdfBtn).toBeVisible({ timeout: 15_000 });
      const [download] = await Promise.all([
        authedPage.waitForEvent("download", { timeout: 90_000 }),
        pdfBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });
  }
});
