import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import { useBilling } from "@/lib/billing-store";
import {
  useCustomerPaymentAllocation,
  previewPaymentAllocation,
  type CustomerPaymentReceipt,
} from "@/lib/customer-payment-allocation";
import { mgToGrams, COMMON_PURITIES } from "@/lib/gold";
import { rupeesToPaise, paiseToRupees } from "@/lib/orders-store";
import { Receipt, Printer, CheckCircle2, FileText, Send, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { soundEffects } from "@/lib/sound-effects";
import { toast } from "sonner";
import { waMobileUrl } from "@/lib/wa-link";

export interface JamaSlipDialogProps {
  open: boolean;
  onClose: () => void;
  defaultPartyId?: string;
  onSaved?: (receipt: CustomerPaymentReceipt) => void;
}

export function JamaSlipDialog({
  open,
  onClose,
  defaultPartyId,
  onSaved,
}: JamaSlipDialogProps) {
  const people = usePeople((s) => s.people);
  const firm = useSettings((s) => s.firm);
  const invoices = useBilling((s) => s.invoices);
  const receiveAndAllocate = useCustomerPaymentAllocation((s) => s.receiveCustomerPaymentAndAllocate);

  const [partyId, setPartyId] = useState(defaultPartyId ?? "");
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0]);
  const [voucherNo, setVoucherNo] = useState(`JAM-${Date.now().toString().slice(-6)}`);

  // Gold deposit inputs
  const [grossStr, setGrossStr] = useState("");
  const [lessStr, setLessStr] = useState("0");
  const [purityStr, setPurityStr] = useState("995");

  // Cash deposit inputs
  const [cashAmountStr, setCashAmountStr] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank">("cash");

  // Narration (optional)
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<CustomerPaymentReceipt | null>(null);

  useEffect(() => {
    if (open) {
      setPartyId(defaultPartyId ?? "");
      setDateStr(new Date().toISOString().split("T")[0]);
      setVoucherNo(`JAM-${Date.now().toString().slice(-6)}`);
      setGrossStr("");
      setLessStr("0");
      setPurityStr("995");
      setCashAmountStr("");
      setPaymentMode("cash");
      setNarration("");
      setPrintMode(false);
      setSavedReceipt(null);
    }
  }, [open, defaultPartyId]);

  const selectedParty = useMemo(() => people.find((p) => p.id === partyId), [people, partyId]);

  // Calculations
  const grossG = Math.max(0, parseFloat(grossStr) || 0);
  const lessG = Math.max(0, parseFloat(lessStr) || 0);
  const netG = Math.max(0, grossG - lessG);
  const purity = parseInt(purityStr, 10) || 995;
  const fineG = (netG * purity) / 995; // Authoritative 995 standard

  const fineMg = Math.round(fineG * 1000);
  const cashPaise = rupeesToPaise(cashAmountStr || "0");

  // Live Allocation Preview
  const allocationPreview = useMemo(() => {
    if (!partyId || (fineMg === 0 && cashPaise === 0)) return null;
    return previewPaymentAllocation({
      customerId: partyId,
      customerName: selectedParty?.fullName || "",
      invoices,
      goldReceivedMg: fineMg,
      cashReceivedPaise: cashPaise,
      mode: fineMg > 0 && cashPaise > 0 ? "mixed" : fineMg > 0 ? "gold" : "cash",
      strategy: "fifo",
    });
  }, [partyId, selectedParty, invoices, fineMg, cashPaise]);

  const canSubmit =
    !!partyId &&
    (fineMg > 0 || cashPaise > 0) &&
    !saving;

  async function handleSaveAndPrint() {
    if (!canSubmit || !selectedParty) return;
    setSaving(true);
    try {
      const mode = fineMg > 0 && cashPaise > 0 ? "mixed" : fineMg > 0 ? "gold" : "cash";

      const receipt = await receiveAndAllocate({
        customerId: selectedParty.id,
        customerName: selectedParty.fullName,
        customerPhone: selectedParty.phone,
        goldReceivedMg: fineMg,
        cashReceivedPaise: cashPaise,
        mode,
        strategy: "fifo",
        notes: narration.trim() || undefined,
      });

      await useLedger.getState().refresh();
      await useBilling.getState().refresh();

      setSavedReceipt(receipt);

      const clearedCount = receipt.allocations.filter((a) => a.statusAfter === "paid").length;
      toast.success(
        `Jama Receipt ${receipt.receiptNo} recorded! ` +
          (clearedCount > 0
            ? `${clearedCount} invoice(s) marked PAID.`
            : `Gold credited to ${selectedParty.fullName}.`),
      );

      try {
        soundEffects.success();
      } catch {
        /* ignore */
      }

      onSaved?.(receipt);
      setPrintMode(true);
    } catch (err: any) {
      console.error("Failed to record Jama Slip:", err);
      toast.error(err?.message || "Failed to record Jama Slip.");
    } finally {
      setSaving(false);
    }
  }

  function handleTriggerPrint() {
    window.print();
  }

  function handleShareWhatsApp() {
    if (!selectedParty?.phone) {
      toast.error("Customer phone number is missing.");
      return;
    }

    const lines = [
      `*JAMA RECEIPT / अनामत पावती*`,
      `*${firm?.shopName || "AVS JEWELLERS"}*`,
      `Slip No: ${savedReceipt?.receiptNo || voucherNo}`,
      `Date: ${dateStr}`,
      `Customer: ${selectedParty.fullName}`,
      ``,
    ];

    if (fineMg > 0) {
      lines.push(`*Gold Metal Received:*`);
      lines.push(`• Gross: ${grossG.toFixed(3)}g | Less: ${lessG.toFixed(3)}g`);
      lines.push(`• Net: ${netG.toFixed(3)}g @ ${purity}‰ Touch`);
      lines.push(`• *995 Fine Gold: ${fineG.toFixed(3)}g*`);
      lines.push(``);
    }

    if (cashPaise > 0) {
      lines.push(`*Amount Received:* ₹${paiseToRupees(cashPaise)} (${paymentMode.toUpperCase()})`);
      lines.push(``);
    }

    if (savedReceipt && savedReceipt.allocations.length > 0) {
      lines.push(`*Invoices Adjusted / Cleared:*`);
      for (const a of savedReceipt.allocations) {
        lines.push(`• ${a.invoiceNo}: ${a.appliedGoldMg > 0 ? `${mgToGrams(a.appliedGoldMg)}g Fine` : ""} ${a.appliedCashPaise > 0 ? `₹${paiseToRupees(a.appliedCashPaise)}` : ""} → [${a.statusAfter.toUpperCase()}]`);
      }
      lines.push(``);
    }

    if (savedReceipt && savedReceipt.goldUnappliedMg > 0) {
      lines.push(`*Advance Ledger Credit:* +${mgToGrams(savedReceipt.goldUnappliedMg)}g Fine Gold`);
      lines.push(``);
    }

    if (narration.trim()) {
      lines.push(`Note: ${narration.trim()}`);
      lines.push(``);
    }

    lines.push(`Thank you for your trust!`);

    const text = lines.join("\n");
    const url = waMobileUrl(selectedParty.phone, text);
    window.open(url, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-gold" /> Standalone Jama Receipt / अनामत पावती
          </DialogTitle>
          <DialogDescription>
            Record pure gold metal or cash received from customer. Instantly credits customer live ledger,
            auto-allocates FIFO against outstanding unpaid invoices, and issues an authoritative receipt.
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
            <div className="rounded-lg border border-gold/40 bg-gold/5 p-3.5 space-y-3">
              <div className="text-xs font-bold text-gold uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Gold Metal Jama (जमा)
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">995 Standard Basis</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                    <SelectTrigger className="mt-1 font-mono text-xs">
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
                  <Label className="text-xs text-gold font-bold">Fine Gold (995)</Label>
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

            {/* Live FIFO Allocation Preview */}
            {allocationPreview && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Auto-Clearance Preview (FIFO)
                  </span>
                  <span>
                    {allocationPreview.clearedInvoiceCount} fully cleared ·{" "}
                    {allocationPreview.partiallyClearedInvoiceCount} partial
                  </span>
                </div>

                {allocationPreview.items.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {allocationPreview.items.map((it) => (
                      <div
                        key={it.invoice.id}
                        className="flex items-center justify-between p-2 rounded bg-background/80 border border-border/50 text-[11px] font-mono"
                      >
                        <div>
                          <span className="font-bold text-foreground">{it.invoice.invoiceNo}</span>
                          <span className="text-muted-foreground ml-2">
                            Due: {mgToGrams(it.dueGoldMg)}g Fine
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">
                            -{mgToGrams(it.appliedGoldMg)}g
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge
                            variant={it.nextStatus === "paid" ? "default" : "secondary"}
                            className="text-[10px] uppercase font-bold"
                          >
                            {it.nextStatus === "paid" ? "PAID" : "PARTIAL"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-[11px] py-1">
                    No outstanding invoices. Entire deposit will be credited as Advance Balance to the customer ledger.
                  </div>
                )}

                {allocationPreview.unappliedGoldMg > 0 && (
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                    <span>Remaining Advance to Customer Ledger:</span>
                    <span>+{mgToGrams(allocationPreview.unappliedGoldMg)} g Fine Gold</span>
                  </div>
                )}
              </div>
            )}

            {/* Narration (Optional) */}
            <div>
              <Label className="text-xs font-semibold">
                Narration / तपशील (Optional)
              </Label>
              <Textarea
                rows={2}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="e.g. Received 20g 995 gold for bill clearance and advance credit"
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
                  {firm?.shopName || "AVS GOLD JEWELLERS"}
                </h2>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {firm?.address || "Swarna Bazzar, Jewellers Market"}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  GSTIN: {firm?.gstin || "27AAACM1234F1Z5"} · Phone: {firm?.phone || "+91 98765 43210"}
                </div>
                <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-gold/10 text-gold font-bold text-xs uppercase tracking-widest border border-gold/30">
                  JAMA SLIP / अनामत पावती (OFFICIAL RECEIPT)
                </div>
              </div>

              {/* Slip Meta */}
              <div className="flex justify-between text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Receipt No: </span>
                  <span className="font-bold">{savedReceipt?.receiptNo || voucherNo}</span>
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
                  <div className="text-muted-foreground mt-0.5 font-mono">Phone: {selectedParty.phone}</div>
                )}
              </div>

              {/* Metal & Amount Details */}
              <div className="space-y-2 text-xs">
                {fineMg > 0 && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-muted/40 text-[11px] uppercase border-b border-border">
                        <tr>
                          <th className="p-2">Gross (g)</th>
                          <th className="p-2">Less (g)</th>
                          <th className="p-2">Net (g)</th>
                          <th className="p-2">Touch</th>
                          <th className="p-2 text-right font-bold text-gold">Fine Gold (995)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2">{grossG.toFixed(3)}</td>
                          <td className="p-2">{lessG.toFixed(3)}</td>
                          <td className="p-2 font-bold">{netG.toFixed(3)}</td>
                          <td className="p-2">{purity}‰</td>
                          <td className="p-2 text-right font-bold text-gold">{fineG.toFixed(3)} g</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {cashPaise > 0 && (
                  <div className="flex justify-between text-xs p-2.5 border border-border rounded-md font-mono bg-muted/10">
                    <span className="text-muted-foreground font-sans">Cash / Amount Received ({paymentMode.toUpperCase()}):</span>
                    <span className="font-bold text-foreground">₹ {paiseToRupees(cashPaise)}</span>
                  </div>
                )}
              </div>

              {/* Invoices Allocated / Cleared */}
              {savedReceipt && savedReceipt.allocations.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Invoice Settlement Details:
                  </div>
                  <div className="border border-border rounded-md overflow-hidden font-mono text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 uppercase text-[10px] border-b border-border">
                        <tr>
                          <th className="p-1.5">Invoice No</th>
                          <th className="p-1.5 text-right">Original Due</th>
                          <th className="p-1.5 text-right text-emerald-600">Applied Gold</th>
                          <th className="p-1.5 text-right">Remaining Due</th>
                          <th className="p-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedReceipt.allocations.map((a) => (
                          <tr key={a.id} className="border-b border-border/40 last:border-none">
                            <td className="p-1.5 font-bold">{a.invoiceNo}</td>
                            <td className="p-1.5 text-right">{a.previousBalanceGoldMg > 0 ? `${mgToGrams(a.previousBalanceGoldMg)} g` : a.previousBalanceCashPaise > 0 ? `₹${paiseToRupees(a.previousBalanceCashPaise)}` : "—"}</td>
                            <td className="p-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {a.appliedGoldMg > 0 ? `${mgToGrams(a.appliedGoldMg)} g` : "—"}
                              {a.appliedCashPaise > 0 ? ` (₹${paiseToRupees(a.appliedCashPaise)})` : ""}
                            </td>
                            <td className="p-1.5 text-right">{a.remainingBalanceGoldMg > 0 ? `${mgToGrams(a.remainingBalanceGoldMg)} g` : a.remainingBalanceCashPaise > 0 ? `₹${paiseToRupees(a.remainingBalanceCashPaise)}` : "0.000 g"}</td>
                            <td className="p-1.5 text-center">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                                {a.statusAfter.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Settlement Summary Reconciliation Block */}
              {savedReceipt && (
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Total Gold Received:</span>
                    <span className="font-bold">{mgToGrams(savedReceipt.goldReceivedMg)} g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Total Gold Applied:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">-{mgToGrams(savedReceipt.goldAllocatedMg)} g</span>
                  </div>
                  <div className="border-t border-border/60 pt-1 flex justify-between font-bold">
                    <span className="font-sans">Excess Gold / Ledger Credit:</span>
                    <span className="text-gold">+{mgToGrams(savedReceipt.goldUnappliedMg)} g</span>
                  </div>
                  {savedReceipt.goldUnappliedMg > 0 && (
                    <div className="mt-1 p-1.5 rounded bg-gold/10 border border-gold/30 text-gold text-[11px] font-bold text-center uppercase tracking-wide">
                      EXCESS GOLD CREDITED TO CUSTOMER LEDGER = {mgToGrams(savedReceipt.goldUnappliedMg)} g
                    </div>
                  )}
                  {savedReceipt.remainingOutstandingGoldMg > 0 && (
                    <div className="flex justify-between text-muted-foreground pt-0.5">
                      <span className="font-sans">Remaining Customer Outstanding:</span>
                      <span>{mgToGrams(savedReceipt.remainingOutstandingGoldMg)} g</span>
                    </div>
                  )}
                </div>
              )}

              {/* Narration */}
              {narration.trim() && (
                <div className="text-xs bg-muted/10 border border-border/40 p-2 rounded">
                  <span className="font-semibold text-muted-foreground">Narration: </span>
                  <span>{narration.trim()}</span>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-6 flex justify-between text-xs text-muted-foreground text-center">
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
                {saving ? "Posting to Ledger…" : "Save & Clear Invoices"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
              {selectedParty?.phone && (
                <Button
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <Send className="h-4 w-4" /> Share on WhatsApp
                </Button>
              )}
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

