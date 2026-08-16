/**
 * Company-wide cash ledger — aggregates party cash movements for treasury view.
 */
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { usePeople } from "@/lib/people-store";
import { paiseToRupees } from "@/lib/billing-store";

export interface CompanyCashLedgerRow {
  id: string;
  ts: number;
  date: string;
  voucherNo: string;
  type: string;
  description: string;
  partyId: string;
  partyName: string;
  sourceRoute?: string | null;
  debitPaise: number;
  creditPaise: number;
  closingPaise: number;
}

export function compileCompanyCashLedger(): CompanyCashLedgerRow[] {
  const people = usePeople.getState().people;
  const raw: Omit<CompanyCashLedgerRow, "closingPaise">[] = [];

  for (const person of people) {
    const ledger = compileCustomerLedger(person.id);
    for (const row of ledger.rows) {
      if (!row.moneyDebitPaise && !row.moneyCreditPaise) continue;
      raw.push({
        id: `${person.id}_${row.id}`,
        ts: row.ts,
        date: row.date,
        voucherNo: row.voucherNo,
        type: row.type,
        description: row.description,
        partyId: person.id,
        partyName: person.fullName,
        sourceRoute: row.sourceRoute,
        debitPaise: row.moneyDebitPaise,
        creditPaise: row.moneyCreditPaise,
      });
    }
  }

  raw.sort((a, b) => a.ts - b.ts || a.voucherNo.localeCompare(b.voucherNo));

  let running = 0;
  return raw.map((row) => {
    running += row.debitPaise - row.creditPaise;
    return { ...row, closingPaise: running };
  });
}

export function companyCashLedgerToExportRows(rows: CompanyCashLedgerRow[]): string[][] {
  const header = [
    "Date",
    "Voucher",
    "Type",
    "Party",
    "Description",
    "Debit (₹)",
    "Credit (₹)",
    "Balance (₹)",
  ];
  const data = rows.map((r) => [
    r.date,
    r.voucherNo,
    r.type,
    r.partyName,
    r.description,
    r.debitPaise ? paiseToRupees(r.debitPaise) : "",
    r.creditPaise ? paiseToRupees(r.creditPaise) : "",
    paiseToRupees(r.closingPaise),
  ]);
  return [header, ...data];
}
