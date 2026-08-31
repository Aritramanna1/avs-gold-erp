/**
 * Workshop ledger — external source registry (the Payment-module seam).
 *
 * Workshop is the permanent ledger; other modules are operations that POST to
 * it. Today the jeweller-book compiler reads the stores it knows about
 * (settlements, orders, invoices). The upcoming Payment module — worker salary
 * payouts, outside-worker and polishing-vendor payments, and other
 * manufacturing-operation payments — must land in the relevant party's book
 * WITHOUT the compiler growing a hard dependency on it.
 *
 * So instead of importing a payment store here, we expose a registry: the
 * Payment module (or any future contributor) calls registerLedgerContributor()
 * once at startup, and the books merge whatever it yields for a party. Nothing
 * is registered today, so behaviour is unchanged — but the data flow is already
 * in place, and adding payments is "register a contributor", not "redesign the
 * Workshop".
 *
 * Contributors are kept purposely dumb: given a partyId, return ledger rows.
 * They never compute running balances — the book owns that, so a payment and a
 * settlement interleave on one balance correctly.
 */
import type { LedgerSource } from "./customer-account-ledger";

/**
 * A row a contributor hands to a book. Mirrors the money/gold columns of
 * CustomerLedgerRow, minus the running-balance fields the book computes.
 */
export interface ContributedLedgerRow {
  id: string;
  ts: number;
  date: string;
  voucherNo: string;
  type: string;
  description: string;
  source: LedgerSource;

  purity?: number;
  goldInMg: number;
  goldOutMg: number;
  moneyDebitPaise: number;
  moneyCreditPaise: number;
}

export interface LedgerContributor {
  /** Tags every row this contributor emits (e.g. "payment"). */
  source: LedgerSource;
  /** One-line label for the book's UI section, e.g. "Payments & Payouts". */
  label: string;
  /** Rows for one party (jeweller, worker or vendor), any order — the book sorts. */
  rowsFor: (partyId: string) => ContributedLedgerRow[];
}

const contributors: LedgerContributor[] = [];

/** Register once at module init. Idempotent per source — re-registering replaces. */
export function registerLedgerContributor(c: LedgerContributor): void {
  const i = contributors.findIndex((x) => x.source === c.source);
  if (i >= 0) contributors[i] = c;
  else contributors.push(c);
}

export function getLedgerContributors(): readonly LedgerContributor[] {
  return contributors;
}

/** Every contributed row for a party, flattened. Empty until a module registers. */
export function contributedRowsFor(partyId: string): ContributedLedgerRow[] {
  return contributors.flatMap((c) => c.rowsFor(partyId));
}
