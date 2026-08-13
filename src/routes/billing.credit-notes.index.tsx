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
import { type CreditNote, useCreditNotes } from "@/lib/billing-documents-store";
import { paiseToRupees, rupeesToPaise, type Invoice } from "@/lib/billing-store";
import type { Person } from "@/lib/people-store";
import {
  fetchActiveCustomerOptions,
  fetchCreditNotes,
  fetchRecentInvoiceOptions,
} from "@/lib/billing-documents-query";
import { useCan } from "@/lib/rbac";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/credit-notes/")({
  head: () => ({ meta: [{ title: "Credit Notes · AVS Gold ERP" }] }),
  component: CreditNotesIndex,
});

function CreditNotesIndex() {
  const issue = useCreditNotes((s) => s.issue);
  const { can, email } = useCan();

  const [q, setQ] = useState("");
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchCreditNotes(q), fetchRecentInvoiceOptions(), fetchActiveCustomerOptions()])
      .then(([nextNotes, nextInvoices, nextPeople]) => {
        if (!live) return;
        setNotes(nextNotes);
        setInvoices(nextInvoices);
        setPeople(nextPeople);
      })
      .catch((error: any) => {
        if (!live) return;
        setLoadError(error?.message ?? "Could not load credit notes.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [q]);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return notes.filter((n) => {
      if (!t) return true;
      return (
        n.creditNoteNo.toLowerCase().includes(t) ||
        n.customerName.toLowerCase().includes(t) ||
        (n.invoiceNo?.toLowerCase().includes(t) ?? false)
      );
    });
  }, [notes, q]);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);
  const selectedCustomer = people.find((p) => p.id === customerId);

  async function handleCreate() {
    const customerRef = selectedInvoice
      ? { id: selectedInvoice.customerId, name: selectedInvoice.customerName }
      : selectedCustomer
        ? { id: selectedCustomer.id, name: selectedCustomer.fullName }
        : null;
    if (!customerRef) {
      toast.error("Select an invoice, or a customer for a standalone credit note.");
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
      const created = await issue(
        {
          invoiceId: selectedInvoice?.id,
          invoiceNo: selectedInvoice?.invoiceNo,
          customerId: customerRef.id,
          customerName: customerRef.name,
          amountPaise: amt,
          goldFineMg: 0,
          reason: reason.trim(),
        },
        {
          id: data.session?.user.id ?? null,
          email: data.session?.user.email ?? email ?? null,
        },
      );
      setNotes((current) => [created, ...current.filter((note) => note.id !== created.id)]);
      toast.success("Credit note issued.");
      setOpen(false);
      setInvoiceId("");
      setCustomerId("");
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
      <Link to="/billing">
        <Button variant="ghost" className="gap-1.5 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Billing
        </Button>
      </Link>
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
        {loadError ? (
          <div className="py-6 text-center text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setQ((value) => value.trim());
                void fetchCreditNotes(q).then(setNotes);
              }}
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading credit notes...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No credit notes found.</p>
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
                    <td className="text-xs text-muted-foreground">
                      {n.invoiceNo || "— (standalone)"}
                    </td>
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
              <Label>Invoice (optional)</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  if (e.target.value) setCustomerId("");
                }}
              >
                <option value="">No invoice — standalone credit note</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNo} · {i.customerName}
                  </option>
                ))}
              </select>
            </div>
            {!invoiceId && (
              <div>
                <Label>Customer</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Select customer…</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} · {p.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
