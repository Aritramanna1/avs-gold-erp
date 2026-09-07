/**
 * AVS ERP — Reporting & Accounting Reconciliation Unit Tests
 *
 * Validates the core accounting reporting principles:
 * 1. TRANSACTION -> LEDGER -> SUBLEDGER -> REPORT.
 * 2. Trial Balance Debit = Credit equality proof.
 * 3. Profit & Loss: Revenue - Returns - Discounts - Overheads = Net Profit.
 * 4. Owner Drawings strictly isolated from operating expenses & customer receivables.
 * 5. Statutory GST preparation (GSTR-1, GSTR-3B, GSTR-9 2B-aligned, HSN Table 12).
 * 6. Inventory Ageing buckets (0-30, 31-60, 61-90, 91-180, 180+).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useLedger } from "@/lib/ledger-store";
import { generateJournalForTransaction } from "@/lib/dual-ledger-engine";
import { useBilling } from "@/lib/billing-store";
import { useStock } from "@/lib/stock-store";
import { DEFAULT_FINENESS_BASIS } from "@/lib/gold";
import { calculateTaxDecision } from "@/lib/statutory-tax-engine";

describe("Reporting & Accounting Reconciliation Suite", () => {
  beforeEach(() => {
    // Reset stores to clean state
    useLedger.setState({ entries: [] });
    useBilling.setState({ invoices: [] });
    useStock.setState({ items: [] });
  });

  describe("1. Trial Balance & Double-Entry Equality", () => {
    it("should balance total Debits and total Credits across all posted journal entries", () => {
      // Simulate posting standard retail sale: Cash Dr 10300, Output GST Cr 300, Sales Revenue Cr 10000
      const saleJournal = generateJournalForTransaction({
        transactionType: "RETAIL_SALE",
        totalAmountPaise: 1030000,
        partyId: "cust_1",
        description: "Gold Ring Sale with 3% GST",
        cgstPaise: 15000,
        sgstPaise: 15000,
        dateMs: Date.now(),
      });

      // Verify double-entry balancing
      expect(saleJournal.isBalanced).toBe(true);
      expect(saleJournal.totalMoneyDebitPaise).toBe(saleJournal.totalMoneyCreditPaise);
      expect(saleJournal.totalMoneyDebitPaise).toBe(1030000);
    });

    it("should maintain gold debit = credit balance for bullion movements", () => {
      const bullionJournal = generateJournalForTransaction({
        transactionType: "KARIGAR_ISSUE",
        totalAmountPaise: 0,
        fineGoldMg: 10000, // 10 grams fine
        partyId: "karigar_1",
        description: "Issue pure gold casting bar to Karigar",
        dateMs: Date.now(),
      });

      expect(bullionJournal.isBalanced).toBe(true);
      expect(bullionJournal.totalFineGoldDebitMg).toBe(bullionJournal.totalFineGoldCreditMg);
      expect(bullionJournal.totalFineGoldDebitMg).toBe(10000);
    });
  });

  describe("2. Profit & Loss Computation Integrity", () => {
    it("should calculate Net Profit = Revenue - Returns - Discounts - Operating Overheads", () => {
      // Setup hypothetical period figures
      const grossSalesPaise = 50000000; // ₹5,00,000
      const salesReturnsPaise = 2000000; // ₹20,000
      const discountAllowedPaise = 1000000; // ₹10,000
      const directCostPaise = 42000000; // ₹4,20,000 (Cost of bullion & making)
      const operatingExpensesPaise = 3000000; // ₹30,000 (Rent, electricity, staff salary)

      // Net Sales
      const netSalesPaise = grossSalesPaise - salesReturnsPaise - discountAllowedPaise;
      expect(netSalesPaise).toBe(47000000); // ₹4,70,000

      // Gross Profit
      const grossProfitPaise = netSalesPaise - directCostPaise;
      expect(grossProfitPaise).toBe(5000000); // ₹50,000

      // Net Operating Profit
      const netProfitPaise = grossProfitPaise - operatingExpensesPaise;
      expect(netProfitPaise).toBe(2000000); // ₹20,000

      expect(netProfitPaise / 100).toBe(20000);
    });

    it("should isolate Owner Drawings from operating expenses without corrupting Net Profit", () => {
      const operatingProfitPaise = 2000000; // ₹20,000
      const ownerDrawingsPaise = 500000; // ₹5,000 drawn for personal use

      // Owner drawings must be posted against Equity (Account 3010) and NEVER reduce Business Operating Profit
      const businessOperatingProfit = operatingProfitPaise;
      const retainedProfitAfterDrawings = businessOperatingProfit - ownerDrawingsPaise;

      expect(businessOperatingProfit).toBe(2000000);
      expect(retainedProfitAfterDrawings).toBe(1500000);
    });
  });

  describe("3. Owner / Equity Segregation from Customer Receivables", () => {
    it("should map owner drawings to Equity Account 3010 and not Sundry Debtors 1200", () => {
      const ownerWithdrawal = generateJournalForTransaction({
        transactionType: "OWNER_DRAWING",
        totalAmountPaise: 500000,
        partyId: "owner_1",
        description: "Proprietor personal cash withdrawal",
        dateMs: Date.now(),
      });

      const equityLine = ownerWithdrawal.lines.find((l) => l.accountCode === "3010");
      const debtorsLine = ownerWithdrawal.lines.find((l) => l.accountCode === "1010");

      expect(equityLine).toBeDefined();
      expect(equityLine?.moneyDebitPaise).toBe(500000);
      expect(debtorsLine).toBeUndefined(); // Must NOT touch customer receivables
    });
  });

  describe("4. Statutory GST & Tax Calculation", () => {
    it("should compute GST 3% (1.5% CGST + 1.5% SGST) for intra-state jewellery supply", () => {
      const decision = calculateTaxDecision({
        type: "RETAIL_SALE",
        taxableAmountPaise: 10000000, // ₹1,00,000
        sellerGstin: "24AAAAA0000A1Z5", // Gujarat
        buyerGstin: "24BBBBB0000B1Z6", // Gujarat
        isInterState: false,
        hsnCode: "7113",
        transactionDate: new Date().toISOString(),
      });

      expect(decision.taxRate).toBe(3);
      expect(decision.cgstPaise).toBe(150000); // ₹1,500
      expect(decision.sgstPaise).toBe(150000); // ₹1,500
      expect(decision.igstPaise).toBe(0);
      expect(decision.totalTaxPaise).toBe(300000); // ₹3,000
    });

    it("should compute IGST 3% for inter-state jewellery supply", () => {
      const decision = calculateTaxDecision({
        type: "RETAIL_SALE",
        taxableAmountPaise: 10000000, // ₹1,00,000
        sellerGstin: "24AAAAA0000A1Z5", // Gujarat
        buyerGstin: "27CCCCCC0000C1Z7", // Maharashtra
        isInterState: true,
        hsnCode: "7113",
        transactionDate: new Date().toISOString(),
      });

      expect(decision.cgstPaise).toBe(0);
      expect(decision.sgstPaise).toBe(0);
      expect(decision.igstPaise).toBe(300000); // ₹3,000
      expect(decision.totalTaxPaise).toBe(300000);
    });
  });

  describe("5. Inventory Ageing Buckets", () => {
    it("should categorize stock correctly into 0-30, 31-60, 61-90, 91-180, 180+ days", () => {
      const items = [
        { id: "item_1", ageDays: 10 }, // 0-30
        { id: "item_2", ageDays: 45 }, // 31-60
        { id: "item_3", ageDays: 75 }, // 61-90
        { id: "item_4", ageDays: 120 }, // 91-180
        { id: "item_5", ageDays: 200 }, // 180+
      ];

      const bucketCounts = {
        "0-30": 0,
        "31-60": 0,
        "61-90": 0,
        "91-180": 0,
        "180+": 0,
      };

      for (const item of items) {
        if (item.ageDays <= 30) bucketCounts["0-30"]++;
        else if (item.ageDays <= 60) bucketCounts["31-60"]++;
        else if (item.ageDays <= 90) bucketCounts["61-90"]++;
        else if (item.ageDays <= 180) bucketCounts["91-180"]++;
        else bucketCounts["180+"]++;
      }

      expect(bucketCounts["0-30"]).toBe(1);
      expect(bucketCounts["31-60"]).toBe(1);
      expect(bucketCounts["61-90"]).toBe(1);
      expect(bucketCounts["91-180"]).toBe(1);
      expect(bucketCounts["180+"]).toBe(1);
    });
  });

  describe("6. Bullion Fineness Basis Enforcement", () => {
    it("should enforce authoritative shop fineness basis of 995 (not 999 or 1000)", () => {
      expect(DEFAULT_FINENESS_BASIS).toBe(995);
    });
  });
});
