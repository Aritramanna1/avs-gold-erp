import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { paiseToRupees } from "@/lib/billing-store";
import {
  type CompanyCashLedgerRow,
} from "@/lib/company-cash-ledger";
import { useTableKeyboardNav } from "@/hooks/use-table-keyboard-nav";
import { LedgerMoneyDetailDrawer } from "@/components/ledger/LedgerMoneyDetailDrawer";
import { useState } from "react";

type CompanyCashLedgerTableProps = {
  rows: CompanyCashLedgerRow[];
  showOpeningFooter?: boolean;
  openingPaise?: number;
};

export function CompanyCashLedgerTable({
  rows,
  showOpeningFooter,
  openingPaise = 0,
}: CompanyCashLedgerTableProps) {
  const { focusedIndex, onKeyDown } = useTableKeyboardNav({ rowCount: rows.length });
  const [detailRow, setDetailRow] = useState<CompanyCashLedgerRow | null>(null);

  const totals = useMemo(() => {
    const totalDebitPaise = rows.reduce((s, r) => s + r.debitPaise, 0);
    const totalCreditPaise = rows.reduce((s, r) => s + r.creditPaise, 0);
    const closingPaise = rows.length > 0 ? rows[rows.length - 1].closingPaise : openingPaise;
    return { totalDebitPaise, totalCreditPaise, closingPaise };
  }, [rows, openingPaise]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No cash ledger movements in this period. Receipts, payments, billing, expenses, and party
        ledger cash post to the Company Cash Book automatically.
      </p>
    );
  }

  return (
    <>
      <div
        className="rounded-md border border-border overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="grid"
        aria-label="Company cash ledger"
      >
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground border-b">
            <tr>
              <th className="py-2 px-3 text-left">Date</th>
              <th className="py-2 px-3 text-left">No. / Voucher</th>
              <th className="py-2 px-3 text-left">Nar</th>
              <th className="py-2 px-3 text-right">Jama (Receipt)</th>
              <th className="py-2 px-3 text-right">Nave (Payment)</th>
              <th className="py-2 px-3 text-right">Closing Cash</th>
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, idx) => (
              <tr
                key={r.id}
                className={`hover:bg-muted/30 cursor-pointer ${idx === focusedIndex ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""}`}
                onClick={() => setDetailRow(r)}
              >
                <td className="py-2 px-3 whitespace-nowrap">{r.date}</td>
                <td className="py-2 px-3 font-mono">
                  {r.sourceRoute ? (
                    <Link
                      to={r.sourceRoute}
                      className="text-primary hover:underline"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {r.voucherNo}
                    </Link>
                  ) : (
                    r.voucherNo
                  )}
                  {r.reference ? (
                    <div className="text-[10px] text-muted-foreground">{r.reference}</div>
                  ) : null}
                </td>
                <td className="py-2 px-3 max-w-[240px] truncate" title={r.description}>
                  {r.description}
                </td>
                <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                  {r.debitPaise ? `₹${paiseToRupees(r.debitPaise)}` : "—"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-rose-700 dark:text-rose-400">
                  {r.creditPaise ? `₹${paiseToRupees(r.creditPaise)}` : "—"}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold">
                  ₹{paiseToRupees(r.closingPaise)}
                </td>
                <td className="py-2 px-3">{r.partyName || "—"}</td>
                <td className="py-2 px-3">
                  <span className="text-[10px] uppercase tracking-wide">{r.sourceLabel}</span>
                  {r.postedBy ? (
                    <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                      {r.postedBy}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          {showOpeningFooter ? (
            <tfoot className="bg-muted/40 border-t font-semibold">
              <tr>
                <td colSpan={3} className="py-2 px-3 text-right text-muted-foreground">
                  Opening ₹{paiseToRupees(openingPaise)} · Period totals
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  ₹{paiseToRupees(totals.totalDebitPaise)}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  ₹{paiseToRupees(totals.totalCreditPaise)}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  ₹{paiseToRupees(totals.closingPaise)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <LedgerMoneyDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
    </>
  );
}
