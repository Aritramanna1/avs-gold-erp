/**
 * MTJ ERP — Total Profit & Loss and Owner Drawings Accounting Engine
 *
 * Core Principles:
 * 1. Business Revenue: Making Charges + Fine Gold Margins + Other Income.
 * 2. Direct Work Costs: Carrier Costs + Karigar Labour Costs.
 * 3. Gross Margin: Customer Earning % - Karigar/Carrier Cost %.
 * 4. Business Operating Expenses: Rent, electricity, salaries, transport, packaging, software, etc.
 * 5. Net Business Profit: Gross Revenue - Direct Costs - Business Operating Expenses.
 * 6. Owner Drawings / Personal Spending: Tracked separately in Owner Equity. Does NOT reduce operating profit.
 */

import { useBilling } from "./billing-store";
import { useExpensesStore, type BusinessProfitSummary } from "./expenses-store";
import { useSettings } from "./settings-store";
import { getCurrentGoldRatePaise } from "./bullion-rate-service";

export function compileTotalProfitReport(fromMs: number, toMs: number): BusinessProfitSummary {
  const invoices = useBilling.getState().invoices || [];
  const expensesStore = useExpensesStore.getState();
  const expenses = expensesStore.expenses || [];
  const withdrawals = expensesStore.withdrawals || [];
  const goldRatePaise = getCurrentGoldRatePaise() || 750000;

  const fromDateStr = new Date(fromMs).toISOString().slice(0, 10);
  const toDateStr = new Date(toMs).toISOString().slice(0, 10);

  // 1. Invoices in window
  const inWindowInvoices = invoices.filter((inv) => {
    const ts = typeof inv.createdAt === "number" ? inv.createdAt : Date.parse(String(inv.createdAt)) || 0;
    return ts >= fromMs && ts <= toMs && inv.status !== "cancelled";
  });

  let makingChargesPaise = 0;
  let grossRevenuePaise = 0;
  let grossRevenueFineMg = 0;
  let directWorkCostPaise = 0;
  let fineMarginPaise = 0;

  for (const inv of inWindowInvoices) {
    grossRevenuePaise += inv.subtotalPaise;
    for (const item of inv.items || []) {
      grossRevenueFineMg += item.fineMg || 0;
      makingChargesPaise += item.makingChargesPaise || 0;
      // Direct Karigar cost estimation: typical 50% of making or carrier cost delta
      const itemDirectCost = Math.round((item.makingChargesPaise || 0) * 0.5);
      directWorkCostPaise += itemDirectCost;
      fineMarginPaise += (item.makingChargesPaise || 0) - itemDirectCost;
    }
  }

  // 2. Business Operating Expenses (type === "business")
  const businessExpensesInPeriod = expenses.filter(
    (e) => e.date >= fromDateStr && e.date <= toDateStr && e.type === "business",
  );
  const businessExpensesPaise = businessExpensesInPeriod.reduce((sum, e) => sum + e.amountPaise, 0);

  // 3. Gross Profit
  const grossProfitPaise = grossRevenuePaise - directWorkCostPaise;
  const grossProfitMarginPct =
    grossRevenuePaise > 0 ? (grossProfitPaise / grossRevenuePaise) * 100 : 0;

  // 4. Net Business Profit
  const netBusinessProfitPaise = grossProfitPaise - businessExpensesPaise;
  const netProfitMarginPct =
    grossRevenuePaise > 0 ? (netBusinessProfitPaise / grossRevenuePaise) * 100 : 0;
  const isLoss = netBusinessProfitPaise < 0;

  // 5. Owner Drawings / Personal Spending (Must NEVER reduce operating profit)
  const personalExpensesInPeriod = expenses.filter(
    (e) => e.date >= fromDateStr && e.date <= toDateStr && e.type === "personal",
  );
  const withdrawalsInPeriod = withdrawals.filter(
    (w) => w.date >= fromDateStr && w.date <= toDateStr,
  );
  const ownerDrawingsPaise =
    withdrawalsInPeriod.reduce((sum, w) => sum + w.amountPaise, 0) +
    personalExpensesInPeriod.reduce((sum, e) => sum + e.amountPaise, 0);

  // 6. Net Equity Impact (Retained in Business)
  const netEquityImpactPaise = netBusinessProfitPaise - ownerDrawingsPaise;

  // 7. Gold Equivalents
  const businessExpensesFineMg =
    goldRatePaise > 0 ? Math.round((businessExpensesPaise / goldRatePaise) * 1000) : 0;
  const netBusinessProfitFineMg =
    goldRatePaise > 0 ? Math.round((netBusinessProfitPaise / goldRatePaise) * 1000) : 0;
  const ownerDrawingsFineMg =
    goldRatePaise > 0 ? Math.round((ownerDrawingsPaise / goldRatePaise) * 1000) : 0;

  return {
    periodFrom: fromDateStr,
    periodTo: toDateStr,
    grossRevenuePaise,
    makingChargesPaise,
    fineMarginPaise,
    otherIncomePaise: 0,
    directWorkCostPaise,
    karigarLabourCostPaise: directWorkCostPaise,
    carrierCostPaise: Math.round(directWorkCostPaise * 0.3),
    grossProfitPaise,
    grossProfitMarginPct,
    businessExpensesPaise,
    netBusinessProfitPaise,
    netProfitMarginPct,
    isLoss,
    ownerDrawingsPaise,
    netEquityImpactPaise,
    grossRevenueFineMg,
    businessExpensesFineMg,
    netBusinessProfitFineMg,
    ownerDrawingsFineMg,
  };
}
