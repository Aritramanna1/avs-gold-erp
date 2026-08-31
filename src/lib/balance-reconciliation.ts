/**
 * Cross-module balance reconciliation checks (CVsE73i6 shop parity).
 * Recovered from production-dist-shop/assets/balance-reconciliation-*.js
 */
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { usePeople } from "@/lib/people-store";
import { compileCompanyCashLedger } from "@/lib/company-cash-ledger";
import { useMoneyVoucherStore } from "@/lib/money-voucher";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useExpensesStore } from "@/lib/expenses-store";
import { useStock } from "@/lib/stock-store";

export type ReconciliationStatus = "ok" | "warn" | "fail";

export type ReconciliationCheck = {
  id: string;
  title: string;
  category: "gold" | "cash" | "stock" | "module" | "party";
  status: ReconciliationStatus;
  expected: string;
  actual: string;
  variance: string;
  explainRoute: string;
  detail?: string;
};

function cashCoaBalancePaise(): number {
  return useChartOfAccountsStore
    .getState()
    .ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive)
    .reduce((sum, a) => sum + (a.currentBalancePaise ?? a.openingBalancePaise ?? 0), 0);
}

export function runBalanceReconciliationChecks(): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = [];
  const entries = useLedger.getState().entries;
  const balances = computeBalances(entries);

  checks.push({
    id: "gold_ledger_integrity",
    title: "Gold ledger internal balance",
    category: "gold",
    status: balances.balanced ? "ok" : "fail",
    expected: "Bucket sum = ledger total",
    actual: balances.balanced
      ? "Balanced"
      : `Discrepancy ${mgToGrams(Math.abs(balances.discrepancyMg))} g fine`,
    variance: balances.balanced ? "0" : `${balances.discrepancyMg} mg`,
    explainRoute: "/ledger",
    detail: balances.balanced
      ? undefined
      : "Daily close and vault operations are blocked until resolved.",
  });

  const cashRows = compileCompanyCashLedger();
  const cashClosing = cashRows.length > 0 ? cashRows[cashRows.length - 1].closingPaise : 0;
  const coaCash = cashCoaBalancePaise();
  const cashVar = Math.abs(cashClosing - coaCash);
  checks.push({
    id: "company_cash_vs_coa",
    title: "Company cash book vs Chart of Accounts",
    category: "cash",
    status: cashVar <= 1 ? "ok" : "warn",
    expected: `₹${paiseToRupees(coaCash)} (CoA cache)`,
    actual: `₹${paiseToRupees(cashClosing)} (compiled book)`,
    variance: `₹${paiseToRupees(cashVar)}`,
    explainRoute: "/treasury/cash-book",
  });

  const stockFine = useStock
    .getState()
    .items.filter((i) => i.status !== "sold" && (i.fineMg ?? 0) > 0)
    .reduce((sum, i) => sum + (i.fineMg ?? 0), 0);
  const finished = balances.buckets.finished ?? 0;
  const stockVar = Math.abs(stockFine - finished);
  checks.push({
    id: "ready_stock_vs_finished",
    title: "Ready stock tags vs finished gold bucket",
    category: "stock",
    status: stockVar <= 50 ? "ok" : "warn",
    expected: `${mgToGrams(finished)} g fine (ledger finished bucket)`,
    actual: `${mgToGrams(stockFine)} g fine (stock items)`,
    variance: `${mgToGrams(stockVar)} g`,
    explainRoute: "/reports/gold-stock",
  });

  const settlements = useGoldSettlement.getState().settlements;
  const unpaired = settlements.filter(
    (s) =>
      ["gold_received", "gold_given", "cash_received_against_gold"].includes(s.settlement_type) &&
      !s.notes?.includes("[ledger:"),
  );
  checks.push({
    id: "settlement_voucher_count",
    title: "Gold settlement vouchers (operational mirror)",
    category: "module",
    status: unpaired.length === 0 ? "ok" : "warn",
    expected: "Settlements paired with ledger posts",
    actual: `${settlements.length} settlement rows`,
    variance: unpaired.length > 0 ? `${unpaired.length} need review` : "0",
    explainRoute: "/reports/settlement-reconciliation",
  });

  const book = useWorkerGoldBook.getState().entries;
  const orphans = book.filter((e) => e.type === "given" && !e.orderId);
  checks.push({
    id: "worker_book_orphans",
    title: "Karigar gold book standalone issues",
    category: "module",
    status: orphans.length === 0 ? "ok" : "warn",
    expected: "Order-linked or ledger-backed issues",
    actual: `${book.length} gold book rows`,
    variance: `${orphans.length} standalone given rows`,
    explainRoute: "/workshop/gold-book",
  });

  const expenses = useExpensesStore.getState().expenses;
  const voucherEntries = useMoneyVoucherStore.getState().entries;
  const linkedExpenseIds = new Set(
    voucherEntries
      .filter((e) => e.metadata?.source === "expense")
      .map((e) => String(e.metadata?.sourceId ?? "")),
  );
  const missingExpensePosts = expenses.filter((e) => !linkedExpenseIds.has(e.id));
  checks.push({
    id: "expense_cash_book",
    title: "Expenses posted to company cash book",
    category: "cash",
    status: missingExpensePosts.length === 0 || expenses.length === 0 ? "ok" : "warn",
    expected: "Each expense has universal ledger voucher",
    actual: `${expenses.length - missingExpensePosts.length} / ${expenses.length} linked`,
    variance:
      missingExpensePosts.length > 0
        ? `${missingExpensePosts.length} missing cash book post`
        : "0",
    explainRoute: "/expenses",
  });

  const sampleCustomers = usePeople
    .getState()
    .people.filter((p) => p.type === "customer")
    .slice(0, 5);
  for (const person of sampleCustomers) {
    const party = compileCustomerLedger(person.id);
    checks.push({
      id: `party_gold_${person.id}`,
      title: `Party gold book: ${person.fullName}`,
      category: "party",
      status: "ok",
      expected: "Compiled party ledger (derived)",
      actual: `Closing ${mgToGrams(party.closingGoldMg)} g fine`,
      variance: "See party ledger report",
      explainRoute: `/people/${person.id}`,
      detail: "Cross-check against gold_ledger customer bucket for this party.",
    });
  }

  return checks;
}

export function summarizeReconciliationChecks(checks: ReconciliationCheck[]): {
  ok: number;
  warn: number;
  fail: number;
} {
  return {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
}
