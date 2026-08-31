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
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";

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
  const [amountRupees, setAmountRupees] = useState(
    initial ? String(initial.amountPaise / 100) : "",
  );
  const [paymentMode, setPaymentMode] = useState<FamilyWithdrawal["paymentMode"]>(
    initial?.paymentMode ?? "cash",
  );
  const [purpose, setPurpose] = useState(initial?.purpose ?? initial?.reason ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const numRupees = parseFloat(amountRupees) || 0;
  const numPaise = rupeesToPaise(numRupees);
  const goldEquivMg = goldRatePaise > 0 ? Math.round((numPaise / goldRatePaise) * 1000) : 0;

  async function handleSave() {
    setError("");
    if (!personId) {
      setError("Please select a family member or owner beneficiary.");
      return;
    }
    if (numRupees <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }

    setSaving(true);
    try {
      if (initial) {
        await updateWithdrawal(initial.id, {
          date,
          personId,
          amountPaise: numPaise,
          paymentMode,
          purpose,
          notes,
          goldEquivalentMg: goldEquivMg,
          goldRatePerGramPaise: goldRatePaise,
        });
        toast.success("Owner drawing updated successfully.");
      } else {
        await addWithdrawal({
          date,
          personId,
          amountPaise: numPaise,
          paymentMode,
          purpose,
          notes,
          branchId: selectedBranchId || "MAIN",
          goldEquivalentMg: goldEquivMg,
          goldRatePerGramPaise: goldRatePaise,
        });
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
            Personal and family drawings are accounted against Owner Equity. They do NOT reduce operating profit.
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

          <div className="space-y-1">
            <Label className="text-xs">Amount (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 10000"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
            />
          </div>

          {numRupees > 0 && (
            <div className="p-2.5 rounded bg-muted/40 border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gold Equivalent:</span>
                <span className="font-mono font-bold text-gold">{mgToGrams(goldEquivMg)} g Pure Gold</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Transaction Rate:</span>
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
