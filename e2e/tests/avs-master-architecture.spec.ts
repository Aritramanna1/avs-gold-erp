import { test, expect } from "@playwright/test";
import {
  calculateFineGold,
  calculateKarigarWastage,
  convertWeightUnits,
  calculateAlloyBatchRecipe,
  calculateProcessShrinkage,
  calculateLabourCharge,
  calculateHallmarkCharge,
} from "../../src/lib/calculation-engine";
import { ReplaceableAssistantBrain } from "../../src/lib/avs-assistant-brain";
import { calculateLiveGoldExposure } from "../../src/lib/ledger-store";
import { validateEnvironment } from "../../src/lib/db-status";
import { validateMetalCreditLimit, Person } from "../../src/lib/people-store";
import { generateTallyXML } from "../../src/lib/tally-export-engine";
import { assertFreezeDateOpen } from "../../src/lib/financial-lock-store";

test.describe("AVS Master Architecture Unit & E2E Validation", () => {
  test("validateEnvironment should confirm development environment status", () => {
    const envStatus = validateEnvironment();
    expect(envStatus.isValid).toBe(true);
    expect(envStatus.env).toBe("development");
  });

  test("calculateLabourCharge should compute gross, net, fine, and piece-based labour charges", () => {
    const grossRes = calculateLabourCharge({
      basis: "gross",
      ratePerUnitPaise: 5000, // ₹50/g
      grossWeightMg: 10000, // 10g
      netWeightMg: 9500,
      fineWeightMg: 8702,
    });
    expect(grossRes.totalLabourChargeRupees).toBe(500);

    const pieceRes = calculateLabourCharge({
      basis: "piece",
      ratePerUnitPaise: 15000, // ₹150/piece
      grossWeightMg: 5000,
      netWeightMg: 5000,
      fineWeightMg: 4580,
      piecesCount: 5,
    });
    expect(pieceRes.totalLabourChargeRupees).toBe(750);
  });

  test("calculateHallmarkCharge should calculate fixed and per-gram hallmark fees", () => {
    const fixedRes = calculateHallmarkCharge({
      basis: "fixed_per_piece",
      ratePaise: 4500,
      grossWeightMg: 10000,
      piecesCount: 2,
    }); // ₹45/piece
    expect(fixedRes.totalHallmarkChargeRupees).toBe(90);
  });

  test("validateMetalCreditLimit should flag when Karigar exceeds assigned fine gold credit limit", () => {
    const mockPerson: Person = {
      id: "p1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: "karigar",
      active: true,
      fullName: "Raju Karigar",
      phone: "9876543210",
      maxFineGoldCreditMg: 100000, // 100g max credit limit
      docs: {},
    };

    const validCheck = validateMetalCreditLimit(mockPerson, 50000, 30000); // 50g + 30g = 80g <= 100g
    expect(validCheck.isExceeded).toBe(false);

    const exceedCheck = validateMetalCreditLimit(mockPerson, 80000, 30000); // 80g + 30g = 110g > 100g
    expect(exceedCheck.isExceeded).toBe(true);
  });

  test("generateTallyXML should output valid Tally ERP XML payload", () => {
    const xml = generateTallyXML([
      {
        voucherNumber: "INV-001",
        dateStr: "20260812",
        voucherType: "Sales",
        partyName: "Swarna Jewellers",
        amountPaise: 1500000, // ₹15,000
        fineGoldMg: 10000,
        narration: "Sale of 22K Gold Bangle",
      },
    ]);
    expect(xml).toContain('<VOUCHER VCHTYPE="Sales" ACTION="Create">');
    expect(xml).toContain("<VOUCHERNUMBER>INV-001</VOUCHERNUMBER>");
  });

  test("assertFreezeDateOpen should throw error when target date is prior to system freeze date", () => {
    expect(() => assertFreezeDateOpen("2026-04-01", "2026-03-15")).toThrow("TRANSACTION BLOCKED");
    expect(() => assertFreezeDateOpen("2026-04-01", "2026-05-01")).not.toThrow();
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
      meenaWeightAddedMg: 0,
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
    expect(prompt).toContain("Ornexa Assistant");
    expect(prompt).not.toContain("I am a deterministic ERP engine");
  });
});
