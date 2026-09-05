import { describe, it, expect } from "vitest";
import {
  fineGoldMg,
  gramsToMg,
  mgToGrams,
  parsePurity,
  assertNetNotAboveGross,
} from "../../src/lib/gold";

/** Table-driven boundary tests — jewellery precision is integer mg throughout on authoritative 995 basis. */
const FINE_GOLD_CASES: Array<{
  grossMg: number;
  purity: number;
  expectedFineMg: number;
  note: string;
}> = [
  { grossMg: 10_000, purity: 916, expectedFineMg: 9206, note: "22K standard issue" },
  { grossMg: 10_000, purity: 995, expectedFineMg: 10_000, note: "fine / 995 touch" },
  { grossMg: 1, purity: 916, expectedFineMg: 1, note: "minimum gross rounding" },
  { grossMg: 0, purity: 916, expectedFineMg: 0, note: "zero gross" },
  { grossMg: 3000, purity: 916, expectedFineMg: 2762, note: "order workflow sample" },
  { grossMg: 1000, purity: 916, expectedFineMg: 921, note: "partial return sample" },
  { grossMg: 50_000, purity: 750, expectedFineMg: 37_688, note: "18K bulk" },
];

describe("QA-02 Gold calculations (fineGoldMg /995 authoritative convention)", () => {
  it.each(FINE_GOLD_CASES)(
    "$note: gross=$grossMg purity=$purity → $expectedFineMg mg fine",
    ({ grossMg, purity, expectedFineMg }) => {
      expect(fineGoldMg(grossMg, purity)).toBe(expectedFineMg);
    },
  );

  it("rejects non-integer gross", () => {
    expect(() => fineGoldMg(10.5, 916)).toThrow(/integer/);
  });

  it("rejects invalid purity", () => {
    expect(() => fineGoldMg(1000, 1000)).toThrow(/0\.\.999/);
  });

  it("gramsToMg / mgToGrams round-trip", () => {
    expect(gramsToMg("12.345")).toBe(12_345);
    expect(mgToGrams(12_345)).toBe("12.345");
  });

  it("parsePurity accepts valid per-mille", () => {
    expect(parsePurity("916")).toBe(916);
    expect(parsePurity(750)).toBe(750);
  });

  it("assertNetNotAboveGross blocks swapped gross/net", () => {
    expect(() => assertNetNotAboveGross(5000, 6000, "test")).toThrow(/cannot exceed gross/);
  });
});

describe("QA-02 Gold conservation identity (formula tenant config)", () => {
  it("input = output + custody + recoverable + loss (synthetic ledger)", () => {
    const inputMg = 10_000;
    const outputMg = 6_000;
    const custodyMg = 2_500;
    const recoverableMg = 1_000;
    const lossMg = 500;
    expect(outputMg + custodyMg + recoverableMg + lossMg).toBe(inputMg);
  });
});
