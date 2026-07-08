import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useSettings } from "@/lib/settings-store";
import { useCurrentBranchId } from "@/lib/branch-store";
import { useSettlements, previewSettlementTotals } from "@/lib/settlement-store";
import { computeItemTotals, type InvoiceItem, type GstKind } from "@/lib/billing-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settlement/new")({
  head: () => ({ meta: [{ title: "New Settlement · AVS Gold ERP" }] }),
  component: NewSettlement,
});

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `it_${Date.now()}`;
}

/**
 * Settlement Draft creation — the pre-invoice document an employee carries
 * out for delivery. Deliberately minimal: one product line (the common
 * case for a delivery settlement); more items can be added on the operator
 * screen before Final Settlement if ever needed. No GST Invoice exists yet
 * — createDraft() never touches useBilling.
 */
function NewSettlement() {
  const navigate = useNavigate();
  const people = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const { goldRatePerGramPaise } = useSettings();
  const branchId = useCurrentBranchId();
  const createDraft = useSettlements((s) => s.createDraft);

  const customers = useMemo(
    () => people.filter((p) => p.type === "customer" || p.type === "firm_customer"),
    [people],
  );

  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [itemName, setItemName] = useState("");
  const [grossStr, setGrossStr] = useState("");
  const [purityStr, setPurityStr] = useState("916");
  const [makingStr, setMakingStr] = useState("");
  const [gst, setGst] = useState<GstKind>("none");
  const [saving, setSaving] = useState(false);

  // Selecting a Production Order auto-fills Customer, Product, Weight, and
  // Purity from that order — the operator no longer has to re-type what the
  // order already recorded. Never overwrites a manual edit the operator
  // already made to itemName/grossStr/purityStr once the order is picked;
  // it only fires at the moment of selection.
  function handleOrderSelect(id: string) {
    setOrderId(id);
    if (id === "none") return;
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    setCustomerId(order.customerId);
    setItemName(order.item.itemName || order.item.category || "");
    setGrossStr(mgToGrams(order.item.grossMg));
    if (order.item.purity) setPurityStr(String(order.item.purity));
  }

  const grossMg = gramsToMg(grossStr || "0");
  const purity = Number(purityStr) || 0;
  const fineMg = grossMg > 0 && purity > 0 ? fineGoldMg(grossMg, purity) : 0;
  const makingChargesPaise = Math.round((Number(makingStr) || 0) * 100);

  const item: InvoiceItem | null =
    grossMg > 0 && purity > 0
      ? (() => {
          const base = {
            id: makeId(),
            itemName: itemName || "Product",
            category: "Jewellery",
            purity,
            grossMg,
            netMg: grossMg,
            fineMg,
            goldRatePerGramPaise,
            makingChargesPaise,
            stoneChargesPaise: 0,
            hallmarkChargesPaise: 0,
            otherChargesPaise: 0,
            discountPaise: 0,
          };
          const totals = computeItemTotals(base);
          return { ...base, ...totals };
        })()
      : null;

  const preview = item ? previewSettlementTotals([item], gst) : null;

  const canSubmit = !!customerId && !!item && !saving;

  async function submit() {
    if (!canSubmit || !item) return;
    setSaving(true);
    try {
      const customer = people.find((p) => p.id === customerId)!;
      const order = orderId !== "none" ? orders.find((o) => o.id === orderId) : undefined;
      const draft = await createDraft({
        branchId,
        customerId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        orderId: order?.id,
        orderNo: order?.orderNo,
        items: [item],
        gst,
      });
      toast.success(`Settlement Draft ${draft.settlementNo} created`);
      navigate({ to: "/settlement/$id", params: { id: draft.id } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create settlement draft.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/billing">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <PageHeader
          title="New Settlement Draft"
          subtitle="Not a GST Invoice — generated only after Final Settlement."
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <Label>Customer / Dealer *</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger data-testid="settlement-customer-select">
              <SelectValue placeholder="Select customer…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Production Order (optional — auto-fills Customer, Product, Weight, Purity)</Label>
          <Select value={orderId} onValueChange={handleOrderSelect}>
            <SelectTrigger data-testid="settlement-order-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No linked order</SelectItem>
              {/* Selecting the order now sets the customer too, so this
                  isn't restricted to the currently-selected customer's
                  orders — the operator can pick the order first. */}
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.orderNo} · {people.find((p) => p.id === o.customerId)?.fullName ?? "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Product</Label>
          <Input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Gold Necklace"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Gross Weight (g) *</Label>
            <Input
              value={grossStr}
              onChange={(e) => setGrossStr(e.target.value)}
              inputMode="decimal"
              data-testid="settlement-gross-input"
            />
          </div>
          <div>
            <Label>Purity *</Label>
            <Select value={purityStr} onValueChange={setPurityStr}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PURITIES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Making Charges (₹)</Label>
            <Input
              value={makingStr}
              onChange={(e) => setMakingStr(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <Label>GST</Label>
          <Select value={gst} onValueChange={(v) => setGst(v as GstKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No GST</SelectItem>
              <SelectItem value="gst3">GST (3%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {item && preview && (
          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fine Gold</span>
              <span className="font-mono">{mgToGrams(fineMg)} g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST Preview</span>
              <span className="font-mono">₹{(preview.gstPaise / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TCS Preview</span>
              <span className="font-mono">₹{(preview.tcsPaise / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Preview Total</span>
              <span className="font-mono text-gold">
                ₹{(preview.grandTotalPaise / 100).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      <Button
        onClick={submit}
        disabled={!canSubmit}
        className="gap-2"
        data-testid="settlement-create-submit"
      >
        <FileText className="h-4 w-4" /> {saving ? "Creating…" : "Create Settlement Draft"}
      </Button>
    </div>
  );
}
