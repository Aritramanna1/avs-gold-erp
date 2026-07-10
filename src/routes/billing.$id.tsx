import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { usePrintEngine } from "@/lib/print-engine";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useBilling,
  PAYMENT_MODE_LABELS,
  INVOICE_STATUS_LABELS,
  paiseToRupees,
  rupeesToPaise,
  type PaymentMode,
} from "@/lib/billing-store";
import { mgToGrams, getCaratLabel } from "@/lib/gold";
import { ArrowLeft, Printer, Receipt, Trash2, FileText, Ban } from "lucide-react";
import { useCan } from "@/lib/rbac";
import { useSettings } from "@/lib/settings-store";
import { supabase } from "@/integrations/supabase/client";
import { usePeople } from "@/lib/people-store";
import { DocCommActions } from "@/components/doc-comm-actions";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/$id")({
  head: () => ({ meta: [{ title: "Invoice · AVS Gold ERP" }] }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = useParams({ from: "/billing/$id" });
  const navigate = useNavigate();
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));
  const addPayment = useBilling((s) => s.addPayment);
  const remove = useBilling((s) => s.remove);
  const cancelInvoice = useBilling((s) => s.cancelInvoice);
  const { can, email } = useCan();

  const people = usePeople((s) => s.people);
  const customer = people.find((p) => p.id === inv?.customerId);
  const { firm } = useSettings();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  async function handleCancelInvoice() {
    if (!inv || !cancelReason.trim()) {
      toast.error("A reason is required to cancel an invoice.");
      return;
    }
    setCancelling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const result = await cancelInvoice(inv.id, cancelReason.trim(), {
        id: data.session?.user.id ?? null,
        email: data.session?.user.email ?? email ?? null,
      });
      if (result) {
        toast.success("Invoice cancelled — gold ledger entries reversed.");
        setCancelOpen(false);
        setCancelReason("");
      } else {
        toast.error("Invoice was not cancelled — it may already be cancelled.");
      }
    } finally {
      setCancelling(false);
    }
  }

  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payAmt, setPayAmt] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const { triggerPrint } = usePrintEngine();
  if (!inv) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">Invoice not found</h1>
        <Link to="/billing" className="text-gold underline mt-4 inline-block">
          Back to billing
        </Link>
      </div>
    );
  }

  function record() {
    const amt = rupeesToPaise(payAmt);
    if (amt <= 0) {
      alert("Enter payment amount.");
      return;
    }
    addPayment(inv!.id, {
      mode: payMode,
      amountPaise: amt,
      reference: payRef || undefined,
      notes: payNotes || undefined,
    });
    setPayAmt("");
    setPayRef("");
    setPayNotes("");
  }

  function triggerPrintInvoice() {
    triggerPrint(`/billing/print/${inv!.id}`, `Invoice Preview · ${inv!.invoiceNo}`);
  }

  function triggerPrintReceipt() {
    triggerPrint(`/billing/receipt/${inv!.id}`, `Receipt Preview · ${inv!.invoiceNo}`);
  }

  function triggerPrintSettlementSlip() {
    triggerPrint(
      `/billing/settlement-slip/${inv!.id}`,
      `Customer Settlement Slip · ${inv!.invoiceNo}`,
    );
  }

  function triggerPrintEstimate() {
    triggerPrint(`/billing/estimate/${inv!.id}`, `Estimate · ${inv!.invoiceNo}`);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title={inv.invoiceNo}
        subtitle={`${inv.customerName} · ${new Date(inv.createdAt).toLocaleString("en-IN")}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to="/billing">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> All
              </Button>
            </Link>
            <Button
              data-testid="billing-print-invoice"
              variant="outline"
              className="gap-2"
              onClick={triggerPrintInvoice}
            >
              <Printer className="h-4 w-4" /> Print Invoice
            </Button>
            <Button variant="outline" className="gap-2" onClick={triggerPrintEstimate}>
              <FileText className="h-4 w-4" /> Estimate
            </Button>
            <Button
              data-testid="billing-print-settlement-slip"
              variant="outline"
              className="gap-2"
              onClick={triggerPrintSettlementSlip}
            >
              <Receipt className="h-4 w-4" /> Settlement Slip
            </Button>
            {inv.payments.length > 0 && (
              <Button
                data-testid="billing-print-receipt"
                variant="outline"
                className="gap-2"
                onClick={triggerPrintReceipt}
              >
                <Receipt className="h-4 w-4" /> Payment Receipt
              </Button>
            )}
          </div>
        }
      />

      {/* Communication Actions */}
      <div className="mt-4 mb-6">
        <DocCommActions
          printA4Href={`/billing/print/${inv.id}` as any}
          whatsapp={{
            phone: customer?.phone,
            message: `Hello ${inv.customerName},\nYour invoice ${inv.invoiceNo} for ₹${paiseToRupees(inv.subtotalPaise)} has been generated by ${firm.shopName}.\n\nBalance due: ₹${paiseToRupees(inv.balancePaise)}.\n\nThank you for your business!`,
          }}
          email={{
            to: (customer as any)?.email,
            subject: `Invoice ${inv.invoiceNo} — ${firm.shopName}`,
            body: `Dear ${inv.customerName},\n\nPlease find your invoice details:\nInvoice No: ${inv.invoiceNo}\nTotal: ₹${paiseToRupees(inv.subtotalPaise)}\nPaid: ₹${paiseToRupees(inv.paidPaise)}\nBalance: ₹${paiseToRupees(inv.balancePaise)}\n\nThank you,\n${firm.shopName}`,
          }}
          linkedType="invoice"
          linkedId={inv.id}
          recipientLabel={inv.customerName}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-lg text-gold">Items</h3>
              <Badge variant="outline">{INVOICE_STATUS_LABELS[inv.status]}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right">Gross/Net/Fine</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Gold</th>
                    <th className="text-right">Making+Stone</th>
                    <th className="text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it) => (
                    <tr key={it.id} className="border-b border-border/60">
                      <td className="py-2">
                        <div>{it.itemName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {it.category} · {getCaratLabel(it.purity)}
                          {it.barcode ? ` · ${it.barcode}` : ""}
                        </div>
                      </td>
                      <td className="text-right font-mono text-xs">
                        <div>G: {mgToGrams(it.grossMg)} g</div>
                        <div>N: {mgToGrams(it.netMg)} g</div>
                        <div className="text-gold font-semibold">
                          F: {mgToGrams(it.fineMg)} g fine
                        </div>
                      </td>
                      <td className="text-right">₹ {paiseToRupees(it.goldRatePerGramPaise)}/g</td>
                      <td className="text-right">₹ {paiseToRupees(it.goldValuePaise)}</td>
                      <td className="text-right">
                        ₹{" "}
                        {paiseToRupees(
                          it.makingChargesPaise +
                            it.stoneChargesPaise +
                            it.otherChargesPaise -
                            it.discountPaise,
                        )}
                      </td>
                      <td className="text-right text-gold">₹ {paiseToRupees(it.lineTotalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {inv.orderAdjustment && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-serif text-lg text-gold mb-3">Order Adjustments</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {inv.orderAdjustment.cashAdvancePaise > 0 && (
                  <Kv
                    k="Cash advance"
                    v={`₹ ${paiseToRupees(inv.orderAdjustment.cashAdvancePaise)}`}
                  />
                )}
                {inv.orderAdjustment.goldGrossMg > 0 && (
                  <Kv
                    k="Old gold"
                    v={`${mgToGrams(inv.orderAdjustment.goldGrossMg)} g · ₹ ${paiseToRupees(inv.orderAdjustment.goldValuePaise)}`}
                  />
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-serif text-lg text-gold mb-3">Payments</h3>
            {inv.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {inv.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2"
                  >
                    <div>
                      <div>
                        {PAYMENT_MODE_LABELS[p.mode]}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(p.ts).toLocaleString("en-IN")}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </div>
                    </div>
                    <div className="text-gold font-mono">₹ {paiseToRupees(p.amountPaise)}</div>
                  </li>
                ))}
              </ul>
            )}

            {inv.balancePaise > 0 && can("billing.recordPayment") && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Record payment
                </div>
                <div className="grid sm:grid-cols-[150px_140px_1fr_auto] gap-2 items-end">
                  <div>
                    <Label>Mode</Label>
                    <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[])
                          .filter((m) => m !== "outstanding")
                          .map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_MODE_LABELS[m]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      value={payAmt}
                      onChange={(e) => setPayAmt(e.target.value)}
                      placeholder={(inv.balancePaise / 100).toString()}
                    />
                  </div>
                  <div>
                    <Label>Reference / Notes</Label>
                    <Input
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="UPI ref, cheque"
                    />
                  </div>
                  <Button onClick={record}>Record</Button>
                </div>
                <Input
                  className="mt-2"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5 sticky top-4">
            <h3 className="font-serif text-lg text-gold mb-3">Summary</h3>
            <div className="space-y-1.5 text-sm">
              <Row k="Subtotal" v={`₹ ${paiseToRupees(inv.subtotalPaise)}`} />
              {inv.gst === "gst3" ? (
                // IGST-mode stores the full tax in sgstPaise with cgstPaise
                // = 0 (see computeInvoiceTotals) — showing a hardcoded
                // "CGST 1.5%: ₹0.00" plus a mislabeled "SGST" line would be
                // wrong on an IGST invoice.
                inv.cgstPaise > 0 && inv.sgstPaise > 0 ? (
                  <>
                    <Row k="CGST" v={`₹ ${paiseToRupees(inv.cgstPaise)}`} />
                    <Row k="SGST" v={`₹ ${paiseToRupees(inv.sgstPaise)}`} />
                  </>
                ) : (
                  <Row k="IGST" v={`₹ ${paiseToRupees(inv.cgstPaise + inv.sgstPaise)}`} />
                )
              ) : (
                <Row k="GST" v="Not applied" mute />
              )}
              {inv.adjustmentPaise > 0 && (
                <Row k="Less: adjustments" v={`− ₹ ${paiseToRupees(inv.adjustmentPaise)}`} />
              )}
              <div className="border-t border-border pt-2 mt-2">
                <Row k="Grand Total" v={`₹ ${paiseToRupees(inv.grandTotalPaise)}`} bold />
                <Row k="Paid" v={`₹ ${paiseToRupees(inv.paidPaise)}`} mute />
                <Row k="Balance" v={`₹ ${paiseToRupees(inv.balancePaise)}`} bold />
              </div>
            </div>
            {inv.orderId && (
              <Link
                to="/orders/$id"
                params={{ id: inv.orderId }}
                className="text-xs text-gold underline mt-3 inline-block"
              >
                Linked order: {inv.orderNo}
              </Link>
            )}
            {inv.saleLedgerEntryId && (
              <div className="text-[11px] text-muted-foreground mt-2 font-mono">
                Ledger {inv.saleLedgerEntryId.slice(0, 8)}
              </div>
            )}
            {can("billing.delete") && inv.status !== "cancelled" && (
              <Button
                variant="outline"
                className="w-full mt-4 text-destructive border-destructive/40 gap-2"
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="h-4 w-4" /> Cancel invoice
              </Button>
            )}
            {can("billing.delete") && (
              <Button
                variant="ghost"
                className="w-full mt-2 text-destructive gap-2"
                onClick={() => {
                  if (
                    confirm(
                      "Delete this invoice? This is a raw delete and does NOT reverse gold ledger entries — prefer Cancel Invoice above, which does.",
                    )
                  ) {
                    // Record in security logs
                    useSettings
                      .getState()
                      .addSecurityLog(
                        "invoice deleted",
                        `Deleted Invoice ID: ${inv.id}, Client: ${inv.customerName}, Total Amount Paid: ₹${paiseToRupees(inv.paidPaise)} of ₹${paiseToRupees(inv.subtotalPaise)}`,
                        email || "System/Owner",
                      );
                    remove(inv.id);
                    navigate({ to: "/billing" });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete invoice (raw, no reversal)
              </Button>
            )}
          </div>
        </aside>

        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Invoice {inv.invoiceNo}?</AlertDialogTitle>
              <AlertDialogDescription>
                This reverses every gold-ledger entry this invoice posted (sale, Pay-In-Gold
                shortfall/surplus) as a traceable reversal entry — the invoice stays in the system
                marked "Cancelled", nothing is deleted. A reason is required for the audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (required)"
              rows={3}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCancelReason("")}>Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelInvoice}
                disabled={cancelling || !cancelReason.trim()}
                className="bg-destructive hover:bg-destructive/90"
              >
                {cancelling ? "Cancelling…" : "Yes, Cancel Invoice"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function Row({ k, v, bold, mute }: { k: string; v: string; bold?: boolean; mute?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? "font-medium text-gold" : ""} ${mute ? "text-muted-foreground" : ""}`}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-sm">{v}</div>
    </div>
  );
}
