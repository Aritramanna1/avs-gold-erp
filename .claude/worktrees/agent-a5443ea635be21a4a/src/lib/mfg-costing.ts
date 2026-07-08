/**
 * MTJ ERP — Manufacturing Costing Engine
 * Pure calculation functions. All values in paise or milligrams.
 * Integer arithmetic only — no floating point.
 */

/** Inputs for full manufacturing cost calculation */
export interface MfgCostingInputs {
  /** Labour charges in paise */
  labourChargesPaise: number;
  /** Making charges per piece × pcs in paise */
  makingChargesPaise: number;
  /** Stone / diamond setting in paise */
  stoneCostPaise: number;
  /** Hallmark / BIS certification in paise */
  hallmarkChargesPaise: number;
  /** Wastage fine gold in mg */
  wastageMg: number;
  /** Gold rate paise per gram (for valuing wastage) */
  goldRatePaisePerGram: number;
  /** Fine gold recovered/returned (reduces cost) in mg */
  recoveryMg: number;
  /** Gold rate for recovery credit paise per gram */
  recoveryRatePaisePerGram: number;
}

export interface MfgCostingResult {
  labourCostPaise: number;
  makingChargesPaise: number;
  stoneCostPaise: number;
  hallmarkChargesPaise: number;
  /** Wastage valued at gold rate */
  wastageCostPaise: number;
  /** Recovery credit (reduces total) */
  recoveryCreditPaise: number;
  netMfgCostPaise: number;
}

/**
 * Calculate net manufacturing cost.
 * All arithmetic in paise (integers).
 */
export function calcNetMfgCost(inputs: MfgCostingInputs): MfgCostingResult {
  const labourCostPaise = inputs.labourChargesPaise;
  const makingChargesPaise = inputs.makingChargesPaise;
  const stoneCostPaise = inputs.stoneCostPaise;
  const hallmarkChargesPaise = inputs.hallmarkChargesPaise;

  // Wastage value: (wastage_mg / 1000) * rate_per_gram, result in paise
  const wastageCostPaise = Math.round((inputs.wastageMg * inputs.goldRatePaisePerGram) / 1000);

  // Recovery credit: (recovery_mg / 1000) * rate, result in paise
  const recoveryCreditPaise = Math.round(
    (inputs.recoveryMg * inputs.recoveryRatePaisePerGram) / 1000,
  );

  const netMfgCostPaise =
    labourCostPaise +
    makingChargesPaise +
    stoneCostPaise +
    hallmarkChargesPaise +
    wastageCostPaise -
    recoveryCreditPaise;

  return {
    labourCostPaise,
    makingChargesPaise,
    stoneCostPaise,
    hallmarkChargesPaise,
    wastageCostPaise,
    recoveryCreditPaise,
    netMfgCostPaise,
  };
}

/**
 * Calculate profit margin in basis points.
 * profitMarginBps = ((sellingPrice - netCost) / sellingPrice) × 10000
 * Returns 0 if sellingPrice is 0.
 */
export function calcProfitMargin(sellingPricePaise: number, netMfgCostPaise: number): number {
  if (sellingPricePaise <= 0) return 0;
  const profit = sellingPricePaise - netMfgCostPaise;
  return Math.round((profit / sellingPricePaise) * 10000);
}

/** Format basis points as percentage string e.g. 1567 → "15.67%" */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Format paise as rupees string e.g. 150000 → "₹1,500.00" */
export function paiseToRupeesStr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}
