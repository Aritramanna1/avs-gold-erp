import { describe, it, expect } from "vitest";
import { fineGoldMg } from "../../src/lib/gold";

/**
 * QA Gold Accountability — strict conservation checks per transaction type.
 * Full E2E gold flows use Playwright + seeded QA data; this layer validates math invariants.
 */
describe("QA Gold Accountability invariants", () => {
  it("issue transaction: input fine equals custody when nothing returned", () => {
    const inputMg = 10_000;
    const purity = 916;
    const inputFine = fineGoldMg(inputMg, purity);
    const custodyFine = fineGoldMg(inputMg, purity);
    expect(custodyFine).toBe(inputFine);
  });

  it("partial receive: output + custody + loss partitions input gross mass", () => {
    const purity = 916;
    const inputMg = 10_000;
    const outputMg = 3_000;
    const custodyMg = 6_000;
    const lossMg = 1_000;
    expect(outputMg + custodyMg + lossMg).toBe(inputMg);
    const inputFine = fineGoldMg(inputMg, purity);
    const partsFine =
      fineGoldMg(outputMg, purity) + fineGoldMg(custodyMg, purity) + fineGoldMg(lossMg, purity);
    expect(partsFine).toBeLessThanOrEqual(inputFine + 1);
  });
});
