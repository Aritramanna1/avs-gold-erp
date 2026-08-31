/**
 * Cross-module balance reconciliation — Ledger vs module vs stock vs report.
 */
import { computeBalances, useLedger } from "@/lib/ledger-store";
import { compileCompanyCashLedger } from "@/lib/company-cash-ledger";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { useStock } from "@/lib/stock-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { useMoneyVoucherStore } from "@/lib/money-voucher";

export type ReconciliationCheckStatus = "ok" | "warn" | "fail";

export type ReconciliationCheck = {
  id: string;
  title: string;
  category: "gold" | "cash" | "party" | "stock" | "module";
  status: ReconciliationCheckStatus;
  expected: string;
  actual: string;
  variance: string;
  explainRoute?: string;
  detail?: string;
};

export function runBalanceReconciliation(): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = [];
  const entries = useLedger.getState().entries;
  const balance = computeBalances(entries);

  checks.push({
    id: "gold_ledger_integrity",
    title: "Gold ledger internal balance",
    category: "gold",
    status: balance.balanced ? "ok" : "fail",
    expected: "Bucket sum = ledger total",
    actual: balance.balanced ? "Balanced" : `Discrepancy ${mgToGrams(Math.abs(balance.discrepancyMg))} g fine`,
    variance: balance.balanced ? "0" : `${balance.discrepancyMg} mg`,
    explainRoute: "/ledger",
    detail: balance.balanced
      ? undefined
      : "Daily close and vault operations are blocked until resolved.",
  });

  const cashRows = compileCompanyCashLedger();
  const compiledClosing =
    cashRows.length > 0 ? cashRows[cashRows.length - 1].closingPaise : 0;
  const coaCash = useChartOfAccountsStore
    .getState()
    .ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive)
    .reduce((s, a) => s + (a.currentBalancePaise ?? a.openingBalancePaise), 0);
  const cashDelta = Math.abs(compiledClosing - coaCash);
  checks.push({
    id: "company_cash_vs_coa",
    title: "Company cash book vs Chart of Accounts",
    category: "cash",
    status: cashDelta <= 1 ? "ok" : "warn",
    expected: `₹${paiseToRupees(coaCash)} (CoA cache)`,
    actual: `₹${paiseToRupees(compiledClosing)} (compiled book)`,
    variance: `₹${paiseToRupees(cashDelta)}`,
    explainRoute: "/treasury/cash-book",
  });

  const stockItems = useStock.getState().items.filter((i) => i.status !== "sold" && (i.fineMg ?? 0) > 0);
  const stockFineMg = stockItems.reduce((s, i) => s + (i.fineMg ?? 0), 0);
  const finishedBucket = balance.buckets.finished ?? 0;
  const stockDelta = Math.abs(stockFineMg - finishedBucket);
  checks.push({
    id: "ready_stock_vs_finished",
    title: "Ready stock tags vs finished gold bucket",
    category: "stock",
    status: stockDelta <= 50 ? "ok" : "warn",
    expected: `${mgToGrams(finishedBucket)} g fine (ledger finished bucket)`,
    actual: `${mgToGrams(stockFineMg)} g fine (stock items)`,
    variance: `${mgToGrams(stockDelta)} g`,
    explainRoute: "/reports/gold-stock",
  });

  const settlements = useGoldSettlement.getState().settlements;
  const orphanSettlements = settlements.filter(
    (s) =>
      ["gold_received", "gold_given", "cash_received_against_gold"].includes(s.settlement_type) &&
      !s.notes?.includes("[ledger:"),
  );
  checks.push({
    id: "settlement_voucher_count",
    title: "Gold settlement vouchers (operational mirror)",
    category: "module",
    status: orphanSettlements.length === 0 ? "ok" : "warn",
    expected: "Settlements paired with ledger posts",
    actual: `${settlements.length} settlement rows`,
    variance: orphanSettlements.length > 0 ? `${orphanSettlements.length} need review` : "0",
    explainRoute: "/reports/settlement-reconciliation",
  });

  const goldBookEntries = useWorkerGoldBook.getState().entries;
  const missingLedger = goldBookEntries.filter((e) => e.type === "given" && !e.orderId);
  checks.push({
    id: "worker_book_orphans",
    title: "Karigar gold book standalone issues",
    category: "module",
    status: missingLedger.length === 0 ? "ok" : "warn",
    expected: "Order-linked or ledger-backed issues",
    actual: `${goldBookEntries.length} gold book rows`,
    variance: `${missingLedger.length} standalone given rows`,
    explainRoute: "/workshop/gold-book",
  });

  const expenses = useExpensesStore.getState().expenses;
  const moneyEntries = useMoneyVoucherStore.getState().entries;
  const expenseVoucherIds = new Set(
    moneyEntries
      .filter((e) => e.metadata?.source === "expense")
      .map((e) => String(e.metadata?.sourceId ?? "")),
  );
  const expensesWithoutLedger = expenses.filter((e) => !expenseVoucherIds.has(e.id));
  checks.push({
    id: "expense_cash_book",
    title: "Expenses posted to company cash book",
    category: "cash",
    status: expensesWithoutLedger.length === 0 ? "ok" : expenses.length === 0 ? "ok" : "warn",
    expected: "Each expense has universal ledger voucher",
    actual: `${expenses.length - expensesWithoutLedger.length} / ${expenses.length} linked`,
    variance:
      expensesWithoutLedger.length > 0
        ? `${expensesWithoutLedger.length} missing cash book post`
        : "0",
    explainRoute: "/expenses",
  });

  const customers = usePeople.getState().people.filter((p) => p.type === "customer").slice(0, 5);
  for (const c of customers) {
    const compiled = compileCustomerLedger(c.id);
    checks.push({
      id: `party_gold_${c.id}`,
      title: `Party gold book: ${c.fullName}`,
      category: "party",
      status: "ok",
      expected: "Compiled party ledger (derived)",
      actual: `Closing ${mgToGrams(compiled.closingGoldMg)} g fine`,
      variance: "See party ledger report",
      explainRoute: `/people/${c.id}`,
      detail: "Cross-check against gold_ledger customer bucket for this party.",
    });
  }

  return checks;
}

export function reconciliationSummary(checks: ReconciliationCheck[]): {
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
