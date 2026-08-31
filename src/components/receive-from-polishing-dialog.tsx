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
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { usePolishing, findOldestPendingSend } from "@/lib/polishing-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { generateImageThumbnail } from "@/lib/attachments-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { rupeesToPaise, useOrders } from "@/lib/orders-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { PackageCheck, AlertTriangle, ImagePlus } from "lucide-react";

/**
 * Receive from Polishing — Polisher, Returned Product, Returned Weight,
 * Purity, Polishing Charges (optional), Remarks, Reference Photo (optional).
 * Saving appends to the Gold Ledger, the Polishing Ledger, and — if linked
 * and `auto_timeline_entries_polishing` is on — the order's timeline.
 */
export function ReceiveFromPolishingDialog({
  open,
  onClose,
  orderId: fixedOrderId,
  orderNo: fixedOrderNo,
  defaultPurity,
  onReceived,
}: {
  open: boolean;
  onClose: () => void;
  orderId?: string;
  orderNo?: string;
  defaultPurity?: number;
  onReceived?: (info: { grossMg: number; polisherName: string; product: string }) => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const people = usePeople((s) => s.people);
  const addPolishing = usePolishing((s) => s.add);
  const allTransactions = usePolishing((s) => s.transactions);
  const allOrders = useOrders((s) => s.orders);
  const isEnabled = useBusinessRules((s) => s.isEnabled);
  const requireApproval = isEnabled("require_approval_before_receiving_polishing");

  const polishers = useMemo(
    () =>
      people.filter(
        (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
      ),
    [people],
  );

  const [pickedOrderId, setPickedOrderId] = useState("");
  const orderId = fixedOrderId ?? (pickedOrderId || undefined);
  const orderNo = fixedOrderId
    ? fixedOrderNo
    : allOrders.find((o) => o.id === pickedOrderId)?.orderNo;

  const [polisherId, setPolisherId] = useState("");
  const [product, setProduct] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [purityStr, setPurityStr] = useState(String(defaultPurity ?? 916));
  const [chargesStr, setChargesStr] = useState("");
  const [remarks, setRemarks] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPolisherId("");
      setProduct("");
      setWeightStr("");
      setPurityStr(String(defaultPurity ?? 916));
      setChargesStr("");
      setRemarks("");
      setApprovedBy("");
      setPhotoDataUrl(null);
      setPickedOrderId("");
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

  const canSubmit =
    !!polisherId &&
    product.trim().length > 0 &&
    grossMg > 0 &&
    purity > 0 &&
    (!requireApproval || approvedBy.trim().length > 0) &&
    !saving;

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
    const polisher = people.find((p) => p.id === polisherId);
    if (!polisher) {
      setError("Select a polisher.");
      return;
    }
    setSaving(true);
    try {
      const chargesPaise = chargesStr ? rupeesToPaise(chargesStr) : undefined;
      const ledgerEntry = await appendLedger({
        type: "received_from_polisher",
        netFineMg: 0,
        deltas: { karigar: -fineMg, finished: fineMg },
        grossMg,
        purity,
        fineMg,
        reference: orderNo ?? product.trim(),
        notes: `Received ${product.trim()} from ${polisher.fullName} after polishing${orderNo ? ` · Order ${orderNo}` : ""}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
      });

      const relatedSent = findOldestPendingSend(allTransactions, polisherId, orderId);

      const { data } = await supabase.auth.getSession();
      await addPolishing(
        {
          type: "received",
          polisherId,
          polisherName: polisher.fullName,
          orderId,
          orderNo,
          product: product.trim(),
          grossMg,
          purity,
          fineMg,
          polishingChargesPaise: chargesPaise,
          referencePhotoDataUrl: photoDataUrl ?? undefined,
          remarks: remarks.trim() || undefined,
          ledgerEntryId: ledgerEntry.id,
          approvedBy: requireApproval ? approvedBy.trim() : undefined,
          relatedSentId: relatedSent?.id,
        },
        { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null },
      );

      if (orderId && useBusinessRules.getState().isEnabled("auto_timeline_entries_polishing")) {
        const { useOrders: useOrdersLive } = await import("@/lib/orders-store");
        await useOrdersLive.getState().appendTimeline(orderId, {
          ts: Date.now(),
          label: "Received from Polishing",
          note: `${(grossMg / 1000).toFixed(3)}g ${product.trim()} ← ${polisher.fullName}`,
        });
      }

      onReceived?.({ grossMg, polisherName: polisher.fullName, product: product.trim() });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record polishing return.");
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
            <PackageCheck className="h-4 w-4 text-gold" /> Receive from Polishing
          </DialogTitle>
          {orderNo && <DialogDescription>Order {orderNo}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Polisher *</Label>
            <Select value={polisherId} onValueChange={setPolisherId}>
              <SelectTrigger
                ref={firstFieldRef as any}
                data-testid="polishing-receive-polisher-select"
              >
                <SelectValue placeholder="Select polisher…" />
              </SelectTrigger>
              <SelectContent>
                {polishers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName} · {PERSON_TYPE_LABELS[p.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!fixedOrderId && (
            <div>
              <Label>Production Order (optional)</Label>
              <Select
                value={pickedOrderId || "none"}
                onValueChange={(v) => setPickedOrderId(v === "none" ? "" : v)}
              >
                <SelectTrigger data-testid="polishing-receive-order-select">
                  <SelectValue placeholder="No order — standalone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No order — standalone</SelectItem>
                  {allOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNo} · {o.item.itemName || o.item.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Returned Product *</Label>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Gold bangle pair, polished"
              data-testid="polishing-receive-product-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Returned Weight (g) *</Label>
              <Input
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="9.850"
                inputMode="decimal"
                data-testid="polishing-receive-weight-input"
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
            <Label>Polishing Charges (₹, optional)</Label>
            <Input
              value={chargesStr}
              onChange={(e) => setChargesStr(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>

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

          {requireApproval && (
            <div>
              <Label>Approved By *</Label>
              <Input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Required by current settings — manager/owner name"
                data-testid="polishing-receive-approver-input"
              />
            </div>
          )}

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
            data-testid="polishing-receive-submit"
          >
            <PackageCheck className="h-4 w-4" /> {saving ? "Saving…" : "Receive (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
