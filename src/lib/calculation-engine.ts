/**
 * AVS Gold ERP — Universal Formula & Calculation Engine
 *
 * Centralized, explainable calculation registry for Fine Gold, Karigar Wastage
 * with Category Exclusions (e.g. Chains 0%), Over-Loss Purity Retention,
 * GST Dual-Currency calculations, and Multi-Unit Weight conversions.
 */

import { fineGoldMg, getPureGoldReferencePermille, grossFromFineMg } from "./gold";
import { evaluateBusinessRules, type BusinessRuleDefinition } from "./formula-engine";

export interface FineGoldCalculationInput {
  netWeightMg: number;
  purityPerMille: number; // e.g. 916 for 22K, 750 for 18K, 1000 for 24K
}

export interface FineGoldCalculationResult {
  netWeightMg: number;
  purityPerMille: number;
  fineGoldMg: number;
  fineGoldGrams: number;
  explanation: string;
}

export interface CategoryWeightItem {
  categoryId: string;
  categoryName: string;
  weightMg: number;
  isWastageExcluded?: boolean; // e.g. true for Chains, Machine items
}

export interface KarigarWastageInput {
  totalSubmittedNetWeightMg: number;
  karigarWastagePct: number; // e.g. 1.5%
  items: CategoryWeightItem[];
  issuedFineGoldMg: number;
  targetPurityPerMille: number; // e.g. 916
}

export interface KarigarWastageResult {
  totalSubmittedMg: number;
  excludedWeightMg: number;
  eligibleWeightMg: number;
  allowedWastageMg: number;
  allowedWastageFineMg: number;
  submittedFineMg: number;
  netDueFineMg: number;
  isOverLoss: boolean;
  overLossPenaltyFineMg: number;
  refundFineMgInOriginalPurity: {
    purityPerMille: number;
    metalWeightMg: number;
  };
  explanation: string[];
}

export interface DualCurrencyBillingInput {
  netWeightGrams: number;
  goldRatePerGram: number;
  makingChargePct: number;
  stoneChargesRs: number;
  discountRs: number;
  isInterstate?: boolean;
}

export interface DualCurrencyBillingResult {
  netWeightGrams: number;
  goldRatePerGram: number;
  goldValueRs: number;
  makingChargesRs: number;
  stoneChargesRs: number;
  discountRs: number;
  subtotalRs: number;
  cgstRs: number;
  sgstRs: number;
  igstRs: number;
  totalGstRs: number;
  grandTotalRs: number;
  fineGoldGramsEquivalent: number;
  explanation: string[];
}

export interface UnitConversionResult {
  grams: number;
  milligrams: number;
  troyOunces: number;
  tolas: number;
}

/**
 * Calculates Fine Gold weight from Net Weight and Purity (Per Mille).
 */
export function calculateFineGold(input: FineGoldCalculationInput): FineGoldCalculationResult {
  const { netWeightMg, purityPerMille } = input;
  // Routes through gold.ts's fineGoldMg() — single SoT; default pure ref = 995.
  const pureRef = getPureGoldReferencePermille();
  const fineGoldMgValue = fineGoldMg(netWeightMg, Math.min(purityPerMille, 999));
  const fineGoldGrams = Number((fineGoldMgValue / 1000).toFixed(3));

  return {
    netWeightMg,
    purityPerMille,
    fineGoldMg: fineGoldMgValue,
    fineGoldGrams,
    explanation: `${netWeightMg}mg Net Wt * (${purityPerMille}/${pureRef} Purity) = ${fineGoldMgValue}mg Fine Gold (${fineGoldGrams}g)`,
  };
}

/**
 * Calculates Karigar Wastage with Category Exclusion (e.g., 0% wastage allowance on chains)
 * and returns net due fine gold and refund in exact original purity.
 */
export function calculateKarigarWastage(input: KarigarWastageInput): KarigarWastageResult {
  const {
    totalSubmittedNetWeightMg,
    karigarWastagePct,
    items,
    issuedFineGoldMg,
    targetPurityPerMille,
  } = input;

  const explanation: string[] = [];

  // 1. Calculate Excluded Weight (e.g. Chains)
  const excludedWeightMg = items
    .filter((item) => item.isWastageExcluded)
    .reduce((sum, item) => sum + item.weightMg, 0);

  const eligibleWeightMg = Math.max(0, totalSubmittedNetWeightMg - excludedWeightMg);
  explanation.push(
    `Total Submitted: ${totalSubmittedNetWeightMg}mg, Excluded Categories (Chains): ${excludedWeightMg}mg -> Eligible Weight: ${eligibleWeightMg}mg`,
  );

  // 2. Allowed Wastage Calculation
  const allowedWastageMg = Math.round(eligibleWeightMg * (karigarWastagePct / 100));
  const allowedWastageFineMg = fineGoldMg(allowedWastageMg, Math.min(targetPurityPerMille, 999));
  explanation.push(
    `Allowed Wastage (${karigarWastagePct}% on ${eligibleWeightMg}mg): ${allowedWastageMg}mg (${allowedWastageFineMg}mg Fine)`,
  );

  // 3. Submitted Fine Weight
  const submittedFineMg = fineGoldMg(
    totalSubmittedNetWeightMg,
    Math.min(targetPurityPerMille, 999),
  );
  explanation.push(`Submitted Fine Gold: ${submittedFineMg}mg`);

  // 4. Net Due Fine Calculation
  const totalAccountedFineMg = submittedFineMg + allowedWastageFineMg;
  const netDueFineMg = issuedFineGoldMg - totalAccountedFineMg;
  const isOverLoss = netDueFineMg < 0;

  const overLossPenaltyFineMg = isOverLoss ? Math.abs(netDueFineMg) : 0;

  // 5. Refund in Original Purity
  // Inverse of fineGoldMg via grossFromFineMg (same pure-gold reference).
  const refundMetalWeightMg = grossFromFineMg(
    Math.abs(netDueFineMg),
    Math.min(targetPurityPerMille, 999),
  );
  explanation.push(
    isOverLoss
      ? `Karigar Over-Loss detected: ${overLossPenaltyFineMg}mg Fine (${refundMetalWeightMg}mg in ${targetPurityPerMille / 10}K purity)`
      : `Remaining Karigar Due Balance: ${netDueFineMg}mg Fine Gold`,
  );

  return {
    totalSubmittedMg: totalSubmittedNetWeightMg,
    excludedWeightMg,
    eligibleWeightMg,
    allowedWastageMg,
    allowedWastageFineMg,
    submittedFineMg,
    netDueFineMg,
    isOverLoss,
    overLossPenaltyFineMg,
    refundFineMgInOriginalPurity: {
      purityPerMille: targetPurityPerMille,
      metalWeightMg: refundMetalWeightMg,
    },
    explanation,
  };
}

/**
 * Calculates GST Dual-Currency Billing (Fine Gold Weight + Cash Amount).
 */
export function calculateDualCurrencyBilling(
  input: DualCurrencyBillingInput,
): DualCurrencyBillingResult {
  const {
    netWeightGrams,
    goldRatePerGram,
    makingChargePct,
    stoneChargesRs,
    discountRs,
    isInterstate = false,
  } = input;

  const explanation: string[] = [];

  // Gold Value
  const goldValueRs = Math.round(netWeightGrams * goldRatePerGram);
  explanation.push(`Gold Value: ${netWeightGrams}g * ₹${goldRatePerGram}/g = ₹${goldValueRs}`);

  // Making Charges
  const makingChargesRs = Math.round(goldValueRs * (makingChargePct / 100));
  explanation.push(`Making Charges (${makingChargePct}%): ₹${makingChargesRs}`);

  // Subtotal
  const subtotalRs = Math.max(0, goldValueRs + makingChargesRs + stoneChargesRs - discountRs);
  explanation.push(
    `Subtotal: ₹${goldValueRs} + ₹${makingChargesRs} + ₹${stoneChargesRs} - ₹${discountRs} = ₹${subtotalRs}`,
  );

  // GST (3%)
  let cgstRs = 0;
  let sgstRs = 0;
  let igstRs = 0;

  if (isInterstate) {
    igstRs = Math.round(subtotalRs * 0.03);
    explanation.push(`IGST (3.0%): ₹${igstRs}`);
  } else {
    cgstRs = Math.round(subtotalRs * 0.015);
    sgstRs = Math.round(subtotalRs * 0.015);
    explanation.push(`CGST (1.5%): ₹${cgstRs}, SGST (1.5%): ₹${sgstRs}`);
  }

  const totalGstRs = cgstRs + sgstRs + igstRs;
  const grandTotalRs = subtotalRs + totalGstRs;
  const fineGoldGramsEquivalent = Number((netWeightGrams * 0.916).toFixed(3)); // 22K reference

  return {
    netWeightGrams,
    goldRatePerGram,
    goldValueRs,
    makingChargesRs,
    stoneChargesRs,
    discountRs,
    subtotalRs,
    cgstRs,
    sgstRs,
    igstRs,
    totalGstRs,
    grandTotalRs,
    fineGoldGramsEquivalent,
    explanation,
  };
}

/**
 * Converts Grams to Troy Ounces and Tolas.
 */
export function convertWeightUnits(grams: number): UnitConversionResult {
  const milligrams = Math.round(grams * 1000);
  const troyOunces = Number((grams / 31.1034768).toFixed(4));
  const tolas = Number((grams / 11.6638038).toFixed(4));

  return {
    grams,
    milligrams,
    troyOunces,
    tolas,
  };
}

export interface AlloyRecipeInput {
  targetWeightGrams: number;
  targetKarat: 22 | 18 | 14 | 10;
}

export interface AlloyRecipeResult {
  targetWeightGrams: number;
  targetKarat: number;
  pureGold24KGrams: number;
  copperAlloyGrams: number;
  silverAlloyGrams: number;
  totalAlloyGrams: number;
  explanation: string[];
}

/**
 * Calculates exact 24K pure gold, copper, and silver weights required to alloy a target karat batch. (Section 53)
 */
export function calculateAlloyBatchRecipe(input: AlloyRecipeInput): AlloyRecipeResult {
  const { targetWeightGrams, targetKarat } = input;
  const purityRatio = targetKarat / 24;

  const pureGold24KGrams = Number((targetWeightGrams * purityRatio).toFixed(3));
  const totalAlloyGrams = Number((targetWeightGrams - pureGold24KGrams).toFixed(3));

  // Default alloy mix: 75% Copper, 25% Silver for 22K/18K gold color balance
  const copperAlloyGrams = Number((totalAlloyGrams * 0.75).toFixed(3));
  const silverAlloyGrams = Number((totalAlloyGrams * 0.25).toFixed(3));

  const explanation = [
    `Target: ${targetWeightGrams}g of ${targetKarat}K Gold`,
    `24K Pure Gold Required: ${pureGold24KGrams}g (${(purityRatio * 100).toFixed(2)}%)`,
    `Alloy Additions Required: ${totalAlloyGrams}g (Copper: ${copperAlloyGrams}g, Silver: ${silverAlloyGrams}g)`,
  ];

  return {
    targetWeightGrams,
    targetKarat,
    pureGold24KGrams,
    copperAlloyGrams,
    silverAlloyGrams,
    totalAlloyGrams,
    explanation,
  };
}

export interface ProcessShrinkageInput {
  preProcessGrossMg: number;
  postProcessGrossMg: number;
  stoneWeightAddedMg?: number;
  meenaWeightAddedMg?: number;
}

export interface ProcessShrinkageResult {
  preProcessGrossMg: number;
  postProcessGrossMg: number;
  stoneWeightAddedMg: number;
  meenaWeightAddedMg: number;
  netGoldLossMg: number;
  variancePct: number;
  isExcessiveLoss: boolean;
  explanation: string;
}

/**
 * Calculates Net Gold Shrinkage/Loss during Meena, Enameling, and Stone Setting. (Section 49)
 */
export function calculateProcessShrinkage(input: ProcessShrinkageInput): ProcessShrinkageResult {
  const {
    preProcessGrossMg,
    postProcessGrossMg,
    stoneWeightAddedMg = 0,
    meenaWeightAddedMg = 0,
  } = input;

  const expectedGrossMg = preProcessGrossMg + stoneWeightAddedMg + meenaWeightAddedMg;
  const netGoldLossMg = Math.max(0, expectedGrossMg - postProcessGrossMg);
  const variancePct =
    preProcessGrossMg > 0 ? Number(((netGoldLossMg / preProcessGrossMg) * 100).toFixed(2)) : 0;
  const isExcessiveLoss = variancePct > 1.0; // Alert if loss > 1.0%

  return {
    preProcessGrossMg,
    postProcessGrossMg,
    stoneWeightAddedMg,
    meenaWeightAddedMg,
    netGoldLossMg,
    variancePct,
    isExcessiveLoss,
    explanation: `Pre-process: ${preProcessGrossMg}mg, Post-process: ${postProcessGrossMg}mg, Added (Stone/Meena): ${stoneWeightAddedMg + meenaWeightAddedMg}mg -> Net Gold Loss: ${netGoldLossMg}mg (${variancePct}%)`,
  };
}

export type LabourBasis = "gross" | "net" | "fine" | "piece" | "carat";

export interface LabourCalculationInput {
  basis: LabourBasis;
  ratePerUnitPaise: number;
  grossWeightMg: number;
  netWeightMg: number;
  fineWeightMg: number;
  piecesCount?: number;
  caratsCount?: number;
}

export interface LabourCalculationResult {
  basis: LabourBasis;
  ratePerUnitPaise: number;
  effectiveUnits: number;
  totalLabourChargePaise: number;
  totalLabourChargeRupees: number;
  explanation: string;
}

/**
 * Calculates Labour Making Charge across Gross, Net, Fine, Piece, or Carat basis.
 */
export function calculateLabourCharge(input: LabourCalculationInput): LabourCalculationResult {
  const {
    basis,
    ratePerUnitPaise,
    grossWeightMg,
    netWeightMg,
    fineWeightMg,
    piecesCount = 1,
    caratsCount = 0,
  } = input;

  let effectiveUnits = 0;
  switch (basis) {
    case "gross":
      effectiveUnits = grossWeightMg / 1000; // grams
      break;
    case "net":
      effectiveUnits = netWeightMg / 1000; // grams
      break;
    case "fine":
      effectiveUnits = fineWeightMg / 1000; // grams
      break;
    case "piece":
      effectiveUnits = piecesCount;
      break;
    case "carat":
      effectiveUnits = caratsCount;
      break;
  }

  const totalLabourChargePaise = Math.round(effectiveUnits * ratePerUnitPaise);
  const totalLabourChargeRupees = Number((totalLabourChargePaise / 100).toFixed(2));

  return {
    basis,
    ratePerUnitPaise,
    effectiveUnits: Number(effectiveUnits.toFixed(3)),
    totalLabourChargePaise,
    totalLabourChargeRupees,
    explanation: `Labour Basis: ${basis}, Rate: ₹${(ratePerUnitPaise / 100).toFixed(2)}/unit, Units: ${effectiveUnits.toFixed(3)} -> Total Labour: ₹${totalLabourChargeRupees}`,
  };
}

export type HallmarkBasis = "fixed_per_piece" | "per_gram" | "percentage";

export interface HallmarkCalculationInput {
  basis: HallmarkBasis;
  ratePaise: number;
  grossWeightMg: number;
  piecesCount?: number;
  itemValuePaise?: number;
}

export interface HallmarkCalculationResult {
  basis: HallmarkBasis;
  totalHallmarkChargePaise: number;
  totalHallmarkChargeRupees: number;
  explanation: string;
}

/**
 * Calculates Hallmark Verification Charges (Fixed per piece, Per gram, or Percentage).
 */
export function calculateHallmarkCharge(
  input: HallmarkCalculationInput,
): HallmarkCalculationResult {
  const { basis, ratePaise, grossWeightMg, piecesCount = 1, itemValuePaise = 0 } = input;

  let totalHallmarkChargePaise = 0;
  switch (basis) {
    case "fixed_per_piece":
      totalHallmarkChargePaise = ratePaise * piecesCount;
      break;
    case "per_gram":
      totalHallmarkChargePaise = Math.round((grossWeightMg / 1000) * ratePaise);
      break;
    case "percentage":
      totalHallmarkChargePaise = Math.round(itemValuePaise * (ratePaise / 10000)); // ratePaise in basis points
      break;
  }

  const totalHallmarkChargeRupees = Number((totalHallmarkChargePaise / 100).toFixed(2));

  return {
    basis,
    totalHallmarkChargePaise,
    totalHallmarkChargeRupees,
    explanation: `Hallmark Basis: ${basis}, Rate: ${ratePaise} -> Charge: ₹${totalHallmarkChargeRupees}`,
  };
}

// ── Configurable making/labour charge resolution ─────────────────────────

export type MakingChargeBasis =
  "percentage" | "gross" | "net" | "fine" | "piece" | "carat" | "flat";

export interface MakingChargeResolutionInput {
  basis: MakingChargeBasis;
  /** Used only when basis is "percentage". */
  percent?: number;
  /** Used for every other basis — paise per gram, per piece, per carat, or the flat charge itself. */
  ratePerUnitPaise?: number;
  goldValuePaise: number;
  grossWeightMg: number;
  netWeightMg: number;
  fineWeightMg: number;
  piecesCount?: number;
  caratsCount?: number;
}

export interface MakingChargeResolutionResult {
  basis: MakingChargeBasis;
  /** The rate actually used — percent for "percentage", paise/unit for everything else, the flat amount for "flat". Snapshot this alongside basis on the invoice item so a historical row is immutable even if settings change later. */
  resolvedRate: number;
  totalChargePaise: number;
  explanation: string;
}

/**
 * Resolves a making/labour charge for one item under whichever basis a
 * tenant (or a category/item-level override) has configured. "percentage"
 * reproduces the original always-%-of-gold-value behavior exactly; every
 * other basis delegates to calculateLabourCharge. Callers should snapshot
 * the returned basis + resolvedRate onto the persisted record (e.g.
 * InvoiceItem.makingChargeBasis / makingChargeRatePerUnitPaise) so a change
 * to settings later never alters an already-posted transaction.
 */
export function resolveMakingCharge(
  input: MakingChargeResolutionInput,
): MakingChargeResolutionResult {
  const { basis, goldValuePaise } = input;

  if (basis === "percentage") {
    const percent = input.percent ?? 0;
    const totalChargePaise = Math.round((goldValuePaise * percent) / 100);
    return {
      basis,
      resolvedRate: percent,
      totalChargePaise,
      explanation: `Making Charge: ${percent}% of gold value ₹${(goldValuePaise / 100).toFixed(2)} -> ₹${(totalChargePaise / 100).toFixed(2)}`,
    };
  }

  if (basis === "flat") {
    const flatPaise = input.ratePerUnitPaise ?? 0;
    return {
      basis,
      resolvedRate: flatPaise,
      totalChargePaise: flatPaise,
      explanation: `Making Charge: flat ₹${(flatPaise / 100).toFixed(2)}`,
    };
  }

  const labour = calculateLabourCharge({
    basis,
    ratePerUnitPaise: input.ratePerUnitPaise ?? 0,
    grossWeightMg: input.grossWeightMg,
    netWeightMg: input.netWeightMg,
    fineWeightMg: input.fineWeightMg,
    piecesCount: input.piecesCount,
    caratsCount: input.caratsCount,
  });
  return {
    basis,
    resolvedRate: input.ratePerUnitPaise ?? 0,
    totalChargePaise: labour.totalLabourChargePaise,
    explanation: labour.explanation,
  };
}

export interface DeclarativeRuleApplicationResult {
  record: Record<string, number | string | boolean>;
  requiresApproval: boolean;
  approvalRole?: string;
  messages: string[];
  triggeredRuleNames: string[];
}

/**
 * Applies tenant declarative business rules to a calculation record context.
 * Used by workshop, billing, and custom book formula columns at runtime.
 */
export function applyDeclarativeBusinessRules(
  record: Record<string, number | string | boolean>,
  rules: BusinessRuleDefinition[],
): DeclarativeRuleApplicationResult {
  const result = evaluateBusinessRules(rules, record);
  const enriched = { ...record };
  for (const [field, value] of Object.entries(result.calculatedOverrides)) {
    enriched[field] = value;
  }
  return {
    record: enriched,
    requiresApproval: result.requiresApproval,
    approvalRole: result.approvalRole,
    messages: result.messages,
    triggeredRuleNames: result.triggeredRules.map((r) => r.name),
  };
}

/**
 * Karigar wastage with declarative rule overrides applied to eligible weight.
 */
export function calculateKarigarWastageWithRules(
  input: KarigarWastageInput,
  rules: BusinessRuleDefinition[],
): KarigarWastageResult & { ruleMessages: string[]; requiresApproval: boolean } {
  const baseRecord: Record<string, number | string | boolean> = {
    gross_weight: input.totalSubmittedNetWeightMg / 1000,
    net_weight: input.totalSubmittedNetWeightMg / 1000,
    chain_weight:
      input.items.filter((i) => i.isWastageExcluded).reduce((s, i) => s + i.weightMg, 0) / 1000,
    loss_percentage:
      input.issuedFineGoldMg > 0
        ? Math.max(
            0,
            ((input.issuedFineGoldMg -
              fineGoldMg(input.totalSubmittedNetWeightMg, input.targetPurityPerMille)) /
              input.issuedFineGoldMg) *
              100,
          )
        : 0,
  };

  const ruleResult = applyDeclarativeBusinessRules(baseRecord, rules);
  const adjustedItems = [...input.items];
  const chainOverride = ruleResult.record.worker_eligible_weight;
  if (typeof chainOverride === "number") {
    const excludedMg = Math.max(
      0,
      input.totalSubmittedNetWeightMg - Math.round(chainOverride * 1000),
    );
    const chainIdx = adjustedItems.findIndex((i) => i.isWastageExcluded);
    if (chainIdx >= 0) {
      adjustedItems[chainIdx] = { ...adjustedItems[chainIdx], weightMg: excludedMg };
    }
  }

  const wastage = calculateKarigarWastage({ ...input, items: adjustedItems });
  return {
    ...wastage,
    ruleMessages: ruleResult.messages,
    requiresApproval: ruleResult.requiresApproval,
  };
}
