/**
 * Jewellery GST taxable-base profiles.
 * GST Council gems & jewellery FAQ Q7: sale of jewellery to end consumer is
 * 3% on total transaction value (gold + making), whether making is shown
 * separately or not. Job-work bills labour only (customer already owns metal).
 *
 * Posted invoices keep stored gstPaise. This module only decides the base for
 * new computeInvoiceTotals() runs.
 */
export type JewelleryTaxableBase = "auto" | "total_value" | "making_stone_hallmark";

export type TaxableLine = {
  chargeMode?: "job_work" | "full_value";
  makingChargesPaise: number;
  stoneChargesPaise: number;
  hallmarkChargesPaise?: number;
  lineTotalPaise: number;
  hsnCode?: string;
};

export type GstTaxProfileSettings = {
  taxableBase?: JewelleryTaxableBase;
  applyOnMakingAndStoneOnly?: boolean;
  hsnJewellery?: string;
  sacServices?: string;
};

export function labourChargesPaise(items: TaxableLine[]): number {
  return items.reduce(
    (sum, item) =>
      sum + item.makingChargesPaise + item.stoneChargesPaise + (item.hallmarkChargesPaise ?? 0),
    0,
  );
}

export function billsGoldValue(items: TaxableLine[]): boolean {
  return items.some((item) => (item.chargeMode ?? "job_work") === "full_value");
}

/**
 * Resolve GST taxable base in paise.
 * `auto`: full invoice value when any line is a ready-stock / full-value sale;
 * making+stone+hallmark when the bill is job-work (gold not sold).
 */
export function resolveInvoiceTaxableBasePaise(
  items: TaxableLine[],
  gst: GstTaxProfileSettings,
  subtotalPaise: number,
): number {
  const labour = labourChargesPaise(items);
  const mode = gst.taxableBase ?? "auto";
  if (mode === "total_value") return subtotalPaise;
  if (mode === "making_stone_hallmark") return labour;
  if (billsGoldValue(items)) return subtotalPaise;
  if (gst.applyOnMakingAndStoneOnly === false) return subtotalPaise;
  return labour;
}

export function defaultHsnForLine(item: TaxableLine, gst: GstTaxProfileSettings): string {
  if (item.hsnCode) return item.hsnCode;
  return (item.chargeMode ?? "job_work") === "full_value"
    ? (gst.hsnJewellery ?? "7113")
    : (gst.sacServices ?? "9988");
}
