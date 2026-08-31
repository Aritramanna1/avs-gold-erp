import { describe, expect, it } from "vitest";
import {
  DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED,
  defaultGoldCalculationRules,
} from "@/lib/gold-calculation-rules";
import {
  calculateFineGold,
  calculateGoldCashSettlement,
  calculateGoldValuePaise,
  calculateSettlementLineFine,
} from "@/lib/transaction-calculations";

const advancedConfig = {
  ...defaultGoldCalculationRules(),
  calculationMode: "advanced" as const,
  featureFlags: { ...DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED },
};

describe("transaction-calculations", () => {
  it("calculateFineGold uses module rules (orders = metal_content_999 gross)", () => {
    const result = calculateFineGold(
      {
        module: "orders",
        grossMg: 10_000,
        purityPermille: 916,
      },
      advancedConfig,
    );
    expect(result.method).toBe("metal_content_999");
    expect(result.fineMg).toBeGreaterThan(0);
    expect(result.snapshot.purityPermille).toBe(916);
  });

  it("calculateGoldValuePaise converts fine mg at rate", () => {
    expect(calculateGoldValuePaise(1000, 700_000)).toBe(700_000);
    expect(calculateGoldValuePaise(0, 700_000)).toBe(0);
  });

  it("calculateGoldCashSettlement derives remaining cash at rate", () => {
    const out = calculateGoldCashSettlement({
      obligationFineMg: 5000,
      goldPaidFineMg: 3000,
      ratePerGramPaise: 600_000,
    });
    expect(out.remainingFineMg).toBe(2000);
    expect(out.cashEquivalentPaise).toBe(1_200_000);
  });

  it("calculateSettlementLineFine returns purity-based preview in BASIC mode", () => {
    const result = calculateSettlementLineFine({ grossMg: 10_000, purityPermille: 916 });
    expect(result.fineMg).toBeGreaterThan(0);
    expect(result.method).toBe("hisob_100");
  });
});
