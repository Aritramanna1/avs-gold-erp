import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useStock,
  STOCK_LOCATIONS,
  STOCK_LOCATION_LABELS,
  type StockLocation,
} from "@/lib/stock-store";
import { useSettings } from "@/lib/settings-store";
import { gramsToMg } from "@/lib/gold";
import { toast } from "sonner";
import { ArrowLeft, PackagePlus } from "lucide-react";

export const Route = createFileRoute("/stock/entry")({
  head: () => ({ meta: [{ title: "Ready Stock Entry · AVS Gold ERP" }] }),
  component: ReadyStockEntry,
});

function ReadyStockEntry() {
  const navigate = useNavigate();
  const addReadyStock = useStock((s) => s.addReadyStock);
  const purities = useSettings((s) => s.purities);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [purity, setPurity] = useState(String(purities.find((p) => p.active)?.permille ?? 916));
  const [grossG, setGrossG] = useState("");
  const [netG, setNetG] = useState("");
  const [location, setLocation] = useState<StockLocation>("safe");
  const [source, setSource] = useState<"manufactured" | "purchased">("manufactured");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const grossMg = gramsToMg(grossG);
    const netMg = gramsToMg(netG);
    const purityValue = Number(purity);
    if (!itemName.trim() || !category.trim() || grossMg <= 0 || netMg <= 0 || netMg > grossMg) {
      toast.error("Enter item, category, and valid gross/net weights.");
      return;
    }
    if (!Number.isInteger(purityValue) || purityValue <= 0 || purityValue > 1000) {
      toast.error("Select a valid configured purity.");
      return;
    }
    setSaving(true);
    try {
      const item = await addReadyStock(
        {
          itemName: itemName.trim(),
          category: category.trim(),
          purity: purityValue,
          grossMg,
          netMg,
          status: "available",
          location,
          notes: notes.trim() || undefined,
        },
        source,
      );
      toast.success(`Ready stock saved. Barcode ${item.barcode} generated.`);
      void navigate({ to: "/stock" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save ready stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-24 md:p-8">
      <PageHeader
        title="Ready Stock Entry"
        subtitle="Add a finished item directly or receive a purchased finished piece. Barcode and vault posting are automatic."
        actions={
          <Button variant="ghost" onClick={() => void navigate({ to: "/stock" })} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />
      <form onSubmit={submit} className="erp-surface space-y-4 rounded-xl p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ready-item-name">Item name *</Label>
            <Input
              id="ready-item-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="22K gold ring"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ready-category">Category *</Label>
            <Input
              id="ready-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ring, chain, bangle"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ready-source">Source *</Label>
            <select
              id="ready-source"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="manufactured">Manufactured</option>
              <option value="purchased">Purchased finished goods</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ready-purity">Purity *</Label>
            <select
              id="ready-purity"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={purity}
              onChange={(e) => setPurity(e.target.value)}
            >
              {purities
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.permille}>
                    {p.metal ?? "Gold"} · {p.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ready-location">Location *</Label>
            <select
              id="ready-location"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value as StockLocation)}
            >
              {STOCK_LOCATIONS.map((value) => (
                <option key={value} value={value}>
                  {STOCK_LOCATION_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ready-gross">Gross weight (g) *</Label>
            <Input
              id="ready-gross"
              inputMode="decimal"
              value={grossG}
              onChange={(e) => setGrossG(e.target.value)}
              placeholder="0.000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ready-net">Net metal weight (g) *</Label>
            <Input
              id="ready-net"
              inputMode="decimal"
              value={netG}
              onChange={(e) => setNetG(e.target.value)}
              placeholder="0.000"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ready-notes">Reference / notes</Label>
            <Input
              id="ready-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Supplier invoice, order, or workshop reference"
            />
          </div>
        </div>
        <Button type="submit" className="h-11 w-full gap-2" disabled={saving}>
          <PackagePlus className="h-4 w-4" /> {saving ? "Saving…" : "Save Ready Stock"}
        </Button>
      </form>
    </div>
  );
}
