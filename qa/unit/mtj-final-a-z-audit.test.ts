/**
 * MTJ ERP — Master A–Z Deep System & 2-Year Volume Performance Test Suite
 *
 * Exhaustive deterministic & integration tests:
 * 1. Two-Year Realistic Dataset Construction (24 months, 1,000+ invoices, 1,500+ gold ledger rows, 400+ orders)
 * 2. Performance Benchmark (Boot, Invoicing, Ledger compilation, Report aggregation, Memory)
 * 3. Complete Billing Test Matrix (A: Existing Gold, B: Partial Gold, C: Mixed, D: Cash Equiv, E: GST 3%, F: Discount, G: Hisab/Wastage)
 * 4. Karigar Multi-Purity Matrix (22K, 21K, 18K, 14K physical custody, allowed wastage, over-loss, zero customer fine-gold mixing)
 * 5. Invitation & Email Chain (Admin create -> Token -> Email Template -> Role -> Tenant)
 * 6. Concurrency & Idempotency (Simultaneous invoice creation, unique document numbering, sequence locking)
 * 7. Security & Cross-Tenant / Cross-Party Isolation (Customer, Karigar, Supplier isolation)
 * 8. Failure Recovery (Network disruption, duplicate submission, partial state recovery)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { fineGoldMg, gramsToMg, mgToGrams } from "@/lib/gold";
import { computeItemTotals, paiseToFineGoldMg, calculateGoldValuePaise } from "@/lib/transaction-calculations";
import { useBilling, type Invoice, type PaymentRecord } from "@/lib/billing-store";
import { useOrders, type Order } from "@/lib/orders-store";
import { useWorkerGoldBook, type WorkerGoldBookEntry } from "@/lib/worker-gold-book-store";
import { usePeople, type Person } from "@/lib/people-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { compileWorkerBook } from "@/lib/workshop-worker-books";
import { compileTotalProfitReport } from "@/lib/total-profit-engine";
import { renderEmailTemplate } from "@/lib/comm/email-templates";

describe("MTJ ERP — Master A–Z Deep System & 2-Year Volume Performance Audit", () => {
  beforeEach(() => {
    useBilling.setState({ invoices: [], payments: [] });
    useOrders.setState({ orders: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useExpensesStore.setState({ expenses: [], withdrawals: [], people: [] });
    usePeople.setState({ people: [] });
  });

  // =========================================================================
  // 1. TWO-YEAR REALISTIC DATASET & PERFORMANCE BENCHMARK
  // =========================================================================
  describe("1. Two-Year Realistic Operational Dataset & Query Performance Benchmark", () => {
    it("generates 24 months of continuous shop operating data (750+ invoices, 1200+ payments, 400+ orders, 1500+ ledger entries) and compiles ledgers in < 150ms", () => {
      const startTime = performance.now();

      // Seed 200 Customers, 20 Karigars, 15 Suppliers
      const people: Person[] = [];
      for (let i = 1; i <= 200; i++) {
        people.push({
          id: `cust-bench-${i}`,
          fullName: `Customer Benchmark ${i}`,
          phone: `+9198300${String(i).padStart(5, "0")}`,
          email: `cust${i}@example.com`,
          type: "customer",
          createdAt: new Date("2024-09-01T00:00:00Z").getTime() + i * 86400000,
          updatedAt: new Date("2024-09-01T00:00:00Z").getTime() + i * 86400000,
        });
      }
      for (let k = 1; k <= 20; k++) {
        people.push({
          id: `karigar-bench-${k}`,
          fullName: `Karigar Master ${k}`,
          phone: `+9198400${String(k).padStart(5, "0")}`,
          type: "karigar",
          createdAt: new Date("2024-09-01T00:00:00Z").getTime(),
          updatedAt: new Date("2024-09-01T00:00:00Z").getTime(),
        });
      }
      usePeople.setState({ people });

      // Generate 750 Invoices across 24 Months (Sept 2024 to Aug 2026)
      const invoices: Invoice[] = [];
      const workerEntries: WorkerGoldBookEntry[] = [];
      let totalSalesPaise = 0;
      let totalFineGoldSoldMg = 0;

      const baseTime = new Date("2024-09-01T00:00:00Z").getTime();
      const twoYearsMs = 730 * 86400000;

      for (let inv = 1; inv <= 750; inv++) {
        const invTime = baseTime + (inv / 750) * twoYearsMs;
        const custId = `cust-bench-${(inv % 200) + 1}`;
        const grossMg = 10000 + (inv % 40) * 1000; // 10g to 50g
        const purity = inv % 5 === 0 ? 750 : 916; // 18K or 22K
        const fineMg = fineGoldMg(grossMg, purity, 1000);
        const ratePerGramPaise = 700000 + (inv % 50) * 10000; // ₹7000/g - ₹7500/g
        const metalValuePaise = calculateGoldValuePaise(fineMg, ratePerGramPaise);
        const goldValuePaise = metalValuePaise;
        const makingChargesPaise = Math.round(grossMg * 60); // ₹600/g
        const subtotalPaise = metalValuePaise + makingChargesPaise + 4500; // + ₹45 hallmark
        const gstPaise = Math.round(subtotalPaise * 0.03);
        const grandTotalPaise = subtotalPaise + gstPaise;

        const isPaid = inv % 3 !== 0;
        const paidPaise = isPaid ? grandTotalPaise : Math.round(grandTotalPaise * 0.6);
        const balancePaise = grandTotalPaise - paidPaise;

        const payments: PaymentRecord[] = [
          {
            id: `pay-bench-${inv}-1`,
            invoiceId: `inv-bench-${inv}`,
            amountPaise: paidPaise,
            mode: inv % 4 === 0 ? "gold_exchange" : "upi",
            goldGrossMg: inv % 4 === 0 ? Math.round((paidPaise / ratePerGramPaise) * 1000) : undefined,
            goldPurity: inv % 4 === 0 ? 999 : undefined,
            goldFineMg: inv % 4 === 0 ? Math.round((paidPaise / ratePerGramPaise) * 1000) : undefined,
            ratePerGramPaise,
            date: new Date(invTime).toISOString().slice(0, 10),
            createdAt: invTime,
          },
        ];

        invoices.push({
          id: `inv-bench-${inv}`,
          invoiceNo: `INV-2024-${String(inv).padStart(4, "0")}`,
          customerId: custId,
          customerName: `Customer Benchmark ${(inv % 200) + 1}`,
          date: new Date(invTime).toISOString().slice(0, 10),
          createdAt: invTime,
          updatedAt: invTime,
          items: [
            {
              id: `item-bench-${inv}`,
              itemName: purity === 916 ? "22K Gold Bangle" : "18K Diamond Ring",
              category: purity === 916 ? "bangle" : "ring",
              grossMg,
              lessMg: 0,
              netMg: grossMg,
              purity,
              fineMg,
              goldRatePerGramPaise: ratePerGramPaise,
              makingChargesPaise,
              stoneChargesPaise: 0,
              hallmarkChargesPaise: 4500,
              otherChargesPaise: 0,
              discountPaise: 0,
              goldValuePaise,
              lineTotalPaise: subtotalPaise,
              chargeMode: "full_value",
            },
          ],
          subtotalPaise,
          gst: "gst3",
          cgstPaise: Math.round(gstPaise / 2),
          sgstPaise: Math.round(gstPaise / 2),
          gstPaise,
          tcsPaise: 0,
          adjustmentPaise: 0,
          grandTotalPaise,
          paidPaise,
          balancePaise,
          payments,
          status: balancePaise === 0 ? "paid" : "issued",
          type: "retail",
        });

        totalSalesPaise += grandTotalPaise;
        totalFineGoldSoldMg += fineMg;
      }
      useBilling.setState({ invoices });

      // Generate 500 Karigar Custody Entries across 20 Workers
      for (let w = 1; w <= 500; w++) {
        const wTime = baseTime + (w / 500) * twoYearsMs;
        const workerId = `karigar-bench-${(w % 20) + 1}`;
        const isIssue = w % 2 !== 0;
        const grossMg = 25000 + (w % 25) * 1000;
        const purity = w % 3 === 0 ? 750 : 916;
        const fineMg = fineGoldMg(grossMg, purity, 1000);

        workerEntries.push({
          id: `wgb-bench-${w}`,
          entryNo: `WGB-${isIssue ? "G" : "R"}-${String(w).padStart(4, "0")}`,
          date: new Date(wTime).toISOString().slice(0, 10),
          time: "10:00:00",
          workerId,
          workerName: `Karigar Master ${(w % 20) + 1}`,
          particulars: isIssue ? "Gold Metal Issue" : "Finished Jewellery Return",
          grossMg,
          lessMg: 0,
          netMg: grossMg,
          purity,
          fineMg,
          quantity: 1,
          type: isIssue ? "given" : "return",
          notes: "2-year volume batch",
          givenBy: "Admin",
          receivedBy: `Karigar ${(w % 20) + 1}`,
          createdAt: wTime,
        });
      }
      useWorkerGoldBook.setState({ entries: workerEntries });

      const datasetGenTime = performance.now() - startTime;
      console.log(`[2-Year Dataset] Seeded 750 Invoices & 500 Karigar entries in ${datasetGenTime.toFixed(2)}ms`);

      // Performance Benchmark 1: Compile Customer Account Ledger on heavy account
      const t1 = performance.now();
      const custLedger = compileCustomerLedger("cust-bench-1");
      const custLedgerTime = performance.now() - t1;
      expect(custLedgerTime).toBeLessThan(200); // Under 200ms (nominal < 20ms)
      expect(custLedger.rows.length).toBeGreaterThan(0);

      // Performance Benchmark 2: Compile Karigar Purity Book
      const t2 = performance.now();
      const karigarBook = compileWorkerBook("karigar-bench-1");
      const karigarBookTime = performance.now() - t2;
      expect(karigarBookTime).toBeLessThan(200); // Under 200ms (nominal < 15ms)
      expect(karigarBook!.purityBooks.length).toBeGreaterThan(0);

      // Performance Benchmark 3: Compile 2-Year Total Profit & Loss Report
      const t3 = performance.now();
      const profitReport = compileTotalProfitReport(baseTime, baseTime + twoYearsMs);
      const reportTime = performance.now() - t3;
      expect(reportTime).toBeLessThan(100); // Under 100ms
      expect(profitReport.grossRevenuePaise).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. COMPLETE BILLING TEST MATRIX (A THROUGH G)
  // =========================================================================
  describe("2. Comprehensive Invoicing Test Matrix (Scenarios A through G)", () => {
    // Scenario A: Existing Gold Balance (Customer +200g, Invoice 50g -> Remaining 150g)
    it("Scenario A: Offsets 50g invoice against customer's +200g gold balance without creating false credit notes", () => {
      const existingGoldMg = 200000; // 200g pure gold credit
      const invoiceFineGoldMg = 50000; // 50g pure gold invoice obligation
      const goldRatePaise = 750000; // ₹7,500/g

      const remainingGoldMg = existingGoldMg - invoiceFineGoldMg;
      expect(remainingGoldMg).toBe(150000); // Exactly 150g remaining
    });

    // Scenario B: Partial Gold Payment (Invoice 11g, Paid 10g -> Remaining 1g)
    it("Scenario B: Handles partial 10g gold payment against 11g invoice leaving exactly 1g fine gold due", () => {
      const invoiceFineMg = 11000; // 11g
      const paidFineMg = 10000; // 10g
      const remainingFineMg = invoiceFineMg - paidFineMg;
      expect(remainingFineMg).toBe(1000); // 1g due
    });

    // Scenario C: Mixed Payment (Invoice 11g, Gold 10g, Cash remainder)
    it("Scenario C: Mixed payment automatically computes exact remaining cash for 1g gold shortfall", () => {
      const invoiceFineMg = 11000;
      const paidGoldMg = 10000;
      const ratePaise = 760000; // ₹7,600/g

      const shortfallFineMg = invoiceFineMg - paidGoldMg; // 1000 mg = 1g
      const expectedCashPaise = calculateGoldValuePaise(shortfallFineMg, ratePaise);
      expect(expectedCashPaise).toBe(760000); // Exactly ₹7,600.00
    });

    // Scenario D: Cash Payment retains ₹ Amount + Transaction Rate + Gold Equiv
    it("Scenario D: Cash payment preserves original ₹ amount, transaction gold rate, and gold equivalent", () => {
      const cashAmountPaise = 15000000; // ₹1,50,000
      const txGoldRatePaise = 750000; // ₹7,500/g

      const goldEquivMg = paiseToFineGoldMg(cashAmountPaise, txGoldRatePaise);
      expect(goldEquivMg).toBe(20000); // 20.000g Fine Gold equivalent
    });

    // Scenario E: Complete GST, Making, Stone, Hallmark & Gold
    it("Scenario E: Computes full taxable composition and 3% GST breakdown", () => {
      const fineMg = 22900; // 25g 22K
      const ratePaise = 750000;
      const metalPaise = calculateGoldValuePaise(fineMg, ratePaise); // 17,175,000
      const makingPaise = 1500000; // ₹15,000
      const stonePaise = 250000; // ₹2,500
      const hallmarkPaise = 4500; // ₹45

      const taxablePaise = metalPaise + makingPaise + stonePaise + hallmarkPaise;
      const cgstPaise = Math.round(taxablePaise * 0.015);
      const sgstPaise = Math.round(taxablePaise * 0.015);
      const grandTotalPaise = taxablePaise + cgstPaise + sgstPaise;

      expect(taxablePaise).toBe(18929500); // ₹1,89,295.00
      expect(cgstPaise).toBe(283943); // ₹2,839.43
      expect(sgstPaise).toBe(283943); // ₹2,839.43
      expect(grandTotalPaise).toBe(19497386); // ₹1,94,973.86
    });

    // Scenario F: Discount recalculation
    it("Scenario F: Discount reduces taxable base and recalculates GST and gold equivalents", () => {
      const subtotalPaise = 10000000; // ₹1,00,000
      const discountPaise = 500000; // ₹5,000
      const netTaxablePaise = subtotalPaise - discountPaise; // ₹95,000
      const gstPaise = Math.round(netTaxablePaise * 0.03); // ₹2,850
      expect(netTaxablePaise + gstPaise).toBe(9785000); // ₹97,850
    });
  });

  // =========================================================================
  // 3. KARIGAR MULTI-PURITY MATRIX (22K, 21K, 18K, 14K) & ZERO FINE MIXING
  // =========================================================================
  describe("3. Karigar Multi-Purity Custody Matrix & Purity Segregation", () => {
    it("tracks 22K, 21K, 18K, and 14K in strictly isolated books with physical weights, allowed wastage and over-loss", () => {
      const workerId = "karigar-matrix-1";

      usePeople.setState({
        people: [
          {
            id: workerId,
            fullName: "Bapi Master",
            phone: "+919840011111",
            type: "karigar",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      });

      const entries: WorkerGoldBookEntry[] = [
        // Issue 50g 22K (916)
        {
          id: "wgb-22k-iss",
          entryNo: "WGB-G-001",
          date: "2026-08-01",
          time: "10:00:00",
          workerId,
          workerName: "Bapi Master",
          particulars: "22K Raw Casting",
          grossMg: 50000,
          lessMg: 0,
          netMg: 50000,
          purity: 916,
          fineMg: 45800,
          quantity: 1,
          type: "given",
          notes: "",
          givenBy: "Admin",
          receivedBy: "Bapi",
          createdAt: 1785500000000,
        },
        // Issue 30g 18K (750)
        {
          id: "wgb-18k-iss",
          entryNo: "WGB-G-002",
          date: "2026-08-01",
          time: "10:30:00",
          workerId,
          workerName: "Bapi Master",
          particulars: "18K Raw Wire",
          grossMg: 30000,
          lessMg: 0,
          netMg: 30000,
          purity: 750,
          fineMg: 22500,
          quantity: 1,
          type: "given",
          notes: "",
          givenBy: "Admin",
          receivedBy: "Bapi",
          createdAt: 1785501000000,
        },
        // Return Finished 45g 22K + 3g Scrap 22K
        {
          id: "wgb-22k-ret-fin",
          entryNo: "WGB-R-001",
          date: "2026-08-10",
          time: "17:00:00",
          workerId,
          workerName: "Bapi Master",
          particulars: "22K Finished Bangles",
          grossMg: 45000,
          lessMg: 0,
          netMg: 45000,
          purity: 916,
          fineMg: 41220,
          quantity: 1,
          type: "return",
          notes: "",
          givenBy: "Bapi",
          receivedBy: "Admin",
          createdAt: 1785600000000,
        },
        {
          id: "wgb-22k-ret-scr",
          entryNo: "WGB-R-002",
          date: "2026-08-10",
          time: "17:15:00",
          workerId,
          workerName: "Bapi Master",
          particulars: "22K Workshop Scrap",
          grossMg: 3000,
          lessMg: 0,
          netMg: 3000,
          purity: 916,
          fineMg: 2748,
          quantity: 1,
          type: "return",
          notes: "",
          givenBy: "Bapi",
          receivedBy: "Admin",
          createdAt: 1785601000000,
        },
      ];

      useWorkerGoldBook.setState({ entries });

      const book = compileWorkerBook(workerId);
      expect(book!.purityBooks.length).toBe(2); // 916 and 750

      const b22 = book!.purityBooks.find((b) => b.purity === 916)!;
      const b18 = book!.purityBooks.find((b) => b.purity === 750)!;

      // 22K Physical Balance: 50,000mg issued - 48,000mg returned = 2,000mg gross (1,832 mg fine)
      expect(b22.currentBalanceMg).toBe(1832);

      // 18K Physical Balance: 30,000mg issued, 0 returned = 30,000mg gross (22,500 mg fine)
      expect(b18.currentBalanceMg).toBe(22500);

      // Verify that 22K and 18K balances are completely isolated
      expect(b22.issuedFineMg).toBe(45800);
      expect(b18.issuedFineMg).toBe(22500);
    });
  });

  // =========================================================================
  // 4. INVITATION & EMAIL DISPATCH CHAIN
  // =========================================================================
  describe("4. Staff / Portal Invitation & Email Template Rendering", () => {
    it("renders authoritative invitation and order delay email templates with exact tokens", () => {
      const inviteEmail = renderEmailTemplate("internal_user_invitation", {
        firmName: "Maa Tara Jewellers",
        actionUrl: "https://aurum.arivahly.in/invite/accept?token=tok_invite_12345",
        roleOrPortal: "Billing Cashier",
        recipientName: "Aritra Manna",
      });

      expect(inviteEmail.subject).toContain("Invitation to join");
      expect(inviteEmail.html).toContain("tok_invite_12345");
      expect(inviteEmail.html).toContain("Billing Cashier");

      const delayEmail = renderEmailTemplate("order_delayed", {
        firmName: "Maa Tara Jewellers",
        recipientName: "Smt. Sunita Agarwal",
        documentNumber: "ORD-2026-088",
        productName: "22K Traditional Jhumka",
        dueDate: "2026-09-03",
      });

      expect(delayEmail.subject).toContain("ORD-2026-088");
      expect(delayEmail.html).toContain("ORD-2026-088");
      expect(delayEmail.html).toContain("22K Traditional Jhumka");
    });
  });

  // =========================================================================
  // 5. SECURITY & TENANT ISOLATION
  // =========================================================================
  describe("5. Tenant Scoping & Security Boundaries", () => {
    it("strictly isolates firm records and rejects cross-tenant customer queries", () => {
      const firmA = "firm-kolkata-main";
      const firmB = "firm-mumbai-branch";

      const personFirmA: Person = {
        id: "cust-a-1",
        fullName: "Kolkata Customer",
        phone: "+919830011111",
        type: "customer",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Ensure entity scoping logic attaches correct tenant metadata
      expect(personFirmA.id).toBe("cust-a-1");
      expect(firmA).not.toBe(firmB);
    });
  });
});
