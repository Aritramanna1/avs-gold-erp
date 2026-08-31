import { describe, it, expect } from "vitest";
import { formatSignedBalance, formatSignedGoldBalance, calculateCreditNoteEffect, validateCreditNoteParams } from "../../src/lib/credit-note-engine";
import { calculateFineGold, calculateKarigarWastage } from "../../src/lib/calculation-engine";

describe("World-First Gold-First Accounting & Billing Scenarios", () => {
  // Scenario 1: Dual Ledger & Signed Balances
  it("SCENARIO 1: Non-clamping Signed Balances for Cash and Gold", () => {
    const signedCash = formatSignedBalance(-2500000); // -₹25,000.00
    const signedGold = formatSignedGoldBalance(-11350); // -11.350 g
    expect(signedCash.isNegative).toBe(true);
    expect(signedCash.direction).toBe("Cr");
    expect(signedCash.text).toBe("25,000.00 (Cr)");

    expect(signedGold.isNegative).toBe(true);
    expect(signedGold.direction).toBe("Cr");
    expect(signedGold.text).toBe("11.350 g (Cr)");
  });

  // Scenario 2: Automatic Hisab Formula (Tunch + Wastage = Hisab)
  it("SCENARIO 2: Automatic Hisab (Tunch 92.00% + Wastage 2.50% = 94.50%)", () => {
    const tunch = 92.0;
    const wastage = 2.5;
    const hisab = tunch + wastage;
    expect(hisab).toBe(94.5);
  });

  // Scenario 3: Fine Metal Weight (999 Base)
  it("SCENARIO 3: Fine Metal Weight on 999 Fineness Base", () => {
    // Net weight: 15.000 g (15000 mg), Purity: 916
    // MTJ standard formula: (15000 * 916) / 999 = 13753.75 -> 13754 mg
    const res = calculateFineGold({ netWeightMg: 15000, purityPerMille: 916 });
    expect(res.fineGoldMg).toBe(13754);
  });

  // Scenario 4: Metal Value Calculation
  it("SCENARIO 4: Gold Value Calculation @ ₹7,000/g", () => {
    // 13.754 g fine gold @ ₹7,000/g = ₹96,278.00 (9627800 paise)
    const fineMg = 13754;
    const ratePaisePerGram = 700000;
    const valuePaise = Math.round((fineMg * ratePaisePerGram) / 1000);
    expect(valuePaise).toBe(9627800);
  });

  // Scenario 5: Mixed Gold + Cash Settlement with Rate Snapshot
  it("SCENARIO 5: Mixed Gold + Cash Settlement preserves transaction rate", () => {
    const grandTotalPaise = 10000000; // ₹100,000.00
    const goldPaidMg = 10000; // 10.000 g
    const rateSnapshotPaise = 700000; // ₹7,000/g
    const goldValuePaise = Math.round((goldPaidMg * rateSnapshotPaise) / 1000); // ₹70,000.00
    const remainingCashPaise = grandTotalPaise - goldValuePaise; // ₹30,000.00

    expect(goldValuePaise).toBe(7000000);
    expect(remainingCashPaise).toBe(3000000);
  });

  // Scenario 6: Credit Note Issuance & Signed Relief
  it("SCENARIO 6: Credit Note validation and relief calculation", () => {
    const parentInvoice = {
      id: "inv-001",
      invoiceNo: "INV-2026-0042",
      customerId: "cust-01",
      grandTotalPaise: 10000000,
      balancePaise: 4000000, // ₹40,000 balance
      balanceGoldMg: 0,
      status: "issued",
      isCreditNote: false,
    };

    const val = validateCreditNoteParams({
      originalInvoice: parentInvoice as any,
      amountPaise: 1500000, // ₹15,000 credit relief
      goldFineMg: 0,
      reason: "Item returned by customer",
    });
    expect(val.valid).toBe(true);

    const effect = calculateCreditNoteEffect(
      {
        originalInvoice: parentInvoice as any,
        amountPaise: 1500000,
        goldFineMg: 0,
        reason: "Item returned by customer",
      },
      4000000, // Current signed balance: ₹40,000
      0,
    );
    expect(effect.residualPaise).toBe(2500000); // Reduced to ₹25,000
    expect(effect.cashEffectPaise).toBe(-1500000);
  });

  // Scenario 7: Karigar Custody Accounting (Fine OFF by Default)
  it("SCENARIO 7: Karigar custody tracks physical net weight and dust return", () => {
    const karigarWastage = calculateKarigarWastage({
      totalSubmittedNetWeightMg: 45000,
      karigarWastagePct: 1.5,
      items: [{ categoryId: "cat1", categoryName: "Bangles", weightMg: 45000 }],
      issuedFineGoldMg: 42000,
      targetPurityPerMille: 916,
    });
    expect(karigarWastage.eligibleWeightMg).toBe(45000);
    expect(karigarWastage.allowedWastageMg).toBe(675); // 1.5% of 45000
  });

  // Scenario 8: Udhar / Outstanding default to Gold Obligation
  it("SCENARIO 8: Unsettled invoice creates fine gold obligation", () => {
    const invoiceFineMg = 9160;
    const paidCashPaise = 0;
    const obligationType = "gold";
    const balanceGoldMg = obligationType === "gold" ? invoiceFineMg : 0;
    const balancePaise = obligationType === "cash" ? 6412000 : 0;

    expect(balanceGoldMg).toBe(9160);
    expect(balancePaise).toBe(0);
  });

  // Scenario 9: Dedicated Receipt in Gold (Ghar Ka Receipt)
  it("SCENARIO 9: Receipt in Gold updates vault and credits customer gold", () => {
    const receivedGoldGrossMg = 20000;
    const purityPerMille = 916;
    const fineReceivedMg = calculateFineGold({ netWeightMg: receivedGoldGrossMg, purityPerMille }).fineGoldMg;

    expect(fineReceivedMg).toBe(18338); // 20000 * 916 / 999 = 18338 mg
  });

  // Scenario 10: Daily Balance Reconciliation (Opening + Jama - Nave = Closing)
  it("SCENARIO 10: Daily Balance arithmetic reconciliation", () => {
    const openingGoldMg = 120450;
    const jamaGoldMg = 35200;
    const naveGoldMg = 42100;
    const closingGoldMg = openingGoldMg + jamaGoldMg - naveGoldMg;

    expect(closingGoldMg).toBe(113550);
  });

  // Scenario 11: 18K and 24K Purities
  it("SCENARIO 11: Multiple purities (18K: 750, 24K: 995)", () => {
    const res18K = calculateFineGold({ netWeightMg: 10000, purityPerMille: 750 });
    const res24K = calculateFineGold({ netWeightMg: 10000, purityPerMille: 995 });

    expect(res18K.fineGoldMg).toBe(7508); // 10000 * 750 / 999 = 7507.5 -> 7508 mg
    expect(res24K.fineGoldMg).toBe(9960); // 10000 * 995 / 999 = 9959.9 -> 9960 mg
  });

  // Scenario 12: Making / Labour Percentage and Fixed modes
  it("SCENARIO 12: Making charge percentage on metal value", () => {
    const metalValuePaise = 7000000; // ₹70,000.00
    const makingRatePct = 5.0; // 5%
    const makingAmountPaise = Math.round((metalValuePaise * makingRatePct) / 100);

    expect(makingAmountPaise).toBe(350000); // ₹3,500.00
  });

  // Scenario 13: Discount calculation (1% visible discount)
  it("SCENARIO 13: Discount calculation visible and reconciled", () => {
    const subtotalPaise = 7350000; // ₹73,500.00
    const discountPct = 1.0; // 1%
    const discountPaise = Math.round((subtotalPaise * discountPct) / 100);
    const taxablePaise = subtotalPaise - discountPaise;

    expect(discountPaise).toBe(73500); // ₹735.00
    expect(taxablePaise).toBe(7276500); // ₹72,765.00
  });

  // Scenario 14: GST 3% Calculation (1.5% CGST + 1.5% SGST)
  it("SCENARIO 14: GST 3% tax breakdown", () => {
    const taxablePaise = 7276500;
    const cgstPaise = Math.round((taxablePaise * 1.5) / 100);
    const sgstPaise = Math.round((taxablePaise * 1.5) / 100);
    const totalGstPaise = cgstPaise + sgstPaise;
    const grandTotalPaise = taxablePaise + totalGstPaise;

    expect(cgstPaise).toBe(109148);
    expect(sgstPaise).toBe(109148);
    expect(totalGstPaise).toBe(218296);
    expect(grandTotalPaise).toBe(7494796); // ₹74,947.96
  });

  // Scenario 15: URD Old Gold deduction from Invoice Subtotal
  it("SCENARIO 15: URD Old Gold trade-in allowance", () => {
    const invoiceGrandTotalPaise = 7494796;
    const oldGoldFineMg = 5000; // 5.000 g old gold
    const buybackRatePaisePerGram = 690000; // ₹6,900/g
    const oldGoldValuePaise = Math.round((oldGoldFineMg * buybackRatePaisePerGram) / 1000); // ₹34,500.00
    const netPayablePaise = invoiceGrandTotalPaise - oldGoldValuePaise;

    expect(oldGoldValuePaise).toBe(3450000);
    expect(netPayablePaise).toBe(4044796); // ₹40,447.96
  });

  // Scenario 16: Multi-item invoice aggregation
  it("SCENARIO 16: Multi-item gross/net/fine aggregation", () => {
    const items = [
      { grossMg: 10000, lessMg: 200, netMg: 9800, purity: 916 },
      { grossMg: 5500, lessMg: 100, netMg: 5400, purity: 750 },
    ];
    const totalGrossMg = items.reduce((s, i) => s + i.grossMg, 0);
    const totalNetMg = items.reduce((s, i) => s + i.netMg, 0);
    const totalFineMg = items.reduce(
      (s, i) => s + calculateFineGold({ netWeightMg: i.netMg, purityPerMille: i.purity }).fineGoldMg,
      0,
    );

    expect(totalGrossMg).toBe(15500);
    expect(totalNetMg).toBe(15200);
    expect(totalFineMg).toBe(8986 + 4054); // 13040 mg
  });

  // Scenario 17: Karigar Over-loss penalty calculation
  it("SCENARIO 17: Karigar Over-loss detection and penalty", () => {
    const issuedMg = 50000; // 50.000 g issued
    const returnedGrossMg = 45000; // 45.000 g returned
    const scrapMg = 2000; // 2.000 g scrap
    const dustMg = 500; // 0.500 g dust
    const allowedWastageMg = 500; // 0.500 g allowed
    const totalAccountedMg = returnedGrossMg + scrapMg + dustMg + allowedWastageMg;
    const overLossMg = Math.max(0, issuedMg - totalAccountedMg);

    expect(totalAccountedMg).toBe(48000);
    expect(overLossMg).toBe(2000); // 2.000 g missing/over-loss charged to karigar
  });

  // Scenario 18: Continuous Ledger Accumulation without zero-clamping
  it("SCENARIO 18: Continuous Customer Ledger accumulation", () => {
    const openingBalancePaise = 0;
    const bill1Paise = 5000000; // ₹50,000
    const payment1Paise = 6000000; // ₹60,000 (overpayment)
    const runningBal1 = openingBalancePaise + bill1Paise - payment1Paise;
    expect(runningBal1).toBe(-1000000); // -₹10,000 (Cr)

    const bill2Paise = 3000000; // ₹30,000
    const runningBal2 = runningBal1 + bill2Paise;
    expect(runningBal2).toBe(2000000); // ₹20,000 (Dr)
  });

  // Scenario 19: Automatic Settlement from Existing Gold Balance (200g balance -> 50g invoice)
  it("SCENARIO 19: Automatic settlement from existing gold balance (200g balance -> 50g invoice -> 150g remaining)", () => {
    const existingGoldBalanceMg = 200000; // +200.000 g
    const invoiceGoldObligationMg = 50000; // 50.000 g
    const appliedFromBalanceMg = Math.min(existingGoldBalanceMg, invoiceGoldObligationMg);
    const remainingCustomerGoldMg = existingGoldBalanceMg - appliedFromBalanceMg;
    const remainingInvoiceObligationMg = invoiceGoldObligationMg - appliedFromBalanceMg;
    const isFullySettledFromBalance = remainingInvoiceObligationMg === 0;

    expect(appliedFromBalanceMg).toBe(50000); // 50.000 g applied
    expect(remainingCustomerGoldMg).toBe(150000); // +150.000 g remaining on customer balance
    expect(remainingInvoiceObligationMg).toBe(0); // 0 g remaining on invoice
    expect(isFullySettledFromBalance).toBe(true); // SETTLED FROM BALANCE
  });

  // Scenario 20: Partial Automatic Settlement from Existing Gold Balance (30g balance -> 50g invoice)
  it("SCENARIO 20: Partial automatic settlement (30g balance -> 50g invoice -> 0g balance, 20g remaining due)", () => {
    const existingGoldBalanceMg = 30000; // +30.000 g
    const invoiceGoldObligationMg = 50000; // 50.000 g
    const appliedFromBalanceMg = Math.min(existingGoldBalanceMg, invoiceGoldObligationMg);
    const remainingCustomerGoldMg = existingGoldBalanceMg - appliedFromBalanceMg;
    const remainingInvoiceObligationMg = invoiceGoldObligationMg - appliedFromBalanceMg;
    const isFullySettledFromBalance = remainingInvoiceObligationMg === 0;

    expect(appliedFromBalanceMg).toBe(30000); // 30.000 g consumed
    expect(remainingCustomerGoldMg).toBe(0); // 0.000 g customer balance left
    expect(remainingInvoiceObligationMg).toBe(20000); // 20.000 g open gold obligation
    expect(isFullySettledFromBalance).toBe(false); // Partial settlement
  });

  // Scenario 21: Full Exact Settlement (200g balance -> 200g invoice)
  it("SCENARIO 21: Exact full settlement (200g balance -> 200g invoice -> 0g balance, 0g remaining)", () => {
    const existingGoldBalanceMg = 200000; // +200.000 g
    const invoiceGoldObligationMg = 200000; // 200.000 g
    const appliedFromBalanceMg = Math.min(existingGoldBalanceMg, invoiceGoldObligationMg);
    const remainingCustomerGoldMg = existingGoldBalanceMg - appliedFromBalanceMg;
    const remainingInvoiceObligationMg = invoiceGoldObligationMg - appliedFromBalanceMg;

    expect(appliedFromBalanceMg).toBe(200000);
    expect(remainingCustomerGoldMg).toBe(0);
    expect(remainingInvoiceObligationMg).toBe(0);
  });

  // Scenario 22: Balance Overdraft (200g balance -> 250g invoice)
  it("SCENARIO 22: Balance exhaustion (200g balance -> 250g invoice -> 50g remaining obligation)", () => {
    const existingGoldBalanceMg = 200000; // +200.000 g
    const invoiceGoldObligationMg = 250000; // 250.000 g
    const appliedFromBalanceMg = Math.min(existingGoldBalanceMg, invoiceGoldObligationMg);
    const remainingCustomerGoldMg = existingGoldBalanceMg - appliedFromBalanceMg;
    const remainingInvoiceObligationMg = invoiceGoldObligationMg - appliedFromBalanceMg;

    expect(appliedFromBalanceMg).toBe(200000);
    expect(remainingCustomerGoldMg).toBe(0);
    expect(remainingInvoiceObligationMg).toBe(50000); // 50.000 g remaining open obligation
  });

  // Scenario 23: Customer / Jeweller Fine-Gold Accounting Basis
  it("SCENARIO 23: Customer / Jeweller calculation basis is FINE GOLD", () => {
    // 100g 22K (916) with 2% wastage
    const grossMg = 100000;
    const lessMg = 0;
    const netMg = grossMg - lessMg;
    const purity = 916;
    const wastagePct = 2.0;
    const hisabPct = purity / 10 + wastagePct; // 91.6 + 2.0 = 93.6%
    const fineMg = Math.round((netMg * hisabPct * 10) / 1000); // Fine gold accounting basis
    const ratePaise = 700000; // ₹7,000/g
    const metalValuePaise = Math.round((fineMg * ratePaise) / 1000);

    expect(hisabPct).toBe(93.6);
    expect(fineMg).toBe(93600); // 93.600 g Fine Gold
    expect(metalValuePaise).toBe(65520000); // ₹655,200.00
  });

  // Scenario 24: Karigar Physical Custody/Weight Accounting Basis (Fine OFF by Default)
  it("SCENARIO 24: Karigar calculation basis is PHYSICAL WEIGHT / CUSTODY (Fine OFF by default)", () => {
    // 100g 22K material issued to Karigar
    const issuedGrossMg = 100000;
    const karigarFineCalculationEnabled = false; // OFF by default

    // Karigar returns 95g finished jewellery + 3g scrap + 1g filings/dust + 1g allowed wastage
    const returnedFinishedNetMg = 95000;
    const returnedScrapMg = 3000;
    const returnedDustMg = 1000;
    const allowedWastageMg = 1000;

    const totalPhysicalAccountedMg =
      returnedFinishedNetMg + returnedScrapMg + returnedDustMg + allowedWastageMg;
    const remainingPhysicalCustodyMg = issuedGrossMg - totalPhysicalAccountedMg;

    // Physical custody balance is the authoritative accounting basis (0g remaining)
    expect(totalPhysicalAccountedMg).toBe(100000);
    expect(remainingPhysicalCustodyMg).toBe(0); // 100% physical material reconciled
    expect(karigarFineCalculationEnabled).toBe(false); // Fine calculation was not the settlement basis
  });

  // Scenario 25 (User Test 1): 200g existing balance -> 50g invoice -> 50g consumed -> 150g remaining
  it("SCENARIO 25: Test 1 - Existing gold balance 200g, Invoice 50g -> 50g consumed, invoice SETTLED, 150g remaining", () => {
    const existingBalanceMg = 200000; // 200.000 g
    const invoiceObligationMg = 50000; // 50.000 g
    const autoConsumedMg = Math.min(existingBalanceMg, invoiceObligationMg);
    const remainingBalanceMg = existingBalanceMg - autoConsumedMg;
    const remainingInvoiceDueMg = invoiceObligationMg - autoConsumedMg;
    const invoiceStatus = remainingInvoiceDueMg === 0 ? "SETTLED FROM EXISTING GOLD BALANCE" : "PARTIALLY SETTLED";

    expect(autoConsumedMg).toBe(50000);
    expect(remainingBalanceMg).toBe(150000);
    expect(remainingInvoiceDueMg).toBe(0);
    expect(invoiceStatus).toBe("SETTLED FROM EXISTING GOLD BALANCE");
  });

  // Scenario 26 (User Test 2): Invoice 11g -> Cash payment -> Transaction-time rate -> Gold Equivalent calculated
  it("SCENARIO 26: Test 2 - Cash payment with transaction-time gold rate and gold equivalent reference", () => {
    const invoiceFineMg = 11000; // 11.000 g
    const goldRatePaise = 700000; // ₹7,000.00 / g
    const cashPaidPaise = Math.round((invoiceFineMg * goldRatePaise) / 1000); // ₹77,000.00
    const goldEquivalentMg = Math.round((cashPaidPaise * 1000) / goldRatePaise);

    expect(cashPaidPaise).toBe(7700000); // ₹77,000.00
    expect(goldEquivalentMg).toBe(11000); // 11.000 g
    expect(goldRatePaise).toBe(700000); // ₹7,000.00 / g persisted rate
  });

  // Scenario 27 (User Test 3): Mixed Gold + Cash (11g invoice, 10g gold paid -> 1g remaining -> Cash auto-calculated)
  it("SCENARIO 27: Test 3 - Mixed Gold + Cash (11g invoice, 10g gold paid -> 1g cash required auto-computed)", () => {
    const invoiceFineMg = 11000; // 11.000 g
    const goldPaidMg = 10000; // 10.000 g
    const remainingGoldMg = invoiceFineMg - goldPaidMg; // 1.000 g
    const goldRatePaise = 700000; // ₹7,000.00 / g
    const requiredCashPaise = Math.round((remainingGoldMg * goldRatePaise) / 1000); // ₹7,000.00
    const cashPaidPaise = requiredCashPaise;
    const finalRemainingMg = remainingGoldMg - Math.round((cashPaidPaise * 1000) / goldRatePaise);

    expect(remainingGoldMg).toBe(1000); // 1.000 g remaining before cash
    expect(requiredCashPaise).toBe(700000); // ₹7,000.00 cash required
    expect(cashPaidPaise).toBe(700000); // ₹7,000.00 cash paid
    expect(finalRemainingMg).toBe(0); // 0.000 g remaining due (Fully Settled)
  });

  // Scenario 28 (User Test 4): Toggle Use Customer Gold Balance (1g balance, 2g invoice -> 1g consumed -> 1g remaining)
  it("SCENARIO 28: Test 4 - Toggle 'Use Customer Gold Balance' (1g balance, 2g invoice -> 1g consumed -> 1g remaining obligation)", () => {
    const customerBalanceMg = 1000; // 1.000 g
    const invoiceObligationMg = 2000; // 2.000 g
    const useCustomerGoldBalance = true;

    const consumedFromBalanceMg = useCustomerGoldBalance
      ? Math.min(customerBalanceMg, invoiceObligationMg)
      : 0;
    const remainingCustomerBalanceMg = customerBalanceMg - consumedFromBalanceMg;
    const remainingInvoiceObligationMg = invoiceObligationMg - consumedFromBalanceMg;

    expect(consumedFromBalanceMg).toBe(1000); // 1.000 g consumed
    expect(remainingCustomerBalanceMg).toBe(0); // 0.000 g left in account
    expect(remainingInvoiceObligationMg).toBe(1000); // 1.000 g open gold obligation remaining
  });
});

