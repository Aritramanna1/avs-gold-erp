import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("bank reconciliation workflow wiring", () => {
  it("store imports statement CSV and posts bank charges via postBankChargeVoucher", () => {
    const store = readFileSync(resolve(ROOT, "src/lib/bank-reconciliation-store.ts"), "utf8");
    expect(store).toContain("importStatementCsv");
    expect(store).toContain("autoMatchStatement");
    expect(store).toContain("parseBankStatementCsv");
    expect(store).toContain("postBankChargeVoucher");
    expect(store).toContain("statement_lines");
  });

  it("treasury UI exposes CSV import and auto-match controls", () => {
    const ui = readFileSync(resolve(ROOT, "src/routes/treasury.bank-reconciliation.tsx"), "utf8");
    expect(ui).toContain("importStatementCsv");
    expect(ui).toContain("autoMatchStatement");
    expect(ui).toContain('accept=".csv,text/csv"');
  });

  it("migration adds statement_lines column", () => {
    const mig = resolve(
      ROOT,
      "supabase/migrations/20260830200000_bank_recon_statement_and_verify_rpcs.sql",
    );
    expect(existsSync(mig)).toBe(true);
    expect(readFileSync(mig, "utf8")).toContain("statement_lines");
  });

  it("verify RPC migration defines mint + public verify with rate limits", () => {
    const mig = readFileSync(
      resolve(ROOT, "supabase/migrations/20260830200000_bank_recon_statement_and_verify_rpcs.sql"),
      "utf8",
    );
    expect(mig).toContain("mint_invoice_verification");
    expect(mig).toContain("verify_public_document");
    expect(mig).toContain("check_api_rate_limit");
    expect(mig).toContain("enforce_egress_rate_limit('rpc:mint_invoice_verification'");
  });
});
