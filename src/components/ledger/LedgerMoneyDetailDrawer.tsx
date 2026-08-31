import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { paiseToRupees } from "@/lib/billing-store";
import type { CompanyCashLedgerRow } from "@/lib/company-cash-ledger";

type LedgerMoneyDetailDrawerProps = {
  row: CompanyCashLedgerRow | null;
  onClose: () => void;
};

/** Audit trail: source module → voucher → narration → balance impact. */
export function LedgerMoneyDetailDrawer({ row, onClose }: LedgerMoneyDetailDrawerProps) {
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">{row?.voucherNo ?? "Voucher"}</DialogTitle>
        </DialogHeader>
        {row ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{row.date}</dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-mono">{row.reference || "—"}</dd>
              <dt className="text-muted-foreground">Party</dt>
              <dd>{row.partyName || "—"}</dd>
              <dt className="text-muted-foreground">Source module</dt>
              <dd>{row.sourceLabel}</dd>
              <dt className="text-muted-foreground">Account</dt>
              <dd>
                {row.accountName ?? row.accountCode ?? "—"}
              </dd>
              <dt className="text-muted-foreground">Debit</dt>
              <dd className="font-mono">
                {row.debitPaise ? `₹${paiseToRupees(row.debitPaise)}` : "—"}
              </dd>
              <dt className="text-muted-foreground">Credit</dt>
              <dd className="font-mono">
                {row.creditPaise ? `₹${paiseToRupees(row.creditPaise)}` : "—"}
              </dd>
              <dt className="text-muted-foreground">Running balance</dt>
              <dd className="font-mono font-semibold">₹{paiseToRupees(row.closingPaise)}</dd>
            </dl>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Narration
              </div>
              <p className="text-sm border rounded-md p-2 bg-muted/30">{row.description}</p>
            </div>
            {row.sourceRoute ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={row.sourceRoute}>Open source document</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
