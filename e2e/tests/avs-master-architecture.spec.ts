import { test, expect } from "@playwright/test";
import {
  calculateFineGold,
  calculateKarigarWastage,
  calculateDualCurrencyBilling,
  convertWeightUnits,
  calculateAlloyBatchRecipe,
  calculateProcessShrinkage,
} from "../../src/lib/calculation-engine";
import { ReplaceableAssistantBrain } from "../../src/lib/avs-assistant-brain";
import { calculateLiveGoldExposure } from "../../src/lib/ledger-store";
import { validateEnvironment } from "../../src/lib/db-status";

test.describe("AVS Master Architecture Unit & E2E Validation", () => {
  test("validateEnvironment should confirm development environment status", () => {
    const envStatus = validateEnvironment();
    expect(envStatus.isValid).toBe(true);
    expect(envStatus.env).toBe("development");
  });

  test("calculateFineGold should compute exact fine gold milligrams and grams", () => {
    const res = calculateFineGold({ netWeightMg: 50000, purityPerMille: 916 }); // 50g 22K
    expect(res.fineGoldMg).toBe(45800);
    expect(res.fineGoldGrams).toBe(45.8);
  });

  test("calculateAlloyBatchRecipe should compute required 24K gold, copper, and silver for 22K batch", () => {
    const res = calculateAlloyBatchRecipe({ targetWeightGrams: 100, targetKarat: 22 });
    expect(res.pureGold24KGrams).toBe(91.667); // 100 * (22/24)
    expect(res.totalAlloyGrams).toBe(8.333);
  });

  test("calculateProcessShrinkage should calculate Net Gold Loss during Meena enameling", () => {
    const res = calculateProcessShrinkage({
      preProcessGrossMg: 50000,
      postProcessGrossMg: 49500,
      stoneWeightAddedMg: 0,
      meenaWeightAddedMg: 0
    });
    expect(res.netGoldLossMg).toBe(500);
    expect(res.variancePct).toBe(1.0);
    expect(res.isExcessiveLoss).toBe(false);
  });


  test("calculateKarigarWastage should exclude chain category before computing 1.5% wastage", () => {
    const res = calculateKarigarWastage({
      totalSubmittedNetWeightMg: 50000, // 50g total
      karigarWastagePct: 1.5,
      items: [
        { categoryId: "1", categoryName: "Chains", weightMg: 30000, isWastageExcluded: true }, // 30g chain excluded
        { categoryId: "2", categoryName: "Rings", weightMg: 20000, isWastageExcluded: false }, // 20g ring eligible
      ],
      issuedFineGoldMg: 45800,
      targetPurityPerMille: 916,
    });

    expect(res.excludedWeightMg).toBe(30000);
    expect(res.eligibleWeightMg).toBe(20000);
    expect(res.allowedWastageMg).toBe(300); // 1.5% on 20g = 300mg
  });

  test("convertWeightUnits should accurately convert grams to troy ounces and tolas", () => {
    const res = convertWeightUnits(100); // 100 grams
    expect(res.milligrams).toBe(100000);
    expect(res.troyOunces).toBeCloseTo(3.215, 2);
    expect(res.tolas).toBeCloseTo(8.573, 2);
  });

  test("calculateLiveGoldExposure should detect unhedged gold liabilities vs physical gold assets", () => {
    const res = calculateLiveGoldExposure(
      { vault: 10000, karigar: 20000, finished: 15000, customer: 50000, jeweller: 0, scrap: 0 },
      10000,
    );

    // Assets: 10k + 20k + 15k = 45k mg. Liabilities: 50k + 10k = 60k mg.
    expect(res.netPhysicalGoldMg).toBe(45000);
    expect(res.netUnhedgedGoldExposureMg).toBe(-15000);
    expect(res.isRiskOverdraft).toBe(true);
  });

  test("ReplaceableAssistantBrain should respond with natural non-technical prompt", () => {
    const brain = new ReplaceableAssistantBrain({
      provider: "cloudflare_ai_gateway",
      model: "@cf/meta/llama-3-8b-instruct",
    });

    const prompt = brain.getSystemPrompt();
    expect(prompt).toContain("Hey! 👋 What are we working on today?");
    expect(prompt).not.toContain("I am a deterministic ERP engine");
  });
});
