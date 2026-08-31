import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { mgToGrams } from "@/lib/gold";
import {
  LEDGER_PERIODS,
  resolvePeriod,
  type LedgerPeriodKey,
  type LedgerView,
  type PeriodRange,
} from "@/lib/workshop-ledger";

/**
 * Period picker + resolved range, shared by every per-purity book. Ledgers are
 * shared by period, not dumped whole — the default is the current Financial
 * Year, and the user narrows or widens from there before viewing/exporting.
 */
export function useLedgerPeriod(initial: LedgerPeriodKey = "financial_year") {
  const [periodKey, setPeriodKey] = useState<LedgerPeriodKey>(initial);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range: PeriodRange = resolvePeriod(periodKey, customFrom, customTo);
  return {
    periodKey,
    setPeriodKey,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    range,
  };
}

type LedgerPeriodState = ReturnType<typeof useLedgerPeriod>;

/** The period dropdown, plus two date inputs when "Custom Date Range" is chosen. */
export function LedgerPeriodPicker({ period }: { period: LedgerPeriodState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Period</span>
      <select
        value={period.periodKey}
        onChange={(e) => period.setPeriodKey(e.target.value as LedgerPeriodKey)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
        aria-label="Ledger period"
        data-testid="ledger-period-select"
      >
        {LEDGER_PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {period.periodKey === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={period.customFrom}
            onChange={(e) => period.setCustomFrom(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={period.customTo}
            onChange={(e) => period.setCustomTo(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}

function g(mg: number): string {
  return mgToGrams(mg);
}

/**
 * One purity book rendered as a period statement: Opening Balance, the period's
 * transactions with automatic weekly/monthly closings, then Closing Balance.
 * Non-technical column names on purpose (Transaction Date, Reference No., …).
 */
export function LedgerStatementTable({
  view,
  receivedLabel = "Gold Received",
  issuedLabel = "Gold Issued",
}: {
  view: LedgerView;
  receivedLabel?: string;
  issuedLabel?: string;
}) {
  return (
    <div className="overflow-x-auto border-t border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-3 font-medium">Transaction Date</th>
            <th className="text-left px-3 py-3 font-medium">Reference No.</th>
            <th className="text-left px-3 py-3 font-medium">Transaction Description</th>
            <th className="text-right px-3 py-3 font-medium">{receivedLabel}</th>
            <th className="text-right px-3 py-3 font-medium">{issuedLabel}</th>
            <th className="text-right px-3 py-3 font-medium">Running Gold Balance</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((l, i) => {
            const isBalance = l.kind !== "txn";
            return (
              <tr
                key={i}
                className={
                  isBalance
                    ? "border-t border-border bg-muted/20 font-semibold"
                    : "border-t border-border hover:bg-muted/20"
                }
              >
                <td className="px-3 py-2.5 whitespace-nowrap text-xs">{l.date || "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-gold">
                  {l.refNo || ""}
                  {l.slipNo ? (
                    <span className="block text-[10px] text-muted-foreground">{l.slipNo}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {l.description}
                  {l.orderNo ? (
                    <span className="text-[10px] text-muted-foreground"> · {l.orderNo}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-300">
                  {l.kind === "txn"
                    ? l.receivedMg
                      ? `${g(l.receivedMg)} g`
                      : "—"
                    : l.periodReceivedMg
                      ? `${g(l.periodReceivedMg)} g`
                      : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-amber-300">
                  {l.kind === "txn"
                    ? l.issuedMg
                      ? `${g(l.issuedMg)} g`
                      : "—"
                    : l.periodIssuedMg
                      ? `${g(l.periodIssuedMg)} g`
                      : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{g(l.balanceMg)} g</td>
              </tr>
            );
          })}
          {view.txnCount === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                No transactions in this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Linked-order chips — unchanged behaviour, just shared here. */
export function LinkedOrders({ orders }: { orders: { orderId: string; orderNo: string }[] }) {
  if (orders.length === 0) return null;
  return (
    <div className="px-4 pb-3 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
      <span className="uppercase tracking-wide">Linked orders:</span>
      {orders.map((o) => (
        <Link
          key={o.orderId}
          to="/orders/$id"
          params={{ id: o.orderId }}
          className="font-mono text-gold hover:underline"
        >
          {o.orderNo}
        </Link>
      ))}
    </div>
  );
}

/** g value as a plain spreadsheet number (no unit). */
function gNum(mg: number): number {
  return Number(mgToGrams(mg));
}

/**
 * One period statement as spreadsheet rows: a header, every line (Opening,
 * transactions, weekly/monthly closings, Closing) and blank cells where a
 * balance line has no In/Out amount.
 */
export function ledgerViewToSheet(
  view: LedgerView,
  receivedLabel = "Gold Received",
  issuedLabel = "Gold Issued",
): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "Transaction Date",
      "Reference No.",
      "Transaction Description",
      "Order",
      `${receivedLabel} (g)`,
      `${issuedLabel} (g)`,
      "Running Gold Balance (g)",
    ],
  ];
  for (const l of view.lines) {
    const recv = l.kind === "txn" ? l.receivedMg : (l.periodReceivedMg ?? 0);
    const issd = l.kind === "txn" ? l.issuedMg : (l.periodIssuedMg ?? 0);
    rows.push([
      l.date,
      l.refNo,
      l.description,
      l.orderNo ?? "",
      recv ? gNum(recv) : "",
      issd ? gNum(issd) : "",
      gNum(l.balanceMg),
    ]);
  }
  return rows;
}
