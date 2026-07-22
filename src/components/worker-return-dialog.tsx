import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrders } from "@/lib/orders-store";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useWorkerReturns, COMMON_RETURN_MATERIALS } from "@/lib/worker-return-store";
import { generateImageThumbnail } from "@/lib/attachments-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { PackageCheck, AlertTriangle, ImagePlus } from "lucide-react";

/**
 * Simple "Receive From Worker" form — the 7 fields this phase calls for,
 * nothing more. Saving appends to the Gold Ledger, the Worker Gold Book,
 * and a per-order WorkerReturn record so this Production Order can show
 * its full return history and support any number of returns.
 *
 * Deliberately does NOT calculate or settle wastage, recovery, over/loss,
 * salary deduction, or manufacturing billing — those are reserved,
 * documented extension points on WorkerReturn for a later phase.
 */
export function WorkerReturnDialog({
  open,
  onClose,
  orderId,
  orderNo,
  defaultPurity,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNo: string;
  defaultPurity?: number;
  onSaved?: (info: { materialReturned: string; grossMg: number; workerName: string }) => void;
}) {
  const people = usePeople((s) => s.people);
  const addWorkerReturn = useWorkerReturns((s) => s.add);
  // NOTE: calling a store method like `forOrder()` directly inside the
  // selector returns a brand-new array every render, which zustand sees as
  // "state changed" every time — an infinite render loop. Select the raw
  // `entries` array (stable reference) and derive the per-order filter with
  // useMemo instead, same fix already applied in orders.$id.tsx.
  const allGoldBookEntries = useWorkerGoldBook((s) => s.entries);
  const orderIssues = useMemo(
    () => allGoldBookEntries.filter((e) => e.orderId === orderId && e.type === "given"),
    [allGoldBookEntries, orderId],
  );

  const workers = useMemo(
    () =>
      people.filter(
        (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
      ),
    [people],
  );

  // Auto-fill the worker most recently issued gold/material for this order,
  // if any — a return almost always comes from whoever received the issue.
  const autoWorkerId = orderIssues[0]?.workerId ?? "";

  const [workerId, setWorkerId] = useState("");
  const [materialReturned, setMaterialReturned] = useState<string>("Finished Product");
  const [description, setDescription] = useState("");
  const [purityStr, setPurityStr] = useState(String(defaultPurity ?? 916));
  const [weightStr, setWeightStr] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setWorkerId(autoWorkerId);
      setMaterialReturned("Finished Product");
      setDescription("");
      setPurityStr(String(defaultPurity ?? 916));
      setWeightStr("");
      setRemarks("");
      setPhotoDataUrl(null);
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = Number(purityStr) || 0;
  const fineMg = purity > 0 ? fineGoldMg(grossMg, purity) : grossMg;

  const canSubmit = !!workerId && grossMg > 0 && purity > 0 && !saving;

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const thumb = await generateImageThumbnail(file, 480);
      setPhotoDataUrl(thumb);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process photo");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const worker = people.find((p) => p.id === workerId);
    if (!worker) {
      setError("Select a worker.");
      return;
    }
    setSaving(true);
    try {
      // Single source of truth: useWorkerGoldBook.addEntry() is the ONE place
      // a return gets posted — it routes through the centralized Gold
      // Transaction Service (gold-transaction-service.ts) internally, which
      // atomically updates the Gold Ledger and the Material Vault (Gold
      // Stock) alongside the Worker Gold Book entry itself. This dialog used
      // to also post its own direct Ledger + Material Vault entries, which
      // after that service existed meant every vault-tracked return got
      // double-counted (once here, once inside addEntry). Do not re-add
      // direct appendLedger/useMaterialVault writes here.
      const gbEntry = await useWorkerGoldBook.getState().addEntry({
        workerId,
        workerName: worker.fullName,
        particulars: materialReturned,
        grossMg,
        lessMg: 0,
        netMg: grossMg,
        purity,
        fineMg,
        quantity: 1,
        notes: remarks.trim() || `Returned for Order ${orderNo}`,
        givenBy: worker.fullName,
        receivedBy: "Vault Manager",
        type: "return",
        reference: orderNo,
        orderId,
        orderNo,
      });

      await addWorkerReturn({
        orderId,
        workerId,
        workerName: worker.fullName,
        materialReturned,
        finishedProductDescription: description.trim() || undefined,
        purity,
        grossMg,
        fineMg,
        remarks: remarks.trim() || undefined,
        referencePhotoDataUrl: photoDataUrl ?? undefined,
        workerGoldBookEntryId: gbEntry.id,
        relatedIssueId: orderIssues[0]?.id,
      });

      // Order Timeline entry — mirrors the pattern send-to-polishing-dialog.tsx
      // uses (appendTimeline), so a worker return shows up in the order's own
      // activity history the same way sending to polishing does.
      await useOrders.getState().appendTimeline(orderId, {
        ts: Date.now(),
        label: "Worker Return",
        note: `${mgToGrams(grossMg)}g ${materialReturned} ← ${worker.fullName}`,
      });

      onSaved?.({ materialReturned, grossMg, workerName: worker.fullName });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record return.");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-gold" /> Receive From Worker
          </DialogTitle>
          <DialogDescription>Order {orderNo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Worker *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger ref={firstFieldRef as any} data-testid="return-worker-select">
                <SelectValue placeholder="Select worker…" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName} · {PERSON_TYPE_LABELS[w.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Material Returned *</Label>
              <Select value={materialReturned} onValueChange={setMaterialReturned}>
                <SelectTrigger data-testid="return-material-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_RETURN_MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purity *</Label>
              <Select value={purityStr} onValueChange={setPurityStr}>
                <SelectTrigger data-testid="return-purity-select">
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
          </div>

          <div>
            <Label>Finished Product Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Chain, 22K, finished polish"
            />
          </div>

          <div>
            <Label>Returned Weight (g) *</Label>
            <Input
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              placeholder="10.000"
              inputMode="decimal"
              data-testid="return-weight-input"
            />
          </div>

          {grossMg > 0 && purity > 0 && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Fine gold (auto)
              </div>
              <div className="font-mono text-gold">{mgToGrams(fineMg)} g</div>
            </div>
          )}

          <div>
            <Label>Remarks (optional)</Label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>

          <div>
            <Label>Reference Photo (optional)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                <ImagePlus className="h-3.5 w-3.5" />{" "}
                {uploadingPhoto ? "Processing…" : "Choose Photo"}
              </Button>
              {photoDataUrl && (
                <img
                  src={photoDataUrl}
                  alt="Reference"
                  className="h-10 w-10 rounded object-cover border border-border"
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel (Esc)
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="gap-2"
            data-testid="return-submit"
          >
            <PackageCheck className="h-4 w-4" /> {saving ? "Saving…" : "Receive (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
