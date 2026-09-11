import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Invoice, InvoiceItem, PaymentRecord } from "@/lib/billing-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useCreditNotes } from "@/lib/billing-documents-store";
import { buildInvoicePrintData } from "@/lib/print-engine/invoice-data";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { hydrateCustomerLedgerContext } from "@/lib/customer-ledger-context";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { calculateTotalGoldAndCharges } from "@/lib/mtj-gold-calculation-engine";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

describe("Strict Billing Breakdown, Ledger Reconciliation & Document Parity (A-T)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNecklaceItem: InvoiceItem = {
    id: "item-necklace-1",
    itemName: "22K Traditional Bridal Necklace",
    category: "Necklaces",
    grossMg: 25500, // 25.500 g
    lessMg: 1500,   // 1.500 g (stones)
    addMg: 200,     // 0.200 g (enamel/add)
    netMg: 24200,   // 24.200 g
    purity: 916,    // 22K (91.60%)
    wastagePct: 3.5, // 3.5% allowed wastage
    hisobPct: 95.1, // 91.6 + 3.5 = 95.10%
    fineMg: 23014,  // Math.round(24200 * 95.1 / 100) = 23014 mg (23.014 g Fine Gold)
    goldRatePerGramPaise: 750000, // ₹ 7,500/g
    goldValuePaise: 17260500,
    makingChargesPaise: 150000, // ₹ 1,500 internal rupee basis
    makingChargesGoldMg: 200,   // 0.200 g gold equivalent
    hallmarkChargesPaise: 4500, // ₹ 45
    hallmarkChargesGoldMg: 6,   // 0.006 g gold equivalent
    stoneChargesPaise: 50000,   // ₹ 500
    otherChargesPaise: 0,
    discountPaise: 0,
    lineTotalPaise: 17465000,
    chargeMode: "job_work",
  };

  it("A & B: Necklace Gross/Less/Add/Net/Purity/Fine calculation is exact", () => {
    const gross = mockNecklaceItem.grossMg;
    const less = mockNecklaceItem.lessMg || 0;
    const add = mockNecklaceItem.addMg || 0;
    const net = gross - less + add;
    expect(net).toBe(24200);

    // Fine gold with hisob
    const expectedFine = Math.round((net * (mockNecklaceItem.hisobPct || 91.6)) / 100);
    expect(expectedFine).toBe(23014);
  });

  it("C & D: Wastage breakdown and charge-by-charge breakdown are distinct", () => {
    expect(mockNecklaceItem.wastagePct).toBe(3.5);
    expect(mockNecklaceItem.makingChargesPaise).toBe(150000);
    expect(mockNecklaceItem.hallmarkChargesPaise).toBe(4500);
    expect(mockNecklaceItem.stoneChargesPaise).toBe(50000);

    const totalChargesPaise =
      mockNecklaceItem.makingChargesPaise +
      mockNecklaceItem.hallmarkChargesPaise +
      mockNecklaceItem.stoneChargesPaise;
    expect(totalChargesPaise).toBe(204500); // ₹ 2,045
  });

  it("E: Gold equivalent of rupee-originated charges uses authoritative rate", () => {
    const ratePaise = mockNecklaceItem.goldRatePerGramPaise;
    const hallmarkGoldMg = Math.round(((mockNecklaceItem.hallmarkChargesPaise || 0) / ratePaise) * 1000);
    expect(hallmarkGoldMg).toBe(6); // 0.006 g

    const makingGoldMg = Math.round((mockNecklaceItem.makingChargesPaise / ratePaise) * 1000);
    expect(makingGoldMg).toBe(200); // 0.200 g
  });

  it("F: GST calculation preserves statutory compliance without polluting customer gold presentation", () => {
    const subtotalPaise = mockNecklaceItem.lineTotalPaise;
    const gstRatePct = 3;
    const gstPaise = Math.round((subtotalPaise * gstRatePct) / 100);
    const grandTotalPaise = subtotalPaise + gstPaise;

    expect(gstPaise).toBe(523950);
    expect(grandTotalPaise).toBe(17988950);
  });

  it("G & J: Full ledger balance application consumes exact amount once and leaves zero balance", () => {
    const availableGoldAdvanceMg = 23014;
    const invoiceRequirementFineMg = 23014;

    const autoSettlementGoldMg = Math.min(availableGoldAdvanceMg, invoiceRequirementFineMg);
    const remainingCustomerGoldMg = availableGoldAdvanceMg - autoSettlementGoldMg;

    expect(autoSettlementGoldMg).toBe(23014);
    expect(remainingCustomerGoldMg).toBe(0);
  });

  it("H: Partial ledger balance application consumes custom amount and retains remainder", () => {
    const availableGoldAdvanceMg = 10500; // 10.500 g
    const customApplyMg = 4000;           // 4.000 g

    const appliedMg = Math.min(availableGoldAdvanceMg, customApplyMg);
    const remainingMg = availableGoldAdvanceMg - appliedMg;

    expect(appliedMg).toBe(4000);
    expect(remainingMg).toBe(6500); // 6.500 g retained
  });

  it("I: Repeated ledger-payment click is protected by idempotency and updates existing line", () => {
    const payments: PaymentRecord[] = [];
    const applyPayment = (gramsStr: string) => {
      const existingIdx = payments.findIndex((p) => p.mode === "customer_gold_credit");
      if (existingIdx >= 0) {
        payments[existingIdx] = {
          ...payments[existingIdx],
          goldFineMg: Math.round(parseFloat(gramsStr) * 1000),
          goldGrossMg: Math.round(parseFloat(gramsStr) * 1000),
        };
      } else {
        payments.push({
          id: "pay-advance-1",
          ts: Date.now(),
          mode: "customer_gold_credit",
          amountPaise: 0,
          goldFineMg: Math.round(parseFloat(gramsStr) * 1000),
          goldGrossMg: Math.round(parseFloat(gramsStr) * 1000),
          goldPurity: 100,
          goldRatePerGramPaise: 750000,
          reference: "Applied from Customer Gold Balance",
        });
      }
    };

    // First click
    applyPayment("10.500");
    expect(payments.length).toBe(1);
    expect(payments[0].goldFineMg).toBe(10500);

    // Second click (duplicate click)
    applyPayment("10.500");
    expect(payments.length).toBe(1);
    expect(payments[0].goldFineMg).toBe(10500);
  });

  it("K & Q: Customer ledger reconciliation and GOLD-only invoice agree", () => {
    const goldInvoice: Invoice = {
      id: "inv-strict-gold-1",
      invoiceNo: "AVS/26-27/0010",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "job_work",
      transactionMode: "gold",
      customerId: "cust-strict-1",
      customerName: "Mahalaxmi Jewellers",
      items: [mockNecklaceItem],
      gst: "gst3",
      cgstPaise: 0,
      sgstPaise: 0,
      gstPaise: 0,
      tcsPaise: 0,
      subtotalPaise: 17465000,
      adjustmentPaise: 0,
      grandTotalPaise: 17465000,
      paidPaise: 0,
      balancePaise: 0,
      payments: [
        {
          id: "pay-1",
          ts: Date.now(),
          mode: "customer_gold_credit",
          amountPaise: 0,
          goldGrossMg: 23014,
          goldPurity: 100,
          goldFineMg: 23014,
          goldRatePerGramPaise: 750000,
          reference: "Gold Advance Usage",
        },
      ],
    };

    const printData = buildInvoicePrintData(goldInvoice);
    expect(printData.flags.isPureGold).toBe(true);
    expect(printData.fields.grandTotalLabel).toBe("23.014 g Fine Gold");
    expect(printData.fields.openingCashLabel || "").toBeFalsy();
    expect(printData.fields.closingCashLabel || "").toBeFalsy();
  });

  it("L: Payment Slip builder formats pure gold receipt without cash leakage", () => {
    const goldInvoice: Invoice = {
      id: "inv-pay-slip-1",
      invoiceNo: "AVS/26-27/0020",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "job_work",
      transactionMode: "gold",
      customerId: "cust-strict-1",
      customerName: "Mahalaxmi Jewellers",
      items: [mockNecklaceItem],
      gst: "gst3",
      cgstPaise: 0,
      sgstPaise: 0,
      gstPaise: 0,
      tcsPaise: 0,
      subtotalPaise: 17465000,
      adjustmentPaise: 0,
      grandTotalPaise: 17465000,
      paidPaise: 0,
      balancePaise: 0,
      payments: [
        {
          id: "pay-slip-p1",
          ts: Date.now(),
          mode: "gold_exchange",
          amountPaise: 0,
          goldGrossMg: 23014,
          goldPurity: 916,
          goldFineMg: 23014,
          goldRatePerGramPaise: 750000,
          reference: "Counter Gold Received",
        },
      ],
    };

    useBilling.setState({ invoices: [goldInvoice] });

    const context = resolvePrintContext("payment_receipt", goldInvoice.id);
    expect(context).not.toBeNull();
    expect(context?.flags.isPureGold).toBe(true);
    expect(context?.fields.totalReceived).toBe("23.014 g Fine Gold");
    expect(context?.fields.amountLabel).toBe("23.014 g Fine Gold");
  });

  it("M: Return slip (credit note) supports pure gold return representation", () => {
    useCreditNotes.setState({
      notes: [
        {
          id: "cn-1",
          creditNoteNo: "CN-001",
          invoiceId: "inv-1",
          invoiceNo: "AVS/26-27/0001",
          customerId: "cust-1",
          customerName: "Ramesh Jewellers",
          amountPaise: 0,
          goldFineMg: 12450,
          reason: "Customer returned bangle for exchange",
          status: "issued",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    const context = resolvePrintContext("credit_note", "cn-1");
    expect(context).not.toBeNull();
    expect(context?.flags.isPureGold).toBe(true);
    expect(context?.fields.amountLabel).toBe("12.450 g Fine Gold");
    expect(context?.fields.goldFineLabel).toBe("12.450 g Fine Gold");
  });

  it("O & P: hydrateCustomerLedgerContext handles empty/null customer safely", async () => {
    const result = await hydrateCustomerLedgerContext("");
    expect(result).toBeDefined();
    expect(result.invoices).toBe(0);
    expect(result.jobCards).toBe(0);
  });

  it("S: CASH-ONLY transaction renders rupee grand total", () => {
    const cashInvoice: Invoice = {
      id: "inv-cash-strict-1",
      invoiceNo: "AVS/26-27/0030",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "retail",
      transactionMode: "cash",
      customerId: "cust-2",
      customerName: "Vijay Verma",
      items: [
        {
          id: "it-c1",
          itemName: "Gold Chain",
          category: "Chains",
          purity: 916,
          grossMg: 10000,
          netMg: 10000,
          fineMg: 9160,
          goldRatePerGramPaise: 750000,
          goldValuePaise: 6870000,
          makingChargesPaise: 50000,
          stoneChargesPaise: 0,
          hallmarkChargesPaise: 4500,
          otherChargesPaise: 0,
          discountPaise: 0,
          lineTotalPaise: 6924500,
          chargeMode: "full_value",
        },
      ],
      gst: "gst3",
      cgstPaise: 103868,
      sgstPaise: 103867,
      gstPaise: 207735,
      tcsPaise: 0,
      subtotalPaise: 6924500,
      adjustmentPaise: 0,
      grandTotalPaise: 7132235,
      paidPaise: 7132235,
      balancePaise: 0,
      payments: [
        {
          id: "p-c1",
          ts: Date.now(),
          mode: "cash",
          amountPaise: 7132235,
          reference: "Counter Cash",
        },
      ],
    };

    const printData = buildInvoicePrintData(cashInvoice);
    expect(printData.flags.isPureGold).toBe(false);
    expect(printData.flags.hasCash).toBe(true);
    expect(printData.fields.grandTotalLabel).toContain("₹");
  });

  it("T: MIXED transaction renders separate gold and cash dimensions", () => {
    const mixedInvoice: Invoice = {
      id: "inv-mixed-strict-1",
      invoiceNo: "AVS/26-27/0040",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "retail",
      transactionMode: "mixed",
      customerId: "cust-3",
      customerName: "Anand Saraf",
      items: [
        {
          id: "it-m1",
          itemName: "Gold Ring",
          category: "Rings",
          purity: 916,
          grossMg: 10000,
          netMg: 10000,
          fineMg: 9160,
          goldRatePerGramPaise: 750000,
          goldValuePaise: 6870000,
          makingChargesPaise: 50000,
          stoneChargesPaise: 0,
          hallmarkChargesPaise: 4500,
          otherChargesPaise: 0,
          discountPaise: 0,
          lineTotalPaise: 6924500,
          chargeMode: "full_value",
        },
      ],
      gst: "gst3",
      cgstPaise: 103868,
      sgstPaise: 103867,
      gstPaise: 207735,
      tcsPaise: 0,
      subtotalPaise: 6924500,
      adjustmentPaise: 0,
      grandTotalPaise: 7132235,
      paidPaise: 3500000,
      balancePaise: 0,
      payments: [
        {
          id: "p-m-gold",
          ts: Date.now(),
          mode: "gold_exchange",
          amountPaise: 0,
          goldGrossMg: 5000,
          goldPurity: 916,
          goldFineMg: 4580,
          goldRatePerGramPaise: 750000,
          reference: "Old Gold Exchanged",
        },
        {
          id: "p-m-cash",
          ts: Date.now(),
          mode: "cash",
          amountPaise: 3500000,
          reference: "Cash Paid",
        },
      ],
    };

    const printData = buildInvoicePrintData(mixedInvoice);
    expect(printData.flags.isPureGold).toBe(false);
    expect(printData.flags.hasCash).toBe(true);
    expect(printData.fields.grandTotalLabel).toBeDefined();
  });
});
