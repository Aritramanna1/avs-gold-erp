import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useMaterialVault,
  computeMaterialBalances,
  MATERIAL_GROUP_LABELS,
  MATERIAL_MOVEMENT_LABELS,
  DEFAULT_MATERIAL_CATEGORIES,
  type MaterialGroup,
} from "@/lib/material-vault-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, Wrench, Recycle, Settings2 } from "lucide-react";

const GROUP_ICONS: Record<MaterialGroup, typeof Coins> = {
  gold: Coins,
  manufacturing_materials: Wrench,
  recovery: Recycle,
};

/**
 * Gold & Material Vault panel — grouped balances (Gold / Manufacturing
 * Materials / Recovery), the Material Conversion transaction, an authorized
 * Adjustment entry (the only manual-edit path), and full transaction
 * history. Every balance shown here is derived from material-vault-store.ts's
 * movement log — nothing here writes a balance directly.
 */
export function MaterialVaultPanel() {
  const movements = useMaterialVault((s) => s.movements);
  const categories = useMaterialVault((s) => s.categories);
  const refresh = useMaterialVault((s) => s.refresh);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const balances = useMemo(
    () => computeMaterialBalances(movements, categories),
    [movements, categories],
  );

  const sortedMovements = useMemo(() => [...movements].sort((a, b) => b.ts - a.ts), [movements]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 no-print">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setAdjustmentOpen(true)}
          data-testid="material-adjustment-open"
        >
          <Settings2 className="h-4 w-4" /> Authorized Adjustment
        </Button>
      </div>

      <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
        <div className="text-xs uppercase tracking-wider text-gold font-semibold">
          Grand Total (all materials)
        </div>
        <div className="font-serif text-3xl text-gold mt-1">
          {mgToGrams(balances.grandTotalMg)} <span className="text-sm">g</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(MATERIAL_GROUP_LABELS) as MaterialGroup[]).map((group) => {
          const Icon = GROUP_ICONS[group];
          const cats = balances.byGroup[group];
          return (
            <div key={group} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gold" />
                  <h3 className="font-serif text-lg text-gold">{MATERIAL_GROUP_LABELS[group]}</h3>
                </div>
                <div className="font-mono text-sm text-gold">
                  {mgToGrams(balances.groupTotals[group])} g
                </div>
              </div>
              <div className="space-y-1.5">
                {cats.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No categories yet.</p>
                ) : (
                  cats.map((c) => (
                    <div
                      key={c.category}
                      className="flex items-center justify-between text-sm rounded-lg border border-border bg-background/40 px-3 py-1.5"
                    >
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-mono">{mgToGrams(c.balanceMg)} g</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-serif text-lg text-gold mb-3">Transaction History</h3>
        {sortedMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No material vault transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="material-vault-history">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Reference</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Balance After</th>
                  <th className="text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {sortedMovements.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(m.ts).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[11px] text-gold">
                        {MATERIAL_MOVEMENT_LABELS[m.type]}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">{m.category}</td>
                    <td className="text-xs text-muted-foreground">{m.reference ?? "—"}</td>
                    <td
                      className={`text-right font-mono ${m.deltaMg < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {m.deltaMg > 0 ? "+" : ""}
                      {mgToGrams(m.deltaMg)} g
                    </td>
                    <td className="text-right font-mono">{mgToGrams(m.balanceAfterMg)} g</td>
                    <td className="text-xs text-muted-foreground">
                      {m.remarks ?? "—"}
                      {m.conversionLossMg != null && (
                        <span className="block text-[10px] text-amber-600">
                          Loss: {mgToGrams(m.conversionLossMg)} g
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MaterialAdjustmentDialog open={adjustmentOpen} onClose={() => setAdjustmentOpen(false)} />
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder="Select category…" />
      </SelectTrigger>
      <SelectContent>
        {DEFAULT_MATERIAL_CATEGORIES.map((c) => (
          <SelectItem key={c.key} value={c.key}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MaterialAdjustmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const recordAdjustment = useMaterialVault((s) => s.recordAdjustment);
  const [category, setCategory] = useState("raw_gold");
  const [deltaG, setDeltaG] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("raw_gold");
      setDeltaG("");
      setReason("");
      setError(null);
      setConfirmOpen(false);
    }
  }, [open]);

  function requestSubmit() {
    setError(null);
    const n = Number(deltaG);
    if (!Number.isFinite(n) || n === 0) return setError("Enter a non-zero adjustment amount.");
    if (!reason.trim()) return setError("A reason is required for every adjustment.");
    setConfirmOpen(true);
  }

  async function submit() {
    setConfirmOpen(false);
    setError(null);
    const n = Number(deltaG);
    if (!Number.isFinite(n) || n === 0) return setError("Enter a non-zero adjustment amount.");
    if (!reason.trim()) return setError("A reason is required for every adjustment.");
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      await recordAdjustment({
        category,
        deltaMg: gramsToMg(Math.abs(n)) * (n < 0 ? -1 : 1),
        remarks: reason.trim(),
        actor: { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null },
      });
      toast.success("Adjustment recorded.");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record adjustment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gold" /> Authorized Adjustment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Category *</Label>
            <CategorySelect value={category} onChange={setCategory} />
          </div>
          <div>
            <Label>Adjustment (g) — negative to reduce *</Label>
            <Input
              value={deltaG}
              onChange={(e) => setDeltaG(e.target.value)}
              placeholder="e.g. -0.500 or 2.000"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Reason *</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required — physical stock count correction, etc."
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={requestSubmit}
            disabled={saving}
            className="gap-2"
            data-testid="adjustment-submit"
          >
            <Settings2 className="h-4 w-4" /> {saving ? "Saving…" : "Record Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm manual adjustment</AlertDialogTitle>
            <AlertDialogDescription>
              This will {Number(deltaG) < 0 ? "reduce" : "increase"} the{" "}
              {DEFAULT_MATERIAL_CATEGORIES.find((c) => c.key === category)?.label ?? category}{" "}
              balance by {Math.abs(Number(deltaG) || 0).toFixed(3)} g. This action is audited and
              cannot be silently undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit} data-testid="adjustment-confirm">
              Confirm Adjustment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
