import { describe, it, expect } from "vitest";
import {
  labourChargesPaise,
  billsGoldValue,
  resolveInvoiceTaxableBasePaise,
} from "../../src/lib/tax-profiles";

describe("tax-profiles GST taxable base", () => {
  const jobWorkLine = {
    chargeMode: "job_work" as const,
    makingChargesPaise: 500_00,
    stoneChargesPaise: 100_00,
    lineTotalPaise: 50_000_00,
  };

  it("auto mode uses labour only for job-work bills", () => {
    expect(resolveInvoiceTaxableBasePaise([jobWorkLine], {}, 50_000_00)).toBe(600_00);
  });

  it("total_value mode taxes full subtotal", () => {
    expect(
      resolveInvoiceTaxableBasePaise([jobWorkLine], { taxableBase: "total_value" }, 50_000_00),
    ).toBe(50_000_00);
  });

  it("detects full-value retail lines", () => {
    expect(
      billsGoldValue([{ ...jobWorkLine, chargeMode: "full_value" }]),
    ).toBe(true);
  });

  it("sums labour charges", () => {
    expect(labourChargesPaise([jobWorkLine])).toBe(600_00);
  });
});
