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
import { gramsToMg, mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import { useCan } from "@/lib/rbac";
import { ArrowLeft, Plus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/purchases/")({
  head: () => ({ meta: [{ title: "Supplier Purchases · AVS ERP" }] }),
  component: SupplierPurchasesIndex,
});

interface VendorOption {
  id: string;
  fullName: string;
}

/** Offline frm_sale purchase line (S_P=2) — summed into RPC payload. */
type PurchaseLineDraft = {
  id: string;
  itemName: string;
  grossG: string;
  lessG: string;
  addG: string;
  tanchPct: string;
  wstgPct: string;
  hisobPct: string;
  pcs: string;
  labourRupees: string;
  jn: "1" | "2";
};

function emptyPurchaseLine(): PurchaseLineDraft {
  return {
    id: `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    itemName: "",
    grossG: "",
    lessG: "",
    addG: "",
    tanchPct: "91.60",
    wstgPct: "0",
    hisobPct: "",
    pcs: "1",
    labourRupees: "0",
    jn: "1",
  };
}

function lineNetMg(l: PurchaseLineDraft): number {
  try {
    const gr = gramsToMg(l.grossG || "0");
    const less = gramsToMg(l.lessG || "0");
    const add = gramsToMg(l.addG || "0");
    return Math.max(0, gr + add - less);
  } catch {
    return 0;
  }
}

function lineFineMg(l: PurchaseLineDraft): number {
  const net = lineNetMg(l);
  const tanch = parseFloat(l.tanchPct) || 0;
  const wstg = parseFloat(l.wstgPct) || 0;
  const hisob =
    l.hisobPct.trim() !== ""
      ? parseFloat(l.hisobPct) || 0
      : Math.round((tanch + wstg) * 100) / 100;
  return Math.round((net * hisob) / 100);
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
  const [lines, setLines] = useState<PurchaseLineDraft[]>([emptyPurchaseLine()]);
  const [payMode, setPayMode] = useState<"cash" | "anamat" | "bank">("cash");
  const [gstRateStr, setGstRateStr] = useState("3");
  const [paidStr, setPaidStr] = useState("0");
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    let grossMg = 0;
    let fineMg = 0;
    let labourPaise = 0;
    for (const l of lines) {
      try {
        grossMg += gramsToMg(l.grossG || "0");
      } catch {
        /* */
      }
      fineMg += lineFineMg(l);
      labourPaise += rupeesToPaise(l.labourRupees || "0");
    }
    const purity =
      grossMg > 0
        ? Math.round(
            (lines.reduce((s, l) => {
              const n = lineNetMg(l);
              const t = parseFloat(l.tanchPct) || 0;
              return s + n * t * 10;
            }, 0) /
              Math.max(
                1,
                lines.reduce((s, l) => s + lineNetMg(l), 0),
              )) *
              1,
          )
        : 916;
    return { grossMg, fineMg, labourPaise, purity: Math.max(1, Math.min(999, purity || 916)) };
  }, [lines]);

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
    setLines([emptyPurchaseLine()]);
    setPayMode("cash");
    setGstRateStr("3");
    setPaidStr("0");
  }

  async function handleCreate() {
    if (!supplierId) {
      toast.error("Select a supplier.");
      return;
    }
    if (totals.grossMg <= 0 || totals.fineMg <= 0) {
      toast.error("Enter Offline hisab lines (Gr / Less / Add / Tanch → Fine).");
      return;
    }
    setSaving(true);
    try {
      const gstRatePct = Number(gstRateStr) || 0;
      const paidPaise = rupeesToPaise(paidStr || "0");
      const metalLines = lines
        .filter((l) => lineFineMg(l) > 0 || lineNetMg(l) > 0)
        .map((l) => {
          const tanch = parseFloat(l.tanchPct) || 0;
          const wstg = parseFloat(l.wstgPct) || 0;
          const hisob =
            l.hisobPct.trim() !== ""
              ? parseFloat(l.hisobPct) || 0
              : Math.round((tanch + wstg) * 100) / 100;
          return {
            itemName: l.itemName || "Purchase metal",
            grossMg: (() => {
              try {
                return gramsToMg(l.grossG || "0");
              } catch {
                return 0;
              }
            })(),
            lessMg: (() => {
              try {
                return gramsToMg(l.lessG || "0");
              } catch {
                return 0;
              }
            })(),
            addMg: (() => {
              try {
                return gramsToMg(l.addG || "0");
              } catch {
                return 0;
              }
            })(),
            netMg: lineNetMg(l),
            tanchPct: tanch,
            wastagePct: wstg,
            hisobPct: hisob,
            fineMg: lineFineMg(l),
            pcs: parseInt(l.pcs, 10) || 0,
            labourPaise: rupeesToPaise(l.labourRupees || "0"),
            jn: Number(l.jn) as 1 | 2,
          };
        });

      const { capturePurchaseCreate } = await import("@/lib/offline");
      const queued = await capturePurchaseCreate({
        supplierId,
        branchId: resolveOperationalBranchId(useSettings.getState().selectedBranchId),
        invoiceNo: invoiceNo.trim() || undefined,
        invoiceDate,
        metal: "Gold",
        purityPermille: totals.purity,
        grossMg: totals.grossMg,
        fineMg: totals.fineMg,
        gstRatePct,
        paidPaise,
        duePaise: 0,
        // Offline frm_sale particulars retained on purchase data blob
        paymentMode: payMode,
        lines: metalLines,
        labourPaise: totals.labourPaise,
      } as never);
      if (queued.mode === "queued") {
        toast.message("Purchase saved offline — Pending Sync. Gold posts when you reconnect.");
        setOpen(false);
        reset();
        return;
      }
      const purchase = queued.result as { purchaseNo?: string };
      toast.success(`Purchase ${purchase.purchaseNo ?? ""} posted.`);
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
          <>
            <div className="block md:hidden space-y-2">
              {list.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-background/40 p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gold">{p.purchaseNo}</p>
                      <p className="text-sm mt-0.5">{vendorName(p.supplierId)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.invoiceNo || "—"} · {mgToGrams(p.fineMg)} g · {money(p.paidPaise)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {p.reversed ? "Reversed" : "Posted"}
                    </Badge>
                  </div>
                  {!p.reversed && canCreate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full min-h-[var(--touch-target)] gap-1"
                      onClick={() => void handleReverse(p)}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Purchase Return
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
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
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase (Offline metal voucher)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Supplier</Label>
              <select
                className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-11 sm:h-9" />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-11 sm:h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide">Metal lines (Gr / Less / Add / Net / Tanch / Wstg / Hisob / Fine)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, emptyPurchaseLine()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                </Button>
              </div>
              {lines.map((l, idx) => (
                <div key={l.id} className="rounded-md border p-3 space-y-2 bg-muted/10">
                  <div className="flex gap-2">
                    <Input
                      className="h-11 sm:h-9 flex-1"
                      placeholder="Item"
                      value={l.itemName}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, itemName: e.target.value } : x)),
                        )
                      }
                    />
                    {lines.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        ["grossG", "Gr (g)"],
                        ["lessG", "Less"],
                        ["addG", "Add"],
                        ["tanchPct", "Tanch %"],
                        ["wstgPct", "Wstg %"],
                        ["hisobPct", "Hisob %"],
                        ["pcs", "Pcs"],
                        ["labourRupees", "Lab ₹"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                        <Input
                          className="h-11 sm:h-9 font-mono"
                          inputMode="decimal"
                          value={l[key]}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, [key]: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                    ))}
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">J/N</Label>
                      <select
                        className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={l.jn}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, jn: e.target.value as "1" | "2" } : x,
                            ),
                          )
                        }
                      >
                        <option value="1">Jama</option>
                        <option value="2">Nave</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="text-[10px] uppercase text-muted-foreground">Net / Fine</div>
                      <div className="font-mono text-sm font-semibold text-gold">
                        {mgToGrams(lineNetMg(l))} g · {mgToGrams(lineFineMg(l))} g
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs font-mono text-muted-foreground">
                Voucher total: {mgToGrams(totals.grossMg)} g gross · {mgToGrams(totals.fineMg)} g fine
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label>Pay mode</Label>
                <select
                  className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as "cash" | "anamat" | "bank")}
                >
                  <option value="cash">Cash</option>
                  <option value="anamat">Anamat</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <Label>GST Rate (%)</Label>
                <Input className="h-11 sm:h-9" value={gstRateStr} onChange={(e) => setGstRateStr(e.target.value)} />
              </div>
              <div>
                <Label>Paid Now (₹)</Label>
                <Input className="h-11 sm:h-9" value={paidStr} onChange={(e) => setPaidStr(e.target.value)} />
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
