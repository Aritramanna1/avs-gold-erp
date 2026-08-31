/**
 * MTJ ERP — Credit Note Issue Screen
 *
 * Triggered from the billing Invoice detail page when a user clicks
 * "Mark as Credit" or "Issue Credit Note".
 *
 * CRITICAL ACCOUNTING RULE:
 *   - The original invoice is NEVER modified (immutable historical record).
 *   - A separate credit note Invoice record is created (isCreditNote: true).
 *   - A corrective ledger entry is posted, reducing the obligation.
 *   - The signed closing balance is preserved enterprise-wide (never zero-clamped).
 *   - Negative balance = firm owes party (Cr) — displayed in red with (Cr) label.
 */

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useBilling, paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import {
  validateCreditNoteParams,
  calculateCreditNoteEffect,
  formatSignedBalance,
  formatSignedGoldBalance,
} from "@/lib/credit-note-engine";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Coins,
  ArrowLeft,
  Undo2,
} from "lucide-react";

type CreditNoteSearch = {
  invoiceId?: string;
};

export const Route = createFileRoute("/billing/credit-note")({
  validateSearch: (search: Record<string, unknown>): CreditNoteSearch => ({
    invoiceId: typeof search.invoiceId === "string" ? search.invoiceId : undefined,
  }),
  component: CreditNoteScreen,
});

function CreditNoteScreen() {
  const search = useSearch({ strict: false }) as CreditNoteSearch;
  const invoiceId = search?.invoiceId;
  const navigate = useNavigate();
  const authContext = useAuthorizationContext((s) => s.context);

  const invoice = useBilling((s) => s.invoices.find((i) => i.id === invoiceId));
  const createCreditNote = useBilling((s) => s.createCreditNote);

  const ledger = useMemo(
    () => (invoice ? compileCustomerLedger(invoice.customerId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoice?.customerId],
  );

  const [reason, setReason] = useState("");
  const [amountRupees, setAmountRupees] = useState("");
  const [goldGrams, setGoldGrams] = useState("");
  const [mode, setMode] = useState<"cash" | "gold" | "both">("gold");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ creditNoteNo: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const amountPaise = useMemo(() => rupeesToPaise(amountRupees || "0"), [amountRupees]);
  const goldFineMg = useMemo(() => gramsToMg(parseFloat(goldGrams || "0") || 0), [goldGrams]);

  const effect = useMemo(() => {
    if (!invoice || !ledger) return null;
    return calculateCreditNoteEffect(
      { originalInvoice: invoice, reason, amountPaise, goldFineMg },
      ledger.closingMoneyPaise,
      ledger.closingGoldMg,
    );
  }, [invoice, ledger, reason, amountPaise, goldFineMg]);

  const handleSubmit = useCallback(async () => {
    if (!invoice) return;

    const validation = validateCreditNoteParams({
      originalInvoice: invoice,
      reason,
      amountPaise: mode !== "gold" ? amountPaise : undefined,
      goldFineMg: mode !== "cash" ? goldFineMg : undefined,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    try {
      const res = await createCreditNote({
        originalInvoiceId: invoice.id,
        reason,
        amountPaise: mode !== "gold" ? amountPaise : undefined,
        goldFineMg: mode !== "cash" ? goldFineMg : undefined,
        issuedByUserId: authContext?.auth_user_id,
        issuedByName: authContext?.auth_user_id || "Staff",
      });
      if (res) {
        setResult({ creditNoteNo: res.creditNote.invoiceNo });
      } else {
        setErrors(["Credit note creation failed. Please try again."]);
      }
    } catch (err: any) {
      setErrors([err.message || "An unexpected error occurred."]);
    } finally {
      setSubmitting(false);
    }
  }, [invoice, createCreditNote, reason, amountPaise, goldFineMg, mode, authContext]);

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-lg font-semibold">Invoice not found</p>
          <p className="text-sm text-muted-foreground">
            The invoice ID "{invoiceId}" does not exist in the current session.
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/billing" })}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Billing
          </Button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Credit Note Issued"
          subtitle="The credit note has been recorded and linked to the original invoice."
        />
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-6 text-center space-y-3">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-bold text-emerald-300">{result.creditNoteNo}</h2>
            <p className="text-sm text-emerald-200/70">
              Credit Note issued against Invoice {invoice.invoiceNo}
            </p>
            <p className="text-xs text-muted-foreground">
              The original invoice is preserved. A corrective entry has been posted to the party ledger.
              The signed closing balance now reflects the net obligation.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => navigate({ to: "/billing/$id", params: { id: invoice.id } })}
            >
              <FileText className="h-4 w-4 mr-2" /> View Original Invoice
            </Button>
            <Button
              className="flex-1"
              onClick={() =>
                navigate({
                  to: "/people/$id",
                  params: { id: invoice.customerId },
                  search: { tab: "ledger" },
                })
              }
            >
              View Party Ledger
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const cashBalance = formatSignedBalance(ledger?.closingMoneyPaise ?? 0, { currency: true });
  const goldBalance = formatSignedGoldBalance(ledger?.closingGoldMg ?? 0, { unit: "g" });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={`Issue Credit Note — ${invoice.invoiceNo}`}
        subtitle={`Customer: ${invoice.customerName} · Invoice Total: ₹${paiseToRupees(invoice.grandTotalPaise)}`}
      />

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Original Invoice Summary */}
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Original Invoice (Read-Only)
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Invoice No.</p>
              <p className="font-semibold">{invoice.invoiceNo}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline">{invoice.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <p className="font-semibold">₹{paiseToRupees(invoice.grandTotalPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance Due</p>
              <p className="font-semibold">₹{paiseToRupees(invoice.balancePaise)}</p>
            </div>
          </div>
        </div>

        {/* Current Party Balance */}
        {ledger && (
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Current Party Ledger Balance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Gold Balance</p>
                <p
                  className={`font-semibold ${
                    goldBalance.isNegative ? "text-red-400" : "text-foreground"
                  }`}
                >
                  {goldBalance.text}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cash Balance</p>
                <p
                  className={`font-semibold ${
                    cashBalance.isNegative ? "text-red-400" : "text-foreground"
                  }`}
                >
                  {cashBalance.text}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              (Dr) = Party owes firm · (Cr) = Firm owes party
            </p>
          </div>
        )}

        {/* Credit Type Selection */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Credit Note Details
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Credit Type</label>
            <div className="flex gap-2">
              {(["gold", "cash", "both"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    mode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m === "gold" ? "Gold (g)" : m === "cash" ? "Cash (₹)" : "Both"}
                </button>
              ))}
            </div>
          </div>

          {(mode === "cash" || mode === "both") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Credit Amount (₹)
              </label>
              <Input
                id="credit-amount-rupees"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
              />
            </div>
          )}

          {(mode === "gold" || mode === "both") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Gold Fine Weight (grams)
              </label>
              <Input
                id="credit-gold-grams"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={goldGrams}
                onChange={(e) => setGoldGrams(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                = {goldFineMg.toFixed(0)} mg fine
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Reason / Narration <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="credit-reason"
              rows={3}
              placeholder="e.g. Gold shortfall accepted, Billing error — excess charged, Customer dispute resolved"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Effect Preview */}
          {effect && (amountPaise > 0 || goldFineMg > 0) && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                Ledger Effect Preview
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {amountPaise > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cash After Credit</p>
                    <p
                      className={`font-semibold ${
                        effect.residualPaise < 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {formatSignedBalance(effect.residualPaise, { currency: true }).text}
                    </p>
                  </div>
                )}
                {goldFineMg > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Gold After Credit</p>
                    <p
                      className={`font-semibold ${
                        effect.residualGoldMg < 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {formatSignedGoldBalance(effect.residualGoldMg, { unit: "g" }).text}
                    </p>
                  </div>
                )}
              </div>
              {effect.isFullCredit && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Full credit — obligation will be fully cleared.
                </p>
              )}
            </div>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {e}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate({ to: "/billing/$id", params: { id: invoice.id } })}
            disabled={submitting}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Issuing Credit Note…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Undo2 className="h-4 w-4" /> Issue Credit Note
              </span>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          The original invoice will remain unchanged. A credit note and corrective ledger entry will be created.
          This action is recorded in the audit log.
        </p>
      </div>
    </div>
  );
}
