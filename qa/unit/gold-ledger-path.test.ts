import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("gold ledger paginated path (static audit)", () => {
  it("ledger refresh uses desc order for recent-tail cache", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/ledger-store.ts"), "utf8");
    expect(src).toContain('order: "desc"');
  });

  it("boot pullLedger uses fetchGoldLedgerPage not direct REST", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/data-loader.ts"), "utf8");
    expect(src).toContain("fetchGoldLedgerPage");
    expect(src).not.toMatch(/pullLedgerInner[\s\S]*from\("gold_ledger"\)/);
  });

  it("gold position report avoids PostgREST count exact on gold_ledger", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/gold-position-report-query.ts"), "utf8");
    expect(src).toContain("fetchGoldLedgerInRange");
    expect(src).not.toContain('count: "exact"');
  });

  it("gold loss ledger fetch uses paginated RPC helper", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/gold-loss-report-query.ts"), "utf8");
    expect(src).toContain("fetchGoldLedgerInRange");
    expect(src).not.toMatch(/from\("gold_ledger"\)[\s\S]*count: "exact"/);
  });

  it("migration adds get_firm_ledger_balances and p_order", () => {
    const src = readFileSync(
      resolve(ROOT, "supabase/migrations/20260830190000_gold_ledger_balances_page_order.sql"),
      "utf8",
    );
    expect(src).toContain("get_firm_ledger_balances");
    expect(src).toContain("p_order");
    expect(src).toContain("mark_my_portal_kyc_doc");
  });
});

describe("KYC PDF images (static audit)", () => {
  it("print PDF generator draws images section", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/print-engine/pdf/generate.ts"), "utf8");
    expect(src).toContain('case "images"');
    expect(src).toContain("urlToPdfImageData");
    expect(src).toContain("printImageItemsForSection");
  });

  it("worker_kyc mapper sets visibility flags", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/print-engine/data-mapper.ts"), "utf8");
    expect(src).toContain("hasWorkerPhone");
    expect(src).toContain("hasWorkerSkill");
  });
});
