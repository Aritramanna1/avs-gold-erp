import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useLedger } from "@/lib/ledger-store";
import { useStock } from "@/lib/stock-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { gramsToMg, mgToGrams, COMMON_PURITIES } from "@/lib/gold";
import { generateImageThumbnail } from "@/lib/attachments-store";
import { PackageCheck, Camera, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface ReceiveFinishedProductDialogProps {
  open: boolean;
  onClose: () => void;
  defaultWorkerId?: string;
  onSaved?: (info: { itemName: string; barcode: string; fineMg: number; workerName: string }) => void;
}

export function ReceiveFinishedProductDialog({
  open,
  onClose,
  defaultWorkerId,
  onSaved,
}: ReceiveFinishedProductDialogProps) {
  const people = usePeople((s) => s.people);
  const appendLedger = useLedger((s) => s.append);
  const addReadyStock = useStock((s) => s.addReadyStock);
  const nextBarcode = useStock((s) => s.nextBarcode);
  const nextItemCode = useStock((s) => s.nextItemCode);

  const workers = useMemo(
    () =>
      people.filter(
        (p) =>
          p.type === "karigar" ||
          p.type === "worker" ||
          p.type === "outside_worker" ||
          p.type === "vendor",
      ),
    [people],
  );

  const [workerId, setWorkerId] = useState(defaultWorkerId ?? "");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Gold Jewellery");
  const [grossStr, setGrossStr] = useState("");
  const [lessStr, setLessStr] = useState("0");
  const [addStr, setAddStr] = useState("0");
  const [purityStr, setPurityStr] = useState("916");
  const [wastagePctStr, setWastagePctStr] = useState("0");
  const [piecesCountStr, setPiecesCountStr] = useState("1");
  const [huid, setHuid] = useState("");
  const [makingChargePct, setMakingChargePct] = useState("0");
  const [scrapGrossStr, setScrapGrossStr] = useState("0");
  const [scrapPurityStr, setScrapPurityStr] = useState("916");
  const [overLossGStr, setOverLossGStr] = useState("0");
  const [overLossReason, setOverLossReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setWorkerId(defaultWorkerId ?? "");
      setItemName("");
      setCategory("Gold Jewellery");
      setGrossStr("");
      setLessStr("0");
      setAddStr("0");
      setPurityStr("916");
      setWastagePctStr("0");
      setPiecesCountStr("1");
      setHuid("");
      setMakingChargePct("0");
      setScrapGrossStr("0");
      setScrapPurityStr("916");
      setOverLossGStr("0");
      setOverLossReason("");
      setRemarks("");
      setPhotoDataUrl(null);
    }
  }, [open, defaultWorkerId]);

  // Dynamic calculations (Industry standard 995 basis / Hisab = Tanch + Wstg)
  const grossG = Math.max(0, parseFloat(grossStr) || 0);
  const lessG = Math.max(0, parseFloat(lessStr) || 0);
  const addG = Math.max(0, parseFloat(addStr) || 0);
  const netG = Math.max(0, grossG - lessG + addG);
  const purity = parseInt(purityStr, 10) || 916;
  const tanchPct = purity / 10;
  const wastagePct = Math.max(0, parseFloat(wastagePctStr) || 0);
  const hisabPct = Math.round((tanchPct + wastagePct) * 100) / 100;
  
  const fineG =
    wastagePct > 0
      ? (netG * hisabPct) / 100
      : (netG * purity) / 995;

  const scrapGrossG = Math.max(0, parseFloat(scrapGrossStr) || 0);
  const scrapPurity = parseInt(scrapPurityStr, 10) || 916;
  const scrapFineG = (scrapGrossG * scrapPurity) / 995;

  const overLossG = Math.max(0, parseFloat(overLossGStr) || 0);
  const overLossFineG = (overLossG * purity) / 995;

  const totalFineReturnedG = fineG + scrapFineG;
  const totalCustodySettledFineG = totalFineReturnedG + overLossFineG;

  const grossMg = Math.round(grossG * 1000);
  const netMg = Math.round(netG * 1000);
  const fineMg = Math.round(fineG * 1000);
  const scrapFineMg = Math.round(scrapFineG * 1000);
  const overLossFineMg = Math.round(overLossFineG * 1000);
  const totalFineReturnedMg = Math.round(totalFineReturnedG * 1000);
  const totalCustodySettledFineMg = Math.round(totalCustodySettledFineG * 1000);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const thumb = await generateImageThumbnail(file, 480);
      setPhotoDataUrl(thumb);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process photo");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  const canSubmit = !!workerId && itemName.trim().length > 0 && grossG > 0 && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) {
      toast.error("Select a karigar / worker.");
      return;
    }

    setSaving(true);
    try {
      const barcode = nextBarcode();
      const itemCode = nextItemCode();

      // 1. Add finished item directly into Ready Stock (Inventory)
      await addReadyStock(
        {
          itemCode,
          barcode,
          itemName: itemName.trim(),
          category: category.trim() || "Gold Jewellery",
          purity,
          grossMg,
          netMg,
          huid: huid.trim() || undefined,
          makingChargePct: parseFloat(makingChargePct) || 0,
          piecesCount: parseInt(piecesCountStr, 10) || 1,
          status: "available",
          location: "counter",
          notes: `Manufactured by ${worker.fullName}. ${remarks.trim()}`.trim(),
          imageStoragePath: photoDataUrl ?? undefined,
        },
        "manufactured",
      );

      // 2. Record Karigar settlement ledger entry:
      // Karigar returns fine gold (credit worker balance, debit finished stock/vault/over-loss)
      if (overLossFineMg > 0) {
        await appendLedger({
          type: "receive_from_karigar",
          netFineMg: 0,
          deltas: { karigar: -totalCustodySettledFineMg, finished: fineMg, vault: scrapFineMg, scrap: overLossFineMg },
          grossMg: grossMg + Math.round(scrapGrossG * 1000) + Math.round(overLossG * 1000),
          purity,
          fineMg: totalCustodySettledFineMg,
          reference: barcode,
          notes: `Received finished stock ${itemName.trim()} (${barcode}, ${netG.toFixed(3)}g net, ${purity}‰) + ${scrapGrossG.toFixed(3)}g scrap + Over-loss: ${overLossG.toFixed(3)}g (${overLossReason.trim() || "Excess workshop loss"}) from ${worker.fullName}`,
        });
      } else {
        await appendLedger({
          type: "receive_from_karigar",
          netFineMg: 0,
          deltas: { karigar: -totalFineReturnedMg, finished: fineMg, vault: scrapFineMg },
          grossMg: grossMg + Math.round(scrapGrossG * 1000),
          purity,
          fineMg: totalFineReturnedMg,
          reference: barcode,
          notes: `Received finished stock ${itemName.trim()} (${barcode}, ${netG.toFixed(3)}g net, ${purity}‰) + ${scrapGrossG.toFixed(3)}g scrap from ${worker.fullName}`,
        });
      }

      // 3. Record in Worker Gold Book statement so running history reflects returned work & over-loss
      try {
        await useWorkerGoldBook.getState().addEntry({
          workerId: worker.id,
          workerName: worker.fullName,
          particulars: `Finished Stock: ${itemName.trim()}`,
          grossMg,
          lessMg: Math.round(lessG * 1000),
          addMg: Math.round(addG * 1000),
          netMg,
          purity,
          fineMg: totalCustodySettledFineMg,
          wastagePct: wastagePct > 0 ? wastagePct : undefined,
          quantity: parseInt(piecesCountStr, 10) || 1,
          givenBy: worker.fullName,
          receivedBy: "Authorized Staff",
          type: "return",
          reference: barcode,
          notes: `Received finished stock ${itemName.trim()} (${barcode})${scrapGrossG > 0 ? ` + ${scrapGrossG.toFixed(3)}g scrap` : ""}${overLossG > 0 ? ` [Over-loss: ${overLossG.toFixed(3)}g · ${overLossReason.trim() || "Loss settled"}]` : ""}. ${remarks.trim()}`.trim(),
          skipGoldLedger: true,
        });
      } catch (wgbErr) {
        console.warn("Worker gold book entry non-blocking log:", wgbErr);
      }

      toast.success(
        `Finished stock ${itemName} created (${barcode}) and settled ${totalCustodySettledFineG.toFixed(3)}g fine (${totalFineReturnedG.toFixed(3)}g returned${overLossG > 0 ? ` + ${overLossG.toFixed(3)}g over-loss` : ""}) for ${worker.fullName}!`,
      );

      onSaved?.({
        itemName: itemName.trim(),
        barcode,
        fineMg,
        workerName: worker.fullName,
      });

      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to receive finished product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PackageCheck className="h-5 w-5 text-gold" /> Receive Finished Product (To Ready Stock)
          </DialogTitle>
          <DialogDescription>
            Deposits finished manufactured jewellery into Ready Stock inventory and settles the
            worker's gold balance in their ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Worker Selector */}
          <div>
            <Label className="font-semibold">Karigar / Worker *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select karigar or worker…" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName} · {PERSON_TYPE_LABELS[w.type] ?? w.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="font-semibold">Item Name *</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Gold Necklace, Ladies Ring"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-semibold">Category / Design</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Rings, Bangles, Chains"
                className="mt-1"
              />
            </div>
          </div>

          {/* Weight Matrix */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Weight & Calculation Matrix (995 Fineness Standard)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Gross Wt (g) *</Label>
                <Input
                  value={grossStr}
                  onChange={(e) => setGrossStr(e.target.value)}
                  placeholder="10.000"
                  inputMode="decimal"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Less Wt (g)</Label>
                <Input
                  value={lessStr}
                  onChange={(e) => setLessStr(e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Add Wt (g)</Label>
                <Input
                  value={addStr}
                  onChange={(e) => setAddStr(e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gold font-bold">Net Wt (g)</Label>
                <div className="mt-1 h-9 rounded-md border border-gold/40 bg-gold/10 flex items-center px-3 font-mono font-bold text-foreground">
                  {netG.toFixed(3)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Purity / Tanch</Label>
                <Select value={purityStr} onValueChange={setPurityStr}>
                  <SelectTrigger className="mt-1">
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
                <Label className="text-xs">Wastage %</Label>
                <Input
                  value={wastagePctStr}
                  onChange={(e) => setWastagePctStr(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Hisab %</Label>
                <div className="mt-1 h-9 rounded-md border border-border bg-muted flex items-center px-3 font-mono text-xs">
                  {hisabPct.toFixed(2)}%
                </div>
              </div>
              <div>
                <Label className="text-xs text-gold font-bold">Fine Gold (g)</Label>
                <div className="mt-1 h-9 rounded-md border border-gold/40 bg-gold/10 flex items-center px-3 font-mono font-bold text-gold">
                  {fineG.toFixed(3)} g
                </div>
              </div>
            </div>
          </div>

          {/* Scrap Returned Section */}
          <div className="rounded-lg border border-border/80 bg-background p-3 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Scrap / Chhela Returned Alongside (Optional)
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Scrap Gross (g)</Label>
                <Input
                  value={scrapGrossStr}
                  onChange={(e) => setScrapGrossStr(e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Scrap Purity</Label>
                <Select value={scrapPurityStr} onValueChange={setScrapPurityStr}>
                  <SelectTrigger className="mt-1">
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
                <Label className="text-xs">Total Fine Returned</Label>
                <div className="mt-1 h-9 rounded-md border border-border bg-muted/60 flex items-center px-3 font-mono font-bold text-xs text-foreground">
                  {totalFineReturnedG.toFixed(3)} g
                </div>
              </div>
            </div>
          </div>

          {/* Record Over-Loss / Excess Ghata Section */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Record Over-Loss / Excess Ghata (Optional)
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Deducts unrecoverable loss from Karigar custody
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold text-foreground">Over-Loss Weight (g)</Label>
                <Input
                  value={overLossGStr}
                  onChange={(e) => setOverLossGStr(e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className="mt-1 font-mono text-sm border-red-500/30 focus:border-red-500"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Over-Loss Fine (g)</Label>
                <div className="mt-1 h-9 rounded-md border border-red-500/30 bg-background flex items-center px-3 font-mono font-bold text-xs text-red-400">
                  {overLossFineG.toFixed(3)} g
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Reason / Process Step</Label>
                <Input
                  value={overLossReason}
                  onChange={(e) => setOverLossReason(e.target.value)}
                  placeholder="e.g. Melting fire loss, excessive grinding"
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            {overLossG > 0 && (
              <div className="text-[11px] font-mono text-amber-400 flex items-center justify-between pt-1 border-t border-red-500/20">
                <span>Total Karigar Custody Settled:</span>
                <span className="font-bold">{totalCustodySettledFineG.toFixed(3)} g fine</span>
              </div>
            )}
          </div>

          {/* Stock Tag Details & Photo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Pieces (Pcs)</Label>
              <Input
                value={piecesCountStr}
                onChange={(e) => setPiecesCountStr(e.target.value)}
                placeholder="1"
                type="number"
                min="1"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">HUID / Hallmark</Label>
              <Input
                value={huid}
                onChange={(e) => setHuid(e.target.value)}
                placeholder="e.g. ABC123"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Labour / Making %</Label>
              <Input
                value={makingChargePct}
                onChange={(e) => setMakingChargePct(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="mt-1 font-mono"
              />
            </div>
          </div>

          {/* Finished Product Photo */}
          <div>
            <Label className="text-xs">Finished Product Photo</Label>
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
                  alt="Finished piece preview"
                  className="h-20 w-20 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow hover:opacity-90"
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
                {uploadingPhoto ? "Processing photo…" : "Attach Finished Product Photo"}
              </Button>
            )}
          </div>

          <div>
            <Label className="text-xs">Remarks / Notes</Label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Design details, stamp note, or worker remarks…"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2 bg-gold hover:bg-gold/90 text-white font-semibold"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? "Creating Stock…" : "Deposit in Ready Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
