import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreditNotes } from "@/lib/billing-documents-store";
import { useBilling, paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { useCan } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/credit-notes/")({
  head: () => ({ meta: [{ title: "Credit Notes · AVS Gold ERP" }] }),
  component: CreditNotesIndex,
});

function CreditNotesIndex() {
  const notes = useCreditNotes((s) => s.notes);
  const refresh = useCreditNotes((s) => s.refresh);
  const issue = useCreditNotes((s) => s.issue);
  const invoices = useBilling((s) => s.invoices);
  const { can, email } = useCan();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return notes.filter((n) => {
      if (!t) return true;
      return (
        n.creditNoteNo.toLowerCase().includes(t) ||
        n.customerName.toLowerCase().includes(t) ||
        n.invoiceNo.toLowerCase().includes(t)
      );
    });
  }, [notes, q]);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  async function handleCreate() {
    if (!selectedInvoice) {
      toast.error("Select an invoice to issue the credit note against.");
      return;
    }
    const amt = rupeesToPaise(amount);
    if (amt <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      await issue(
        {
          invoiceId: selectedInvoice.id,
          invoiceNo: selectedInvoice.invoiceNo,
          customerId: selectedInvoice.customerId,
          customerName: selectedInvoice.customerName,
          amountPaise: amt,
          goldFineMg: 0,
          reason: reason.trim(),
        },
        {
          id: data.session?.user.id ?? null,
          email: data.session?.user.email ?? email ?? null,
        },
      );
      toast.success("Credit note issued.");
      setOpen(false);
      setInvoiceId("");
      setAmount("");
      setReason("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to issue credit note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Credit Notes"
        subtitle="Adjustments issued in the customer's favor against an invoice."
        actions={
          can("billing.create") ? (
            <Button className="gap-2" onClick={() => setOpen(true)} data-testid="credit-note-new">
              <Plus className="h-4 w-4" /> New Credit Note
            </Button>
          ) : null
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="relative max-w-sm mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search credit note, customer, invoice"
            className="pl-9"
          />
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No credit notes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Credit Note</th>
                  <th className="text-left">Customer</th>
                  <th className="text-left">Invoice</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left pl-3">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((n) => (
                  <tr key={n.id} className="border-b border-border/60 hover:bg-background/30">
                    <td className="py-2 font-mono text-xs text-gold">{n.creditNoteNo}</td>
                    <td>{n.customerName}</td>
                    <td className="text-xs text-muted-foreground">{n.invoiceNo}</td>
                    <td className="text-right">₹ {paiseToRupees(n.amountPaise)}</td>
                    <td className="pl-3">
                      <Badge variant="outline" className="text-[10px]">
                        {n.status === "issued" ? "Issued" : "Cancelled"}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Link to="/billing/credit-notes/$id" params={{ id: n.id }}>
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Credit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Invoice</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              >
                <option value="">Select invoice…</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNo} · {i.customerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for credit note (required)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Issuing…" : "Issue Credit Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
