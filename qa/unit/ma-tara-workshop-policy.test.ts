import { describe, it, expect } from "vitest";
import {
  isMaterialCategoryPayable,
  normalizeMaTaraWorkshopPolicy,
  DEFAULT_MA_TARA_WORKSHOP_POLICY,
} from "../../src/lib/ma-tara-workshop-policy";

describe("material payable flags (additive, default PAYABLE)", () => {
  it("defaults every category to payable when flags empty", () => {
    expect(isMaterialCategoryPayable("chains", DEFAULT_MA_TARA_WORKSHOP_POLICY)).toBe(true);
    expect(isMaterialCategoryPayable("raw_gold", { materialPayableByCategoryKey: {} })).toBe(true);
  });

  it("respects explicit non-payable without inventing other defaults", () => {
    const policy = normalizeMaTaraWorkshopPolicy({
      pureGoldReferencePermille: 995,
      materialPayableByCategoryKey: { chains: false },
    });
    expect(isMaterialCategoryPayable("chains", policy)).toBe(false);
    expect(isMaterialCategoryPayable("findings", policy)).toBe(true);
  });

  it("normalize keeps pure gold default 995", () => {
    expect(normalizeMaTaraWorkshopPolicy({}).pureGoldReferencePermille).toBe(995);
  });
});
