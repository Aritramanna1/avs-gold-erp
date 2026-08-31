import { describe, it, expect } from "vitest";
import { calculateFineGold, calculateKarigarWastage } from "../../src/lib/calculation-engine";

describe("QA-02 Calculation Engine", () => {
  it("calculateFineGold explains /999 convention", () => {
    const r = calculateFineGold({ netWeightMg: 10_000, purityPerMille: 916 });
    expect(r.fineGoldMg).toBe(9169);
    expect(r.explanation).toMatch(/999/);
  });

  it("karigar wastage respects category exclusions", () => {
    const r = calculateKarigarWastage({
      totalSubmittedNetWeightMg: 10_000,
      karigarWastagePct: 1.5,
      items: [
        { categoryId: "c1", categoryName: "Chains", weightMg: 2000, isWastageExcluded: true },
        { categoryId: "c2", categoryName: "Ring", weightMg: 8000 },
      ],
      issuedFineGoldMg: 9169,
      targetPurityPerMille: 916,
    });
    expect(r.excludedWeightMg).toBe(2000);
    expect(r.eligibleWeightMg).toBe(8000);
  });
});
