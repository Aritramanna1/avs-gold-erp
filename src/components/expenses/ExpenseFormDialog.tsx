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
import { useExpensesStore, type ExpenseRecord } from "@/lib/expenses-store";
import { useSettings } from "@/lib/settings-store";
import { hapticLight } from "@/lib/native/haptics";
import { isNativeApp } from "@/lib/native/platform";
import { isOnline } from "@/lib/native/network";
import { captureExpenseCreate, captureEntityPhotoOffline } from "@/lib/offline";
import { uploadFileToSupabase, getBucketForEntityType } from "@/lib/supabase-storage";
import { cn } from "@/lib/utils";

/**
 * Canonical expense create/edit — same ExpenseRecord fields on desktop and mobile.
 */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ExpenseRecord | null;
}) {
  const updateExpense = useExpensesStore((s) => s.updateExpense);
  const people = useExpensesStore((s) => s.people);
  const branchId = useSettings((s) => s.selectedBranchId);
  const [date, setDate] = useState(
    () => initial?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [type, setType] = useState<ExpenseRecord["type"]>(initial?.type ?? "business");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [amountRupees, setAmountRupees] = useState(
    initial ? String(initial.amountPaise / 100) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paymentMode, setPaymentMode] = useState<ExpenseRecord["paymentMode"]>(
    initial?.paymentMode ?? "cash",
  );
  const [personId, setPersonId] = useState(initial?.personId ?? "");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mobile =
    isNativeApp() ||
    (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);

  function reset() {
    setDate(new Date().toISOString().slice(0, 10));
    setType("business");
    setCategory("");
    setAmountRupees("");
    setNotes("");
    setPaymentMode("cash");
    setPersonId("");
    setReceiptFile(null);
    setError("");
  }

  async function attachReceipt(expenseId: string, file: File) {
    if (!isOnline()) {
      const local = expenseId.startsWith("local:") ? expenseId.slice(6) : expenseId;
      await captureEntityPhotoOffline({
        entityType: "expense",
        entityId: expenseId.startsWith("local:") ? expenseId : `local:${expenseId}`,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        bytes: await file.arrayBuffer(),
        dependsOnLocalIds: [local],
        docKey: "receipt",
      });
      return;
    }
    await uploadFileToSupabase(
      getBucketForEntityType("expense"),
      file,
      expenseId,
      "receipt",
    );
  }

  async function save() {
    setError("");
    const cat = category.trim();
    const rupees = Number(amountRupees);
    if (!cat) {
      setError("Enter a category.");
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!branchId) {
      setError("Select a branch first.");
      return;
    }
    if (!date) {
      setError("Enter a date.");
      return;
    }
    setSaving(true);
    try {
      const input: Omit<ExpenseRecord, "id"> = {
        date,
        type,
        category: cat,
        amountPaise: Math.round(rupees * 100),
        paymentMode,
        notes: notes.trim() || undefined,
        personId: personId || undefined,
        branchId,
      };

      if (initial) {
        await updateExpense(initial.id, input);
        if (receiptFile) await attachReceipt(initial.id, receiptFile);
        void hapticLight();
        toast.success("Expense updated");
        onOpenChange(false);
        return;
      }

      const queued = await captureExpenseCreate(input);
      if (queued.mode === "queued") {
        if (receiptFile) {
          await attachReceipt(queued.operation.localId, receiptFile);
        }
        void hapticLight();
        toast.message("Expense saved offline — Pending Sync");
        reset();
        onOpenChange(false);
        return;
      }

      const expense = queued.result as ExpenseRecord;
      if (receiptFile) await attachReceipt(expense.id, receiptFile);
      void hapticLight();
      toast.success("Expense saved");
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "max-w-lg overflow-y-auto",
          mobile
            ? "w-[100vw] max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 p-4 pt-[max(1rem,var(--ornexa-inset-top))] pb-[max(1rem,var(--ornexa-inset-bottom))]"
            : "max-h-[90vh]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">
            {initial ? "Edit expense" : "New expense"}
          </DialogTitle>
          <DialogDescription>
            Same fields as the expense register — type, date, category, amount, payment, person,
            notes, and optional receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[var(--touch-target)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select
              className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as ExpenseRecord["type"])}
            >
              <option value="business">Business</option>
              <option value="personal">Personal</option>
              <option value="investment">Investment</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-cat">Category *</Label>
            <Input
              id="exp-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-[var(--touch-target)]"
              placeholder="e.g. Rent, Tools, Fuel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-amt">Amount (₹) *</Label>
            <Input
              id="exp-amt"
              inputMode="decimal"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              className="min-h-[var(--touch-target)] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment mode</Label>
            <select
              className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as ExpenseRecord["paymentMode"])}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked person (optional)</Label>
            <select
              className="min-h-[var(--touch-target)] w-full rounded-md border border-input bg-background px-3 text-sm"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">— None —</option>
              {people
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                    {p.role ? ` (${p.role})` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Narration</Label>
            <Input
              id="exp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[var(--touch-target)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-receipt">Receipt (optional)</Label>
            <Input
              id="exp-receipt"
              type="file"
              accept="image/*,application/pdf"
              className="min-h-[var(--touch-target)]"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            {receiptFile ? (
              <p className="text-xs text-muted-foreground">{receiptFile.name}</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex gap-2 border-t border-border pt-3 sticky bottom-0 bg-background">
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-[var(--touch-target)]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-[1.4] min-h-[var(--touch-target)] bg-gold text-black hover:bg-gold/90 font-semibold"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
