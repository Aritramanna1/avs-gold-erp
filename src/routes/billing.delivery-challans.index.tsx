import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDeliveryChallans, type DeliveryChallanPurpose } from "@/lib/billing-documents-store";
import { usePeople } from "@/lib/people-store";
import { useCan } from "@/lib/rbac";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/delivery-challans/")({
  head: () => ({ meta: [{ title: "Delivery Challans · AVS Gold ERP" }] }),
  component: DeliveryChallansIndex,
});

const PURPOSE_LABEL: Record<DeliveryChallanPurpose, string> = {
  sale_on_approval: "Sale on Approval",
  job_work: "Job Work",
  return: "Return",
  transfer: "Branch Transfer",
  other: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  issued: "Issued",
  returned: "Returned",
  converted_to_invoice: "Converted",
  cancelled: "Cancelled",
};

function DeliveryChallansIndex() {
  const challans = useDeliveryChallans((s) => s.challans);
  const refresh = useDeliveryChallans((s) => s.refresh);
  const create = useDeliveryChallans((s) => s.create);
  const people = usePeople((s) => s.people);
  const { can } = useCan();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [itemName, setItemName] = useState("");
  const [purpose, setPurpose] = useState<DeliveryChallanPurpose>("sale_on_approval");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return challans.filter((c) => {
      if (!t) return true;
      return c.challanNo.toLowerCase().includes(t) || c.customerName.toLowerCase().includes(t);
    });
  }, [challans, q]);

  async function handleCreate() {
    const customer = people.find((p) => p.id === customerId);
    if (!customer) {
      toast.error("Select a customer.");
      return;
    }
    if (!itemName.trim()) {
      toast.error("Enter at least an item description.");
      return;
    }
    setSaving(true);
    try {
      await create({
        customerId: customer.id,
        customerName: customer.fullName,
        items: [
          { itemName: itemName.trim(), category: "", grossMg: 0, purity: 0, fineMg: 0, qty: 1 },
        ],
        purpose,
        notes: notes.trim() || undefined,
      });
      toast.success("Delivery challan issued.");
      setOpen(false);
      setCustomerId("");
      setItemName("");
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to issue delivery challan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Delivery Challans"
        subtitle="Goods sent out without a sale (approval, job work, transfer)."
        actions={
          can("billing.create") ? (
            <Button className="gap-2" onClick={() => setOpen(true)} data-testid="challan-new">
              <Plus className="h-4 w-4" /> New Delivery Challan
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
            placeholder="Search challan, customer"
            className="pl-9"
          />
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No delivery challans yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Challan</th>
                  <th className="text-left">Customer</th>
                  <th className="text-left">Purpose</th>
                  <th className="text-left pl-3">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-background/30">
                    <td className="py-2 font-mono text-xs text-gold">{c.challanNo}</td>
                    <td>{c.customerName}</td>
                    <td className="text-xs text-muted-foreground">{PURPOSE_LABEL[c.purpose]}</td>
                    <td className="pl-3">
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Link to="/billing/delivery-challans/$id" params={{ id: c.id }}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
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
            <DialogTitle>New Delivery Challan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
                    {p.fullName} {p.phone ? `· ${p.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Item description</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Gold necklace, 22K"
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Select
                value={purpose}
                onValueChange={(v) => setPurpose(v as DeliveryChallanPurpose)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PURPOSE_LABEL) as DeliveryChallanPurpose[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PURPOSE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Issuing…" : "Issue Challan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
