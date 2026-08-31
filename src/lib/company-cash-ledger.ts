/**
 * Company cash/bank book — derived from universal_ledger_entries scoped to
 * cash-or-bank CoA accounts. Party AR stays on Party 360 / compileCustomerLedger.
 */
import { paiseToRupees } from "@/lib/billing-store";
import {
  useMoneyVoucherStore,
  type UniversalMoneyEntry,
} from "@/lib/money-voucher";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { formatLedgerSourceLabel, resolveNarrationForDisplay } from "@/lib/ledger-narration";
import { resolveMoneyEntryRoute } from "@/lib/ledger-voucher-routes";
import type { DateRange } from "@/lib/report-engine";

export interface CompanyCashLedgerRow {
  id: string;
  ts: number;
  date: string;
  voucherNo: string;
  reference: string;
  type: string;
  description: string;
  partyId: string;
  partyName: string;
  source: string;
  sourceLabel: string;
  postedBy: string;
  sourceRoute?: string | null;
  debitPaise: number;
  creditPaise: number;
  closingPaise: number;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  metadata: Record<string, unknown>;
}

export type CompanyCashLedgerFilters = {
  accountId?: string;
  partyId?: string;
  source?: string;
  dateRange?: DateRange;
  search?: string;
};

function entryAccountId(e: UniversalMoneyEntry): string | null {
  const m = e.metadata ?? {};
  const id =
    (typeof m.cash_or_bank_account_id === "string" && m.cash_or_bank_account_id) ||
    (typeof m.debit_account_id === "string" && m.voucherKind === "receipt"
      ? m.debit_account_id
      : null) ||
    (typeof m.credit_account_id === "string" && m.voucherKind === "payment"
      ? m.credit_account_id
      : null) ||
    (typeof m.cash_or_bank_account_id === "string" ? m.cash_or_bank_account_id : null) ||
    (typeof m.to_account_id === "string" && m.voucherKind === "contra" && m.contraLeg === "to"
      ? m.to_account_id
      : null) ||
    (typeof m.from_account_id === "string" && m.voucherKind === "contra" && m.contraLeg === "from"
      ? m.from_account_id
      : null) ||
    (typeof m.to_account_id === "string" ? m.to_account_id : null) ||
    (typeof m.from_account_id === "string" ? m.from_account_id : null);
  return id || null;
}

function mapEntryToRow(
  e: UniversalMoneyEntry,
  acc: { id: string; code: string; name: string } | undefined,
): Omit<CompanyCashLedgerRow, "closingPaise"> {
  const m = e.metadata ?? {};
  const label =
    (typeof m.party_ledger_label === "string" && m.party_ledger_label) ||
    e.transactionCode ||
    "Voucher";
  const source = typeof m.source === "string" ? m.source : "";
  const reference =
    (typeof m.reference === "string" && m.reference) ||
    (typeof m.invoiceNo === "string" && m.invoiceNo) ||
    "";
  const postedBy =
    (typeof m.posted_by === "string" && m.posted_by) ||
    (typeof m.postedBy === "string" && m.postedBy) ||
    "";
  const ts = Date.parse(e.createdAt) || Date.parse(e.voucherDate) || 0;
  const accId = entryAccountId(e);
  return {
    id: e.id,
    ts,
    date: e.voucherDate,
    voucherNo: e.voucherNumber,
    reference,
    type: label,
    description: resolveNarrationForDisplay({
      narration: typeof m.narration === "string" ? m.narration : null,
      counterpartyName: e.counterpartyName,
      fallback: label,
    }),
    partyId: e.counterpartyId ?? "",
    partyName: e.counterpartyName ?? "",
    source,
    sourceLabel: formatLedgerSourceLabel(source),
    postedBy,
    sourceRoute: resolveMoneyEntryRoute(e),
    debitPaise: e.cashDebitPaise,
    creditPaise: e.cashCreditPaise,
    accountId: accId ?? undefined,
    accountCode: acc?.code,
    accountName: acc?.name,
    metadata: m,
  };
}

/**
 * @param filters optional account, party, source, date range, text search
 */
export function compileCompanyCashLedger(
  filters?: CompanyCashLedgerFilters,
  entriesOverride?: UniversalMoneyEntry[],
): CompanyCashLedgerRow[] {
  const accounts = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive);
  const accountIds = new Set(
    filters?.accountId ? [filters.accountId] : accounts.map((a) => a.id),
  );
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const entries = entriesOverride ?? useMoneyVoucherStore.getState().entries;
  const raw: Omit<CompanyCashLedgerRow, "closingPaise">[] = [];
  const q = filters?.search?.trim().toLowerCase();

  for (const e of entries) {
    if (e.reversalRefId) continue;
    if (!(e.cashDebitPaise > 0 || e.cashCreditPaise > 0)) continue;
    const accId = entryAccountId(e);
    if (!accId || !accountIds.has(accId)) continue;
    if (filters?.partyId && e.counterpartyId !== filters.partyId) continue;
    const src = typeof e.metadata?.source === "string" ? e.metadata.source : "";
    if (filters?.source && src !== filters.source) continue;
    if (filters?.dateRange) {
      if (filters.dateRange.from && e.voucherDate < filters.dateRange.from) continue;
      if (filters.dateRange.to && e.voucherDate > filters.dateRange.to) continue;
    }
    const row = mapEntryToRow(e, byId.get(accId));
    if (q) {
      const hay = `${row.voucherNo} ${row.reference} ${row.description} ${row.partyName} ${row.sourceLabel}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    raw.push(row);
  }

  raw.sort((a, b) => a.ts - b.ts || a.voucherNo.localeCompare(b.voucherNo));

  let running = accounts
    .filter((a) => accountIds.has(a.id))
    .reduce((s, a) => s + a.openingBalancePaise, 0);

  // Opening adjustment: rows before dateRange.from still affect running balance
  if (filters?.dateRange?.from) {
    for (const e of entries) {
      if (e.reversalRefId) continue;
      const accId = entryAccountId(e);
      if (!accId || !accountIds.has(accId)) continue;
      if (e.voucherDate >= filters.dateRange.from) continue;
      running += e.cashDebitPaise - e.cashCreditPaise;
    }
  }

  return raw.map((row) => {
    running += row.debitPaise - row.creditPaise;
    return { ...row, closingPaise: running };
  });
}

export function companyCashLedgerOpeningPaise(
  filters?: CompanyCashLedgerFilters,
  entriesOverride?: UniversalMoneyEntry[],
): number {
  const rows = compileCompanyCashLedger(filters, entriesOverride);
  if (rows.length === 0) {
    const accounts = useChartOfAccountsStore
      .getState()
      .ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive);
    const accountIds = new Set(
      filters?.accountId ? [filters.accountId] : accounts.map((a) => a.id),
    );
    return accounts
      .filter((a) => accountIds.has(a.id))
      .reduce((s, a) => s + a.openingBalancePaise, 0);
  }
  const first = rows[0];
  return first.closingPaise - (first.debitPaise - first.creditPaise);
}

export function companyCashLedgerTotals(rows: CompanyCashLedgerRow[]): {
  totalDebitPaise: number;
  totalCreditPaise: number;
  closingPaise: number;
} {
  const totalDebitPaise = rows.reduce((s, r) => s + r.debitPaise, 0);
  const totalCreditPaise = rows.reduce((s, r) => s + r.creditPaise, 0);
  const closingPaise = rows.length > 0 ? rows[rows.length - 1].closingPaise : 0;
  return { totalDebitPaise, totalCreditPaise, closingPaise };
}

export function companyCashLedgerToExportRows(rows: CompanyCashLedgerRow[]): string[][] {
  const header = [
    "Date",
    "Voucher",
    "Reference",
    "Narration",
    "Debit (₹)",
    "Credit (₹)",
    "Balance (₹)",
    "Party",
    "Source",
    "User",
  ];
  const data = rows.map((r) => [
    r.date,
    r.voucherNo,
    r.reference,
    r.description,
    r.debitPaise ? paiseToRupees(r.debitPaise) : "",
    r.creditPaise ? paiseToRupees(r.creditPaise) : "",
    paiseToRupees(r.closingPaise),
    r.partyName,
    r.sourceLabel,
    r.postedBy,
  ]);
  return [header, ...data];
}

export function listMoneySourceModules(): string[] {
  const set = new Set<string>();
  for (const e of useMoneyVoucherStore.getState().entries) {
    const s = e.metadata?.source;
    if (typeof s === "string" && s) set.add(s);
  }
  return [...set].sort();
}
