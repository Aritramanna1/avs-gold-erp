import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("firm-scoped boot/dashboard queries (static audit)", () => {
  it("ceo-dashboard-analytics scopes operational reads by firm_id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/services/ceo-dashboard-analytics.ts"), "utf8");
    expect(src).toContain("resolveFirmIdForQuery");
    expect(src).toContain("withFirmScope");
    expect(src).not.toContain("DASHBOARD_ROW_LIMIT = 1000");
  });

  it("assistant tool registry uses requireFirmScopedTable for operational tables", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/assistant/assistant-tool-registry.ts"), "utf8");
    expect(src).toContain("requireFirmScopedTable");
    expect(src).toContain('requireFirmScopedTable("invoices")');
    expect(src).toContain('requireFirmScopedTable("job_cards")');
  });

  it("billing store refresh filters invoices by firm_id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/billing-store.ts"), "utf8");
    expect(src).toContain("resolveFirmIdForQuery");
    expect(src).toContain("withFirmScope");
    expect(src).toContain("rowToInvoice");
  });

  it("invoice row mapper always normalizes payments/items arrays", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/billing-query.ts"), "utf8");
    expect(src).toContain("Array.isArray(data.items) ? data.items : []");
    expect(src).toContain("Array.isArray(data.payments) ? data.payments : []");
  });

  it("billing invoice page query scopes invoices by firm_id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/billing-query.ts"), "utf8");
    expect(src).toContain("fetchBillingInvoicePage");
    expect(src).toMatch(/fetchBillingInvoicePage[\s\S]*resolveFirmIdForQuery/);
    expect(src).toMatch(/fetchBillingInvoicePage[\s\S]*withFirmScope/);
  });

  it("customization hub persists with firm-scoped app_settings id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/customization-hub-preferences-store.ts"), "utf8");
    expect(src).toContain("resolveAppSettingsReadId");
    expect(src).toContain("customizationHubSettingsId");
    expect(src).not.toMatch(/repo\.read\("customization_hub"\)/);
    expect(src).not.toMatch(/saveAs\("customization_hub"/);
  });

  it("gold calculation rules persist with firm-scoped app_settings id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/gold-calculation-rules-store.ts"), "utf8");
    expect(src).toContain("resolveAppSettingsReadId");
    expect(src).toContain("goldCalcRulesSettingsId");
    expect(src).not.toMatch(/repo\.read\(GOLD_CALC_RULES_ID\)/);
    expect(src).not.toMatch(/saveAs\(GOLD_CALC_RULES_ID,/);
  });

  it("item masters update/delete guard firm_id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/item-masters-store.ts"), "utf8");
    expect(src).toMatch(/\.update\(row\)[\s\S]*\.eq\("firm_id", firmId\)/);
    expect(src).toMatch(/\.delete\(\)[\s\S]*\.eq\("firm_id", firmId\)/);
  });

  it("barcode config persists with firm-scoped app_settings id", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/barcode-config-store.ts"), "utf8");
    expect(src).toContain("resolveAppSettingsReadId");
    expect(src).toContain("barcodeConfigSettingsId");
    expect(src).not.toMatch(/read\("barcode_config"\)/);
    expect(src).not.toMatch(/saveAs\("barcode_config"/);
  });

  it("public invoice verify route exists for QR lifecycle", () => {
    const src = readFileSync(resolve(ROOT, "src/routes/verify.invoice.$token.tsx"), "utf8");
    expect(src).toContain("verifyPublicDocument");
    expect(src).toContain('createFileRoute("/verify/invoice/$token")');
  });
});
