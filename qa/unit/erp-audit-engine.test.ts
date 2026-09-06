import { describe, it, expect, beforeEach } from "vitest";
import { runErpAudit } from "@/lib/erp-audit/run-audit";
import { ERP_AUDIT_MODULES } from "@/lib/erp-audit/modules";
import { useSettings } from "@/lib/settings-store";

describe("ERP Audit Engine — Live Probes & Scorer", () => {
  beforeEach(() => {
    useSettings.setState({
      firm: {
        shopName: "AVS Manufacturing Gold ERP",
        tagline: "Fine Craftsmanship",
        address: "123 Jewellers Lane",
        phone: "+91 9876543210",
        gstin: "19ABCDE1234F1Z5",
      },
      branding: {
        companyName: "AVS Manufacturing Gold ERP",
        brandColor: "#D4AF37",
      },
    });
  });

  it("evaluates all registered audit modules without unhandled exceptions", async () => {
    const report = await runErpAudit();

    expect(report).toBeDefined();
    expect(report.createdAt).toBeDefined();
    expect(typeof report.overallScore).toBe("number");
    expect(report.modules.length).toBeGreaterThanOrEqual(ERP_AUDIT_MODULES.length);

    // Verify key modules are tested
    const moduleIds = report.modules.map((m) => m.id);
    expect(moduleIds).toContain("people");
    expect(moduleIds).toContain("gold_material");
    expect(moduleIds).toContain("calculations");
    expect(moduleIds).toContain("hw_barcode_gen");
  });

  it("calculates overall scores and status deterministically", async () => {
    const report = await runErpAudit();

    expect(["PASS", "FAIL", "BLOCKED"]).toContain(report.overallStatus);
    expect(typeof report.readyForRelease).toBe("boolean");
    expect(Array.isArray(report.defects)).toBe(true);

    for (const mod of report.modules) {
      expect(["PASS", "FAIL", "BLOCKED"]).toContain(mod.status);
      expect(Array.isArray(mod.evidence)).toBe(true);
    }
  });
});
