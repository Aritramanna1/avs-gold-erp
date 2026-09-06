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
import { usePeople } from "@/lib/people-store";
import { useLedger } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import { gramsToMg, mgToGrams, COMMON_PURITIES } from "@/lib/gold";
import { rupeesToPaise, paiseToRupees } from "@/lib/orders-store";
import { Receipt, Printer, CheckCircle2, FileText } from "lucide-react";
import { soundEffects } from "@/lib/sound-effects";
import { toast } from "sonner";

export interface JamaSlipDialogProps {
  open: boolean;
  onClose: () => void;
  defaultPartyId?: string;
  onSaved?: (info: { voucherNo: string; partyName: string; fineMg: number; cashPaise: number }) => void;
}

export function JamaSlipDialog({
  open,
  onClose,
  defaultPartyId,
  onSaved,
}: JamaSlipDialogProps) {
  const people = usePeople((s) => s.people);
  const appendLedger = useLedger((s) => s.append);
  const firm = useSettings((s) => s.firm);

  const [partyId, setPartyId] = useState(defaultPartyId ?? "");
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0]);
  const [voucherNo, setVoucherNo] = useState(`JAM-${Date.now().toString().slice(-6)}`);
  
  // Gold deposit inputs
  const [grossStr, setGrossStr] = useState("");
  const [lessStr, setLessStr] = useState("0");
  const [purityStr, setPurityStr] = useState("916");
  
  // Cash deposit inputs
  const [cashAmountStr, setCashAmountStr] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank">("cash");
  
  // Narration
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    if (open) {
      setPartyId(defaultPartyId ?? "");
      setDateStr(new Date().toISOString().split("T")[0]);
      setVoucherNo(`JAM-${Date.now().toString().slice(-6)}`);
      setGrossStr("");
      setLessStr("0");
      setPurityStr("916");
      setCashAmountStr("");
      setPaymentMode("cash");
      setNarration("");
      setPrintMode(false);
    }
  }, [open, defaultPartyId]);

  const selectedParty = useMemo(() => people.find((p) => p.id === partyId), [people, partyId]);

  // Calculations
  const grossG = Math.max(0, parseFloat(grossStr) || 0);
  const lessG = Math.max(0, parseFloat(lessStr) || 0);
  const netG = Math.max(0, grossG - lessG);
  const purity = parseInt(purityStr, 10) || 916;
  const fineG = (netG * purity) / 995; // Authoritative 995 standard

  const grossMg = Math.round(grossG * 1000);
  const fineMg = Math.round(fineG * 1000);
  const cashPaise = rupeesToPaise(cashAmountStr || "0");

  const canSubmit =
    !!partyId &&
    (fineMg > 0 || cashPaise > 0) &&
    narration.trim().length > 0 &&
    !saving;

  async function handleSaveAndPrint() {
    if (!canSubmit || !selectedParty) return;
    setSaving(true);
    try {
      // 1. Post to Live Ledger
      if (fineMg > 0) {
        await appendLedger({
          type: "customer_gold_received",
          netFineMg: fineMg,
          deltas: { customer: fineMg, vault: fineMg },
          grossMg,
          purity,
          fineMg,
          customerId: selectedParty.id,
          reference: voucherNo,
          notes: `[JAMA SLIP] Received ${netG.toFixed(3)}g net (${purity}‰ touch, ${fineG.toFixed(3)}g fine) from ${selectedParty.fullName}. Narration: ${narration.trim()}`,
        });
      }

      await useLedger.getState().refresh();

      toast.success(
        `Jama Slip ${voucherNo} recorded successfully! Live ledger updated for ${selectedParty.fullName}.`,
      );
      try {
        soundEffects.success();
      } catch {
        /* ignore */
      }

      onSaved?.({
        voucherNo,
        partyName: selectedParty.fullName,
        fineMg,
        cashPaise,
      });

      setPrintMode(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record Jama Slip.");
    } finally {
      setSaving(false);
    }
  }

  function handleTriggerPrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-gold" /> Jama Slip / पावती (Deposit / Advance)
          </DialogTitle>
          <DialogDescription>
            Record gold metal or cash received in advance. Instantly credits customer live ledger and
            generates a signed receipt slip.
          </DialogDescription>
        </DialogHeader>

        {!printMode ? (
          <div className="space-y-4 py-2">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Voucher / Slip No</Label>
                <Input value={voucherNo} readOnly className="mt-1 font-mono text-xs bg-muted" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Date</Label>
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Customer / Party Selection */}
            <div>
              <Label className="text-xs font-semibold">Customer / Party Name *</Label>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select party for Jama…" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName} {p.phone ? `(${p.phone})` : ""} · {p.type.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Metal Deposit Section */}
            <div className="rounded-lg border border-gold/40 bg-gold/5 p-3 space-y-3">
              <div className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Gold Metal Jama (जमा)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Gross (g)</Label>
                  <Input
                    value={grossStr}
                    onChange={(e) => setGrossStr(e.target.value)}
                    placeholder="0.000"
                    inputMode="decimal"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Less (g)</Label>
                  <Input
                    value={lessStr}
                    onChange={(e) => setLessStr(e.target.value)}
                    placeholder="0.000"
                    inputMode="decimal"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Touch / Purity</Label>
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
                  <Label className="text-xs text-gold font-bold">Fine Gold (g)</Label>
                  <div className="mt-1 h-9 rounded-md border border-gold/40 bg-gold/10 flex items-center px-2.5 font-mono font-bold text-foreground text-sm">
                    {fineG.toFixed(3)} g
                  </div>
                </div>
              </div>
            </div>

            {/* Cash Deposit Section */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cash / Bank Jama (Optional)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Amount (₹)</Label>
                  <Input
                    value={cashAmountStr}
                    onChange={(e) => setCashAmountStr(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select
                    value={paymentMode}
                    onValueChange={(v: "cash" | "upi" | "bank") => setPaymentMode(v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash (रोख)</SelectItem>
                      <SelectItem value="upi">UPI / QR</SelectItem>
                      <SelectItem value="bank">Bank / NEFT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Narration */}
            <div>
              <Label className="text-xs font-semibold">
                Narration / तपशील (Required for Ledger Audit) *
              </Label>
              <Textarea
                rows={2}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="e.g. Received advance gold for future necklace order / bridal jewellery booking"
                className="mt-1 text-xs"
              />
            </div>
          </div>
        ) : (
          /* Print & Share Preview */
          <div className="space-y-4 py-2">
            <div
              id="printable-jama-slip"
              className="border border-border p-6 rounded-lg bg-card text-foreground font-sans space-y-4 shadow-sm"
            >
              {/* Slip Header */}
              <div className="text-center border-b border-border pb-3">
                <h2 className="font-serif font-extrabold text-lg text-gold tracking-wide">
                  {firm?.shopName || "MTJ / AVS GOLD JEWELLERS"}
                </h2>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {firm?.address || "Jewellers Market, Swarna Bazzar"}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  GSTIN: {firm?.gstin || "27AAACM1234F1Z5"} · Phone: {firm?.phone || "+91 98765 43210"}
                </div>
                <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-gold/10 text-gold font-bold text-xs uppercase tracking-widest border border-gold/30">
                  JAMA SLIP / अनामत पावती
                </div>
              </div>

              {/* Slip Meta */}
              <div className="flex justify-between text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Slip No: </span>
                  <span className="font-bold">{voucherNo}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-bold">{dateStr}</span>
                </div>
              </div>

              {/* Party Info */}
              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
                <div className="text-muted-foreground">Received From (नावे):</div>
                <div className="font-bold text-sm text-foreground mt-0.5">
                  {selectedParty?.fullName}
                </div>
                {selectedParty?.phone && (
                  <div className="text-muted-foreground mt-0.5">Phone: {selectedParty.phone}</div>
                )}
              </div>

              {/* Metal & Amount Details */}
              <div className="space-y-2 text-xs">
                {fineMg > 0 && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-muted/40 text-[11px] uppercase border-b border-border">
                        <tr>
                          <th className="p-1.5">Gross (g)</th>
                          <th className="p-1.5">Less (g)</th>
                          <th className="p-1.5">Net (g)</th>
                          <th className="p-1.5">Touch</th>
                          <th className="p-1.5 text-right font-bold text-gold">Fine Gold (g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-1.5">{grossG.toFixed(3)}</td>
                          <td className="p-1.5">{lessG.toFixed(3)}</td>
                          <td className="p-1.5 font-bold">{netG.toFixed(3)}</td>
                          <td className="p-1.5">{purity}‰</td>
                          <td className="p-1.5 text-right font-bold text-gold">{fineG.toFixed(3)} g</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {cashPaise > 0 && (
                  <div className="flex justify-between text-xs p-2 border border-border rounded-md font-mono bg-muted/10">
                    <span className="text-muted-foreground font-sans">Cash / Amount Received ({paymentMode.toUpperCase()}):</span>
                    <span className="font-bold">₹ {paiseToRupees(cashPaise)}</span>
                  </div>
                )}
              </div>

              {/* Narration */}
              <div className="text-xs bg-muted/10 border border-border/40 p-2 rounded">
                <span className="font-semibold text-muted-foreground">Narration / तपशील: </span>
                <span>{narration}</span>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between text-xs text-muted-foreground text-center">
                <div className="border-t border-border pt-1 w-32">
                  Customer Signature
                </div>
                <div className="border-t border-border pt-1 w-32 font-bold text-foreground">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!printMode ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveAndPrint}
                disabled={!canSubmit}
                className="gap-2 bg-gold hover:bg-gold/90 text-white font-bold"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? "Posting to Ledger…" : "Save & Generate Jama Slip"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
              <Button onClick={handleTriggerPrint} className="gap-2 bg-gold text-white font-bold">
                <Printer className="h-4 w-4" /> Print Jama Slip
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
