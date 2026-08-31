import { describe, it, expect } from "vitest";
import {
  parseBankStatementCsv,
  suggestStatementMatches,
  statementClosingBalancePaise,
} from "../../src/lib/bank-statement-import";
import type { UniversalMoneyEntry } from "../../src/lib/money-voucher";

describe("bank statement CSV import", () => {
  const sampleCsv = `Date,Narration,Debit,Credit,Balance
01/08/2026,NEFT CREDIT SALES,,5000.00,15000.00
02/08/2026,BANK CHARGES,59.00,,14941.00`;

  it("parses Indian date format and debit/credit columns", () => {
    const { lines, errors } = parseBankStatementCsv(sampleCsv);
    expect(errors).toHaveLength(0);
    expect(lines).toHaveLength(2);
    expect(lines[0].date).toBe("2026-08-01");
    expect(lines[0].creditPaise).toBe(500_000);
    expect(lines[0].debitPaise).toBe(0);
    expect(lines[1].debitPaise).toBe(5_900);
    expect(lines[1].narration).toContain("BANK CHARGES");
  });

  it("derives closing balance from last balance column", () => {
    const { lines, closingBalancePaise } = parseBankStatementCsv(sampleCsv);
    expect(closingBalancePaise).toBe(1_494_100);
    expect(statementClosingBalancePaise(lines)).toBe(1_494_100);
  });

  it("auto-matches statement lines to book vouchers by amount and date", () => {
    const { lines } = parseBankStatementCsv(sampleCsv);
    const book: UniversalMoneyEntry[] = [
      {
        id: "v1",
        voucherNumber: "RCP-001",
        voucherDate: "2026-08-01",
        cashDebitPaise: 0,
        cashCreditPaise: 500_000,
        counterpartyName: "Customer",
        metadata: {},
      } as UniversalMoneyEntry,
      {
        id: "v2",
        voucherNumber: "BCH-001",
        voucherDate: "2026-08-02",
        cashDebitPaise: 0,
        cashCreditPaise: 5_900,
        counterpartyName: "Bank Charges",
        metadata: { bank_charge: true },
      } as UniversalMoneyEntry,
    ];
    const matched = suggestStatementMatches(lines, book);
    expect(matched[0].matchedVoucherId).toBe("v1");
    expect(matched[1].matchedVoucherId).toBe("v2");
  });

  it("rejects CSV without date column", () => {
    const bad = parseBankStatementCsv("Amount,Narration\n100,test");
    expect(bad.lines).toHaveLength(0);
    expect(bad.errors.some((e) => e.includes("Date"))).toBe(true);
  });
});
