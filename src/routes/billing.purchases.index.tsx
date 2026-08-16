/**
 * Supplier goods-receipt (purchase entry). Supabase already had a
 * fully-formed supplier_purchases table + post_supplier_purchase /
 * reverse_supplier_purchase RPCs (atomic: writes the purchase row and posts
 * the gold vault ledger entry in one transaction) — nothing in the frontend
 * called them. This route is that missing UI.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSupplierPurchases, type SupplierPurchase } from "@/lib/supplier-purchases-store";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { gramsToMg, mgToGrams, fineGoldMg } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { useCan } from "@/lib/rbac";
import { ArrowLeft, Plus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/purchases/")({
  head: () => ({ meta: [{ title: "Supplier Purchases · AVS Gold ERP" }] }),
  component: SupplierPurchasesIndex,
});

interface VendorOption {
  id: string;
  fullName: string;
}

async function fetchVendorOptions(): Promise<VendorOption[]> {
  const { data, error } = await supabase
    .from("people" as never)
    .select("id,full_name,type,active")
    .eq("active", true)
    .in("type", ["supplier", "vendor", "refinery"])
    .order("full_name", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message ?? "Could not load suppliers.");
  return ((data ?? []) as unknown as { id: string; full_name: string }[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
  }));
}

function money(paise: number): string {
  return `₹${paiseToRupees(paise)}`;
}

function SupplierPurchasesIndex() {
  const { purchases, loading, refresh, create, reverse } = useSupplierPurchases();
  const { can } = useCan();
  const canCreate = can("billing.create");

  const [q, setQ] = useState("");
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [grossStr, setGrossStr] = useState("");
  const [purityStr, setPurityStr] = useState("916");
  const [gstRateStr, setGstRateStr] = useState("3");
  const [paidStr, setPaidStr] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
    fetchVendorOptions()
      .then(setVendors)
      .catch((e) => toast.error(e?.message ?? "Could not load suppliers."));
  }, [refresh]);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    if (!t) return purchases;
    return purchases.filter(
      (p) =>
        p.purchaseNo.toLowerCase().includes(t) || (p.invoiceNo ?? "").toLowerCase().includes(t),
    );
  }, [purchases, q]);

  function vendorName(id: string): string {
    return vendors.find((v) => v.id === id)?.fullName ?? id;
  }

  function reset() {
    setSupplierId("");
    setInvoiceNo("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setGrossStr("");
    setPurityStr("916");
    setGstRateStr("3");
    setPaidStr("0");
  }

  async function handleCreate() {
    if (!supplierId) {
      toast.error("Select a supplier.");
      return;
    }
    const grossMg = gramsToMg(grossStr || "0");
    const purity = Number(purityStr) || 0;
    if (grossMg <= 0 || purity <= 0) {
      toast.error("Enter weight and purity.");
      return;
    }
    setSaving(true);
    try {
      const fineMg = fineGoldMg(grossMg, purity);
      const gstRatePct = Number(gstRateStr) || 0;
      // Bullion purchases are typically valued by fine gold weight at the
      // day's rate, but this form only captures the physical receipt —
      // subtotal/GST are optional cash-side fields entered when the supplier
      // invoice carries a rupee value alongside the metal weight.
      const paidPaise = rupeesToPaise(paidStr || "0");

      const purchase = await create({
        supplierId,
        branchId: useSettings.getState().selectedBranchId || "MAIN",
        invoiceNo: invoiceNo.trim() || undefined,
        invoiceDate,
        metal: "Gold",
        purityPermille: purity,
        grossMg,
        fineMg,
        gstRatePct,
        paidPaise,
        duePaise: 0,
      });
      toast.success(`Purchase ${purchase.purchaseNo} posted.`);
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Failed to post supplier purchase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReverse(p: SupplierPurchase) {
    if (!window.confirm(`Reverse purchase ${p.purchaseNo}? This reverses the gold vault entry.`))
      return;
    try {
      await reverse(p.id);
      toast.success("Purchase reversed.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reverse purchase.");
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
        title="Supplier Purchases"
        subtitle="Goods receipt from suppliers — posts to the gold vault ledger."
        actions={
          canCreate ? (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" asChild>
                <Link to="/billing/purchases/return">Purchase Return</Link>
              </Button>
              <Button className="gap-2" onClick={() => setOpen(true)} data-testid="purchase-new">
                <Plus className="h-4 w-4" /> New Purchase
              </Button>
            </div>
          ) : null
        }
      />

      <div className="rounded-md border border-border bg-card p-4">
        <div className="relative max-w-sm mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search purchase no, invoice no"
            className="pl-9"
          />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading purchases...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No supplier purchases found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Purchase</th>
                  <th className="text-left">Supplier</th>
                  <th className="text-left">Invoice</th>
                  <th className="text-right">Fine (g)</th>
                  <th className="text-right">Paid</th>
                  <th className="text-left pl-3">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-background/30">
                    <td className="py-2 font-mono text-xs text-gold">{p.purchaseNo}</td>
                    <td>{vendorName(p.supplierId)}</td>
                    <td className="text-xs text-muted-foreground">{p.invoiceNo || "—"}</td>
                    <td className="text-right">{mgToGrams(p.fineMg)}</td>
                    <td className="text-right">{money(p.paidPaise)}</td>
                    <td className="pl-3">
                      <Badge variant="outline" className="text-[10px]">
                        {p.reversed ? "Reversed" : "Posted"}
                      </Badge>
                    </td>
                    <td className="text-right">
                      {!p.reversed && canCreate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => void handleReverse(p)}
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Purchase Return
                        </Button>
                      ) : null}
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
            <DialogTitle>New Supplier Purchase</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Supplier</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">-- Select supplier --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Invoice No</Label>
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gross Weight (g)</Label>
                <Input
                  value={grossStr}
                  onChange={(e) => setGrossStr(e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div>
                <Label>Purity (per-mille)</Label>
                <Input
                  value={purityStr}
                  onChange={(e) => setPurityStr(e.target.value)}
                  placeholder="916"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GST Rate (%)</Label>
                <Input value={gstRateStr} onChange={(e) => setGstRateStr(e.target.value)} />
              </div>
              <div>
                <Label>Paid Now (₹)</Label>
                <Input value={paidStr} onChange={(e) => setPaidStr(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Posting..." : "Post Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
