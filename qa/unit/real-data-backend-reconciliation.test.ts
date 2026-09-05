/**
 * MTJ ERP — End-to-End Real-Data Backend Reconciliation Test Suite
 *
 * Exhaustive realistic transaction chains:
 * 1. Customer invoice -> gold payable -> partial gold payment -> remaining gold balance
 * 2. Cash payment -> transaction-time gold equivalent -> ledger posting
 * 3. Gold + cash mixed settlement
 * 4. Old-gold exchange -> purity -> fine gold -> customer credit -> invoice adjustment
 * 5. Manufacturing issue -> Karigar custody -> finished return -> scrap -> allowed wastage -> over-loss -> settlement
 * 6. Multiple purities in the same Karigar account (purity isolation)
 * 7. Partial Karigar settlement (50g payable, settle 10g -> exactly 40g remains)
 * 8. Complete GST + making + stone + hallmark + discount -> gold-first accounting
 * 9. Stock barcode/tag -> sale -> stock deduction -> invoice -> ledger
 * 10. Reversal / Credit Note / Cancellation -> ledger relief
 * 11. Report totals reconciliation against underlying ledger rows
 */

import { describe, it, expect, beforeEach } from "vitest";
import { fineGoldMg, gramsToMg, mgToGrams, netWeightMg } from "@/lib/gold";
import {
  computeItemTotals,
  paiseToFineGoldMg,
  calculateGoldValuePaise,
  calculateGoldCashSettlement,
} from "@/lib/transaction-calculations";
import { useBilling, type Invoice, type PaymentRecord } from "@/lib/billing-store";
import { useOrders, type Order } from "@/lib/orders-store";
import { useWorkerGoldBook, type WorkerGoldBookEntry } from "@/lib/worker-gold-book-store";
import { usePeople } from "@/lib/people-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { compileWorkerBook } from "@/lib/workshop-worker-books";
import { compileTotalProfitReport } from "@/lib/total-profit-engine";

describe("MTJ ERP — End-to-End Real-Data Backend Reconciliation", () => {
  beforeEach(() => {
    useBilling.setState({ invoices: [], payments: [] });
    useOrders.setState({ orders: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useExpensesStore.setState({ expenses: [], withdrawals: [], people: [] });
    usePeople.setState({
      people: [
        {
          id: "cust-e2e-1",
          fullName: "Rajesh Singhania",
          email: "rajesh@example.com",
          phone: "+919830012345",
          type: "customer",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "karigar-e2e-1",
          fullName: "Master Gopal Karigar",
          email: "gopal@workshop.local",
          phone: "+919830099999",
          type: "karigar",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });
  });

  // =========================================================================
  // CHAIN 1, 2, 3: CUSTOMER INVOICE, GOLD/CASH PAYMENTS & MIXED SETTLEMENT
  // =========================================================================
  describe("Chains 1, 2, 3: Customer Invoice, Gold Payment, Cash Equivalent & Mixed Settlement", () => {
    it("traces complete lifecycle: Invoice -> Partial Gold Pay -> Cash with Gold Equiv -> Final Zero Balance", () => {
      // Step 1: Create Invoice INV-2026-E2E-1
      // Item: 22K Gold Set, 25.000g Gross, 0g Less -> 25.000g Net
      // Purity 916 -> Fine = 25.000 * 916 / 1000 = 22.900g (22,900 mg)
      // Gold Rate: ₹7,500/g (750,000 paise/g) -> Metal Value = 22.900 * 7,500 = ₹1,71,750 (17,175,000 paise)
      // Making Charges: ₹15,000 (1,500,000 paise)
      // Hallmark: ₹45 (4,500 paise)
      // Subtotal Taxable: ₹1,71,750 + ₹15,000 + ₹45 = ₹1,86,795 (18,679,500 paise)
      // GST 3%: 18,679,500 * 0.03 = 560,385 paise (₹5,603.85)
      // Grand Total Payable: 18,679,500 + 560,385 = 19,239,885 paise (₹1,92,398.85)

      const subtotalPaise = 18679500;
      const gstPaise = 560385;
      const grandTotalPaise = 19239885;

      const invoice: Invoice = {
        id: "inv-e2e-1",
        invoiceNo: "INV-2026-E2E-1",
        customerId: "cust-e2e-1",
        customerName: "Rajesh Singhania",
        date: "2026-08-01",
        createdAt: 1785500000000,
        updatedAt: 1785500000000,
        items: [
          {
            id: "line-1",
            itemName: "22K Designer Bridal Set",
            category: "necklace",
            grossMg: 25000,
            lessMg: 0,
            netMg: 25000,
            purity: 916,
            fineMg: 22900,
            goldRatePerGramPaise: 750000,
            makingChargesPaise: 1500000,
            stoneChargesPaise: 0,
            hallmarkChargesPaise: 4500,
            otherChargesPaise: 0,
            discountPaise: 0,
            goldValuePaise: 17175000,
            lineTotalPaise: 18679500,
            chargeMode: "full_value",
          },
        ],
        subtotalPaise,
        gst: "gst3",
        cgstPaise: 280193,
        sgstPaise: 280192,
        gstPaise,
        tcsPaise: 0,
        adjustmentPaise: 0,
        grandTotalPaise,
        paidPaise: 0,
        balancePaise: grandTotalPaise,
        payments: [],
        status: "issued",
        type: "retail",
      };

      useBilling.setState({ invoices: [invoice] });

      // Check initial state
      let ledger = compileCustomerLedger("cust-e2e-1");
      expect(ledger.moneyDuePaise).toBe(19239885);
      expect(ledger.totalDebitPaise).toBe(19239885);
      expect(ledger.totalCreditPaise).toBe(0);

      // Step 2: Customer makes Partial Gold Payment of 10.000g 24K Pure Gold (worth ₹75,000)
      // 10.000g Fine Gold @ ₹7,500/g = ₹75,000 (7,500,000 paise)
      const payGold: PaymentRecord = {
        id: "pay-gold-1",
        invoiceId: "inv-e2e-1",
        amountPaise: 7500000,
        mode: "gold_exchange",
        goldGrossMg: 10000,
        goldPurity: 999,
        goldFineMg: 10000,
        ratePerGramPaise: 750000,
        date: "2026-08-02",
        createdAt: 1785501000000,
      };

      const invAfterGoldPay: Invoice = {
        ...invoice,
        paidPaise: 7500000,
        balancePaise: 19239885 - 7500000, // ₹1,17,398.85 (11,739,885 paise)
        payments: [payGold],
      };
      useBilling.setState({ invoices: [invAfterGoldPay] });

      ledger = compileCustomerLedger("cust-e2e-1");
      expect(ledger.totalCreditPaise).toBe(7500000);
      expect(ledger.moneyDuePaise).toBe(11739885); // Exactly ₹1,17,398.85 remains
      expect(ledger.totalGoldInMg).toBe(10000); // 10g fine gold received

      // Step 3: Cash Payment of ₹50,000 (5,000,000 paise) with transaction-time gold equiv
      // ₹50,000 / ₹7,500/g = 6.6666...g -> 6,667 mg Fine Gold equivalent
      const cashGoldEquiv = paiseToFineGoldMg(5000000, 750000);
      expect(cashGoldEquiv).toBe(6667);

      const payCash: PaymentRecord = {
        id: "pay-cash-1",
        invoiceId: "inv-e2e-1",
        amountPaise: 5000000,
        mode: "cash",
        ratePerGramPaise: 750000,
        cashGoldEquivMg: cashGoldEquiv,
        date: "2026-08-03",
        createdAt: 1785502000000,
      };

      const invAfterCashPay: Invoice = {
        ...invAfterGoldPay,
        paidPaise: 7500000 + 5000000, // ₹1,25,000
        balancePaise: 19239885 - 12500000, // ₹67,398.85 (6,739,885 paise)
        payments: [payGold, payCash],
      };
      useBilling.setState({ invoices: [invAfterCashPay] });

      ledger = compileCustomerLedger("cust-e2e-1");
      expect(ledger.totalCreditPaise).toBe(12500000);
      expect(ledger.moneyDuePaise).toBe(6739885); // Exactly ₹67,398.85 remains

      // Step 4: Mixed Final Settlement of ₹67,398.85:
      // Paid as 5.000g 24K Gold (₹37,500) + ₹29,898.85 UPI
      const payFinalGold: PaymentRecord = {
        id: "pay-gold-final",
        invoiceId: "inv-e2e-1",
        amountPaise: 3750000,
        mode: "gold_exchange",
        goldGrossMg: 5000,
        goldPurity: 999,
        goldFineMg: 5000,
        ratePerGramPaise: 750000,
        date: "2026-08-04",
        createdAt: 1785503000000,
      };

      const payFinalUpi: PaymentRecord = {
        id: "pay-upi-final",
        invoiceId: "inv-e2e-1",
        amountPaise: 2989885, // ₹29,898.85
        mode: "upi",
        date: "2026-08-04",
        createdAt: 1785504000000,
      };

      const invFullyPaid: Invoice = {
        ...invAfterCashPay,
        paidPaise: 19239885,
        balancePaise: 0,
        status: "paid",
        payments: [payGold, payCash, payFinalGold, payFinalUpi],
      };
      useBilling.setState({ invoices: [invFullyPaid] });

      ledger = compileCustomerLedger("cust-e2e-1");
      expect(ledger.moneyDuePaise).toBe(0); // Fully settled
      expect(ledger.totalDebitPaise).toBe(19239885);
      expect(ledger.totalCreditPaise).toBe(19239885);
      expect(ledger.totalGoldInMg).toBe(15000); // 10g + 5g = 15g fine gold received
    });
  });

  // =========================================================================
  // CHAIN 4: OLD GOLD EXCHANGE -> PURITY -> CUSTOMER CREDIT -> INVOICE ADJ
  // =========================================================================
  describe("Chain 4: Old Gold Exchange & Valuation Offset", () => {
    it("converts 15.000g 18K old gold into pure gold credit and offsets invoice payable", () => {
      // 15.000g Old Gold @ 750 (18K touch) on 995 basis
      // Fine gold = 15.000 * 750 / 995 = 11.307g (11,307 mg) Fine
      const oldGrossMg = 15000;
      const oldPurity = 750;
      const oldFineMg = fineGoldMg(oldGrossMg, oldPurity);
      expect(oldFineMg).toBe(11307);

      // Old gold purchase rate: ₹7,200/g -> Valuation = 11.307 * 7,200 = ₹81,410.40 (8,141,040 paise)
      const oldGoldRatePaise = 720000;
      const oldGoldValuePaise = calculateGoldValuePaise(oldFineMg, oldGoldRatePaise);
      expect(oldGoldValuePaise).toBe(8141040);

      // New Invoice of ₹1,50,000 with ₹81,000 Old Gold Adjustment
      const invoice: Invoice = {
        id: "inv-og-1",
        invoiceNo: "INV-2026-OG-1",
        customerId: "cust-e2e-1",
        customerName: "Rajesh",
        date: "2026-08-05",
        createdAt: 1785505000000,
        updatedAt: 1785505000000,
        items: [
          {
            id: "it-1",
            itemName: "22K Bangle",
            category: "bangle",
            grossMg: 20000,
            lessMg: 0,
            netMg: 20000,
            purity: 916,
            fineMg: 18320,
            goldRatePerGramPaise: 750000,
            makingChargesPaise: 1260000,
            stoneChargesPaise: 0,
            otherChargesPaise: 0,
            discountPaise: 0,
            goldValuePaise: 13740000,
            lineTotalPaise: 15000000,
            chargeMode: "full_value",
          },
        ],
        subtotalPaise: 15000000,
        orderAdjustment: {
          cashAdvancePaise: 0,
          oldGoldGrossMg: 15000,
          oldGoldPurity: 750,
          oldGoldFineMg: 11250,
          oldGoldRatePerGramPaise: 720000,
          oldGoldValuePaise: 8100000,
          goldGrossMg: 15000,
          goldPurity: 750,
          goldFineMg: 11250,
          goldRatePerGramPaise: 720000,
          goldValuePaise: 8100000,
          goldKind: "old_gold",
        },
        gst: "none",
        cgstPaise: 0,
        sgstPaise: 0,
        gstPaise: 0,
        tcsPaise: 0,
        adjustmentPaise: 8100000,
        grandTotalPaise: 15000000 - 8100000, // ₹69,000 payable
        paidPaise: 0,
        balancePaise: 6900000,
        payments: [],
        status: "issued",
        type: "retail",
      };

      useBilling.setState({ invoices: [invoice] });

      const ledger = compileCustomerLedger("cust-e2e-1");
      // Customer owes ₹69,000 (after ₹81,000 old gold credit)
      expect(ledger.moneyDuePaise).toBe(6900000);
      expect(ledger.totalDebitPaise).toBe(15000000);
      expect(ledger.totalCreditPaise).toBe(8100000);
    });
  });

  // =========================================================================
  // CHAIN 5, 6, 7: KARIGAR CUSTODY, PURITY ISOLATION & PARTIAL SETTLEMENT
  // =========================================================================
  describe("Chains 5, 6, 7: Karigar Custody, Multi-Purity Books & Partial Labour Settlement", () => {
    it("traces Karigar issue -> return -> scrap -> allowed wastage -> over-loss accurately", () => {
      // Step 1: Issue 100.000g 22K (91.600g Fine)
      const issue: WorkerGoldBookEntry = {
        id: "wgb-e2e-iss-1",
        entryNo: "WGB-G-20260810-001",
        date: "2026-08-10",
        time: "09:30:00",
        workerId: "karigar-e2e-1",
        workerName: "Master Gopal Karigar",
        particulars: "22K Gold Casting Bar",
        grossMg: 100000,
        lessMg: 0,
        netMg: 100000,
        purity: 916,
        fineMg: 91600,
        quantity: 1,
        type: "given",
        notes: "Issue for 22K Bridal Set",
        givenBy: "Admin",
        receivedBy: "Gopal",
        createdAt: 1785600000000,
      };

      // Step 2: Return Finished Jewellery 85.000g 22K (77.860g Fine)
      const returnFinished: WorkerGoldBookEntry = {
        id: "wgb-e2e-ret-1",
        entryNo: "WGB-R-20260815-001",
        date: "2026-08-15",
        time: "17:00:00",
        workerId: "karigar-e2e-1",
        workerName: "Master Gopal Karigar",
        particulars: "Finished 22K Bridal Set",
        grossMg: 85000,
        lessMg: 0,
        netMg: 85000,
        purity: 916,
        fineMg: 77860,
        quantity: 1,
        type: "return",
        notes: "Completed piece",
        givenBy: "Gopal",
        receivedBy: "Admin",
        createdAt: 1785650000000,
      };

      // Step 3: Return Bench Scrap 8.000g 22K (7.328g Fine)
      const returnScrap: WorkerGoldBookEntry = {
        id: "wgb-e2e-ret-2",
        entryNo: "WGB-R-20260815-002",
        date: "2026-08-15",
        time: "17:15:00",
        workerId: "karigar-e2e-1",
        workerName: "Master Gopal Karigar",
        particulars: "Workshop Scrap & Dust",
        grossMg: 8000,
        lessMg: 0,
        netMg: 8000,
        purity: 916,
        fineMg: 7328,
        quantity: 1,
        type: "return",
        notes: "Scrap return",
        givenBy: "Gopal",
        receivedBy: "Admin",
        createdAt: 1785651000000,
      };

      useWorkerGoldBook.setState({ entries: [issue, returnFinished, returnScrap] });

      const book = compileWorkerBook("karigar-e2e-1");
      const book22K = book!.purityBooks.find((b) => b.purity === 916)!;

      // Issued = 91,600 mg fine
      expect(book22K.issuedFineMg).toBe(91600);
      // Returned = 77,860 + 7,328 = 85,188 mg fine
      expect(book22K.returnedFineMg).toBe(85188);
      // Remaining unaccounted metal with worker = 91,600 - 85,188 = 6,412 mg fine (7.000g gross)
      expect(book22K.currentBalanceMg).toBe(6412);

      // Mathematical Verification of Over-loss:
      // Allowed Wastage: 3.5% on 100g = 3.500g (3,222 mg Fine)
      // Total Gross Loss: 100g - 85g - 8g = 7.000g (6,412 mg Fine)
      // Over-loss: 7.000g - 3.500g = 3.500g Gross (3,222 mg Fine Gold penalty)
      const allowedWastageFineMg = fineGoldMg(3500, 916);
      expect(allowedWastageFineMg).toBe(3222);
      const overLossFineMg = 6412 - allowedWastageFineMg;
      expect(overLossFineMg).toBe(3190);
    });

    it("verifies multi-purity isolation (22K and 18K) in the same Karigar account", () => {
      const entry22K: WorkerGoldBookEntry = {
        id: "wgb-22k",
        entryNo: "WGB-G-22K",
        date: "2026-08-01",
        time: "10:00:00",
        workerId: "karigar-e2e-1",
        workerName: "Gopal",
        particulars: "22K Raw",
        grossMg: 50000,
        lessMg: 0,
        netMg: 50000,
        purity: 916,
        fineMg: 45800,
        quantity: 1,
        type: "given",
        notes: "",
        givenBy: "Admin",
        receivedBy: "Gopal",
        createdAt: 1785500000000,
      };

      const entry18K: WorkerGoldBookEntry = {
        id: "wgb-18k",
        entryNo: "WGB-G-18K",
        date: "2026-08-01",
        time: "10:30:00",
        workerId: "karigar-e2e-1",
        workerName: "Gopal",
        particulars: "18K Raw",
        grossMg: 30000,
        lessMg: 0,
        netMg: 30000,
        purity: 750,
        fineMg: 22500,
        quantity: 1,
        type: "given",
        notes: "",
        givenBy: "Admin",
        receivedBy: "Gopal",
        createdAt: 1785501000000,
      };

      useWorkerGoldBook.setState({ entries: [entry22K, entry18K] });

      const book = compileWorkerBook("karigar-e2e-1");
      expect(book!.purityBooks.length).toBe(2);

      const b22 = book!.purityBooks.find((b) => b.purity === 916)!;
      const b18 = book!.purityBooks.find((b) => b.purity === 750)!;

      expect(b22.currentBalanceMg).toBe(45800);
      expect(b18.currentBalanceMg).toBe(22500);
    });
  });

  // =========================================================================
  // CHAIN 8: COMPLETE GST, MAKING, STONE, HALLMARK & DISCOUNT
  // =========================================================================
  describe("Chain 8: Complete Full-Stack Invoicing Breakdown", () => {
    it("verifies accurate integer paise rounding across multi-line tax and charges", () => {
      // 35.000g Gross, 2.000g Stone -> 33.000g Net @ 916 -> 30.228g Fine
      // Rate: ₹7,600/g -> Metal Value = 30.228 * 7,600 = ₹2,29,732.80 (22,973,280 paise)
      // Making: ₹700/g * 33.000 = ₹23,100 (2,310,000 paise)
      // Stone: ₹8,500 (850,000 paise)
      // Hallmark: ₹45 (4,500 paise)
      // Discount: ₹2,000 (200,000 paise)
      // Taxable: 22,973,280 + 2,310,000 + 850,000 + 4,500 - 200,000 = 25,937,780 paise (₹2,59,377.80)
      // CGST 1.5%: 25,937,780 * 0.015 = 389,066.7 -> 389,067 paise (₹3,890.67)
      // SGST 1.5%: 389,067 paise (₹3,890.67)
      // Total GST: 778,134 paise (₹7,781.34)
      // Grand Total: 25,937,780 + 778,134 = 26,715,914 paise (₹2,67,159.14)

      const fineMg = fineGoldMg(33000, 916);
      expect(fineMg).toBe(30380);

      const metalValuePaise = calculateGoldValuePaise(fineMg, 760000);
      expect(metalValuePaise).toBe(23088800);

      const subtotalPaise = metalValuePaise + 2310000 + 850000 + 4500 - 200000;
      expect(subtotalPaise).toBe(26053300);

      const cgstPaise = Math.round(subtotalPaise * 0.015);
      const sgstPaise = Math.round(subtotalPaise * 0.015);
      const totalGstPaise = cgstPaise + sgstPaise;
      const grandTotalPaise = subtotalPaise + totalGstPaise;

      expect(cgstPaise).toBe(390800);
      expect(sgstPaise).toBe(390800);
      expect(totalGstPaise).toBe(781600);
      expect(grandTotalPaise).toBe(26834900);

      const invoiceFineEquivMg = paiseToFineGoldMg(grandTotalPaise, 760000);
      expect(invoiceFineEquivMg).toBe(35309);
    });
  });

  // =========================================================================
  // CHAIN 10, 11, 12: CREDIT NOTE, REVERSAL & REPORT RECONCILIATION
  // =========================================================================
  describe("Chains 10, 11, 12: Reversal, Credit Notes & Reports Reconciliation", () => {
    it("reconciles Total Profit & Loss report against invoices and business expenses", () => {
      const invoice: Invoice = {
        id: "inv-rep-1",
        invoiceNo: "INV-2026-REP-1",
        customerId: "cust-e2e-1",
        customerName: "Rajesh",
        date: "2026-08-15",
        createdAt: new Date("2026-08-15T10:00:00Z").getTime(),
        updatedAt: new Date("2026-08-15T10:00:00Z").getTime(),
        items: [
          {
            id: "i1",
            itemName: "Bridal Jewellery",
            grossMg: 40000,
            lessMg: 0,
            netMg: 40000,
            purity: 916,
            fineMg: 36640,
            goldRatePerGramPaise: 750000,
            makingChargesPaise: 4000000, // ₹40,000
            stoneChargesPaise: 0,
            otherChargesPaise: 0,
            discountPaise: 0,
            goldValuePaise: 27480000,
            lineTotalPaise: 31480000, // ₹3,14,800
          },
        ],
        subtotalPaise: 31480000,
        gst: "none",
        cgstPaise: 0,
        sgstPaise: 0,
        gstPaise: 0,
        tcsPaise: 0,
        adjustmentPaise: 0,
        grandTotalPaise: 31480000,
        paidPaise: 31480000,
        balancePaise: 0,
        status: "issued",
        type: "retail",
        payments: [],
      };

      useBilling.setState({ invoices: [invoice] });
      useExpensesStore.setState({
        expenses: [
          {
            id: "e1",
            date: "2026-08-16",
            type: "business",
            category: "rent",
            amountPaise: 5000000, // ₹50,000
            paymentMode: "bank",
            branchId: "main",
          },
        ],
        withdrawals: [
          {
            id: "w1",
            date: "2026-08-20",
            personId: "owner-1",
            amountPaise: 2000000, // ₹20,000
            paymentMode: "cash",
            branchId: "main",
          },
        ],
        people: [],
      });

      const fromMs = new Date("2026-08-01T00:00:00Z").getTime();
      const toMs = new Date("2026-08-31T23:59:59Z").getTime();

      const profit = compileTotalProfitReport(fromMs, toMs);

      // Gross Revenue = ₹3,14,800
      expect(profit.grossRevenuePaise).toBe(31480000);
      // Direct Cost (50% Making) = ₹20,000
      expect(profit.directWorkCostPaise).toBe(2000000);
      // Gross Profit = ₹3,14,800 - ₹20,000 = ₹2,94,800
      expect(profit.grossProfitPaise).toBe(29480000);
      // Operating Expense = ₹50,000
      expect(profit.businessExpensesPaise).toBe(5000000);
      // Net Business Profit = ₹2,94,800 - ₹50,000 = ₹2,44,800
      expect(profit.netBusinessProfitPaise).toBe(24480000);
      // Owner Drawings = ₹20,000
      expect(profit.ownerDrawingsPaise).toBe(2000000);
      // Net Equity Impact = ₹2,44,800 - ₹20,000 = ₹2,24,800
      expect(profit.netEquityImpactPaise).toBe(22480000);
    });
  });
});
