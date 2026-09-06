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
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { usePolishing } from "@/lib/polishing-store";
import { useOrders } from "@/lib/orders-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { generateImageThumbnail } from "@/lib/attachments-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Flame, AlertTriangle, ImagePlus, X, Camera } from "lucide-react";

/**
 * Send to Polishing — the 6 fields this phase calls for (Polisher, Product,
 * Weight, Purity, Expected Return Date, Remarks), plus an optional
 * Production Order link. Saving appends to the Gold Ledger (karigar
 * bucket — a polisher is, for balance purposes, a third party temporarily
 * holding the shop's gold), the Polishing Ledger, and — if linked and
 * `auto_timeline_entries_polishing` is on — the order's timeline.
 *
 * When opened from a specific order's own page, `orderId`/`orderNo` are
 * supplied as fixed props and no picker is shown. When opened standalone
 * (the Polishing Ledger page), a "Production Order" select lets the user
 * optionally link one — the same field, just rendered as an editable
 * picker instead of a fixed label, per "Production Order (optional)" being
 * a genuine field in this form, not just a prop the caller happens to know.
 */
export function SendToPolishingDialog({
  open,
  onClose,
  orderId: fixedOrderId,
  orderNo: fixedOrderNo,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  orderId?: string;
  orderNo?: string;
  onSent?: (info: { grossMg: number; polisherName: string }) => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const allOrders = useOrders((s) => s.orders);
  const [pickedOrderId, setPickedOrderId] = useState<string>("");
  const orderId = fixedOrderId ?? (pickedOrderId || undefined);
  const orderNo = fixedOrderId
    ? fixedOrderNo
    : allOrders.find((o) => o.id === pickedOrderId)?.orderNo;
  const entries = useLedger((s) => s.entries);
  const people = usePeople((s) => s.people);
  const addPolishing = usePolishing((s) => s.add);
  const isEnabled = useBusinessRules((s) => s.isEnabled);
  const requireApproval = isEnabled("require_approval_before_sending_polishing");
  const workflowConfig = useWorkflowEngine((s) => s.config);
  const polishingProcessType = workflowConfig.polishingProcessType ?? "outside";

  const polishers = useMemo(() => {
    const list = people.filter((p) => p.active);
    if (polishingProcessType === "outside") {
      const outside = list.filter(
        (p) =>
          p.type === "outside_karigar" ||
          p.type === "outside_worker" ||
          p.type === "vendor" ||
          p.type === "service_provider",
      );
      if (outside.length > 0) return outside;
    } else {
      const inHouse = list.filter((p) => p.type === "karigar" || p.type === "worker");
      if (inHouse.length > 0) return inHouse;
    }
    return list.filter(
      (p) =>
        p.type === "karigar" ||
        p.type === "worker" ||
        p.type === "outside_karigar" ||
        p.type === "outside_worker" ||
        p.type === "vendor" ||
        p.type === "service_provider",
    );
  }, [people, polishingProcessType]);
  const balances = useMemo(() => computeBalances(entries), [entries]);
  const vaultMg = balances.buckets.vault;

  const [polisherId, setPolisherId] = useState("");
  const [product, setProduct] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [purityStr, setPurityStr] = useState("916");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
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
      setPurityStr("916");
      setExpectedReturnDate("");
      setRemarks("");
      setApprovedBy("");
      setPickedOrderId("");
      setPhotoDataUrl(null);
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open]);

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

  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = Number(purityStr) || 0;
  const fineMg = purity > 0 ? fineGoldMg(grossMg, purity) : grossMg;
  const willOverdraw = fineMg > vaultMg;
  const todayStr = new Date().toISOString().split("T")[0];
  const isPastDate = !!expectedReturnDate && expectedReturnDate < todayStr;

  const canSubmit =
    !!polisherId &&
    product.trim().length > 0 &&
    grossMg > 0 &&
    purity > 0 &&
    !isPastDate &&
    (!requireApproval || approvedBy.trim().length > 0) &&
    !saving;

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
      const ledgerEntry = await appendLedger({
        type: "sent_to_polisher",
        netFineMg: 0,
        deltas: { vault: -fineMg, karigar: fineMg },
        grossMg,
        purity,
        fineMg,
        reference: orderNo ?? product.trim(),
        notes: `Sent ${product.trim()} to ${polisher.fullName} for polishing${orderNo ? ` · Order ${orderNo}` : ""}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
      });

      const { data } = await supabase.auth.getSession();
      await addPolishing(
        {
          type: "sent",
          polisherId,
          polisherName: polisher.fullName,
          orderId,
          orderNo,
          product: product.trim(),
          grossMg,
          purity,
          fineMg,
          expectedReturnDate: expectedReturnDate || undefined,
          referencePhotoDataUrl: photoDataUrl ?? undefined,
          remarks: remarks.trim() || undefined,
          ledgerEntryId: ledgerEntry.id,
          approvedBy: requireApproval ? approvedBy.trim() : undefined,
        },
        { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null },
      );

      if (orderId && useBusinessRules.getState().isEnabled("auto_timeline_entries_polishing")) {
        const { useOrders: useOrdersLive } = await import("@/lib/orders-store");
        await useOrdersLive.getState().appendTimeline(orderId, {
          ts: Date.now(),
          label: "Sent to Polishing",
          note: `${(grossMg / 1000).toFixed(3)}g → ${polisher.fullName}`,
        });
      }

      onSent?.({ grossMg, polisherName: polisher.fullName });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record send to polishing.");
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
            <Flame className="h-4 w-4 text-amber-500" /> Send to Polishing
          </DialogTitle>
          {orderNo && <DialogDescription>Order {orderNo}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Polisher *</Label>
            <Select value={polisherId} onValueChange={setPolisherId}>
              <SelectTrigger
                ref={firstFieldRef as any}
                data-testid="polishing-send-polisher-select"
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
                <SelectTrigger data-testid="polishing-send-order-select">
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
            <Label>Product *</Label>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Gold bangle pair"
              data-testid="polishing-send-product-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Weight (g) *</Label>
              <Input
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="10.000"
                inputMode="decimal"
                data-testid="polishing-send-weight-input"
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

          {/* Before Photo Upload */}
          <div>
            <Label className="flex items-center justify-between">
              <span>Before Photo (Recommended)</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Records piece condition before polishing
              </span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelected}
            />
            {photoDataUrl ? (
              <div className="mt-1 relative inline-block">
                <img
                  src={photoDataUrl}
                  alt="Before Polish Preview"
                  className="h-20 w-20 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow hover:opacity-90"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 gap-2 text-xs w-full justify-center border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                {uploadingPhoto ? "Processing photo…" : "Attach Before Photo"}
              </Button>
            )}
          </div>

          {grossMg > 0 && purity > 0 && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-center justify-between text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Fine gold (auto)
                </div>
                <div className="font-mono text-gold">{mgToGrams(fineMg)} g</div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                Vault after send:
                <br />
                <span className="font-mono text-foreground">
                  {mgToGrams(Math.max(0, vaultMg - fineMg))} g
                </span>
              </div>
            </div>
          )}

          <div>
            <Label>Expected Return Date</Label>
            <Input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              className={isPastDate ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {isPastDate && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                Expected return date cannot be in the past.
              </p>
            )}
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

          {requireApproval && (
            <div>
              <Label>Approved By *</Label>
              <Input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Required by current settings — manager/owner name"
                data-testid="polishing-send-approver-input"
              />
            </div>
          )}

          {willOverdraw && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Vault does not have enough fine gold for this
              send.
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              {error}
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
            data-testid="polishing-send-submit"
          >
            <Flame className="h-4 w-4" /> {saving ? "Sending…" : "Send (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
