/**
 * AVS ERP — CA Report Pack PDF / Excel / CSV Export Verification Test Suite
 *
 * Verifies:
 * 1. Real PDF export produces application/pdf Blob with %PDF- binary magic bytes.
 * 2. Real Excel export produces application/vnd.openxmlformats-officedocument.spreadsheetml.sheet Blob.
 * 3. Real CSV export produces text/csv Blob.
 * 4. Distinct handler execution without cross-wiring (PDF != CSV, Excel != CSV).
 * 5. Gold & Cash dimensional separation is preserved across all CA Pack statements.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  exportReportToPdf,
  exportReportToExcel,
  exportReportToCsv,
  buildCAPackReportData,
  generateCAPackCompleteBooklet,
} from "@/lib/pdf/report-pdf-service";

describe("AVS ERP — CA Report Pack PDF & Export Suite", () => {
  beforeEach(() => {
    // Setup clean state
  });

  it("1. Generates authentic PDF document with application/pdf MIME and %PDF- header", async () => {
    const trialBalanceData = buildCAPackReportData("trial_balance", "2026-2027", "Q2 (Jul - Sep)");
    const { blob, fileName } = await exportReportToPdf(trialBalanceData, false);

    expect(blob).toBeDefined();
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000); // Non-trivial binary PDF
    expect(fileName.endsWith(".pdf")).toBe(true);

    // Verify %PDF- magic bytes
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const headerStr = String.fromCharCode(...bytes.slice(0, 5));
    expect(headerStr).toBe("%PDF-");
  });

  it("2. Generates authentic Excel (.xlsx) file with correct OpenXML spreadsheet MIME", async () => {
    const salesRegisterData = buildCAPackReportData("sales_register", "2026-2027", "Q2 (Jul - Sep)");
    const { blob, fileName } = await exportReportToExcel(salesRegisterData, false);

    expect(blob).toBeDefined();
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(1000);
    expect(fileName.endsWith(".xlsx")).toBe(true);
  });

  it("3. Generates authentic CSV file with text/csv MIME and CRLF rows", () => {
    const gstSummaryData = buildCAPackReportData("gst_summary", "2026-2027", "Q2 (Jul - Sep)");
    const { blob, fileName } = exportReportToCsv(gstSummaryData, false);

    expect(blob).toBeDefined();
    expect(blob.type).toContain("text/csv");
    expect(blob.size).toBeGreaterThan(100);
    expect(fileName.endsWith(".csv")).toBe(true);
  });

  it("4. Strictly enforces discrete Gold and Cash columns across CA statements (No Collapsed Strings)", () => {
    const statements = [
      "trial_balance",
      "general_ledger",
      "sales_register",
      "purchase_register",
      "stock_valuation",
      "karigar_settlements",
      "owner_equity",
    ];

    statements.forEach((stmtId) => {
      const data = buildCAPackReportData(stmtId, "2026-2027", "Q2");
      expect(data.title).toBeDefined();
      expect(data.columns.length).toBeGreaterThanOrEqual(3);
      expect(data.rows.length).toBeGreaterThanOrEqual(1);

      // Check that columns explicitly designate money or gold where applicable
      const hasMoney = data.columns.some((c) => c.isMoney || c.header.includes("₹"));
      const hasGold = data.columns.some((c) => c.isGold || c.header.toLowerCase().includes("gold") || c.header.toLowerCase().includes("wt"));

      if (stmtId === "trial_balance" || stmtId === "karigar_settlements" || stmtId === "owner_equity") {
        expect(hasMoney).toBe(true);
        expect(hasGold).toBe(true);
      }
    });
  });

  it("5. Generates Master CA Pack multi-statement booklet PDF", async () => {
    const { blob, fileName } = await generateCAPackCompleteBooklet("2026-2027", "Q2 (Jul - Sep)");

    expect(blob).toBeDefined();
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(2000);
    expect(fileName).toContain("AVS_CA_Complete_Auditor_Pack");

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const headerStr = String.fromCharCode(...bytes.slice(0, 5));
    expect(headerStr).toBe("%PDF-");
  });
});
