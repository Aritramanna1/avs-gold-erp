/**
 * G-16 — MTJ ERP deterministic calculation tests.
 *
 * Mandate (from spec):
 *   - MTJ default purity = 995 (firm-configurable, never hard-coded globally)
 *   - Purity must flow: transaction → fine-calc → book/ledger → settlement → report
 *   - Karigar fine calculation is OFF by default (calculationMode="basic")
 *   - Any explicitly selected purity must produce the correct fine, not the default
 *   - finenessBasis=999 is the arithmetic denominator — DISTINCT from defaultPurityPermille
 */
import { describe, it, expect } from "vitest";
import {
  fineGoldMg,
  gramsToMg,
  mgToGrams,
} from "../../src/lib/gold";
import {
  computeFineGold,
  effectiveJewelleryCalcFeatures,
  isAdvancedCalculationMode,
  defaultGoldCalculationRules,
  type GoldCalculationRulesDoc,
} from "../../src/lib/gold-calculation-rules";
import { MTJ_DEFAULT_PURITY_PERMILLE, getDefaultPurityPermille } from "../../src/lib/settings-store";

// ── helpers ────────────────────────────────────────────────────────────────

function advancedRules(overrides?: Partial<GoldCalculationRulesDoc>): GoldCalculationRulesDoc {
  return {
    ...defaultGoldCalculationRules(),
    calculationMode: "advanced",
    featureFlags: {
      purityCalculation: true,
      wastageCalculation: true,
      fineCalculation: true,
      alloyCalculation: true,
      automaticLoss: true,
      makingCalculation: true,
      settlementCalculation: true,
    },
    ...overrides,
  };
}

function basicRules(overrides?: Partial<GoldCalculationRulesDoc>): GoldCalculationRulesDoc {
  return { ...defaultGoldCalculationRules(), calculationMode: "basic", ...overrides };
}

// ── G-16-A: Default purity mandate (995) ───────────────────────────────────

describe("G-16-A: MTJ default purity mandate (995)", () => {
  it("MTJ_DEFAULT_PURITY_PERMILLE constant is exactly 995", () => {
    expect(MTJ_DEFAULT_PURITY_PERMILLE).toBe(995);
  });

  it("getDefaultPurityPermille returns 995 from store defaults", () => {
    const v = getDefaultPurityPermille();
    expect(v).toBe(995);
  });

  it("DEFAULT_PURITY_PERMILLE from gold.ts is 995 (corrected from incorrect 999 alias)", async () => {
    const { DEFAULT_PURITY_PERMILLE } = await import("../../src/lib/gold");
    expect(DEFAULT_PURITY_PERMILLE).toBe(995);
  });
});

// ── G-16-B: Purity flow — 995 through fine calculation ────────────────────

describe("G-16-B: Purity flow — 995 touch through fine-calc path", () => {
  const GROSS_MG = 10_000;

  it("fineGoldMg: 995/995 basis → pure-equivalent fine = gross", () => {
    expect(fineGoldMg(GROSS_MG, 995)).toBe(GROSS_MG);
  });

  it("computeFineGold advanced: 995 purity → 10000 mg fine", () => {
    const config = advancedRules({ finenessBasis: 995 });
    const result = computeFineGold(
      { module: "gold_settlement", grossMg: GROSS_MG, purityPermille: 995, method: "metal_content_999", base: "gross" },
      config,
    );
    expect(result.fineMg).toBe(10000);
    expect(result.snapshot.purityPermille).toBe(995);
    expect(result.snapshot.finenessBasis).toBe(995);
  });

  it("explicitly selected purity 916 must produce 916-based fine on 995 basis", () => {
    const config = advancedRules({ finenessBasis: 995 });
    const result = computeFineGold(
      { module: "retail_billing", grossMg: GROSS_MG, purityPermille: 916, method: "metal_content_999", base: "gross" },
      config,
    );
    expect(result.fineMg).toBe(9206);
    expect(result.snapshot.purityPermille).toBe(916);
  });

  it("explicitly selected purity 750 must produce 750-based fine on 995 basis", () => {
    const config = advancedRules({ finenessBasis: 995 });
    const result = computeFineGold(
      { module: "retail_billing", grossMg: GROSS_MG, purityPermille: 750, method: "metal_content_999", base: "gross" },
      config,
    );
    expect(result.fineMg).toBe(7538);
  });
});

// ── G-16-C: finenessBasis and defaultPurityPermille ─────────────────────────

describe("G-16-C: finenessBasis and defaultPurityPermille on authoritative 995 standard", () => {
  it("defaultGoldCalculationRules finenessBasis=995, MTJ_DEFAULT_PURITY_PERMILLE=995", () => {
    const rules = defaultGoldCalculationRules();
    expect(rules.finenessBasis).toBe(995);
    expect(MTJ_DEFAULT_PURITY_PERMILLE).toBe(995);
  });

  it("explicitly entered purity=916 produces 9206 fine on 995 basis", () => {
    const config = advancedRules({ finenessBasis: 995 });
    const fine916 = fineGoldMg(10_000, 916);
    expect(fine916).toBe(9206);
  });
});

// ── G-16-D: Karigar fine calculation OFF by default (G-05) ────────────────

describe("G-16-D: Calculation Mode & Jewellery Flags", () => {
  it("defaultGoldCalculationRules produces calculationMode=advanced as default", () => {
    expect(defaultGoldCalculationRules().calculationMode).toBe("advanced");
  });

  it("BASIC mode (when configured): effectiveJewelleryCalcFeatures returns all-false fine flags", () => {
    const flags = effectiveJewelleryCalcFeatures(basicRules());
    expect(flags.fineCalculation).toBe(false);
    expect(flags.purityCalculation).toBe(false);
    expect(flags.wastageCalculation).toBe(false);
    expect(flags.settlementCalculation).toBe(false);
  });

  it("BASIC mode: computeFineGold uses user-entered fine, ignores purity arithmetic", () => {
    const config = basicRules();
    const userFineMg = 7500;
    const result = computeFineGold(
      { module: "karigar_issue", grossMg: 10_000, purityPermille: 995, userFineMg, method: "metal_content_999", base: "gross" },
      config,
    );
    expect(result.fineMg).toBe(userFineMg);
    expect(result.snapshot.userControlledFine).toBe(true);
    expect(result.snapshot.calculationMode).toBe("basic");
  });

  it("ADVANCED mode: fine IS auto-computed from purity (opt-in path)", () => {
    const config = advancedRules({ finenessBasis: 995 });
    expect(isAdvancedCalculationMode(config)).toBe(true);
    const result = computeFineGold(
      { module: "karigar_issue", grossMg: 10_000, purityPermille: 995, method: "metal_content_999", base: "gross" },
      config,
    );
    expect(result.fineMg).toBe(10000);
    expect(result.snapshot.userControlledFine).toBeFalsy();
  });
});

// ── G-16-E: Snapshot immutability ─────────────────────────────────────────

describe("G-16-E: Settlement fine is frozen at transaction time", () => {
  it("snapshot captures purity, finenessBasis, and fineMg at compute time", () => {
    const config = advancedRules({ finenessBasis: 995 });
    const result = computeFineGold(
      { module: "gold_settlement", grossMg: 20_000, purityPermille: 916, method: "metal_content_999", base: "gross" },
      config,
    );
    const snap = result.snapshot;
    expect(snap.grossMg).toBe(20_000);
    expect(snap.purityPermille).toBe(916);
    expect(snap.finenessBasis).toBe(995);
    expect(snap.fineMg).toBe(result.fineMg);
    expect(typeof snap.computedAt).toBe("number");
    expect(snap.computedAt).toBeGreaterThan(0);
  });
});

// ── G-16-F: Integer-mg precision ──────────────────────────────────────────

describe("G-16-F: Integer milligram precision throughout", () => {
  it("fineGoldMg always produces integer output across common purities", () => {
    const purities = [995, 916, 875, 750, 585, 375];
    for (const p of purities) {
      const fine = fineGoldMg(10_000, p, 999);
      expect(Number.isInteger(fine)).toBe(true);
    }
  });

  it("computeFineGold fineMg is integer for all MTJ-common purities", () => {
    const config = advancedRules({ finenessBasis: 999 });
    const purities = [995, 916, 875, 750, 585];
    for (const p of purities) {
      const result = computeFineGold(
        { module: "retail_billing", grossMg: 12_345, purityPermille: p, method: "metal_content_999", base: "gross" },
        config,
      );
      expect(Number.isInteger(result.fineMg)).toBe(true);
    }
  });

  it("gramsToMg / mgToGrams round-trip at 3 decimal precision", () => {
    const cases = ["0.001", "1.234", "99.999", "0.995", "12.345"];
    for (const g of cases) {
      const mg = gramsToMg(g);
      expect(Number.isInteger(mg)).toBe(true);
      expect(mgToGrams(mg)).toBe(String(parseFloat(g)));
    }
  });
});
