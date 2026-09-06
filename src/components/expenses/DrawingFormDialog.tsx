import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpensesStore, RELATIONSHIP_LABELS, type FamilyWithdrawal } from "@/lib/expenses-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { useLedger } from "@/lib/ledger-store";

export function DrawingFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: FamilyWithdrawal | null;
}) {
  const people = useExpensesStore((s) => s.people);
  const addWithdrawal = useExpensesStore((s) => s.addWithdrawal);
  const updateWithdrawal = useExpensesStore((s) => s.updateWithdrawal);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const goldRatePaise = getCurrentGoldRatePaise() || 750000;

  const [date, setDate] = useState(() => initial?.date ?? new Date().toISOString().slice(0, 10));
  const [personId, setPersonId] = useState(initial?.personId ?? (people[0]?.id || ""));
  const [drawingType, setDrawingType] = useState<"cash" | "gold" | "mixed">(
    initial?.drawingType ?? "cash",
  );
  const [amountRupees, setAmountRupees] = useState(
    initial ? String((initial.cashAmountPaise ?? initial.amountPaise) / 100) : "",
  );
  const [goldGrossGrams, setGoldGrossGrams] = useState(
    initial?.goldGrossWeightMg ? String(mgToGrams(initial.goldGrossWeightMg)) : "",
  );
  const [goldPurity, setGoldPurity] = useState(String(initial?.goldPurity || 999));
  const [paymentMode, setPaymentMode] = useState<FamilyWithdrawal["paymentMode"]>(
    initial?.paymentMode ?? "cash",
  );
  const [purpose, setPurpose] = useState(initial?.purpose ?? initial?.reason ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const numRupees = parseFloat(amountRupees) || 0;
  const numCashPaise = rupeesToPaise(numRupees);

  const numGoldGrossGrams = parseFloat(goldGrossGrams) || 0;
  const numPurity = parseFloat(goldPurity) || 999;
  const goldGrossMg = gramsToMg(numGoldGrossGrams);
  const goldFineMg = Math.round(goldGrossMg * (numPurity / 1000));
  const goldValuePaise = Math.round((goldFineMg * goldRatePaise) / 1000);

  // Total drawing value in paise
  const totalAmountPaise =
    drawingType === "cash"
      ? numCashPaise
      : drawingType === "gold"
      ? goldValuePaise
      : numCashPaise + goldValuePaise;

  const totalGoldEquivMg =
    drawingType === "cash"
      ? (goldRatePaise > 0 ? Math.round((numCashPaise / goldRatePaise) * 1000) : 0)
      : drawingType === "gold"
      ? goldFineMg
      : goldFineMg + (goldRatePaise > 0 ? Math.round((numCashPaise / goldRatePaise) * 1000) : 0);

  async function handleSave() {
    setError("");
    if (!personId) {
      setError("Please select a family member or owner beneficiary.");
      return;
    }

    if (drawingType === "cash" && numRupees <= 0) {
      setError("Please enter a valid cash withdrawal amount.");
      return;
    }
    if (drawingType === "gold" && numGoldGrossGrams <= 0) {
      setError("Please enter a valid gold withdrawal weight.");
      return;
    }
    if (drawingType === "mixed" && numRupees <= 0 && numGoldGrossGrams <= 0) {
      setError("Please enter cash and/or gold amounts for mixed drawing.");
      return;
    }

    setSaving(true);
    try {
      const person = people.find((p) => p.id === personId);
      const personName = person?.fullName || "Owner";

      if (initial) {
        await updateWithdrawal(initial.id, {
          date,
          personId,
          personName,
          relationship: person?.relationship,
          drawingType,
          amountPaise: totalAmountPaise,
          cashAmountPaise: drawingType !== "gold" ? numCashPaise : 0,
          goldGrossWeightMg: drawingType !== "cash" ? goldGrossMg : 0,
          goldPurity: drawingType !== "cash" ? numPurity : undefined,
          goldFineWeightMg: drawingType !== "cash" ? goldFineMg : 0,
          paymentMode,
          purpose,
          notes,
          goldEquivalentMg: totalGoldEquivMg,
          goldRatePerGramPaise: goldRatePaise,
        });
        toast.success("Owner drawing updated successfully.");
      } else {
        await addWithdrawal({
          date,
          personId,
          personName,
          relationship: person?.relationship,
          drawingType,
          amountPaise: totalAmountPaise,
          cashAmountPaise: drawingType !== "gold" ? numCashPaise : 0,
          goldGrossWeightMg: drawingType !== "cash" ? goldGrossMg : 0,
          goldPurity: drawingType !== "cash" ? numPurity : undefined,
          goldFineWeightMg: drawingType !== "cash" ? goldFineMg : 0,
          paymentMode,
          purpose,
          notes,
          branchId: selectedBranchId || "MAIN",
          goldEquivalentMg: totalGoldEquivMg,
          goldRatePerGramPaise: goldRatePaise,
        });

        // If physical gold was drawn, relief the vault in the Gold Ledger
        if (drawingType !== "cash" && goldFineMg > 0) {
          try {
            await useLedger.getState().append({
              type: "adjustment",
              grossMg: -goldGrossMg,
              purity: numPurity,
              fineMg: -goldFineMg,
              deltas: { vault: -goldFineMg },
              reference: `DRAWING-${personName}`,
              notes: `Owner physical gold drawing: ${mgToGrams(goldGrossMg)}g @ ${numPurity} touch for ${personName}`,
            });
          } catch {
            /* best-effort ledger linking */
          }
        }

        toast.success("Owner drawing recorded (accounted under Owner Equity).");
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record drawing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gold font-serif text-lg">
            {initial ? "Edit Owner Drawing" : "Record Owner / Personal Drawing"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Personal and family drawings (Cash, Gold, or Mixed) are accounted against Owner Equity. They do NOT reduce operating profit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Drawing Asset Type</Label>
              <Select value={drawingType} onValueChange={(v: any) => setDrawingType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash / Bank</SelectItem>
                  <SelectItem value="gold">Physical / Fine Gold</SelectItem>
                  <SelectItem value="mixed">Mixed (Cash + Gold)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Beneficiary / Family Member</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Member" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName} ({RELATIONSHIP_LABELS[p.relationship] || p.relationship})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cash Input */}
          {drawingType !== "gold" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cash Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10000"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Source</Label>
                <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Company Cash</SelectItem>
                    <SelectItem value="upi">UPI / Online</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Gold Input */}
          {drawingType !== "cash" && (
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/20 border border-border/60">
              <div className="space-y-1">
                <Label className="text-xs">Gold Gross Wt (g)</Label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="e.g. 10.500"
                  value={goldGrossGrams}
                  onChange={(e) => setGoldGrossGrams(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purity / Touch</Label>
                <Input
                  type="number"
                  placeholder="e.g. 999 or 916"
                  value={goldPurity}
                  onChange={(e) => setGoldPurity(e.target.value)}
                />
              </div>
              {numGoldGrossGrams > 0 && (
                <div className="col-span-2 text-[11px] text-muted-foreground flex justify-between pt-1">
                  <span>Fine Gold: <strong className="text-gold font-mono">{mgToGrams(goldFineMg)} g</strong></span>
                  <span>Gold Value: <strong className="font-mono">₹{paiseToRupees(goldValuePaise)}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Combined Valuation Preview */}
          {totalAmountPaise > 0 && (
            <div className="p-2.5 rounded bg-muted/40 border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Drawing Value:</span>
                <span className="font-mono font-bold text-foreground">₹{paiseToRupees(totalAmountPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Pure Gold Equivalent:</span>
                <span className="font-mono font-bold text-gold">{mgToGrams(totalGoldEquivMg)} g Pure Gold</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Current Gold Rate:</span>
                <span className="font-mono">₹{paiseToRupees(goldRatePaise)}/g</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Purpose / Narration</Label>
            <Input
              placeholder="e.g. Home expenses, grocery, medical, personal withdrawal"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (Optional)</Label>
            <Input
              placeholder="Additional audit notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gold text-black hover:bg-gold/90">
              {saving ? "Saving…" : "Save Drawing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
