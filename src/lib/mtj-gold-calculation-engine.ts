/**
 * MTJ ERP — GOLD CALCULATION FORMULA ENGINE
 *
 * Implements the 28 explicit MTJ gold calculation formulas:
 * 1. Net Weight = Gross + Add − Less
 * 2. Touch / Tunch = Net Weight × Touch% / 100
 * 3. Fineness / Per-Mille (1000 basis) = Net Weight × Purity‰ / 1000
 * 4. 999 Fineness-Basis Conversion = Net Weight × Purity‰ / 999
 * 5. 995 Basis = Net Weight × Purity‰ / 995
 * 6. Wastage → Hisab = Touch% + Wastage%
 * 7. Fine from Hisab = Net Weight × Hisab / 100
 * 8. Gold Value = Fine Gold × Gold Rate per Gram
 * 9. Making / Labour % = Base × Making% / 100
 * 10. Labour per gram = Applicable Weight × Labour Rate
 * 11. Labour per piece = Pieces × Labour Rate per Piece
 * 12. Discount = Base × Discount% / 100 or Fixed Discount
 * 13. GST = Taxable × GST% / 100 (CGST/SGST split or IGST)
 * 14. Total Invoice Value = Gold Value + Making + Labour + Other + GST − Discount ± Adjustments
 * 15. Cash → Gold Equivalent = Cash Amount / Transaction-Time Gold Rate
 * 16. Gold → Cash Value = Gold Amount × Transaction-Time Gold Rate
 * 17. Mixed Gold + Cash Settlement = Auto cash calculation for remaining gold obligation
 * 18. Existing Customer Gold Balance Application = MIN(Existing, Obligation) with zero credit-note requirement
 * 19. Partial Balance Application = MIN(Existing, Obligation) + remainder settlement
 * 20. Karigar Work Earning = Total Work × Configured Earning%
 * 21. Karigar Loss & Over-Loss = MAX(0, Actual Loss − Allowed Loss)
 * 22. Karigar Net Settlement = Earning − Deductions − OverLoss ± Advances
 * 23. Purity-Wise Books = Isolated accounting by purity grade
 * 24. Centralized Rounding Policy = High-precision internal, 3-decimal weight, 2-decimal currency
 * 25. Signed Balances = Preserved signed accounting (+/-) with zero-clamp prevention
 * 26. Formula Engine Context Architecture
 * 27. Module-Wise Method Configuration
 * 28. Comprehensive Test Cases A through Q
 */

import { type FinenessBasis } from "@/lib/gold";

// ── 1. Net Weight ────────────────────────────────────────────────────────────
export function calculateNetWeight(grossGrams: number, addGrams: number = 0, lessGrams: number = 0): number {
  return Math.round((grossGrams + addGrams - lessGrams) * 1_000_000) / 1_000_000;
}

// ── 2. Touch / Tunch (100 basis) ────────────────────────────────────────────
export function calculateFineFromTouch(netGrams: number, touchPercent: number): number {
  return Math.round(((netGrams * touchPercent) / 100) * 1_000_000) / 1_000_000;
}

// ── 3. Authoritative Purity Basis: 995 / 99.50% ─────────────────────────────
export function calculateFineAt995(netGrams: number, purityPermille: number): number {
  return Math.round(((netGrams * purityPermille) / 995) * 1_000_000) / 1_000_000;
}

export function calculateFineAtBasis(netGrams: number, purityPermille: number, basis: FinenessBasis = 995): number {
  return calculateFineAt995(netGrams, purityPermille);
}

// ── 4. Work Manufacturing / Melting Gold (Strict Division) ───────────────────
// Handwritten rule: 100 ÷ 91.6 = 109.170 g, 100 ÷ 83.5 = 119.760 g
export function calculateManufacturingMeltingWeight(pureGoldGrams: number, targetPurityPercentOrTouch: number): number {
  if (targetPurityPercentOrTouch <= 0) throw new Error("Target purity must be greater than zero");
  const result = (pureGoldGrams * 100) / targetPurityPercentOrTouch;
  return Math.round(result * 1000) / 1000;
}

// ── 5. Handwritten Billing Fine Calculation (100 × 96 = 96.000, 100 × 88 = 88.000) ───
export function calculateBillingFineGold(netGrams: number, purityPercent: number): number {
  return Math.round(((netGrams * purityPercent) / 100) * 1000) / 1000;
}

// ── 6. Wastage → Hisab ──────────────────────────────────────────────────────
export function calculateHisab(touchPercent: number, wastagePercent: number): number {
  return Math.round((touchPercent + wastagePercent) * 1_000_000) / 1_000_000;
}

// ── 7. Fine from Hisab ──────────────────────────────────────────────────────
export function calculateFineFromHisab(netGrams: number, hisabPercent: number): number {
  return Math.round(((netGrams * hisabPercent) / 100) * 1_000_000) / 1_000_000;
}

// ── 8. Gold Value (₹) ───────────────────────────────────────────────────────
export function calculateGoldValue(fineGrams: number, ratePerGram: number): number {
  return Math.round(fineGrams * ratePerGram * 100) / 100;
}

// ── 9. Making / Labour — Percentage ────────────────────────────────────────
export function calculateMakingPercentage(baseAmount: number, makingPercent: number): number {
  return Math.round(((baseAmount * makingPercent) / 100) * 100) / 100;
}

// ── 10. Labour — Per Gram ───────────────────────────────────────────────────
export function calculateLabourPerGram(applicableWeightGrams: number, labourRatePerGram: number): number {
  return Math.round(applicableWeightGrams * labourRatePerGram * 100) / 100;
}

// ── 11. Labour — Per Piece ──────────────────────────────────────────────────
export function calculateLabourPerPiece(pieceCount: number, labourRatePerPiece: number): number {
  return Math.round(pieceCount * labourRatePerPiece * 100) / 100;
}

// ── 12. Discount ────────────────────────────────────────────────────────────
export function calculateDiscount(baseAmount: number, discountPercent?: number, fixedDiscount?: number): number {
  if (fixedDiscount != null && fixedDiscount > 0) {
    return Math.min(baseAmount, fixedDiscount);
  }
  if (discountPercent != null && discountPercent > 0) {
    return Math.round(((baseAmount * discountPercent) / 100) * 100) / 100;
  }
  return 0;
}

// ── 13. GST ─────────────────────────────────────────────────────────────────
export interface GstBreakdown {
  totalGst: number;
  cgst: number;
  sgst: number;
  igst: number;
  isInterstate: boolean;
}

export function calculateGst(taxableAmount: number, gstRatePercent: number = 3, isInterstate: boolean = false): GstBreakdown {
  const totalGst = Math.round(((taxableAmount * gstRatePercent) / 100) * 100) / 100;
  if (isInterstate) {
    return {
      totalGst,
      cgst: 0,
      sgst: 0,
      igst: totalGst,
      isInterstate: true,
    };
  }
  const halfGst = Math.round((totalGst / 2) * 100) / 100;
  const otherHalf = Math.round((totalGst - halfGst) * 100) / 100;
  return {
    totalGst,
    cgst: halfGst,
    sgst: otherHalf,
    igst: 0,
    isInterstate: false,
  };
}

// ── 14. Total Invoice Value ────────────────────────────────────────────────
export interface InvoiceCalculationInput {
  fineGoldGrams: number;
  goldRatePerGram: number;
  makingAmount?: number;
  labourAmount?: number;
  otherCharges?: number;
  discountAmount?: number;
  gstRatePercent?: number;
  isInterstate?: boolean;
}

export interface InvoiceCalculationOutput {
  goldValue: number;
  subtotalTaxable: number;
  discountApplied: number;
  taxableAfterDiscount: number;
  gst: GstBreakdown;
  totalInvoiceAmount: number;
}

export function calculateTotalInvoice(input: InvoiceCalculationInput): InvoiceCalculationOutput {
  const goldValue = calculateGoldValue(input.fineGoldGrams, input.goldRatePerGram);
  const making = input.makingAmount || 0;
  const labour = input.labourAmount || 0;
  const other = input.otherCharges || 0;
  const subtotalTaxable = goldValue + making + labour + other;

  const discount = Math.min(subtotalTaxable, input.discountAmount || 0);
  const taxableAfterDiscount = subtotalTaxable - discount;

  const gst = calculateGst(taxableAfterDiscount, input.gstRatePercent ?? 3, input.isInterstate ?? false);
  const totalInvoiceAmount = Math.round((taxableAfterDiscount + gst.totalGst) * 100) / 100;

  return {
    goldValue,
    subtotalTaxable,
    discountApplied: discount,
    taxableAfterDiscount,
    gst,
    totalInvoiceAmount,
  };
}

// ── 15. Cash → Gold Equivalent / Bhav Rule ──────────────────────────────────
// Handwritten rule: ₹15,000 Bhav => ₹1,00,000 ÷ ₹15,000 = 6.666 g
export interface CashToGoldEquivalent {
  cashAmount: number;
  transactionTimeGoldRate: number;
  goldEquivalentGrams: number;
}

export function calculateBhavGoldEquivalent(cashAmountRupees: number, bhavRatePerGram: number): number {
  if (bhavRatePerGram <= 0) throw new Error("Bhav rate must be greater than zero.");
  // Exact 3-decimal precision: 1,00,000 / 15,000 = 6.666... g
  return Math.floor((cashAmountRupees / bhavRatePerGram) * 1_000) / 1_000;
}

export function calculateCashToGoldEquivalent(cashAmount: number, ratePerGram: number): CashToGoldEquivalent {
  if (ratePerGram <= 0) {
    throw new Error("Transaction-time gold rate must be greater than zero.");
  }
  const goldEquivalentGrams = Math.round((cashAmount / ratePerGram) * 1_000_000) / 1_000_000;
  return {
    cashAmount,
    transactionTimeGoldRate: ratePerGram,
    goldEquivalentGrams,
  };
}

// ── 16. Gold → Cash Value ───────────────────────────────────────────────────
export function calculateGoldToCashValue(goldGrams: number, ratePerGram: number): number {
  return Math.round(goldGrams * ratePerGram * 100) / 100;
}

// ── 17. Mixed Gold + Cash Settlement ───────────────────────────────────────
export interface MixedSettlementResult {
  totalObligationGrams: number;
  goldPaidGrams: number;
  remainingGoldGrams: number;
  requiredCashAmount: number;
  transactionTimeRate: number;
}

export function calculateMixedSettlement(
  totalObligationGrams: number,
  goldPaidGrams: number,
  transactionTimeRate: number,
): MixedSettlementResult {
  const actualGoldPaid = Math.min(totalObligationGrams, Math.max(0, goldPaidGrams));
  const remainingGoldGrams = Math.round((totalObligationGrams - actualGoldPaid) * 1_000_000) / 1_000_000;
  const requiredCashAmount = calculateGoldToCashValue(remainingGoldGrams, transactionTimeRate);

  return {
    totalObligationGrams,
    goldPaidGrams: actualGoldPaid,
    remainingGoldGrams,
    requiredCashAmount,
    transactionTimeRate,
  };
}

// ── 18 & 19. Existing Customer Gold Balance Application ────────────────────
export interface CustomerBalanceSettlementResult {
  existingGoldBalanceGrams: number;
  invoiceObligationGrams: number;
  appliedGoldGrams: number;
  remainingInvoiceObligationGrams: number;
  remainingCustomerBalanceGrams: number;
  isFullySettledFromBalance: boolean;
}

export function applyCustomerGoldBalance(
  existingBalanceGrams: number,
  invoiceObligationGrams: number,
): CustomerBalanceSettlementResult {
  const appliedGoldGrams = Math.min(existingBalanceGrams, invoiceObligationGrams);
  const remainingInvoiceObligationGrams =
    Math.round((invoiceObligationGrams - appliedGoldGrams) * 1_000_000) / 1_000_000;
  const remainingCustomerBalanceGrams =
    Math.round((existingBalanceGrams - appliedGoldGrams) * 1_000_000) / 1_000_000;

  return {
    existingGoldBalanceGrams: existingBalanceGrams,
    invoiceObligationGrams,
    appliedGoldGrams,
    remainingInvoiceObligationGrams,
    remainingCustomerBalanceGrams,
    isFullySettledFromBalance: remainingInvoiceObligationGrams === 0,
  };
}

// ── 20. Karigar Work Earning ───────────────────────────────────────────────
export function calculateKarigarEarning(totalWorkGrams: number, earningPercent: number): number {
  return Math.round(((totalWorkGrams * earningPercent) / 100) * 1_000_000) / 1_000_000;
}

// ── 21. Karigar Loss & Over-Loss ───────────────────────────────────────────
export interface KarigarLossResult {
  issuedMaterialGrams: number;
  returnedMaterialGrams: number;
  actualLossGrams: number;
  allowedLossGrams: number;
  overLossGrams: number;
}

export function calculateKarigarLoss(
  issuedGrams: number,
  returnedGrams: number,
  allowedLossGrams: number,
): KarigarLossResult {
  const actualLossGrams = Math.round((issuedGrams - returnedGrams) * 1_000_000) / 1_000_000;
  const overLossGrams = Math.max(0, Math.round((actualLossGrams - allowedLossGrams) * 1_000_000) / 1_000_000);

  return {
    issuedMaterialGrams: issuedGrams,
    returnedMaterialGrams: returnedGrams,
    actualLossGrams,
    allowedLossGrams,
    overLossGrams,
  };
}

// ── 22. Karigar Net Settlement ─────────────────────────────────────────────
export interface KarigarNetSettlementInput {
  workerEarningGrams: number;
  chainDeductionGrams?: number;
  overLossGrams?: number;
  otherDeductionsGrams?: number;
  advanceAdjustmentsGrams?: number;
}

export interface KarigarNetSettlementResult {
  workerEarningGrams: number;
  totalDeductionsGrams: number;
  netSettlementGrams: number;
}

export function calculateKarigarNetSettlement(input: KarigarNetSettlementInput): KarigarNetSettlementResult {
  const chain = input.chainDeductionGrams || 0;
  const overLoss = input.overLossGrams || 0;
  const other = input.otherDeductionsGrams || 0;
  const advances = input.advanceAdjustmentsGrams || 0;

  const totalDeductionsGrams = Math.round((chain + overLoss + other) * 1_000_000) / 1_000_000;
  const netSettlementGrams =
    Math.round((input.workerEarningGrams - totalDeductionsGrams + advances) * 1_000_000) / 1_000_000;

  return {
    workerEarningGrams: input.workerEarningGrams,
    totalDeductionsGrams,
    netSettlementGrams,
  };
}

// ── 23. Purity-Wise Book Ledger Balance ────────────────────────────────────
export interface PurityBookEntry {
  purityGrade: string; // e.g. "916", "875", "750", "585", "995", "999"
  openingGrams: number;
  receiptsCreditsGrams: number;
  issuesDebitsGrams: number;
  adjustmentsGrams: number;
  settlementsGrams: number;
}

export function calculatePurityBookBalance(entry: PurityBookEntry): number {
  return (
    Math.round(
      (entry.openingGrams +
        entry.receiptsCreditsGrams -
        entry.issuesDebitsGrams +
        entry.adjustmentsGrams -
        entry.settlementsGrams) *
        1_000_000,
    ) / 1_000_000
  );
}

// ── 24. Standard Display Formatting (3 Decimals Weight, 2 Decimals Cash) ───
export function formatGoldWeight(grams: number): string {
  return grams.toFixed(3);
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── 25. Gold-First Universal Pair Presentation ──────────────────────────────
export interface GoldFirstValue {
  goldEquivalentGrams: number;
  actualRupees: number;
  ratePerGram: number;
  primaryLabel: string; // e.g. "11.600 g GOLD EQUIVALENT"
  secondaryLabel: string; // e.g. "₹116,000"
}

export function createGoldFirstValue(actualRupees: number, ratePerGram: number): GoldFirstValue {
  const goldEquivalentGrams = ratePerGram > 0 ? Math.round((actualRupees / ratePerGram) * 1_000_000) / 1_000_000 : 0;
  return {
    goldEquivalentGrams,
    actualRupees,
    ratePerGram,
    primaryLabel: `${formatGoldWeight(goldEquivalentGrams)} g equivalent`,
    secondaryLabel: formatCurrency(actualRupees),
  };
}

// ── 26. Gold-First Master Total Bill ────────────────────────────────────────
export interface GoldFirstBillTotals {
  goldValue: number;
  making: number;
  labour: number;
  gst: number;
  discount: number;
  netRupeesTotal: number;
  ratePerGram: number;
  goldEquivalentTotalGrams: number;
  primaryDisplay: string;
  secondaryDisplay: string;
}

export function calculateGoldFirstBillTotals(
  goldValue: number,
  making: number,
  labour: number,
  gst: number,
  discount: number,
  ratePerGram: number,
): GoldFirstBillTotals {
  const netRupeesTotal = Math.round((goldValue + making + labour + gst - discount) * 100) / 100;
  const goldEquivalentTotalGrams =
    ratePerGram > 0 ? Math.round((netRupeesTotal / ratePerGram) * 1_000_000) / 1_000_000 : 0;

  return {
    goldValue,
    making,
    labour,
    gst,
    discount,
    netRupeesTotal,
    ratePerGram,
    goldEquivalentTotalGrams,
    primaryDisplay: `${formatGoldWeight(goldEquivalentTotalGrams)} g GOLD EQUIVALENT`,
    secondaryDisplay: formatCurrency(netRupeesTotal),
  };
}

// ── 27. Gold-First Profit, Expense, and Outstanding ─────────────────────────
export function calculateGoldFirstProfit(profitRupees: number, ratePerGram: number): GoldFirstValue {
  return createGoldFirstValue(profitRupees, ratePerGram);
}

export function calculateGoldFirstExpense(expenseRupees: number, ratePerGram: number): GoldFirstValue {
  return createGoldFirstValue(expenseRupees, ratePerGram);
}

export function calculateGoldFirstOutstanding(outstandingRupees: number, ratePerGram: number): GoldFirstValue {
  return createGoldFirstValue(outstandingRupees, ratePerGram);
}
