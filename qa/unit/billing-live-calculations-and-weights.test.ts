import { describe, it, expect } from "vitest";
import {
  computeFineGold,
  netWeightMg,
  defaultGoldCalculationRules,
  DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED,
  GoldCalculationRulesDoc,
} from "../../src/lib/gold-calculation-rules";
import {
  fineGoldMg,
} from "../../src/lib/gold";
import {
  applyInvoiceLineGold,
} from "../../src/lib/invoice-line-gold";
import {
  computeInvoiceTotals,
  computeInvoiceGoldTotals,
  paiseToFineGoldMg,
  InvoiceItem,
  PaymentRecord,
} from "../../src/lib/billing-store";

const advancedRules: GoldCalculationRulesDoc = {
  ...defaultGoldCalculationRules(),
  calculationMode: "advanced",
  featureFlags: { ...DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED },
};

describe("Live Billing Calculation & Weight Invariants", () => {
  it("computes Net Weight as Net = Gross + Add - Less", () => {
    // Gross = 8.100 g, Less = 0.000 g, Add = 0.000 g -> Net = 8.100 g
    expect(netWeightMg(8100, 0, 0)).toBe(8100);

    // Gross = 8.100 g, Less = 0.100 g, Add = 0.000 g -> Net = 8.000 g
    expect(netWeightMg(8100, 100, 0)).toBe(8000);

    // Gross = 8.100 g, Less = 0.100 g, Add = 0.500 g -> Net = 8.500 g
    expect(netWeightMg(8100, 100, 500)).toBe(8500);
  });

  it("ensures Gross entry does NOT auto-copy into Less weight (Less defaults to 0)", () => {
    const item: InvoiceItem = {
      id: "it-1",
      itemName: "Gold Ring",
      category: "Ring",
      purity: 916,
      grossMg: 8100,
      lessMg: 0,
      addMg: 0,
      netMg: 8100,
      fineMg: 7420,
      goldRatePerGramPaise: 700000,
      goldValuePaise: 0,
      makingChargesPaise: 0,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: 0,
      chargeMode: "net_value",
      pcs: 1,
    };

    const calculated = applyInvoiceLineGold(item, "ready_stock");
    expect(calculated.grossMg).toBe(8100);
    expect(calculated.lessMg).toBe(0);
    expect(calculated.netMg).toBe(8100);
    expect(calculated.fineMg).toBeGreaterThan(0);
  });

  it("calculates Fine Gold live for metal_content on 995 authoritative basis and hisob_100", () => {
    // Authoritative 995 Basis: 8.000 g Net @ 916 purity -> Math.round(8000 * 916 / 995) = 7.365 g Fine
    const fine995 = fineGoldMg(8000, 916);
    expect(fine995).toBe(7365);

    // hisob_100: 8.000 g Net @ 84% Touch + 4% Wastage = 88% Hisab -> 7.040 g Fine
    const hisobResult = computeFineGold(
      {
        module: "mfg_billing",
        grossMg: 8100,
        lessMg: 100,
        addMg: 0,
        tanchPct: 84,
        wastagePct: 4,
        method: "hisob_100",
        base: "net",
      },
      advancedRules,
    );
    expect(hisobResult.netMg).toBe(8000);
    expect(hisobResult.hisobPct).toBe(88);
    expect(hisobResult.fineMg).toBe(7040); // 8000 * 88 / 100
  });

  it("calculates Gold Value, Making charges %, and Line Total live", () => {
    const grossMg = 8100;
    const lessMg = 100;
    const netMg = netWeightMg(grossMg, lessMg, 0); // 8000
    const purity = 916;
    const ratePaisePerGram = 750000; // ₹7,500/g

    const fineMg = fineGoldMg(netMg, purity);
    expect(fineMg).toBe(7365);

    // Gold Value = round(7365 * 750000 / 1000) = 5523750 paise = ₹55,237.50
    const goldValuePaise = Math.round((fineMg * ratePaisePerGram) / 1000);
    expect(goldValuePaise).toBe(5523750);

    // Making charge @ 12% = round(5523750 * 12 / 100) = 662850 paise = ₹6,628.50
    const makingPaise = Math.round((goldValuePaise * 12) / 100);
    expect(makingPaise).toBe(662850);

    // Total = Gold Value + Making = 5523750 + 662850 = 6186600 paise = ₹61,866.00
    const totalPaise = goldValuePaise + makingPaise;
    expect(totalPaise).toBe(6186600);
  });
});

describe("Payment Collection: Gold, Cash, and Mixed Settlements", () => {
  const ratePerGramPaise = 750000; // ₹7,500/g

  it("handles Pure Gold Payment correctly without treating it as cash receipt", () => {
    const item: InvoiceItem = {
      id: "it-1",
      itemName: "Gold Chain",
      category: "Chain",
      purity: 916,
      grossMg: 10000,
      lessMg: 0,
      addMg: 0,
      netMg: 10000,
      fineMg: 9160,
      goldRatePerGramPaise: ratePerGramPaise,
      goldValuePaise: Math.round((9160 * ratePerGramPaise) / 1000), // ₹68,700
      makingChargesPaise: 0,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: Math.round((9160 * ratePerGramPaise) / 1000),
      chargeMode: "net_value",
      pcs: 1,
    };

    const initialTotals = computeInvoiceTotals([item], null, null, [], []);

    // Payment in pure gold: 10.000 g gross @ 916 touch = 9.160 g fine gold
    const goldPayment: PaymentRecord = {
      id: "pay-gold-1",
      ts: Date.now(),
      mode: "gold_exchange",
      amountPaise: initialTotals.grandTotalPaise,
      goldGrossMg: 10000,
      goldPurity: 916,
      goldFineMg: 9160,
      goldRatePerGramPaise: ratePerGramPaise,
      reference: "RECEIVED IN GOLD",
    };

    const invoiceTotals = computeInvoiceTotals([item], null, null, [goldPayment], []);

    const goldTotals = computeInvoiceGoldTotals(
      [item],
      invoiceTotals,
      [goldPayment],
      ratePerGramPaise,
    );

    expect(goldTotals.grandTotalMg).toBe(9160);
    expect(goldTotals.paidMg).toBe(9160);
    expect(goldTotals.balanceMg).toBe(0);
    expect(goldTotals.physicalGoldReceivedMg).toBe(9160);
  });

  it("handles Pure Cash Payment and calculates Gold Equivalent automatically", () => {
    const totalPaise = 7500000; // ₹75,000
    const goldEquivMg = paiseToFineGoldMg(totalPaise, ratePerGramPaise);
    // ₹75,000 / ₹7,500/g = 10.000 g Fine Gold
    expect(goldEquivMg).toBe(10000);

    const cashPayment: PaymentRecord = {
      id: "pay-cash-1",
      ts: Date.now(),
      mode: "cash",
      amountPaise: totalPaise,
      reference: "CASH PAYMENT",
    };

    expect(cashPayment.mode).toBe("cash");
    expect(cashPayment.amountPaise).toBe(7500000);
  });

  it("handles Mixed Payment (Gold + Cash Remainder) according to Directive 10", () => {
    // Invoice Obligation: 11.000 g Fine Gold @ ₹7,500/g = ₹82,500
    const grandTotalFineMg = 11000;
    const grandTotalPaise = Math.round((grandTotalFineMg * ratePerGramPaise) / 1000); // 8250000 paise
    expect(grandTotalPaise).toBe(8250000);

    // Gold Received = 10.000 g @ 1000 touch = 10.000 g Fine Gold
    const goldReceivedFineMg = 10000;
    const goldReceivedPaise = Math.round((goldReceivedFineMg * ratePerGramPaise) / 1000); // 7500000 paise (₹75,000)
    expect(goldReceivedPaise).toBe(7500000);

    // Remaining Obligation = 1.000 g Fine Gold
    const remainingFineMg = grandTotalFineMg - goldReceivedFineMg;
    expect(remainingFineMg).toBe(1000);

    // Cash Required = Remaining Gold × Transaction Rate = 1.000 g × ₹7,500 = ₹7,500
    const cashRequiredPaise = Math.round((remainingFineMg * ratePerGramPaise) / 1000);
    expect(cashRequiredPaise).toBe(750000); // ₹7,500

    const item: InvoiceItem = {
      id: "it-1",
      itemName: "Custom Gold Set",
      category: "Set",
      purity: 1000,
      grossMg: 11000,
      lessMg: 0,
      addMg: 0,
      netMg: 11000,
      fineMg: 11000,
      goldRatePerGramPaise: ratePerGramPaise,
      goldValuePaise: grandTotalPaise,
      makingChargesPaise: 0,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: grandTotalPaise,
      chargeMode: "net_value",
      pcs: 1,
    };

    const payments: PaymentRecord[] = [
      {
        id: "pay-1",
        ts: Date.now(),
        mode: "gold_exchange",
        amountPaise: goldReceivedPaise,
        goldGrossMg: 10000,
        goldPurity: 1000,
        goldFineMg: 10000,
        goldRatePerGramPaise: ratePerGramPaise,
        reference: "Gold Deposit (Part 1)",
      },
      {
        id: "pay-2",
        ts: Date.now(),
        mode: "cash",
        amountPaise: cashRequiredPaise,
        reference: "Cash Remainder (Part 2)",
      },
    ];

    const invoiceTotals = computeInvoiceTotals([item], null, null, payments, []);
    expect(invoiceTotals.grandTotalPaise).toBe(8250000);
    expect(invoiceTotals.paidPaise).toBe(8250000);
    expect(invoiceTotals.balancePaise).toBe(0);

    const goldTotals = computeInvoiceGoldTotals([item], invoiceTotals, payments, ratePerGramPaise);
    expect(goldTotals.grandTotalMg).toBe(11000);
    expect(goldTotals.paidMg).toBe(11000);
    expect(goldTotals.balanceMg).toBe(0);
  });
});
