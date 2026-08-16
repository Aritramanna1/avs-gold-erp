import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormStatus, InlineSavingState } from "@/components/web-app-state";
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
  head: () => ({ meta: [{ title: "Ready Stock Entry - AVS Gold ERP" }] }),
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  function clearFieldError(field: string) {
    setErrors((current) => ({ ...current, [field]: "" }));
    setServerError("");
  }

  function validate(): { grossMg: number; netMg: number; purityValue: number; ok: boolean } {
    const nextErrors: Record<string, string> = {};
    const grossMg = gramsToMg(grossG);
    const netMg = gramsToMg(netG);
    const purityValue = Number(purity);

    if (!itemName.trim()) nextErrors.itemName = "Enter the finished item name.";
    if (!category.trim()) nextErrors.category = "Enter the item category.";
    if (!Number.isInteger(purityValue) || purityValue <= 0 || purityValue > 1000) {
      nextErrors.purity = "Select a configured purity.";
    }
    if (grossMg <= 0) nextErrors.grossG = "Enter gross weight in grams.";
    if (netMg <= 0) nextErrors.netG = "Enter net metal weight in grams.";
    if (grossMg > 0 && netMg > grossMg) {
      nextErrors.netG = "Net metal weight cannot be more than gross weight.";
    }

    setErrors(nextErrors);
    return { grossMg, netMg, purityValue, ok: Object.keys(nextErrors).length === 0 };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const { grossMg, netMg, purityValue, ok } = validate();
    if (!ok) return;

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
      const message = error instanceof Error ? error.message : "Could not save ready stock.";
      setServerError(message);
      toast.error(message);
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
      <form onSubmit={submit} className="erp-surface space-y-4 rounded-md p-4 md:p-6">
        <FormStatus
          status={saving ? "saving" : serverError ? "error" : "idle"}
          title={saving ? "Saving ready stock" : "Ready stock was not saved"}
          description={
            saving
              ? "Creating the stock item, barcode, and connected vault movement through the online data path."
              : serverError
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ready-item-name">Item name *</Label>
            <Input
              id="ready-item-name"
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value);
                clearFieldError("itemName");
              }}
              placeholder="22K gold ring"
              autoFocus
              aria-invalid={!!errors.itemName}
            />
            <FieldError message={errors.itemName} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ready-category">Category *</Label>
            <Input
              id="ready-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                clearFieldError("category");
              }}
              placeholder="Ring, chain, bangle"
              aria-invalid={!!errors.category}
            />
            <FieldError message={errors.category} />
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
              onChange={(e) => {
                setPurity(e.target.value);
                clearFieldError("purity");
              }}
              aria-invalid={!!errors.purity}
            >
              {purities
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.permille}>
                    {p.metal ?? "Gold"} - {p.label}
                  </option>
                ))}
            </select>
            <FieldError message={errors.purity} />
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
              onChange={(e) => {
                setGrossG(e.target.value);
                clearFieldError("grossG");
              }}
              placeholder="0.000"
              aria-invalid={!!errors.grossG}
            />
            <FieldError message={errors.grossG} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ready-net">Net metal weight (g) *</Label>
            <Input
              id="ready-net"
              inputMode="decimal"
              value={netG}
              onChange={(e) => {
                setNetG(e.target.value);
                clearFieldError("netG");
              }}
              placeholder="0.000"
              aria-invalid={!!errors.netG}
            />
            <FieldError message={errors.netG} />
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
          <PackagePlus className="h-4 w-4" />
          {saving ? <InlineSavingState label="Saving..." /> : "Save Ready Stock"}
        </Button>
      </form>
    </div>
  );
}
