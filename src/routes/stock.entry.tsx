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
import { isNativeApp } from "@/lib/native/platform";
import { MobileFormStepActions, MobileFormStepChrome } from "@/components/mobile/MobileFormStep";
import { MobileConfirmSummary } from "@/components/mobile/MobileConfirmSummary";
import { MobileCameraCapture } from "@/components/mobile/MobileCameraCapture";
import { captureStockCreate, captureEntityPhotoOffline } from "@/lib/offline";
import { isOnline } from "@/lib/native/network";
import { useAttachments } from "@/lib/attachments-store";

export const Route = createFileRoute("/stock/entry")({
  head: () => ({ meta: [{ title: "Ready Stock Entry · AVS ERP" }] }),
  component: ReadyStockEntry,
});

const MOBILE_STEPS = ["Basic", "Gold / Weight", "Notes", "Photo / Review"] as const;

function ReadyStockEntry() {
  const navigate = useNavigate();
  const addReadyStock = useStock((s) => s.addReadyStock);
  const purities = useSettings((s) => s.purities);
  const mobile = isNativeApp() || (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  const [step, setStep] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const [photoNote, setPhotoNote] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

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
    if (pendingPhotos.length < 1) {
      nextErrors.photo = "Add at least one product photo (you can add more).";
    }

    setErrors(nextErrors);
    return { grossMg, netMg, purityValue, ok: Object.keys(nextErrors).length === 0 };
  }

  function validateStep(): boolean {
    const nextErrors: Record<string, string> = {};
    if (step === 0) {
      if (!itemName.trim()) nextErrors.itemName = "Enter the finished item name.";
      if (!category.trim()) nextErrors.category = "Enter the item category.";
    }
    if (step === 1) {
      const grossMg = gramsToMg(grossG);
      const netMg = gramsToMg(netG);
      const purityValue = Number(purity);
      if (!Number.isInteger(purityValue) || purityValue <= 0 || purityValue > 1000) {
        nextErrors.purity = "Select a configured purity.";
      }
      if (grossMg <= 0) nextErrors.grossG = "Enter gross weight in grams.";
      if (netMg <= 0) nextErrors.netG = "Enter net metal weight in grams.";
      if (grossMg > 0 && netMg > grossMg) {
        nextErrors.netG = "Net metal weight cannot be more than gross weight.";
      }
    }
    if (step === 3 && pendingPhotos.length < 1) {
      nextErrors.photo = "Add at least one product photo before saving.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function uploadPhotosForItem(itemId: string, localId?: string) {
    for (let i = 0; i < pendingPhotos.length; i++) {
      const file = pendingPhotos[i];
      const docKey = `product_photo_${Date.now()}_${i}`;
      if (localId) {
        await captureEntityPhotoOffline({
          entityType: "stock",
          entityId: `local:${localId}`,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          bytes: await file.arrayBuffer(),
          dependsOnLocalIds: [localId],
          docKey,
        });
        continue;
      }
      if (isOnline()) {
        const saved = await useAttachments.getState().saveWithFile("stock", itemId, docKey, file, {
          note: "Ready stock product photo",
          filed: true,
        });
        if (i === 0 && saved.storagePath) {
          await useStock.getState().update(itemId, { imageStoragePath: saved.storagePath });
        }
      } else {
        await captureEntityPhotoOffline({
          entityType: "stock",
          entityId: itemId,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          bytes: await file.arrayBuffer(),
          docKey,
        });
      }
    }
  }

  async function commitSave() {
    setServerError("");
    const { grossMg, netMg, purityValue, ok } = validate();
    if (!ok) return;

    setSaving(true);
    try {
      const itemInput = {
        itemName: itemName.trim(),
        category: category.trim(),
        purity: purityValue,
        grossMg,
        netMg,
        status: "available" as const,
        location,
        notes: notes.trim() || undefined,
      };

      const queued = await captureStockCreate({ item: itemInput, source });
      if (queued.mode === "queued") {
        await uploadPhotosForItem("", queued.operation.localId);
        toast.message("Stock saved offline — Pending Sync. Vault is not posted until sync succeeds.");
        void navigate({ to: "/stock", search: { tab: "ready" } });
        return;
      }

      const item = queued.result as Awaited<ReturnType<typeof addReadyStock>>;
      await uploadPhotosForItem(item.id);
      toast.success(`Ready stock saved with ${pendingPhotos.length} photo(s). Barcode ${item.barcode}.`);
      void navigate({ to: "/stock/$id", params: { id: item.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save ready stock.";
      setServerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mobile) {
      setConfirmOpen(true);
      return;
    }
    await commitSave();
  }

  const fieldsBasic = (
    <>
      <div className="space-y-1.5">
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
          className="min-h-[var(--touch-target)]"
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
          className="min-h-[var(--touch-target)]"
          aria-invalid={!!errors.category}
        />
        <FieldError message={errors.category} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ready-source">Source *</Label>
        <select
          id="ready-source"
          className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
          value={source}
          onChange={(e) => setSource(e.target.value as typeof source)}
        >
          <option value="manufactured">Manufactured</option>
          <option value="purchased">Purchased finished goods</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ready-location">Location *</Label>
        <select
          id="ready-location"
          className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
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
    </>
  );

  const fieldsGold = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="ready-purity">Purity *</Label>
        <select
          id="ready-purity"
          className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
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
          className="min-h-[var(--touch-target)]"
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
          className="min-h-[var(--touch-target)]"
          aria-invalid={!!errors.netG}
        />
        <FieldError message={errors.netG} />
      </div>
    </>
  );

  if (mobile) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
        <PageHeader
          title="Ready Stock"
          subtitle="Stepped entry — same vault posting as desktop."
          actions={
            <Button variant="ghost" onClick={() => void navigate({ to: "/stock", search: { tab: "ready" } })} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />
        <div className="erp-surface rounded-xl p-4 space-y-4">
          <FormStatus
            status={saving ? "saving" : serverError ? "error" : "idle"}
            title={saving ? "Saving ready stock" : "Ready stock was not saved"}
            description={
              saving
                ? "Creating the stock item, barcode, and vault movement."
                : serverError
            }
          />
          <MobileFormStepChrome step={step + 1} total={MOBILE_STEPS.length} title={MOBILE_STEPS[step]}>
            {step === 0 ? <div className="space-y-3">{fieldsBasic}</div> : null}
            {step === 1 ? <div className="space-y-3">{fieldsGold}</div> : null}
            {step === 2 ? (
              <div className="space-y-1.5">
                <Label htmlFor="ready-notes">Reference / notes</Label>
                <Input
                  id="ready-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Supplier invoice, order, or workshop reference"
                  className="min-h-[var(--touch-target)]"
                />
              </div>
            ) : null}
            {step === 3 ? (
              <div className="space-y-3">
                <dl className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Item</dt>
                    <dd className="font-medium">{itemName}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd className="font-medium">{category}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Purity</dt>
                    <dd className="font-medium">{purity}‰</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Gross / Net</dt>
                    <dd className="font-medium tabular-nums">
                      {grossG} / {netG} g
                    </dd>
                  </div>
                  {photoNote || pendingPhotos.length ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Photos</dt>
                      <dd className="font-medium">
                        {pendingPhotos.length} file(s)
                        {photoNote ? ` · ${photoNote}` : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="text-xs text-muted-foreground">
                  Ready stock must include at least one product photo (add more if needed) plus name,
                  category, purity, and weights.
                </p>
                <MobileCameraCapture
                  label="Add product photo"
                  onCapture={async (file) => {
                    setPendingPhotos((prev) => [...prev, file]);
                    clearFieldError("photo");
                  }}
                  onUploaded={({ fileName }) => {
                    setPhotoNote(fileName);
                  }}
                />
                {errors.photo ? <FieldError message={errors.photo} /> : null}
                {pendingPhotos.length > 0 ? (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {pendingPhotos.map((f, i) => (
                      <li key={`${f.name}-${i}`}>{f.name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </MobileFormStepChrome>
          <MobileFormStepActions
            hideBack={step === 0}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            nextLoading={saving}
            nextLabel={step >= MOBILE_STEPS.length - 1 ? "Save" : "Continue"}
            onNext={() => {
              if (!validateStep()) return;
              if (step >= MOBILE_STEPS.length - 1) {
                setConfirmOpen(true);
                return;
              }
              setStep((s) => s + 1);
            }}
          />
        </div>
        <MobileConfirmSummary
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Post ready stock"
          description="Barcode and vault posting run through the online data path."
          rows={[
            { label: "Item", value: itemName.trim() },
            { label: "Category", value: category.trim() },
            { label: "Purity", value: `${purity}‰` },
            { label: "Gross", value: `${grossG} g` },
            { label: "Net", value: `${netG} g` },
            { label: "Source", value: source },
            {
              label: "Photos",
              value: pendingPhotos.length ? `${pendingPhotos.length} attached` : "Missing — required",
            },
          ]}
          confirmLabel="Save ready stock"
          onConfirm={commitSave}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-24 md:p-8">
      <PageHeader
        title="Ready Stock Entry"
        subtitle="Finished piece with name, weights, purity, and at least one product photo (more allowed)."
        actions={
          <Button variant="ghost" onClick={() => void navigate({ to: "/stock", search: { tab: "ready" } })} className="gap-2">
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
              ? "Creating the stock item, barcode, photos, and connected vault movement through the online data path."
              : serverError
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">{fieldsBasic}</div>
          {fieldsGold}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ready-notes-desktop">Reference / notes</Label>
            <Input
              id="ready-notes-desktop"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Supplier invoice, order, or workshop reference"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ready-photos-desktop">Product photo(s) *</Label>
            <Input
              id="ready-photos-desktop"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).filter((f) =>
                  f.type.startsWith("image/"),
                );
                if (files.length) {
                  setPendingPhotos((prev) => [...prev, ...files]);
                  clearFieldError("photo");
                  setPhotoNote(files.map((f) => f.name).join(", "));
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Required: at least one clear photo of the ornament. You can select multiple images.
            </p>
            {errors.photo ? <FieldError message={errors.photo} /> : null}
            {pendingPhotos.length > 0 ? (
              <ul className="text-xs text-muted-foreground list-disc pl-4">
                {pendingPhotos.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    {f.name}
                    <button
                      type="button"
                      className="ml-2 text-destructive underline"
                      onClick={() =>
                        setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
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
