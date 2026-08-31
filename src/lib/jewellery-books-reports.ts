/**
 * Jewellery book compilers — Offline report parity over AVS SoT.
 * Gold → gold_ledger / ledger-store; cash → universal money vouchers;
 * party → compileCustomerLedger; stock → stock movements; sales → invoices.
 */
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useBilling } from "@/lib/billing-store";
import { usePeople, type Person } from "@/lib/people-store";
import { useLedger, type LedgerEntry } from "@/lib/ledger-store";
import { useStock } from "@/lib/stock-store";
import { useSupplierPurchases } from "@/lib/supplier-purchases-store";
import {
  compileCompanyCashLedger,
  companyCashLedgerOpeningPaise,
} from "@/lib/company-cash-ledger";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { isInDateRange, type DateRange } from "@/lib/report-engine";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type FineRojmelRow = {
  date: string;
  voucherNo: string;
  narration: string;
  inMg: number;
  outMg: number;
  closingMg: number;
};

export function compileFineRojmel(range: DateRange, entries?: LedgerEntry[]): {
  rows: FineRojmelRow[];
  openingMg: number;
  closingMg: number;
} {
  const all = [...(entries ?? useLedger.getState().entries)].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  let running = 0;
  let openingMg = 0;
  const rows: FineRojmelRow[] = [];
  for (const e of all) {
    const inRange = isInDateRange(e.createdAt, range);
    if (!inRange) {
      if (!range.from || dayKey(e.createdAt) < range.from) {
        running += e.netFineMg;
        openingMg = running;
      }
      continue;
    }
    const inMg = e.netFineMg > 0 ? e.netFineMg : 0;
    const outMg = e.netFineMg < 0 ? -e.netFineMg : 0;
    running += e.netFineMg;
    rows.push({
      date: dayKey(e.createdAt),
      voucherNo: e.reference || e.id.slice(0, 8),
      narration: e.notes || e.source || e.type || "Gold ledger",
      inMg,
      outMg,
      closingMg: running,
    });
  }
  return { rows, openingMg, closingMg: running };
}

export type DarRojmelRow = {
  date: string;
  voucherNo: string;
  partyName: string;
  narration: string;
  jamaPaise: number;
  navePaise: number;
  closingPaise: number;
};

export function compileDarRojmel(range: DateRange): {
  rows: DarRojmelRow[];
  openingPaise: number;
  closingPaise: number;
} {
  const openingPaise = companyCashLedgerOpeningPaise({ dateRange: range });
  const cashRows = compileCompanyCashLedger({ dateRange: range });
  const rows: DarRojmelRow[] = cashRows.map((r) => ({
    date: r.date,
    voucherNo: r.voucherNo,
    partyName: r.partyName,
    narration: r.description,
    jamaPaise: r.debitPaise,
    navePaise: r.creditPaise,
    closingPaise: r.closingPaise,
  }));
  const closingPaise = rows.length ? rows[rows.length - 1]!.closingPaise : openingPaise;
  return { rows, openingPaise, closingPaise };
}

export type AccountBalanceRow = {
  partyId: string;
  partyName: string;
  phone: string;
  city: string;
  /** Offline: Jama Wt (g) — metal Jama / gold in */
  jamaWtMg: number;
  /** Offline: Return Wt (g) — returns (0 until return class is tagged) */
  returnWtMg: number;
  /** Offline: Nave Wt (g) — metal Nave / gold out */
  naveWtMg: number;
  /** Offline: Cash — closing money, ROUND 0 rupees (paise internally) */
  cashPaise: number;
  /** Offline: Anamat — cash advance / anamat bucket */
  anamatPaise: number;
  /** Offline: Fine — closing fine gold */
  fineMg: number;
  openingGoldMg: number;
  closingGoldMg: number;
  openingMoneyPaise: number;
  closingMoneyPaise: number;
  goldInMg: number;
  goldOutMg: number;
  debitPaise: number;
  creditPaise: number;
};

function partyCity(p: Person): string {
  return (p.villageCity || p.district || p.area || p.state || "").trim() || "—";
}

export function compileAccountBalances(variant: "1" | "2" = "1"): AccountBalanceRow[] {
  const people = usePeople.getState().people.filter((p) => p.active !== false);
  const rows: AccountBalanceRow[] = [];
  for (const p of people) {
    const roles = [p.type, ...(p.roles ?? [])];
    const isParty = roles.some((r) =>
      ["customer", "firm_customer", "jeweller", "dealer", "vendor"].includes(r),
    );
    if (!isParty) continue;
    const led = compileCustomerLedger(p.id);
    if (
      led.closingGoldMg === 0 &&
      led.closingMoneyPaise === 0 &&
      led.openingGoldMg === 0 &&
      led.openingMoneyPaise === 0 &&
      led.totalGoldInMg === 0 &&
      led.totalGoldOutMg === 0 &&
      led.totalDebitPaise === 0 &&
      led.moneyAdvancePaise === 0
    ) {
      continue;
    }
    rows.push({
      partyId: p.id,
      partyName: p.tradeName || p.fullName,
      phone: p.phone || "",
      city: partyCity(p),
      jamaWtMg: led.totalGoldInMg,
      returnWtMg: 0,
      naveWtMg: led.totalGoldOutMg,
      cashPaise: led.closingMoneyPaise,
      anamatPaise: led.moneyAdvancePaise,
      fineMg: led.closingGoldMg,
      openingGoldMg: led.openingGoldMg,
      closingGoldMg: led.closingGoldMg,
      openingMoneyPaise: led.openingMoneyPaise,
      closingMoneyPaise: led.closingMoneyPaise,
      goldInMg: led.totalGoldInMg,
      goldOutMg: led.totalGoldOutMg,
      debitPaise: led.totalDebitPaise,
      creditPaise: led.totalCreditPaise,
    });
  }
  rows.sort((a, b) => a.partyName.localeCompare(b.partyName));
  if (variant === "2") {
    rows.sort(
      (a, b) =>
        Math.abs(b.naveWtMg) - Math.abs(a.naveWtMg) ||
        Math.abs(b.fineMg) - Math.abs(a.fineMg) ||
        Math.abs(b.cashPaise) - Math.abs(a.cashPaise),
    );
  }
  return rows;
}

export function accountBalanceTotals(rows: AccountBalanceRow[]) {
  return rows.reduce(
    (t, r) => ({
      jamaWtMg: t.jamaWtMg + r.jamaWtMg,
      returnWtMg: t.returnWtMg + r.returnWtMg,
      naveWtMg: t.naveWtMg + r.naveWtMg,
      cashPaise: t.cashPaise + r.cashPaise,
      anamatPaise: t.anamatPaise + r.anamatPaise,
      fineMg: t.fineMg + r.fineMg,
    }),
    { jamaWtMg: 0, returnWtMg: 0, naveWtMg: 0, cashPaise: 0, anamatPaise: 0, fineMg: 0 },
  );
}

/** Offline PDF: weight ROUND 3, cash/anamat ROUND 0 (whole ₹). */
export function fmtOfflineWt(mg: number): string {
  return (mg / 1000).toFixed(3);
}

export function fmtOfflineCash(paise: number): string {
  return String(Math.round(paise / 100));
}

export type JamaNaveRow = {
  key: string;
  label: string;
  saleFineMg: number;
  purchaseFineMg: number;
  salePaise: number;
  purchasePaise: number;
  saleCount: number;
  purchaseCount: number;
};

export function compileItemJamaNave(
  range: DateRange,
  mode: "item" | "account",
): JamaNaveRow[] {
  const invoices = useBilling.getState().invoices.filter(
    (inv) => inv.status !== "cancelled" && isInDateRange(inv.createdAt, range),
  );
  const map = new Map<string, JamaNaveRow>();

  function bump(
    key: string,
    label: string,
    side: "sale" | "purchase",
    fineMg: number,
    paise: number,
  ) {
    const row = map.get(key) ?? {
      key,
      label,
      saleFineMg: 0,
      purchaseFineMg: 0,
      salePaise: 0,
      purchasePaise: 0,
      saleCount: 0,
      purchaseCount: 0,
    };
    if (side === "sale") {
      row.saleFineMg += fineMg;
      row.salePaise += paise;
      row.saleCount += 1;
    } else {
      row.purchaseFineMg += fineMg;
      row.purchasePaise += paise;
      row.purchaseCount += 1;
    }
    map.set(key, row);
  }

  for (const inv of invoices) {
    const isPurchase = !!inv.billingType && inv.billingType === ("wholesale" as never);
    // Purchases live in purchase store; sales invoices contribute sale side.
    // Also treat negative line totals as purchase-like when tagged.
    const side: "sale" | "purchase" = isPurchase ? "purchase" : "sale";
    if (mode === "account") {
      const fine = inv.items.reduce((s, it) => s + (it.fineMg || 0), 0);
      bump(inv.customerId || inv.id, inv.customerName || "Unknown", side, fine, inv.grandTotalPaise);
    } else {
      for (const it of inv.items) {
        const key = (it.itemName || "Item").trim().toLowerCase();
        bump(key, it.itemName || "Item", side, it.fineMg || 0, it.lineTotalPaise || 0);
      }
    }
  }

  // Supplier purchases (metal inward)
  const purchases = useSupplierPurchases.getState().purchases ?? [];
  const people = usePeople.getState().people;
  for (const inv of purchases) {
    if (inv.reversed) continue;
    const ts = Date.parse(inv.createdAt) || 0;
    if (!isInDateRange(ts, range)) continue;
    if (mode === "account") {
      const name =
        people.find((p) => p.id === inv.supplierId)?.fullName || inv.purchaseNo || "Supplier";
      bump(inv.supplierId || inv.id, name, "purchase", inv.fineMg || 0, inv.totalPaise ?? 0);
    } else {
      const label = inv.metal || "Metal purchase";
      bump(label.toLowerCase(), label, "purchase", inv.fineMg || 0, inv.totalPaise ?? 0);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export type ItemTxnRow = {
  date: string;
  itemName: string;
  type: string;
  qty: number;
  grossMg: number;
  netMg: number;
  fineMg: number;
  ref: string;
};

export function compileItemTransactions(range: DateRange): ItemTxnRow[] {
  const { items, movements } = useStock.getState();
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows: ItemTxnRow[] = [];
  for (const m of movements) {
    if (!isInDateRange(m.ts, range)) continue;
    const item = byId.get(m.itemId);
    rows.push({
      date: dayKey(m.ts),
      itemName: item?.itemName || item?.barcode || m.itemId.slice(0, 8),
      type: m.kind,
      qty: 1,
      grossMg: item?.grossMg ?? 0,
      netMg: item?.netMg ?? 0,
      fineMg: item?.fineMg ?? 0,
      ref: m.notes || "",
    });
  }
  // Also invoice line activity as item txn
  for (const inv of useBilling.getState().invoices) {
    if (inv.status === "cancelled") continue;
    if (!isInDateRange(inv.createdAt, range)) continue;
    for (const it of inv.items) {
      rows.push({
        date: dayKey(inv.createdAt),
        itemName: it.itemName,
        type: "sale",
        qty: it.pcs ?? 1,
        grossMg: it.grossMg,
        netMg: it.netMg,
        fineMg: it.fineMg,
        ref: inv.invoiceNo,
      });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type CityWiseRow = {
  city: string;
  parties: number;
  closingGoldMg: number;
  closingMoneyPaise: number;
  saleFineMg: number;
  salePaise: number;
};

export function compileCityWise(range: DateRange): CityWiseRow[] {
  const people = usePeople.getState().people;
  const byCity = new Map<string, CityWiseRow>();
  for (const p of people) {
    if (p.active === false) continue;
    const city = partyCity(p);
    const led = compileCustomerLedger(p.id);
    const row = byCity.get(city) ?? {
      city,
      parties: 0,
      closingGoldMg: 0,
      closingMoneyPaise: 0,
      saleFineMg: 0,
      salePaise: 0,
    };
    row.parties += 1;
    row.closingGoldMg += led.closingGoldMg;
    row.closingMoneyPaise += led.closingMoneyPaise;
    byCity.set(city, row);
  }
  for (const inv of useBilling.getState().invoices) {
    if (inv.status === "cancelled" || !isInDateRange(inv.createdAt, range)) continue;
    const p = people.find((x) => x.id === inv.customerId);
    const city = p ? partyCity(p) : "—";
    const row = byCity.get(city) ?? {
      city,
      parties: 0,
      closingGoldMg: 0,
      closingMoneyPaise: 0,
      saleFineMg: 0,
      salePaise: 0,
    };
    row.saleFineMg += inv.items.reduce((s, it) => s + (it.fineMg || 0), 0);
    row.salePaise += inv.grandTotalPaise;
    byCity.set(city, row);
  }
  return Array.from(byCity.values()).sort((a, b) => a.city.localeCompare(b.city));
}

export type FineMarginRow = {
  invoiceNo: string;
  date: string;
  customerName: string;
  fineMg: number;
  goldValuePaise: number;
  makingPaise: number;
  lineTotalPaise: number;
  marginPaise: number;
};

export function compileFineMargin(range: DateRange): FineMarginRow[] {
  const rows: FineMarginRow[] = [];
  for (const inv of useBilling.getState().invoices) {
    if (inv.status === "cancelled" || !isInDateRange(inv.createdAt, range)) continue;
    const fineMg = inv.items.reduce((s, it) => s + (it.fineMg || 0), 0);
    const goldValuePaise = inv.items.reduce((s, it) => s + (it.goldValuePaise || 0), 0);
    const makingPaise = inv.items.reduce((s, it) => s + (it.makingChargesPaise || 0), 0);
    const lineTotalPaise = inv.items.reduce((s, it) => s + (it.lineTotalPaise || 0), 0);
    rows.push({
      invoiceNo: inv.invoiceNo,
      date: dayKey(inv.createdAt),
      customerName: inv.customerName,
      fineMg,
      goldValuePaise,
      makingPaise,
      lineTotalPaise,
      marginPaise: makingPaise + Math.max(0, lineTotalPaise - goldValuePaise - makingPaise),
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type BankTxnRow = {
  date: string;
  voucherNo: string;
  accountName: string;
  partyName: string;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  closingPaise: number;
};

export function compileBankTransactions(range: DateRange): BankTxnRow[] {
  const bankIds = new Set(
    useChartOfAccountsStore
      .getState()
      .ledgerAccounts.filter(
        (a) => a.isCashOrBank && a.isActive && (a.bankAccountNumber || /bank/i.test(a.name)),
      )
      .map((a) => a.id),
  );
  // If no bank-tagged accounts, fall back to all cash/bank except pure "cash"
  const rows = compileCompanyCashLedger({ dateRange: range }).filter((r) => {
    if (bankIds.size === 0) {
      return !/cash|drawer/i.test(r.accountName || "");
    }
    return r.accountId ? bankIds.has(r.accountId) : false;
  });
  return rows.map((r) => ({
    date: r.date,
    voucherNo: r.voucherNo,
    accountName: r.accountName || "Bank",
    partyName: r.partyName,
    narration: r.description,
    debitPaise: r.debitPaise,
    creditPaise: r.creditPaise,
    closingPaise: r.closingPaise,
  }));
}

export type DailySummaryRow = {
  date: string;
  goldInMg: number;
  goldOutMg: number;
  cashInPaise: number;
  cashOutPaise: number;
  salesPaise: number;
  salesCount: number;
};

export function compileDailySummary(range: DateRange): DailySummaryRow[] {
  const byDay = new Map<string, DailySummaryRow>();
  function day(d: string): DailySummaryRow {
    return (
      byDay.get(d) ?? {
        date: d,
        goldInMg: 0,
        goldOutMg: 0,
        cashInPaise: 0,
        cashOutPaise: 0,
        salesPaise: 0,
        salesCount: 0,
      }
    );
  }
  for (const e of useLedger.getState().entries) {
    if (!isInDateRange(e.createdAt, range)) continue;
    const d = dayKey(e.createdAt);
    const row = day(d);
    if (e.netFineMg > 0) row.goldInMg += e.netFineMg;
    else row.goldOutMg += -e.netFineMg;
    byDay.set(d, row);
  }
  for (const r of compileCompanyCashLedger({ dateRange: range })) {
    const row = day(r.date);
    row.cashInPaise += r.debitPaise;
    row.cashOutPaise += r.creditPaise;
    byDay.set(r.date, row);
  }
  for (const inv of useBilling.getState().invoices) {
    if (inv.status === "cancelled" || !isInDateRange(inv.createdAt, range)) continue;
    const d = dayKey(inv.createdAt);
    const row = day(d);
    row.salesPaise += inv.grandTotalPaise;
    row.salesCount += 1;
    byDay.set(d, row);
  }
  return Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type DeletedBillRow = {
  invoiceNo: string;
  date: string;
  customerName: string;
  grandPaise: number;
  cancelledAt: string;
  reason: string;
};

export function compileDeletedBills(): DeletedBillRow[] {
  return useBilling
    .getState()
    .invoices.filter((inv) => inv.status === "cancelled")
    .map((inv) => ({
      invoiceNo: inv.invoiceNo,
      date: dayKey(inv.createdAt),
      customerName: inv.customerName,
      grandPaise: inv.grandTotalPaise,
      cancelledAt: inv.cancelledAt ? dayKey(inv.cancelledAt) : "—",
      reason: inv.cancelledReason || "",
    }))
    .sort((a, b) => (a.cancelledAt < b.cancelledAt ? 1 : -1));
}

export type CashFlowRow = {
  label: string;
  inPaise: number;
  outPaise: number;
};

export function compileCashFlow(range: DateRange): {
  rows: CashFlowRow[];
  netPaise: number;
  openingPaise: number;
  closingPaise: number;
} {
  const openingPaise = companyCashLedgerOpeningPaise({ dateRange: range });
  const cashRows = compileCompanyCashLedger({ dateRange: range });
  let salesIn = 0;
  let receipts = 0;
  let payments = 0;
  let otherIn = 0;
  let otherOut = 0;
  for (const r of cashRows) {
    if (/sale|invoice|billing/i.test(r.source + r.type)) {
      salesIn += r.debitPaise;
      payments += r.creditPaise;
    } else if (r.debitPaise > 0) {
      receipts += r.debitPaise;
    } else {
      otherOut += r.creditPaise;
    }
    otherIn += 0;
  }
  const rows: CashFlowRow[] = [
    { label: "Sales receipts", inPaise: salesIn, outPaise: 0 },
    { label: "Other receipts (Jama)", inPaise: receipts, outPaise: 0 },
    { label: "Payments (Nave)", inPaise: 0, outPaise: payments + otherOut },
    { label: "Other", inPaise: otherIn, outPaise: 0 },
  ];
  const netIn = rows.reduce((s, r) => s + r.inPaise, 0);
  const netOut = rows.reduce((s, r) => s + r.outPaise, 0);
  return {
    rows,
    netPaise: netIn - netOut,
    openingPaise,
    closingPaise: openingPaise + netIn - netOut,
  };
}

/** Offline Day-wise summary — one row per calendar day with metal + cash + bills. */
export type DayWiseRow = {
  date: string;
  goldInMg: number;
  goldOutMg: number;
  cashInPaise: number;
  cashOutPaise: number;
  salesPaise: number;
  purchasePaise: number;
  bills: number;
};

export function compileDayWise(range: DateRange): DayWiseRow[] {
  const daily = compileDailySummary(range);
  const purchases = useSupplierPurchases.getState().purchases ?? [];
  const byDay = new Map<string, DayWiseRow>();
  for (const d of daily) {
    byDay.set(d.date, {
      date: d.date,
      goldInMg: d.goldInMg,
      goldOutMg: d.goldOutMg,
      cashInPaise: d.cashInPaise,
      cashOutPaise: d.cashOutPaise,
      salesPaise: d.salesPaise,
      purchasePaise: 0,
      bills: d.salesCount,
    });
  }
  for (const p of purchases) {
    const ts = Date.parse(p.createdAt) || (p.invoiceDate ? Date.parse(p.invoiceDate) : 0);
    if (!ts || !isInDateRange(ts, range)) continue;
    const key = dayKey(ts);
    const row = byDay.get(key) ?? {
      date: key,
      goldInMg: 0,
      goldOutMg: 0,
      cashInPaise: 0,
      cashOutPaise: 0,
      salesPaise: 0,
      purchasePaise: 0,
      bills: 0,
    };
    row.purchasePaise += p.totalPaise ?? 0;
    byDay.set(key, row);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Bullion / sauda-style metal deals from purchase+sale ledger lines (dealer parties). */
export type BullionLedgerRow = {
  date: string;
  voucherNo: string;
  party: string;
  fineMg: number;
  amountPaise: number;
  side: "in" | "out";
  narration: string;
};

export function compileBullionLedger(range: DateRange): BullionLedgerRow[] {
  const rows: BullionLedgerRow[] = [];
  const gold = useLedger.getState().entries;
  for (const e of gold) {
    if (!isInDateRange(e.createdAt, range)) continue;
    if (!["purchase", "sale", "old_gold_received", "adjustment"].includes(e.type)) continue;
    if (e.source === "cash_fine_transfer") continue;
    const fine = Math.abs(e.fineMg ?? e.netFineMg ?? 0);
    if (fine <= 0) continue;
    rows.push({
      date: dayKey(e.createdAt),
      voucherNo: e.reference || e.id.slice(0, 8),
      party: e.customerId || e.karigarId || "—",
      fineMg: fine,
      amountPaise: Math.abs(e.netCashPaise ?? 0),
      side: (e.netFineMg ?? 0) >= 0 ? "in" : "out",
      narration: e.notes || e.type,
    });
  }
  const invoices = useBilling.getState().invoices;
  for (const inv of invoices) {
    if (!isInDateRange(inv.createdAt, range)) continue;
    const fine = inv.items.reduce((s, l) => s + (l.fineMg ?? 0), 0);
    if (fine <= 0) continue;
    rows.push({
      date: dayKey(inv.createdAt),
      voucherNo: inv.invoiceNo || inv.id.slice(0, 8),
      party: inv.customerName || inv.customerId || "—",
      fineMg: fine,
      amountPaise: inv.grandTotalPaise ?? 0,
      side: "out",
      narration: "Sale / Invoice",
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Tanch / Hisob worksheet from invoice manufacturing lines. */
export type TanchHishobRow = {
  billNo: string;
  date: string;
  party: string;
  item: string;
  netMg: number;
  tanchPct: number;
  wstgPct: number;
  hisobPct: number;
  fineMg: number;
};

export function compileTanchHishob(range: DateRange): TanchHishobRow[] {
  const rows: TanchHishobRow[] = [];
  for (const inv of useBilling.getState().invoices) {
    if (!isInDateRange(inv.createdAt, range)) continue;
    for (const line of inv.items) {
      const net = line.netMg ?? 0;
      const tanch = (line as { tanchPct?: number }).tanchPct ?? line.purity / 10;
      const wstg = line.wastagePct ?? 0;
      const hisob = line.hisobPct ?? tanch + wstg;
      const fine = line.fineMg ?? 0;
      if (net <= 0 && fine <= 0) continue;
      rows.push({
        billNo: inv.invoiceNo || inv.id.slice(0, 8),
        date: dayKey(inv.createdAt),
        party: inv.customerName || "—",
        item: line.itemName || "Line",
        netMg: net,
        tanchPct: tanch,
        wstgPct: wstg,
        hisobPct: hisob,
        fineMg: fine,
      });
    }
  }
  return rows;
}

export { mgToGrams, paiseToRupees };
