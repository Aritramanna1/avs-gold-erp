/**
 * Read-only final settlement breakdown for karigar portal (mirrors ERP salary sheet).
 */
import { CalendarDays, Coins, Scale, Star, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateMedium as fmtDate } from "@/lib/format-date";
import { mgToGrams } from "@/lib/gold";

export interface KarigarSettlementDetail {
  id: string;
  fromDate?: string;
  toDate?: string;
  presentDays?: number;
  halfDays?: number;
  absentDays?: number;
  leaveDays?: number;
  payableDays?: number;
  daysWorked?: number;
  gramsWorkedMg?: number;
  wagePctApplied?: number;
  wageGrossMg?: number;
  overlossDeductedMg?: number;
  wageNetMg?: number;
  wageBookPurity?: number;
  wageCashPaise?: number;
  wagePayOutMode?: string;
  performanceRating?: string;
  performanceNote?: string;
  salaryEarnedPaise?: number;
  withdrawalsTotalPaise?: number;
  loanDeductionPaise?: number;
  advanceDeductionPaise?: number;
  allowanceTotalPaise?: number;
  finalCashPayablePaise?: number;
  goldAdvanceFineMg?: number;
  wastageReturnedFineMg?: number;
  netGoldMg?: number;
  notes?: string;
}

const PERFORMANCE_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  needs_improvement: "Needs improvement",
};

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function paiseDisplay(paise: unknown): string {
  const n = numericValue(paise);
  if (n == null) return "—";
  const neg = n < 0;
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const body = `${whole.toLocaleString("en-IN")}.${frac}`;
  return neg ? `-₹${body}` : `₹${body}`;
}

function mg(val: unknown): string {
  const n = numericValue(val) ?? 0;
  return `${mgToGrams(n)} g`;
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: "gold" | "success" | "danger" }) {
  const valueCls =
    accent === "gold"
      ? "text-gold"
      : accent === "success"
        ? "text-emerald-400"
        : accent === "danger"
          ? "text-red-400"
          : "text-foreground";
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-semibold text-right ${valueCls}`}>{value}</span>
    </div>
  );
}

export function KarigarSettlementDetailSheet({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: KarigarSettlementDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!settlement) return null;

  const finalCash = numericValue(settlement.finalCashPayablePaise) ?? 0;
  const payOutMode = settlement.wagePayOutMode === "cash" ? "cash" : "gold";
  const netGold = numericValue(settlement.netGoldMg) ?? 0;
  const hasWageGold =
    (numericValue(settlement.wageNetMg) ?? 0) > 0 ||
    (numericValue(settlement.gramsWorkedMg) ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(var(--ornexa-inset-bottom,0px)+1rem)]">
        <SheetHeader className="text-left space-y-1 pb-2">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="font-serif text-lg">Final Settlement</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Close settlement detail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {settlement.fromDate ? fmtDate(settlement.fromDate) : "—"} →{" "}
            {settlement.toDate ? fmtDate(settlement.toDate) : "—"}
          </p>
        </SheetHeader>

        <div className="space-y-4 pt-2">
          {(settlement.performanceRating || settlement.performanceNote) && (
            <section className="rounded-md border border-gold/30 bg-gold/5 p-4">
              <div className="flex items-center gap-2 text-gold mb-2">
                <Star className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Performance</span>
              </div>
              <div className="text-base font-semibold text-foreground">
                {PERFORMANCE_LABELS[settlement.performanceRating ?? ""] ||
                  settlement.performanceRating ||
                  "—"}
              </div>
              {settlement.performanceNote ? (
                <p className="text-sm text-muted-foreground mt-1">{settlement.performanceNote}</p>
              ) : null}
            </section>
          )}

          <section className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CalendarDays className="h-4 w-4 text-gold" />
              <span className="text-xs font-bold uppercase tracking-wider">Attendance</span>
            </div>
            <DetailRow label="Present days" value={String(numericValue(settlement.presentDays) ?? "—")} />
            <DetailRow label="Half days" value={String(numericValue(settlement.halfDays) ?? "—")} />
            <DetailRow label="Absent days" value={String(numericValue(settlement.absentDays) ?? "—")} />
            <DetailRow label="Leave days" value={String(numericValue(settlement.leaveDays) ?? "—")} />
            <DetailRow
              label="Payable / on-site days"
              value={String(
                numericValue(settlement.payableDays) ??
                  numericValue(settlement.daysWorked) ??
                  "—",
              )}
              accent="gold"
            />
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Coins className="h-4 w-4 text-gold" />
              <span className="text-xs font-bold uppercase tracking-wider">Cash Hisab</span>
            </div>
            <DetailRow label="Salary earned" value={paiseDisplay(settlement.salaryEarnedPaise)} />
            <DetailRow label="− Withdrawals" value={paiseDisplay(settlement.withdrawalsTotalPaise)} />
            <DetailRow label="− Allowances paid" value={paiseDisplay(settlement.allowanceTotalPaise)} />
            <DetailRow label="− Salary advances" value={paiseDisplay(settlement.advanceDeductionPaise)} />
            <DetailRow label="− Loan deducted" value={paiseDisplay(settlement.loanDeductionPaise)} />
            <div className="border-t border-border my-2" />
            <DetailRow
              label="Final cash payable"
              value={paiseDisplay(settlement.finalCashPayablePaise)}
              accent={finalCash >= 0 ? "success" : "danger"}
            />
          </section>

          {hasWageGold ? (
            <section className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Scale className="h-4 w-4 text-gold" />
                <span className="text-xs font-bold uppercase tracking-wider">Wage Gold</span>
              </div>
              <DetailRow label="Gold worked" value={mg(settlement.gramsWorkedMg)} />
              {settlement.wagePctApplied != null ? (
                <DetailRow
                  label={`Wage ${numericValue(settlement.wagePctApplied)?.toFixed(2) ?? "—"}%`}
                  value={mg(settlement.wageGrossMg)}
                />
              ) : null}
              <DetailRow label="− Overloss" value={mg(settlement.overlossDeductedMg)} />
              <div className="border-t border-border my-2" />
              <DetailRow
                label={
                  settlement.wageBookPurity
                    ? `Net wage gold (${settlement.wageBookPurity}‰ book)`
                    : "Net wage gold"
                }
                value={mg(settlement.wageNetMg)}
                accent="gold"
              />
              <DetailRow label="Cash equivalent @ rate" value={paiseDisplay(settlement.wageCashPaise)} />
              <p className="text-xs text-muted-foreground pt-2">
                {payOutMode === "gold"
                  ? "Shop pays wage in book-purity gold. Cash line is for reference."
                  : "Shop pays wage in cash at the settlement rate."}
              </p>
            </section>
          ) : null}

          {(numericValue(settlement.goldAdvanceFineMg) ?? 0) > 0 ||
          (numericValue(settlement.wastageReturnedFineMg) ?? 0) > 0 ||
          netGold !== 0 ? (
            <section className="rounded-md border border-border bg-card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Gold custody
              </div>
              <DetailRow label="Gold advance (fine)" value={mg(settlement.goldAdvanceFineMg)} />
              <DetailRow label="− Wastage returned (fine)" value={mg(settlement.wastageReturnedFineMg)} />
              <DetailRow
                label="Net custody gold"
                value={
                  netGold === 0
                    ? "Settled"
                    : netGold > 0
                      ? `You owe ${mg(netGold)}`
                      : `Shop holds ${mg(Math.abs(netGold))} credit`
                }
                accent={netGold > 0 ? "danger" : netGold < 0 ? "success" : undefined}
              />
            </section>
          ) : null}

          {settlement.notes ? (
            <section className="rounded-md border border-border bg-muted/30 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Notes
              </div>
              <p className="text-sm text-foreground">{settlement.notes}</p>
            </section>
          ) : null}

          <p className="text-[11px] text-center text-muted-foreground pb-2">
            Confirmed by your firm — read only. Contact the shop for questions.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
