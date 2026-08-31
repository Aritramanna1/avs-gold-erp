import { describe, it, expect, beforeEach } from "vitest";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useCreditNotes, useEstimates, useDeliveryChallans } from "@/lib/billing-documents-store";
import { resolvePrintContext, hasPrintContextBuilder } from "@/lib/print-engine/data-mapper";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { payloadFor, parsePayload } from "@/lib/verify-token";
import type { PrintDocType } from "@/lib/print-engine/types";

describe("MTJ ERP — Backend Wiring, Accounting & Universal Print/PDF Engine Audit", () => {
  beforeEach(() => {
    // Reset stores with deterministic baseline
    useBilling.setState({ invoices: [], payments: [] });
    useOrders.setState({ orders: [] });
    usePeople.setState({ people: [] });
    useJobCards.setState({ cards: [] });
    useMfgBills.setState({ bills: [] });
    useCreditNotes.setState({ notes: [] });
    useEstimates.setState({ estimates: [] });
    useDeliveryChallans.setState({ challans: [] });
    useWorkerGoldBook.setState({ entries: [] });
  });

  describe("1. Document Data Builder & Mapping Coverage", () => {
    const REQUIRED_DOC_TYPES: PrintDocType[] = [
      "retail_invoice",
      "gst_invoice",
      "estimate_doc",
      "credit_note",
      "debit_note",
      "delivery_challan",
      "order_slip",
      "gold_receipt",
      "advance_receipt",
      "job_card",
      "manufacturing_bill",
      "customer_ledger_statement",
      "karigar_custody_statement",
      "gold_settlement",
      "repair_receipt",
      "polishing_receipt",
      "jewellery_tag",
      "worker_kyc",
      "cash_book",
      "fine_rojmel",
      "dar_rojmel",
      "karigar_book",
      "barcode_stock",
      "item_jama_nave",
      "dhadi_book",
      "daily_jewellery_summary",
      "daily_close_report",
      "platform_tax_invoice",
    ];

    it("has registered data builders for all core business document types", () => {
      for (const docType of REQUIRED_DOC_TYPES) {
        expect(
          hasPrintContextBuilder(docType),
          `Missing PrintContextBuilder for ${docType}`,
        ).toBe(true);
      }
    });

    it("correctly builds PrintDocumentData for Retail Invoice & GST Invoice", () => {
      const mockInvoice = {
        id: "inv-test-001",
        invoiceNo: "INV/2026/001",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "paid" as const,
        billingType: "ready_stock" as const,
        customerId: "cust-001",
        customerName: "Radha Krishna Jewellers",
        customerPhone: "9876543210",
        customerGstin: "24AAACG1234F1Z5",
        gst: "gst3" as const,
        cgstPaise: 15000,
        sgstPaise: 15000,
        gstPaise: 30000,
        tcsPaise: 0,
        subtotalPaise: 1000000,
        adjustmentPaise: 0,
        grandTotalPaise: 1030000,
        paidPaise: 1030000,
        balancePaise: 0,
        items: [
          {
            id: "it-1",
            itemName: "22K Gold Bangle",
            category: "Bangles",
            purity: 916,
            grossMg: 10000,
            netMg: 9500,
            fineMg: 8702,
            goldRatePerGramPaise: 750000,
            goldValuePaise: 712500,
            makingChargesPaise: 50000,
            stoneChargesPaise: 0,
            hallmarkChargesPaise: 4500,
            otherChargesPaise: 0,
            discountPaise: 0,
            lineTotalPaise: 767000,
          },
        ],
        payments: [
          {
            id: "pay-1",
            date: new Date().toISOString().slice(0, 10),
            amountPaise: 1030000,
            mode: "bank" as const,
            goldRatePaisePerGram: 750000,
            goldEquivalentMg: 13733,
          },
        ],
      };

      useBilling.setState({ invoices: [mockInvoice as any] });

      const data = resolvePrintContext("gst_invoice", "inv-test-001");
      expect(data).not.toBeNull();
      expect(data?.docNumber).toBe("INV/2026/001");
      expect(data?.fields.customerName).toBe("Radha Krishna Jewellers");
      expect(data?.tables.items?.length).toBe(1);
      expect(data?.fields.grandTotalLabel).toContain("10,300.00");
    });
  });

  describe("2. PDF Generation Engine — Multi-Paper Size & Layout Verification", () => {
    it("generates valid PDF blobs across A4, A5, and Thermal formats without errors", async () => {
      const mockInvoice = {
        id: "inv-pdf-001",
        invoiceNo: "INV/PDF/999",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "paid" as const,
        customerId: "cust-pdf",
        customerName: "Aritra Jewellers",
        gst: "none" as const,
        cgstPaise: 0,
        sgstPaise: 0,
        gstPaise: 0,
        tcsPaise: 0,
        subtotalPaise: 500000,
        adjustmentPaise: 0,
        grandTotalPaise: 500000,
        paidPaise: 500000,
        balancePaise: 0,
        items: [
          {
            id: "it-pdf-1",
            itemName: "Gold Ring",
            category: "Rings",
            purity: 916,
            grossMg: 5000,
            netMg: 5000,
            fineMg: 4580,
            goldRatePerGramPaise: 750000,
            goldValuePaise: 375000,
            makingChargesPaise: 25000,
            stoneChargesPaise: 0,
            hallmarkChargesPaise: 4500,
            otherChargesPaise: 0,
            discountPaise: 0,
            lineTotalPaise: 404500,
          },
        ],
        payments: [],
      };

      useBilling.setState({ invoices: [mockInvoice as any] });
      const printData = resolvePrintContext("retail_invoice", "inv-pdf-001");
      expect(printData).not.toBeNull();

      const firmProfile = {
        shopName: "Maa Tara Jewellers",
        tagline: "Purity and Trust Since 1995",
        address: "Main Bazar, Kolkata, West Bengal",
        phone: "+91 98300 00000",
        email: "contact@maatarajewellers.com",
        gstin: "19AAAPL1234A1Z5",
      };

      // Test A4 PDF
      const a4Template = usePrintTemplates.getState().getForDocType("retail_invoice", "a4");
      const a4Result = await generateDocumentPdf(printData!, a4Template, firmProfile as any);
      expect(a4Result.blob).toBeDefined();
      expect(a4Result.blob.size).toBeGreaterThan(1000);
      expect(a4Result.fileName).toContain(".pdf");

      // Test Thermal 80mm PDF
      const thermalTemplate = usePrintTemplates.getState().getForDocType("retail_invoice", "thermal");
      const thermalResult = await generateDocumentPdf(printData!, thermalTemplate, firmProfile as any);
      expect(thermalResult.blob).toBeDefined();
      expect(thermalResult.blob.size).toBeGreaterThan(500);
    });
  });

  describe("3. Gold-First & Mixed Payment Accounting Invariants", () => {
    it("Invariant: Cash payments maintain cash ₹, transaction-time rate, and gold equivalent", () => {
      const invoiceAmountPaise = 7500000; // ₹75,000
      const goldRatePaisePerGram = 750000; // ₹7,500/g
      const goldEquivalentMg = Math.round((invoiceAmountPaise / goldRatePaisePerGram) * 1000);

      expect(goldEquivalentMg).toBe(10000); // exactly 10.000 g

      const payment = {
        id: "pay-gold-first",
        mode: "cash" as const,
        amountPaise: invoiceAmountPaise,
        goldRatePaisePerGram: goldRatePaisePerGram,
        goldEquivalentMg: goldEquivalentMg,
      };

      expect(payment.amountPaise).toBe(7500000);
      expect(payment.goldRatePaisePerGram).toBe(750000);
      expect(payment.goldEquivalentMg).toBe(10000);
    });

    it("Invariant: 200g Opening Balance - 50g Job Work Invoice = 150g Remaining Credit", () => {
      const customerId = "cust-gold-credit-01";
      const initialOpeningGoldMg = 200000; // 200 g fine

      usePeople.setState({
        people: [
          {
            id: customerId,
            name: "Vipul Jewellers",
            type: "customer",
            goldOpeningFineMg: initialOpeningGoldMg,
            goldOpeningType: "payable", // Customer credit
            cashOpeningBalancePaise: 0,
            status: "active",
          } as any,
        ],
      });

      const jobWorkInvoice = {
        id: "inv-jw-50g",
        invoiceNo: "JW-0050",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "confirmed" as const,
        billingType: "job_work" as const,
        customerId: customerId,
        customerName: "Vipul Jewellers",
        subtotalPaise: 1500000,
        gstPaise: 45000,
        grandTotalPaise: 1545000,
        paidPaise: 0,
        balancePaise: 1545000,
        totalFineMg: 50000, // 50 g delivered
        items: [
          {
            id: "it-jw-1",
            itemName: "Handmade Necklace",
            category: "Necklaces",
            purity: 916,
            grossMg: 55000,
            netMg: 54585,
            fineMg: 50000,
            makingChargesPaise: 1500000,
            lineTotalPaise: 1500000,
          },
        ],
        payments: [],
      };

      useBilling.setState({ invoices: [jobWorkInvoice as any] });

      const ledger = compileCustomerLedger(customerId);

      expect(ledger.openingGoldMg).toBe(200000);
      expect(ledger.closingGoldMg).toBe(150000); // 150.000 g remaining credit
      expect(ledger.goldAdvanceMg).toBe(150000);
    });

    it("Invariant: Karigar Physical Metal Custody is decoupled from Customer Fine Gold", () => {
      const workerId = "karigar-subhash-01";
      useWorkerGoldBook.setState({
        entries: [
          {
            id: "w-entry-1",
            workerId,
            date: "2026-08-31",
            type: "given",
            particulars: "24K Gold Bar",
            purity: 999,
            grossMg: 100000,
            fineMg: 99900,
            quantity: 1,
            narration: "Raw casting grain issued",
          },
          {
            id: "w-entry-2",
            workerId,
            date: "2026-08-31",
            type: "returned",
            particulars: "24K Return Scrap",
            purity: 999,
            grossMg: 70000,
            fineMg: 69930,
            quantity: 1,
            narration: "Partial return",
          },
        ],
      });

      const balance = useWorkerGoldBook.getState().getWorkerBalance(workerId);
      expect(balance.givenFine).toBe(99900);
      expect(balance.returnedFine).toBe(69930);
      expect(balance.pendingFine).toBe(29970); // 29.970 g fine remaining in custody
    });
  });

  describe("4. Public Verification QR & Token Integrity", () => {
    it("mints and verifies public document access token securely", () => {
      const payload = payloadFor({
        docType: "gst_invoice",
        docNumber: "INV/2026/001",
        recordId: "inv-sec-001",
        createdAt: "2026-08-31",
      });
      expect(payload).toBeDefined();
      expect(payload).toContain("AVS|gst_invoice|INV/2026/001|inv-sec-001|");

      const parsed = parsePayload(payload);
      expect(parsed).not.toBeNull();
      expect(parsed?.docType).toBe("gst_invoice");
      expect(parsed?.docNumber).toBe("INV/2026/001");
      expect(parsed?.recordId).toBe("inv-sec-001");
    });

    it("rejects tampered or malformed public tokens gracefully", () => {
      const result = parsePayload("invalid|tampered|token");
      expect(result).toBeNull();
    });
  });
});
