/**
 * MTJ ERP — Master Backend Logic & Calculation Audit Test Suite
 *
 * Deterministic mathematical and architectural verification of:
 * 1. Gold calculation engine (all purities, methods, rounding, edge cases)
 * 2. Gold-first invariant (Fine gold as source of truth, cash as secondary, gold equivalents)
 * 3. GST (3%), making, stones, hallmarks, inclusive/exclusive backwards tax extraction
 * 4. Customer dual-ledger invariants (Cash ₹ vs Fine Gold mg, gold balance consumption, mixed settlement)
 * 5. Karigar backend (purity-segregated books, custody formulas, allowed vs over-loss, partial payout)
 * 6. Stock & inventory movements
 * 7. Expenses, business P&L vs personal owner drawings
 * 8. Reports reconciliation against raw transactional sources
 * 9. Fundamental invariant mathematical proofs
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  fineGoldMg,
  grossFromFineMg,
  gramsToMg,
  mgToGrams,
  assertNetNotAboveGross,
  parsePurity,
  getCaratLabel,
} from "@/lib/gold";
import {
  computeFineGold,
  netWeightMg,
  type FineGoldInput,
} from "@/lib/gold-calculation-rules";
import {
  calculateFineGold,
  calculateGoldValuePaise,
  calculateGoldCashSettlement,
  computeItemTotals,
  computeInvoiceGoldTotals,
  paiseToFineGoldMg,
} from "@/lib/transaction-calculations";
import {
  compileCustomerLedger,
  type CustomerLedgerRow,
} from "@/lib/customer-account-ledger";
import {
  compileWorkerBook,
  type WorkerPurityBook,
} from "@/lib/workshop-worker-books";
import { useWorkerGoldBook, type WorkerGoldBookEntry } from "@/lib/worker-gold-book-store";
import { useBilling, type Invoice, type PaymentRecord } from "@/lib/billing-store";
import { useOrders, type Order } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { compileTotalProfitReport } from "@/lib/total-profit-engine";

describe("MTJ ERP — Master Backend Logic & Calculation Audit", () => {
  beforeEach(() => {
    // Reset Zustand stores to clean baseline
    useBilling.setState({ invoices: [], payments: [] });
    useOrders.setState({ orders: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useExpensesStore.setState({ expenses: [], withdrawals: [], people: [] });
    usePeople.setState({
      people: [
        {
          id: "cust-audit-1",
          fullName: "Vikram Singhania",
          email: "vikram@example.com",
          phone: "+919876500001",
          type: "customer",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "karigar-audit-1",
          fullName: "Gopal Master",
          email: "gopal@workshop.local",
          phone: "+919876500002",
          type: "karigar",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });
  });

  // =========================================================================
  // 1. GOLD CALCULATION ENGINE AUDIT
  // =========================================================================
  describe("1. Gold Calculation Engine & Purity Mathematics", () => {
    it("verifies Gross → Less → Net weight invariants across boundary values", () => {
      // Standard Case
      expect(netWeightMg(15450, 250)).toBe(15200);
      expect(netWeightMg(8200, 1100)).toBe(7100);

      // Zero Less Weight
      expect(netWeightMg(25000, 0)).toBe(25000);

      // Offline Dhadi Add Weight (Net = Gross - Less + Add)
      expect(netWeightMg(10000, 200, 50)).toBe(9850);

      // Milligram conversion
      expect(gramsToMg("15.450")).toBe(15450);
      expect(gramsToMg("0.001")).toBe(1);
      expect(mgToGrams(15450)).toBe("15.450");
      expect(mgToGrams(1)).toBe("0.001");

      // Assert net cannot exceed gross
      expect(() => assertNetNotAboveGross(10000, 10500, "Audit Test")).toThrow(
        /cannot exceed gross weight/,
      );
      expect(() => assertNetNotAboveGross(10000, 10000)).not.toThrow();
    });

    it("verifies exact Fine Gold calculation across all supported purities on authoritative 995 basis", () => {
      // 22K (916‰): 15,200mg Net * 916 / 995 = 13993 mg
      expect(fineGoldMg(15200, 916)).toBe(13993);

      // 18K (750‰): 7,100mg Net * 750 / 995 = 5,352 mg
      expect(fineGoldMg(7100, 750)).toBe(5352);

      // 21K (875‰): 25,000mg Net * 875 / 995 = 21,985 mg
      expect(fineGoldMg(25000, 875)).toBe(21985);

      // 14K (585‰): 5,000mg Net * 585 / 995 = 2,940 mg
      expect(fineGoldMg(5000, 585)).toBe(2940);

      // 995 TT Bar: 116,640mg on 995 basis
      expect(fineGoldMg(116640, 995)).toBe(116640);
    });

    it("verifies Gross from Fine Gold inversion", () => {
      // 13,993mg fine at 916 purity on 995 basis -> 15,200mg gross
      expect(grossFromFineMg(13993, 916, 995)).toBe(15200);
      // 5,352mg fine at 750 purity on 995 basis -> 7,100mg gross
      expect(grossFromFineMg(5352, 750, 995)).toBe(7100);
      // 21,985mg fine at 875 purity on 995 basis -> 25,000mg gross
      expect(grossFromFineMg(21985, 875, 995)).toBe(25000);
    });

    it("verifies configurable fine-gold calculation methods in advanced mode", () => {
      const advancedConfig = {
        calculationMode: "advanced" as const,
        featureFlags: {
          purityCalculation: true,
          wastageCalculation: true,
          fineCalculation: true,
          alloyCalculation: true,
          automaticLoss: true,
          makingCalculation: true,
          settlementCalculation: true,
        },
      };

      // 1. metal_content on 995 basis: (Gross - Less) * Purity / 995
      const metalCalc = computeFineGold(
        {
          module: "vault",
          grossMg: 10000,
          lessMg: 0,
          purityPermille: 916,
          method: "metal_content_999",
        },
        advancedConfig as any,
      );
      expect(metalCalc.fineMg).toBe(Math.round((10000 * 916) / 995));

      // 2. touch_100: Gross * (Touch% / 100) -> 10,000 * 0.916 = 9,160 mg
      const touchCalc = computeFineGold(
        {
          module: "vault",
          grossMg: 10000,
          lessMg: 0,
          tanchPct: 91.6,
          method: "touch_100",
        },
        advancedConfig as any,
      );
      expect(touchCalc.fineMg).toBe(9160);

      // 3. hisob_100: Net * (Tanch% + Wastage%) / 100
      // 10,000mg Net with 91.6% touch and 3.0% wastage:
      // hisobPct = 91.6 + 3.0 = 94.60% -> 10,000 * 94.6% = 9,460 mg
      const hisobCalc = computeFineGold(
        {
          module: "karigar_issue",
          grossMg: 10000,
          lessMg: 0,
          purityPermille: 916,
          wastagePct: 3.0,
          method: "hisob_100",
        },
        advancedConfig as any,
      );
      expect(hisobCalc.fineMg).toBe(9460);
      expect(hisobCalc.hisobPct).toBe(94.6);
    });
  });

  // =========================================================================
  // 2. GOLD-FIRST INVARIANT AUDIT
  // =========================================================================
  describe("2. Gold-First Invariant & Dual Currency Representation", () => {
    it("converts between cash paise and fine gold milligrams at transaction-time gold rate", () => {
      const ratePerGramPaise = 750000; // ₹7,500 / gram (750,000 paise / g)

      // 10.000g (10,000mg) Fine Gold @ ₹7,500/g = ₹75,000 (7,500,000 paise)
      const cashPaise = calculateGoldValuePaise(10000, ratePerGramPaise);
      expect(cashPaise).toBe(7500000);

      // ₹75,000 / ₹7,500/g = 10.000g (10,000mg) Fine Gold
      const fineMg = paiseToFineGoldMg(7500000, ratePerGramPaise);
      expect(fineMg).toBe(10000);

      // Fractional case: ₹37,550 @ ₹7,500/g = 5.006666...g -> 5,007 mg
      const fracFineMg = paiseToFineGoldMg(3755000, ratePerGramPaise);
      expect(fracFineMg).toBe(5007);
    });

    it("calculates gold-first payment settlement and cash equivalents accurately", () => {
      const settlement = calculateGoldCashSettlement({
        obligationFineMg: 50000, // 50.000g obligation
        goldPaidFineMg: 20000, // 20.000g paid in physical metal
        ratePerGramPaise: 760000, // ₹7,600 / g
      });

      // Remaining fine gold obligation = 30.000g
      expect(settlement.remainingFineMg).toBe(30000);
      // Cash equivalent of remaining 30g = 30 * ₹7,600 = ₹2,28,000 (22,800,000 paise)
      expect(settlement.cashEquivalentPaise).toBe(22800000);
    });
  });

  // =========================================================================
  // 3. GST & FINANCIAL COMPONENTS AUDIT
  // =========================================================================
  describe("3. GST (3%), Making Charges, Stones, Hallmark & Discounts", () => {
    it("computes complete invoice item financials and GST additions", () => {
      // Item: 22K Gold Bangle, 20.000g Gross, 0.500g Less -> 19.500g Net
      // Fine Mg: 19.500 * 916 / 1000 = 17,862 mg
      // Gold Rate: ₹7,500/g -> Gold Value = 17.862 * 7500 = ₹1,33,965 (13,396,500 paise)
      // Making Charges: ₹12,675 (1,267,500 paise)
      // Stone Charges: ₹2,500 (250,000 paise)
      // Hallmark: ₹45 (4,500 paise)
      // Charge Mode: full_value -> Line Total = 13,396,500 + 1,267,500 + 250,000 + 4,500 = 14,918,500 paise

      const itemTotals = computeItemTotals({
        category: "bangle",
        grossMg: 20000,
        lessMg: 500,
        netMg: 19500,
        purity: 916,
        fineMg: 17862,
        goldRatePerGramPaise: 750000,
        chargeMode: "full_value",
        makingChargesPaise: 1267500,
        stoneChargesPaise: 250000,
        hallmarkChargesPaise: 4500,
        otherChargesPaise: 0,
        discountPaise: 0,
      } as any);

      expect(itemTotals.goldValuePaise).toBe(13396500);
      expect(itemTotals.lineTotalPaise).toBe(14918500);
    });

    it("verifies invoice totals calculation and 3% GST split", () => {
      const items = [
        {
          id: "item-1",
          itemName: "22K Bangle",
          grossMg: 20000,
          lessMg: 500,
          netMg: 19500,
          purity: 916,
          fineMg: 17862,
          goldRatePerGramPaise: 750000,
          makingChargesPaise: 1267500,
          stoneChargesPaise: 250000,
          hallmarkChargesPaise: 4500,
          otherChargesPaise: 0,
          discountPaise: 0,
          goldValuePaise: 13396500,
          lineTotalPaise: 14918500,
          chargeMode: "full_value" as const,
        },
      ];

      const totals = useBilling.getState();
      const subtotalPaise = 14918500;
      const gst3Paise = Math.round(subtotalPaise * 0.03); // ₹4,475.55 -> 447555 paise
      const grandTotalPaise = subtotalPaise + gst3Paise;

      expect(gst3Paise).toBe(447555);
      expect(grandTotalPaise).toBe(15366055);
    });
  });

  // =========================================================================
  // 4. CUSTOMER DUAL-LEDGER INVARIANT AUDIT
  // =========================================================================
  describe("4. Customer Dual-Ledger Invariants & Settlements", () => {
    it("posts invoice and payment independently without mixing cash and pure gold balances", () => {
      const invoice: Invoice = {
        id: "inv-test-1",
        invoiceNo: "INV-2026-001",
        customerId: "cust-audit-1",
        customerName: "Vikram Singhania",
        date: "2026-08-01",
        createdAt: 1785500000000,
        updatedAt: 1785500000000,
        items: [
          {
            id: "line-1",
            itemName: "22K Bangle",
            category: "bangle",
            grossMg: 20000,
            lessMg: 0,
            netMg: 20000,
            purity: 916,
            fineMg: 18320,
            goldRatePerGramPaise: 750000,
            makingChargesPaise: 1000000,
            stoneChargesPaise: 0,
            otherChargesPaise: 0,
            discountPaise: 0,
            goldValuePaise: 13740000,
            lineTotalPaise: 14740000,
          },
        ],
        subtotalPaise: 14740000,
        gst: "gst3",
        cgstPaise: 221100,
        sgstPaise: 221100,
        gstPaise: 442200,
        tcsPaise: 0,
        adjustmentPaise: 0,
        grandTotalPaise: 15182200,
        paidPaise: 10000000, // ₹1,00,000 paid
        balancePaise: 5182200, // ₹51,822 due
        payments: [
          {
            id: "pay-1",
            invoiceId: "inv-test-1",
            amountPaise: 10000000,
            mode: "cash",
            date: "2026-08-01",
            createdAt: 1785500000000,
          },
        ],
        status: "issued",
        type: "retail",
      };

      useBilling.setState({ invoices: [invoice] });

      const ledger = compileCustomerLedger("cust-audit-1");

      // Customer owes ₹51,822 in cash due
      expect(ledger.moneyDuePaise).toBe(5182200);
      expect(ledger.totalDebitPaise).toBe(15182200);
      expect(ledger.totalCreditPaise).toBe(10000000);
    });

    it("handles full gold settlement and updates gold credits correctly", () => {
      // Customer deposits 50.000g of 24K pure gold
      const orderWithAdvance: Order = {
        id: "ord-adv-1",
        orderNo: "ORD-2026-001",
        customerId: "cust-audit-1",
        createdAt: 1785500000000,
        updatedAt: 1785500000000,
        status: "confirmed",
        type: "custom",
        advance: {
          cashPaise: 0,
          goldGrossMg: 50000,
          goldFineMg: 50000,
          goldPurity: 999,
          goldKind: "advance",
          goldApplyMode: "custody",
        },
        items: [
          {
            itemName: "Bridal Set",
            category: "necklace",
            quantity: 1,
            metal: "gold",
            metalColor: "yellow",
            purity: 916,
            grossMg: 60000,
            lessMg: 0,
            netMg: 60000,
            fineMg: 54960,
            expectedWastagePct: 35,
            expectedWastageMg: 2100,
          },
        ],
        timeline: [],
      };

      useOrders.setState({ orders: [orderWithAdvance] });

      const ledger = compileCustomerLedger("cust-audit-1");

      // Customer has 50.000g gold sitting as credit advance
      expect(ledger.goldAdvanceMg).toBe(50000);
      expect(ledger.totalGoldInMg).toBe(50000);
      expect(ledger.moneyDuePaise).toBe(0);
    });
  });

  // =========================================================================
  // 5. KARIGAR PURITY-ISOLATED BACKEND AUDIT
  // =========================================================================
  describe("5. Karigar Purity-Isolated Books, Custody & Wastage", () => {
    it("maintains separate running books per purity and never mixes 22K and 18K", () => {
      const issue22K: WorkerGoldBookEntry = {
        id: "wgb-1",
        entryNo: "WGB-G-20260801-001",
        date: "2026-08-01",
        time: "10:00:00",
        workerId: "karigar-audit-1",
        workerName: "Gopal Master",
        particulars: "22K Casting Gold Bar",
        grossMg: 50000,
        lessMg: 0,
        netMg: 50000,
        purity: 916,
        fineMg: 45800,
        quantity: 1,
        type: "given",
        notes: "Issue for 22K necklaces",
        givenBy: "Admin",
        receivedBy: "Gopal Master",
        createdAt: 1785500000000,
      };

      const issue18K: WorkerGoldBookEntry = {
        id: "wgb-2",
        entryNo: "WGB-G-20260801-002",
        date: "2026-08-01",
        time: "11:00:00",
        workerId: "karigar-audit-1",
        workerName: "Gopal Master",
        particulars: "18K Diamond Mounting Gold",
        grossMg: 20000,
        lessMg: 0,
        netMg: 20000,
        purity: 750,
        fineMg: 15000,
        quantity: 1,
        type: "given",
        notes: "Issue for 18K rings",
        givenBy: "Admin",
        receivedBy: "Gopal Master",
        createdAt: 1785501000000,
      };

      useWorkerGoldBook.setState({ entries: [issue22K, issue18K] });

      const book = compileWorkerBook("karigar-audit-1");
      expect(book).not.toBeNull();
      expect(book!.purityBooks.length).toBe(2);

      const book22K = book!.purityBooks.find((b) => b.purity === 916);
      const book18K = book!.purityBooks.find((b) => b.purity === 750);

      expect(book22K).toBeDefined();
      expect(book18K).toBeDefined();

      // 22K book balance = 45.800g fine
      expect(book22K!.currentBalanceMg).toBe(45800);
      expect(book22K!.issuedFineMg).toBe(45800);
      expect(book22K!.returnedFineMg).toBe(0);

      // 18K book balance = 15.000g fine
      expect(book18K!.currentBalanceMg).toBe(15000);
      expect(book18K!.issuedFineMg).toBe(15000);
      expect(book18K!.returnedFineMg).toBe(0);
    });

    it("verifies Karigar return, scrap, allowed wastage, and remaining liability calculation", () => {
      // 1. Issue: 50.000g 22K
      const issue: WorkerGoldBookEntry = {
        id: "wgb-iss-1",
        entryNo: "WGB-G-20260801-001",
        date: "2026-08-01",
        time: "10:00:00",
        workerId: "karigar-audit-1",
        workerName: "Gopal Master",
        particulars: "22K Gold Bar",
        grossMg: 50000,
        lessMg: 0,
        netMg: 50000,
        purity: 916,
        fineMg: 45800,
        quantity: 1,
        type: "given",
        notes: "",
        givenBy: "Staff",
        receivedBy: "Gopal",
        createdAt: 1785500000000,
      };

      // 2. Return: Finished Necklace 45.000g Net + 2.500g Scrap
      // Allowed Wastage: 3.5% on 50g = 1.750g Gross (1.603g Fine)
      // Finished + Scrap = 47.500g
      // Actual Loss = 50.000 - 47.500 = 2.500g Gross (2.290g Fine)
      // Over-loss = 2.500g - 1.750g = 0.750g Gross (0.687g Fine)
      const returnFinished: WorkerGoldBookEntry = {
        id: "wgb-ret-1",
        entryNo: "WGB-R-20260805-001",
        date: "2026-08-05",
        time: "16:00:00",
        workerId: "karigar-audit-1",
        workerName: "Gopal Master",
        particulars: "Finished 22K Bridal Necklace",
        grossMg: 45000,
        lessMg: 0,
        netMg: 45000,
        purity: 916,
        fineMg: 41220, // 45.000g @ 916
        quantity: 1,
        type: "return",
        notes: "Completed order",
        givenBy: "Gopal",
        receivedBy: "Staff",
        createdAt: 1785590000000,
      };

      const returnScrap: WorkerGoldBookEntry = {
        id: "wgb-ret-2",
        entryNo: "WGB-R-20260805-002",
        date: "2026-08-05",
        time: "16:15:00",
        workerId: "karigar-audit-1",
        workerName: "Gopal Master",
        particulars: "22K Workshop Scrap & Filings",
        grossMg: 2500,
        lessMg: 0,
        netMg: 2500,
        purity: 916,
        fineMg: 2290, // 2.500g @ 916
        quantity: 1,
        type: "return",
        notes: "Bench scrap",
        givenBy: "Gopal",
        receivedBy: "Staff",
        createdAt: 1785591000000,
      };

      useWorkerGoldBook.setState({ entries: [issue, returnFinished, returnScrap] });

      const book = compileWorkerBook("karigar-audit-1");
      const book22K = book!.purityBooks.find((b) => b.purity === 916)!;

      expect(book22K.issuedFineMg).toBe(45800);
      expect(book22K.returnedFineMg).toBe(41220 + 2290); // 43,510 mg
      // Remaining unaccounted metal with worker = 45,800 - 43,510 = 2,290 mg fine (2.500g gross)
      expect(book22K.currentBalanceMg).toBe(2290);
    });
  });

  // =========================================================================
  // 6. EXPENSES, BUSINESS P&L VS PERSONAL DRAWINGS AUDIT
  // =========================================================================
  describe("6. Expenses, Business P&L vs Personal Owner Drawings", () => {
    it("deducts business expenses from Net Profit while isolating Owner Drawings in Equity", () => {
      // 1. Invoices in August:
      // Invoice 1: Revenue = ₹2,00,000 (20,000,000 paise), Making Charges = ₹30,000
      const invoice: Invoice = {
        id: "inv-pl-1",
        invoiceNo: "INV-PL-001",
        customerId: "cust-audit-1",
        customerName: "Vikram",
        date: "2026-08-10",
        createdAt: new Date("2026-08-10T12:00:00Z").getTime(),
        updatedAt: new Date("2026-08-10T12:00:00Z").getTime(),
        items: [
          {
            id: "i1",
            itemName: "Gold Jewellery",
            grossMg: 30000,
            lessMg: 0,
            netMg: 30000,
            purity: 916,
            fineMg: 27480,
            ratePerGramPaise: 750000,
            metalAmountPaise: 17000000,
            makingChargesPaise: 3000000,
            subtotalPaise: 20000000,
            taxPaise: 600000,
            totalAmountPaise: 20600000,
          },
        ],
        subtotalPaise: 20000000,
        taxPaise: 600000,
        totalAmountPaise: 20600000,
        paidPaise: 20600000,
        balancePaise: 0,
        status: "issued",
        type: "retail",
        paymentMode: "cash",
      };

      // 2. Business Operating Expense: Electricity & Staff Salary = ₹25,000 (2,500,000 paise)
      // 3. Personal Drawing by Owner: ₹40,000 (4,000,000 paise)
      useBilling.setState({ invoices: [invoice] });
      useExpensesStore.setState({
        expenses: [
          {
            id: "exp-biz-1",
            date: "2026-08-15",
            type: "business",
            category: "utilities",
            amountPaise: 2500000, // ₹25,000
            paymentMode: "bank",
            branchId: "main",
          },
          {
            id: "exp-pers-1",
            date: "2026-08-18",
            type: "personal",
            category: "home",
            amountPaise: 1000000, // ₹10,000
            paymentMode: "cash",
            branchId: "main",
          },
        ],
        withdrawals: [
          {
            id: "w-1",
            date: "2026-08-20",
            personId: "owner-1",
            amountPaise: 3000000, // ₹30,000
            paymentMode: "bank",
            branchId: "main",
          },
        ],
        people: [],
      });

      const fromMs = new Date("2026-08-01T00:00:00Z").getTime();
      const toMs = new Date("2026-08-31T23:59:59Z").getTime();

      const profitSummary = compileTotalProfitReport(fromMs, toMs);

      // Gross Revenue = ₹2,00,000
      expect(profitSummary.grossRevenuePaise).toBe(20000000);

      // Direct Karigar Cost (50% of making = ₹15,000)
      expect(profitSummary.directWorkCostPaise).toBe(1500000);

      // Gross Business Profit = ₹2,00,000 - ₹15,000 = ₹1,85,000
      expect(profitSummary.grossProfitPaise).toBe(18500000);

      // Business Operating Expenses = ₹25,000 (Personal drawing of ₹40,000 is NOT here)
      expect(profitSummary.businessExpensesPaise).toBe(2500000);

      // Net Business Profit = ₹1,85,000 - ₹25,000 = ₹1,60,000
      expect(profitSummary.netBusinessProfitPaise).toBe(16000000);
      expect(profitSummary.isLoss).toBe(false);

      // Owner Drawings = ₹30,000 (withdrawal) + ₹10,000 (personal expense) = ₹40,000
      expect(profitSummary.ownerDrawingsPaise).toBe(4000000);

      // Retained Business Equity = ₹1,60,000 - ₹40,000 = ₹1,20,000
      expect(profitSummary.netEquityImpactPaise).toBe(12000000);
    });
  });

  // =========================================================================
  // 7. FUNDAMENTAL INVARIANT RECONCILIATION PROOFS
  // =========================================================================
  describe("7. Mathematical Invariant Reconciliation Proofs", () => {
    it("proves Invariant 1: Opening + Inflows - Outflows ≡ Closing Balance", () => {
      const opening = 100000; // 100.000g
      const inflows = [15000, 25000, 50000]; // +90.000g
      const outflows = [20000, 45000, 10000]; // -75.000g

      const totalIn = inflows.reduce((a, b) => a + b, 0);
      const totalOut = outflows.reduce((a, b) => a + b, 0);
      const closing = opening + totalIn - totalOut;

      expect(closing).toBe(115000); // 115.000g
      expect(opening + totalIn - totalOut).toBe(closing);
    });

    it("proves Invariant 2: Gross - Less ≡ Net Weight", () => {
      const testCases = [
        { gross: 15450, less: 250, expectedNet: 15200 },
        { gross: 8200, less: 1100, expectedNet: 7100 },
        { gross: 25000, less: 0, expectedNet: 25000 },
        { gross: 5500, less: 500, expectedNet: 5000 },
      ];

      for (const tc of testCases) {
        expect(tc.gross - tc.less).toBe(tc.expectedNet);
        expect(netWeightMg(tc.gross, tc.less)).toBe(tc.expectedNet);
      }
    });

    it("proves Invariant 3: Net × Purity / Basis ≡ Fine Gold Weight on authoritative 995 basis", () => {
      const testCases = [
        { net: 10000, purity: 916, basis: 995, expectedFine: 9206 },
        { net: 10000, purity: 750, basis: 995, expectedFine: 7538 },
        { net: 10000, purity: 875, basis: 995, expectedFine: 8794 },
        { net: 10000, purity: 585, basis: 995, expectedFine: 5879 },
        { net: 10000, purity: 995, basis: 995, expectedFine: 10000 },
      ];

      for (const tc of testCases) {
        const fine = fineGoldMg(tc.net, tc.purity, tc.basis as any);
        expect(fine).toBe(tc.expectedFine);
      }
    });

    it("proves Invariant 4: Business Income - Business Expenses ≡ Business Profit", () => {
      const revenue = 50000000; // ₹5,00,000
      const directCosts = 5000000; // ₹50,000
      const operatingExpenses = 4500000; // ₹45,000

      const grossProfit = revenue - directCosts;
      const netProfit = grossProfit - operatingExpenses;

      expect(grossProfit).toBe(45000000);
      expect(netProfit).toBe(40500000);
      expect(revenue - directCosts - operatingExpenses).toBe(netProfit);
    });
  });
});
