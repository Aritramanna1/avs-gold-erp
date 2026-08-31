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
import {
  type DeliveryChallan,
  useDeliveryChallans,
  type DeliveryChallanPurpose,
} from "@/lib/billing-documents-store";
import type { Person } from "@/lib/people-store";
import type { Order } from "@/lib/orders-store";
import {
  fetchActiveCustomerOptions,
  fetchDeliveryChallans,
  fetchOpenOrderOptions,
} from "@/lib/billing-documents-query";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useCan } from "@/lib/rbac";
import { useSettings } from "@/lib/settings-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { gramsToMg, mgToGrams, fineGoldMg } from "@/lib/gold";
import { ArrowLeft, Plus, Search } from "lucide-react";
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
  const create = useDeliveryChallans((s) => s.create);
  const { can } = useCan();

  const [q, setQ] = useState("");
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [grossStr, setGrossStr] = useState("");
  const [netStr, setNetStr] = useState("");
  const [purityStr, setPurityStr] = useState("916");
  const [qtyStr, setQtyStr] = useState("1");
  const [purpose, setPurpose] = useState<DeliveryChallanPurpose>("sale_on_approval");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchDeliveryChallans(q), fetchActiveCustomerOptions(), fetchOpenOrderOptions()])
      .then(([nextChallans, nextPeople, nextOrders]) => {
        if (!live) return;
        setChallans(nextChallans);
        setPeople(nextPeople);
        setOrders(nextOrders);
      })
      .catch((error: any) => {
        if (!live) return;
        setLoadError(error?.message ?? "Could not load delivery challans.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [q]);

  function handleOrderSelect(id: string) {
    setOrderId(id);
    if (id === "none") return;
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    setCustomerId(order.customerId);
    setItemName(order.item.itemName || order.item.category || "");
    setCategory(order.item.category || "");
    setGrossStr(mgToGrams(order.item.grossMg));
    setNetStr(mgToGrams(order.item.netMg));
    if (order.item.purity) setPurityStr(String(order.item.purity));
    if (order.item.quantity) setQtyStr(String(order.item.quantity));
  }

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
      const grossMg = gramsToMg(grossStr || "0");
      const netMg = netStr ? gramsToMg(netStr) : grossMg;
      const purity = Number(purityStr) || 0;
      const fineMg = netMg > 0 && purity > 0 ? fineGoldMg(netMg, purity) : 0;
      const qty = Number(qtyStr) || 1;

      const challan = await create({
        customerId: customer.id,
        customerName: customer.fullName,
        linkedOrderId: orderId === "none" ? undefined : orderId,
        items: [{ itemName: itemName.trim(), category, grossMg, netMg, purity, fineMg, qty }],
        purpose,
        notes: notes.trim() || undefined,
      });
      setChallans((current) => [challan, ...current.filter((item) => item.id !== challan.id)]);

      // Single source of truth for gold balances: a Delivery Challan physically
      // hands gold to the customer, so it must post the same "gold_given" gold
      // settlement record every other gold-issue flow posts — this is what
      // customerGoldBalanceMg (Gold Account) and the Manufacturing Books read.
      if (fineMg > 0) {
        try {
          await useGoldSettlement.getState().addSettlement({
            party_type: "customer",
            party_id: customer.id,
            branch_id: useSettings.getState().selectedBranchId || "MAIN",
            settlement_type: "gold_given",
            purity,
            gross_mg: grossMg,
            net_mg: fineMg,
            wastage_mg: 0,
            rate_per_gram_paise: getCurrentGoldRatePaise() || 0,
            amount_paise: 0,
            notes: `Gold issued via Delivery Challan ${challan.challanNo}`,
            payment_mode: "gold_exchange",
            direction: "Naam",
          });
        } catch (err) {
          console.error("Failed writing gold settlement for delivery challan:", err);
        }
      }

      toast.success("Delivery challan issued.");
      setOpen(false);
      setCustomerId("");
      setOrderId("none");
      setItemName("");
      setCategory("");
      setGrossStr("");
      setNetStr("");
      setPurityStr("916");
      setQtyStr("1");
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to issue delivery challan.");
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

      <div className="rounded-md border border-border bg-card p-4">
        <div className="relative max-w-sm mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search challan, customer"
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
              onClick={() => void fetchDeliveryChallans(q).then(setChallans)}
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Loading delivery challans...
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No delivery challans found.
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
              <Label>Link to Order (Optional)</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={orderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
              >
                <option value="none">-- No Order (Manual Challan) --</option>
                {orders
                  .filter((o) => o.status === "in_production" || o.status === "ready_for_delivery")
                  .map((o) => {
                    const c = people.find((p) => p.id === o.customerId);
                    return (
                      <option key={o.id} value={o.id}>
                        {o.orderNo} · {c?.fullName || "Unknown"}
                      </option>
                    );
                  })}
              </select>
            </div>
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
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Gross Wt (g)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={grossStr}
                  onChange={(e) => setGrossStr(e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div>
                <Label>Net Wt (g)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={netStr}
                  onChange={(e) => setNetStr(e.target.value)}
                  placeholder="Same as gross"
                />
              </div>
              <div>
                <Label>Purity</Label>
                <Input
                  type="number"
                  value={purityStr}
                  onChange={(e) => setPurityStr(e.target.value)}
                  placeholder="916"
                />
              </div>
              <div>
                <Label>Qty</Label>
                <Input
                  type="number"
                  value={qtyStr}
                  onChange={(e) => setQtyStr(e.target.value)}
                  placeholder="1"
                />
              </div>
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
