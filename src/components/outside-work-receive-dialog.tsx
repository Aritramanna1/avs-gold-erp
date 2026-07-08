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
import { useLedger } from "@/lib/ledger-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useOutsideWork, COMMON_OUTSIDE_RETURN_MATERIALS } from "@/lib/outside-work-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import {
  outsideWorkReceiveMaterialToVaultCategory,
  OUTSIDE_WORK_RECEIVE_VAULT_MOVEMENT_TYPE,
} from "@/lib/material-vault-sync";
import { supabase } from "@/integrations/supabase/client";
import { generateImageThumbnail } from "@/lib/attachments-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { PackageCheck, AlertTriangle, ImagePlus } from "lucide-react";

/**
 * "Receive from Outside Jeweller" — mirrors WorkerReturnDialog's shape.
 * Saving appends a Gold Ledger entry, an OutsideWorkTransaction (the
 * Outside Work Ledger), and — if linked to a Production Order — a timeline
 * entry there. No wastage/recovery/over-loss/settlement math here.
 */
export function OutsideWorkReceiveDialog({
  open,
  onClose,
  defaultJewellerId,
  defaultOrderId,
  onReceived,
}: {
  open: boolean;
  onClose: () => void;
  defaultJewellerId?: string;
  defaultOrderId?: string;
  onReceived?: (txn: { orderId?: string }) => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const people = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const addOutsideWork = useOutsideWork((s) => s.add);
  const appendVault = useMaterialVault((s) => s.append);

  const jewellers = useMemo(
    () => people.filter((p) => p.type === "outside_worker" || p.type === "vendor"),
    [people],
  );

  const [jewellerId, setJewellerId] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [materialType, setMaterialType] = useState<string>("Finished Product");
  const [purityStr, setPurityStr] = useState("916");
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
      setJewellerId(defaultJewellerId ?? "");
      setOrderId(defaultOrderId ?? "none");
      setMaterialType("Finished Product");
      setPurityStr("916");
      setWeightStr("");
      setRemarks("");
      setPhotoDataUrl(null);
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, defaultJewellerId, defaultOrderId]);

  const isGold = materialType === "Gold";
  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = isGold ? Number(purityStr) || 0 : 0;
  const fineMg = isGold && purity > 0 ? fineGoldMg(grossMg, purity) : grossMg;
  const isFinished = materialType === "Finished Product";

  const canSubmit = !!jewellerId && grossMg > 0 && (!isGold || purity > 0) && !saving;

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
    const jeweller = people.find((p) => p.id === jewellerId);
    if (!jeweller) {
      setError("Select an outside jeweller.");
      return;
    }
    const order = orderId !== "none" ? orders.find((o) => o.id === orderId) : undefined;
    setSaving(true);
    try {
      // Bucket mapping: finished product → finished, leftover raw gold →
      // vault (it's unused gold coming back, not scrap), anything else
      // (scrap/filings/other) → scrap.
      const deltas = isFinished
        ? { karigar: -fineMg, finished: fineMg }
        : isGold
          ? { karigar: -fineMg, vault: fineMg }
          : { karigar: -fineMg, scrap: fineMg };

      const ledgerEntry = await appendLedger({
        type: "receive_from_karigar",
        netFineMg: 0,
        deltas,
        grossMg,
        purity: purity || undefined,
        fineMg,
        reference: order?.orderNo ?? jeweller.fullName,
        notes: `Received ${materialType} from outside jeweller ${jeweller.fullName}${order ? ` · Order ${order.orderNo}` : ""}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
      });

      await addOutsideWork({
        type: "receive",
        jewellerId,
        jewellerName: jeweller.fullName,
        orderId: order?.id,
        orderNo: order?.orderNo,
        materialType,
        purity,
        grossMg,
        fineMg,
        remarks: remarks.trim() || undefined,
        referencePhotoDataUrl: photoDataUrl ?? undefined,
        ledgerEntryId: ledgerEntry.id,
      });

      // Automatic synchronization: one receive action updates the Gold
      // Ledger (above), the Outside Work Ledger (above), and — for material
      // types the vault actually tracks — the Gold & Material Vault. See
      // outsideWorkReceiveMaterialToVaultCategory()'s doc comment for why
      // "Finished Product" is deliberately excluded (already tracked by the
      // ledger's `finished` bucket; syncing it here would double-count it).
      const vaultCategory = outsideWorkReceiveMaterialToVaultCategory(materialType);
      if (vaultCategory) {
        const { data } = await supabase.auth.getSession();
        await appendVault({
          category: vaultCategory,
          type: OUTSIDE_WORK_RECEIVE_VAULT_MOVEMENT_TYPE,
          deltaMg: grossMg,
          grossMg,
          purity: purity || undefined,
          reference: order?.orderNo ?? jeweller.fullName,
          remarks: remarks.trim() || undefined,
          relatedOrderId: order?.id,
          actorId: data.session?.user.id ?? null,
          actorEmail: data.session?.user.email ?? null,
        });
      }

      if (order) {
        await useOrders.getState().appendTimeline(order.id, {
          ts: Date.now(),
          label: "Outside work received",
          note: `${materialType} · ${mgToGrams(grossMg)} g ← ${jeweller.fullName}`,
        });
      }

      onReceived?.({ orderId: order?.id });
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
            <PackageCheck className="h-4 w-4 text-gold" /> Receive from Outside Jeweller
          </DialogTitle>
          <DialogDescription>Records a transaction — not a manufacturing job.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Outside Jeweller *</Label>
            <Select value={jewellerId} onValueChange={setJewellerId}>
              <SelectTrigger
                ref={firstFieldRef as any}
                data-testid="outside-receive-jeweller-select"
              >
                <SelectValue placeholder="Select outside jeweller…" />
              </SelectTrigger>
              <SelectContent>
                {jewellers.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Production Order (optional)</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger data-testid="outside-receive-order-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked order</SelectItem>
                {orders.slice(0, 200).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Returned Material/Product *</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger data-testid="outside-receive-material-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_OUTSIDE_RETURN_MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purity {isGold ? "*" : "(n/a)"}</Label>
              <Select value={purityStr} onValueChange={setPurityStr} disabled={!isGold}>
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
          </div>

          <div>
            <Label>Returned Weight (g) *</Label>
            <Input
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              placeholder="10.000"
              inputMode="decimal"
              data-testid="outside-receive-weight-input"
            />
          </div>

          {grossMg > 0 && isGold && purity > 0 && (
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
            data-testid="outside-receive-submit"
          >
            <PackageCheck className="h-4 w-4" /> {saving ? "Saving…" : "Receive (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
