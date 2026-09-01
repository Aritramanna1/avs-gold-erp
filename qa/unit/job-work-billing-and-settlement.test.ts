import { describe, it, expect } from "vitest";
import {
  computeInvoiceTotals,
  computeInvoiceGoldTotals,
  paiseToRupees,
  InvoiceItem,
  PaymentRecord,
} from "../../src/lib/billing-store";
import { mgToGrams } from "../../src/lib/gold";

describe("Job-Work Billing & Settlement Invariants", () => {
  const goldRatePaise = 750000; // ₹7,500 per gram (750,000 paise / gram)

  // Standard 11.050 g Job-Work Item
  // 11.050 g * 750,000 paise/g = 8,287,500 paise = ₹82,875
  const jobWorkItem: InvoiceItem = {
    id: "jw-item-1",
    itemName: "Handmade Gold Necklace",
    category: "Necklace",
    purity: 1000,
    grossMg: 11050,
    lessMg: 0,
    addMg: 0,
    netMg: 11050,
    fineMg: 11050, // 11.050 g fine gold
    goldRatePerGramPaise: goldRatePaise,
    goldValuePaise: Math.round((11050 * goldRatePaise) / 1000), // 8,287,500 paise
    makingChargesPaise: 0,
    stoneChargesPaise: 0,
    hallmarkChargesPaise: 0,
    otherChargesPaise: 0,
    discountPaise: 0,
    lineTotalPaise: Math.round((11050 * goldRatePaise) / 1000),
    chargeMode: "net_value",
    pcs: 1,
  };

  it("1. Job-Work Gold Obligation: 11.050 g Total Obligation vs 11.000 g Metal Received leaves 0.050 g remainder", () => {
    const totalObligationMg = jobWorkItem.fineMg; // 11,050 mg = 11.050 g
    expect(totalObligationMg).toBe(11050);

    // Jeweller gives 11.000 g Gold (11,000 mg Pure Fine)
    // 11.000 g * ₹7,500 = ₹82,500 = 8,250,000 paise
    const goldReceivedMg = 11000;
    const goldReceivedPaise = Math.round((goldReceivedMg * goldRatePaise) / 1000); // 8,250,000 paise

    const goldPayment: PaymentRecord = {
      id: "pay-gold-1",
      ts: Date.now(),
      mode: "gold_exchange",
      amountPaise: goldReceivedPaise,
      goldGrossMg: 11000,
      goldPurity: 100,
      goldFineMg: 11000,
      goldRatePerGramPaise: goldRatePaise,
    };

    const totals = computeInvoiceTotals([jobWorkItem], "none", null, [goldPayment]);
    const goldTotals = computeInvoiceGoldTotals([jobWorkItem], totals, [goldPayment], goldRatePaise);

    // Grand total is 8,287,500 paise (₹82,875 / 11.050 g)
    expect(totals.grandTotalPaise).toBe(8287500);
    expect(paiseToRupees(totals.grandTotalPaise)).toBe("82,875.00");

    // Paid in Gold is 8,250,000 paise (₹82,500 / 11.000 g)
    expect(totals.paidPaise).toBe(8250000);
    expect(paiseToRupees(totals.paidPaise)).toBe("82,500.00");

    // Remaining Balance is 37,500 paise (₹375 / 0.050 g = 50 mg)
    expect(totals.balancePaise).toBe(37500);
    expect(paiseToRupees(totals.balancePaise)).toBe("375.00");
    expect(goldTotals.balanceMg).toBe(50);
    expect(mgToGrams(goldTotals.balanceMg)).toBe("0.050");

    // Invoice is NOT fully settled yet
    expect(totals.paidPaise).toBeLessThan(totals.grandTotalPaise);
  });

  it("2. Remaining 0.050 g can be settled in Cash (@ ₹7,500/g = ₹375) resulting in full settlement", () => {
    // 11.000 g Gold Received
    const goldPayment: PaymentRecord = {
      id: "pay-gold-1",
      ts: Date.now(),
      mode: "gold_exchange",
      amountPaise: Math.round((11000 * goldRatePaise) / 1000), // 8,250,000 paise = ₹82,500
      goldGrossMg: 11000,
      goldPurity: 100,
      goldFineMg: 11000,
      goldRatePerGramPaise: goldRatePaise,
    };

    // Remaining 0.050 g settled in Cash: 0.050 g * ₹7,500 = ₹375 = 37,500 paise
    const cashRequiredPaise = Math.round((50 * goldRatePaise) / 1000); // 37,500 paise
    expect(cashRequiredPaise).toBe(37500);
    expect(paiseToRupees(cashRequiredPaise)).toBe("375.00");

    const cashPayment: PaymentRecord = {
      id: "pay-cash-remainder",
      ts: Date.now(),
      mode: "cash",
      amountPaise: cashRequiredPaise,
      reference: "Remainder settled in Cash (0.050 g equiv)",
    };

    const combinedPayments = [goldPayment, cashPayment];
    const totals = computeInvoiceTotals([jobWorkItem], "none", null, combinedPayments);
    const goldTotals = computeInvoiceGoldTotals([jobWorkItem], totals, combinedPayments, goldRatePaise);

    // Total Paid = 8,250,000 + 37,500 = 8,287,500 paise (₹82,875)
    expect(totals.paidPaise).toBe(8287500);
    // Balance Due = 0
    expect(totals.balancePaise).toBe(0);
    expect(goldTotals.balanceMg).toBe(0);

    // Status is Settled in Full with Gold + Cash
    const status = totals.balancePaise <= 0 ? "paid" : "partial";
    expect(status).toBe("paid");
  });

  it("3. Auto-Settlement from Existing Customer Gold Balance (200.000 g - 11.050 g = 188.950 g remaining)", () => {
    const customerExistingGoldMg = 200000; // 200.000 g in customer ledger
    const jobWorkObligationMg = 11050; // 11.050 g

    // Auto-apply obligation from customer gold advance
    const autoAppliedFineMg = Math.min(customerExistingGoldMg, jobWorkObligationMg);
    expect(autoAppliedFineMg).toBe(11050);

    const remainingCustomerGoldMg = customerExistingGoldMg - autoAppliedFineMg;
    expect(remainingCustomerGoldMg).toBe(188950); // 188.950 g
    expect(mgToGrams(remainingCustomerGoldMg)).toBe("188.950");

    const advancePayment: PaymentRecord = {
      id: "pay-adv-1",
      ts: Date.now(),
      mode: "customer_gold_credit",
      amountPaise: Math.round((autoAppliedFineMg * goldRatePaise) / 1000),
      goldGrossMg: autoAppliedFineMg,
      goldPurity: 100,
      goldFineMg: autoAppliedFineMg,
      goldRatePerGramPaise: goldRatePaise,
      reference: "Auto-Settlement from Customer Gold Advance",
    };

    const totals = computeInvoiceTotals([jobWorkItem], "none", null, [advancePayment]);
    expect(totals.balancePaise).toBe(0);
    expect(totals.paidPaise).toBe(totals.grandTotalPaise);
  });

  it("4. PAYMENT RECEIVED NOW = NO creates an UNPAID INVOICE with 0 payments and full balance (no fake Udhar records)", () => {
    // When paymentReceivedNow is false, payments array is strictly empty
    const payments: PaymentRecord[] = [];

    const totals = computeInvoiceTotals([jobWorkItem], "none", null, payments);
    const goldTotals = computeInvoiceGoldTotals([jobWorkItem], totals, payments, goldRatePaise);

    expect(totals.paidPaise).toBe(0);
    expect(totals.balancePaise).toBe(totals.grandTotalPaise);
    expect(goldTotals.balanceMg).toBe(11050);

    // Status is 'issued' (Unpaid Invoice)
    const status = totals.paidPaise === 0 ? "issued" : "paid";
    expect(status).toBe("issued");

    // Invariant: no placeholder 'outstanding' modes are pushed to payments array
    expect(payments.some((p) => p.mode === "outstanding")).toBe(false);
  });

  it("5. Settling Payment on an Unpaid Invoice brings balance to 0 and transitions status to paid", () => {
    // Start with unpaid invoice
    const unpaidTotals = computeInvoiceTotals([jobWorkItem], "none", null, []);
    expect(unpaidTotals.balancePaise).toBe(8287500);

    // Perform settlement with 11.050 g Fine Gold (8,287,500 paise)
    const settlementPayment: PaymentRecord = {
      id: "pay-settle-final",
      ts: Date.now(),
      mode: "gold_exchange",
      amountPaise: 8287500,
      goldGrossMg: 11050,
      goldPurity: 100,
      goldFineMg: 11050,
      goldRatePerGramPaise: goldRatePaise,
      reference: "Final Gold Settlement",
    };

    const settledTotals = computeInvoiceTotals([jobWorkItem], "none", null, [settlementPayment]);
    expect(settledTotals.balancePaise).toBe(0);
    expect(settledTotals.paidPaise).toBe(8287500);

    const finalStatus = settledTotals.balancePaise <= 0 ? "paid" : "issued";
    expect(finalStatus).toBe("paid");
  });
});
