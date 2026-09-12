import { describe, it, expect, beforeEach } from "vitest";
import {
  applyJewellerySaleTax,
  previewJewellerySaleTax,
  toInvoiceTaxAuditFields,
  createDraftTaxProfile,
  withCaApproval,
  assertTaxRatesMayApply,
  canEnableTaxProfileInProduction,
  taxProfileUiStatus,
  readTaxProfileForFirm,
  getApprovedTaxProfileOrNull,
  __setMemoryTaxProfileForTests,
  __clearMemoryTaxProfilesForTests,
  GST_COUNCIL_FAQ_GEMS_Q7,
} from "../../src/lib/tax";

describe("TAX-P0a tax profile + CA gate (AVS-27)", () => {
  beforeEach(() => {
    __clearMemoryTaxProfilesForTests();
  });

  it("draft profile is not production-enabled and shows Awaiting CA approval", () => {
    const p = createDraftTaxProfile("firm-1");
    expect(p.caApprovedAt).toBeNull();
    expect(canEnableTaxProfileInProduction(p)).toBe(false);
    expect(taxProfileUiStatus(p).label).toBe("Awaiting CA approval");
    expect(assertTaxRatesMayApply(p).ok).toBe(false);
  });

  it("does not hardcode a real GSTIN in draft", () => {
    const p = createDraftTaxProfile("firm-1");
    expect(p.gstinPlaceholder).toBe("SET_IN_FIRM_SETTINGS");
    expect(p.gstinPlaceholder).not.toMatch(/^\d{2}[A-Z]{5}/);
  });

  it("applyJewellerySaleTax blocks without CA approval", () => {
    const profile = createDraftTaxProfile("firm-1");
    const result = applyJewellerySaleTax({
      goldValueInr: 100_000,
      makingInr: 10_000,
      stoneInr: 0,
      otherTaxableInr: 0,
      profile,
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.uiLabel).toBe("Awaiting CA approval");
      expect(result.reason).toBe("AWAITING_CA_APPROVAL");
    }
  });

  it("preview still computes FAQ Q7 composite total but stays previewOnly", () => {
    const profile = createDraftTaxProfile("firm-1");
    const preview = previewJewellerySaleTax({
      goldValueInr: 100_000,
      makingInr: 10_000,
      stoneInr: 5_000,
      otherTaxableInr: 0,
      profile,
    });
    expect(preview.previewOnly).toBe(true);
    expect(preview.productionEnabled).toBe(false);
    expect(preview.taxableValue).toBe(115_000);
    expect(preview.gstRatePct).toBe(3);
    expect(preview.gstAmount).toBe(3450);
    expect(preview.ruleId).toBe(GST_COUNCIL_FAQ_GEMS_Q7);
    expect(preview.uiLabel).toBe("Awaiting CA approval");
    // Making is in the taxable sum — not silently taxed at 18% on its own.
    expect(preview.breakdown.makingInr).toBe(10_000);
    expect(preview.breakdown.gstRatePct).toBe(3);
  });

  it("after CA approval, apply uses profile rate and persists audit fields", () => {
    const profile = withCaApproval(createDraftTaxProfile("firm-1"), "ca-user-1", "2026-09-12T00:00:00.000Z");
    expect(assertTaxRatesMayApply(profile).ok).toBe(true);
    const result = applyJewellerySaleTax({
      goldValueInr: 50_000,
      makingInr: 2_000,
      stoneInr: 0,
      otherTaxableInr: 0,
      profile,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.taxableValue).toBe(52_000);
      expect(result.gstRatePct).toBe(profile.jewelleryCompositeRatePct);
      expect(result.gstAmount).toBe(1560);
      expect(result.ruleId).toBe(GST_COUNCIL_FAQ_GEMS_Q7);
      const audit = toInvoiceTaxAuditFields(result);
      expect(audit.rule_id).toBe(GST_COUNCIL_FAQ_GEMS_Q7);
      expect(audit.rule_pack_version).toBe(profile.rulePackVersion);
      expect(audit.tax_breakdown_json.inputs.goldValueInr).toBe(50_000);
    }
  });

  it("read path returns draft_fallback and approved-or-null respects gate", async () => {
    const read = await readTaxProfileForFirm("firm-missing");
    expect(read.source).toBe("draft_fallback");
    expect(read.uiLabel).toBe("Awaiting CA approval");
    expect(await getApprovedTaxProfileOrNull("firm-missing")).toBeNull();

    const approved = withCaApproval(createDraftTaxProfile("firm-ok"), "ca");
    __setMemoryTaxProfileForTests(approved);
    expect(await getApprovedTaxProfileOrNull("firm-ok")).toMatchObject({ firmId: "firm-ok" });
  });

  it("uses rate from profile (Settings-editable), not a second hardcoded invent", () => {
    const profile = withCaApproval(
      { ...createDraftTaxProfile("firm-1"), jewelleryCompositeRatePct: 3 },
      "ca",
    );
    const result = applyJewellerySaleTax({
      goldValueInr: 10_000,
      makingInr: 0,
      stoneInr: 0,
      otherTaxableInr: 0,
      profile,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.gstRatePct).toBe(3);
      expect(result.gstAmount).toBe(300);
    }
  });
});
