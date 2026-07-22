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
  computeMaterialStockItems,
  MATERIAL_GROUP_LABELS,
  MATERIAL_MOVEMENT_LABELS,
  DEFAULT_MATERIAL_CATEGORIES,
  materialKeyFromName,
  type MaterialGroup,
} from "@/lib/material-vault-store";
import { mgToGrams, gramsToMg, getCaratLabel, COMMON_PURITIES } from "@/lib/gold";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";
import { Coins, Wrench, Recycle, Settings2 } from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { useLedger } from "@/lib/ledger-store";
import { executeGoldTransaction } from "@/lib/gold-transaction-service";

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
  const [stockOpen, setStockOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const balances = useMemo(
    () => computeMaterialBalances(movements, categories),
    [movements, categories],
  );

  const sortedMovements = useMemo(() => [...movements].sort((a, b) => b.ts - a.ts), [movements]);
  const stockItems = useMemo(
    () => computeMaterialStockItems(movements, categories),
    [movements, categories],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 no-print">
        <Button
          className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
          onClick={() => setStockOpen(true)}
          data-testid="material-stock-open"
        >
          <Wrench className="h-4 w-4" /> Add / Manage Stock
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setManageOpen(true)}
          data-testid="material-manage-open"
        >
          <Settings2 className="h-4 w-4" /> Manage Materials
        </Button>
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
        <h3 className="font-serif text-lg text-gold mb-3">
          Stock Items (by material &amp; purity)
        </h3>
        {stockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No material stock yet. Use “Add / Manage Stock” to record material in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Material</th>
                  <th className="text-left">Purity</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Fine Equivalent</th>
                  <th className="text-left pl-4">Unit</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((it) => (
                  <tr key={it.key} className="border-b border-border/60">
                    <td className="py-2 font-medium">{it.label}</td>
                    <td className="text-muted-foreground">
                      {it.purity > 0 ? getCaratLabel(it.purity) : "Non-gold"}
                    </td>
                    <td className="text-right font-mono">{mgToGrams(it.weightMg)} g</td>
                    <td className="text-right font-mono text-gold">
                      {it.fineMg > 0 ? `${mgToGrams(it.fineMg)} g` : "—"}
                    </td>
                    <td className="pl-4 text-muted-foreground">{it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      <MaterialStockDialog open={stockOpen} onClose={() => setStockOpen(false)} />
      <MaterialManageDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <MaterialAdjustmentDialog open={adjustmentOpen} onClose={() => setAdjustmentOpen(false)} />
    </div>
  );
}

/**
 * Add / manage material stock — the working entry path for KDM Balls, Chains,
 * Findings, Components, etc. Purchase/Return add stock; Issue removes it. Each
 * posts through the same movement log (no direct balance edit).
 */
const STOCK_ACTIONS = [
  { value: "purchase", label: "Purchase / Add Stock", sign: 1 },
  { value: "worker_return", label: "Return from Worker (In)", sign: 1 },
  { value: "worker_issue", label: "Issue to Worker (Out)", sign: -1 },
] as const;

function MaterialStockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const movements = useMaterialVault((s) => s.movements);
  const [category, setCategory] = useState("kdm_balls");
  const [purity, setPurity] = useState("916");
  const [action, setAction] = useState<(typeof STOCK_ACTIONS)[number]["value"]>("purchase");
  const [weightG, setWeightG] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState("");

  const addDropdownItem = useSettings((s) => s.addDropdownItem);
  const registerCategory = useMaterialVault((s) => s.registerCategory);
  const branchId = useSettings((s) => s.selectedBranchId) || "MAIN";

  useEffect(() => {
    if (open) {
      setCategory("kdm_balls");
      setPurity("916");
      setAction("purchase");
      setWeightG("");
      setReference("");
      setError(null);
      setNewMaterialName("");
    }
  }, [open]);

  const handleQuickAddMaterial = () => {
    const label = newMaterialName.trim();
    if (!label) return;
    const key = materialKeyFromName(label);
    if (!key) return;
    registerCategory({ key, label, group: "manufacturing_materials" });
    addDropdownItem("materialType", label);
    setNewMaterialName("");
    setCategory(key);
    toast.success(`Material "${label}" added successfully.`);
  };

  async function submit() {
    setError(null);
    const n = Number(weightG);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a weight greater than 0 g.");
      return;
    }
    const sign = STOCK_ACTIONS.find((a) => a.value === action)!.sign;
    const deltaMg = gramsToMg(n) * sign;
    const purityVal = Number(purity) || 0;
    if (sign < 0) {
      // Stock is tracked per (material × purity) — check this exact stock item.
      const available = movements
        .filter((m) => m.category === category && (m.purity ?? 0) === purityVal)
        .reduce((s, m) => s + m.deltaMg, 0);
      if (Math.abs(deltaMg) > available) {
        setError(
          `Issue exceeds stock — available ${(available / 1000).toFixed(3)} g of this material at this purity.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();

      const ledgerMovementMap = {
        purchase: "purchase",
        worker_return: "receive_from_karigar",
        worker_issue: "issue_to_karigar",
      } as const;

      await executeGoldTransaction({
        category,
        purity: purityVal,
        deltaMg,
        grossMg: gramsToMg(n),
        movementType: action,
        ledgerMovement: ledgerMovementMap[action],
        branchId,
        reference: reference.trim() || undefined,
        notes: "Recorded via Gold Stock",
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
      });

      // Refresh both stores to keep them in sync immediately
      await Promise.all([useMaterialVault.getState().refresh(), useLedger.getState().refresh()]);

      toast.success("Stock movement recorded.");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record stock movement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gold" /> Add / Manage Material Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Material *</Label>
            <CategorySelect value={category} onChange={setCategory} testId="stock-category" />
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Quick add new material..."
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                className="text-xs h-8"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleQuickAddMaterial}
                className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs h-8 font-semibold shrink-0"
              >
                + Quick Add
              </Button>
            </div>
          </div>
          <div>
            <Label>Purity / Touch *</Label>
            <Select value={purity} onValueChange={setPurity}>
              <SelectTrigger data-testid="stock-purity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Non-gold / Accessory</SelectItem>
                {COMMON_PURITIES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Same material at different purities is tracked as a separate stock item.
            </p>
          </div>
          <div>
            <Label>Action *</Label>
            <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
              <SelectTrigger data-testid="stock-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Weight (g) *</Label>
            <Input
              value={weightG}
              onChange={(e) => setWeightG(e.target.value)}
              placeholder="e.g. 5.000"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Supplier, worker, order…"
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
          <Button onClick={submit} disabled={saving} className="gap-2" data-testid="stock-submit">
            <Wrench className="h-4 w-4" /> {saving ? "Saving…" : "Record Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  // Store categories = built-ins + admin-defined materials (nothing hard-coded).
  const categories = useMaterialVault((s) => s.categories);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder="Select material…" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c.key} value={c.key}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Manage Materials — admin-configurable material list. New materials persist and
 * appear in every material dropdown. Built-ins can't be removed; admin-defined
 * ones can. Nothing about the material list is hard-coded.
 */
function MaterialManageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useMaterialVault((s) => s.categories);
  const registerCategory = useMaterialVault((s) => s.registerCategory);
  const removeCategory = useMaterialVault((s) => s.removeCategory);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<MaterialGroup>("manufacturing_materials");

  const defaultKeys = new Set(DEFAULT_MATERIAL_CATEGORIES.map((c) => c.key));
  const custom = categories.filter((c) => !defaultKeys.has(c.key));

  function add() {
    const label = name.trim();
    if (!label) return;
    const key = materialKeyFromName(label);
    if (!key) return;
    if (categories.some((c) => c.key === key)) {
      toast.error("A material with this name already exists.");
      return;
    }
    registerCategory({ key, label, group });
    useSettings.getState().addDropdownItem("materialType", label);
    setName("");
    toast.success(`Material "${label}" added.`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gold" /> Manage Materials
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs">New material name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 20K Chain, Solder, Bezel Wire"
              />
            </div>
            <div>
              <Label className="text-xs">Group</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as MaterialGroup)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MATERIAL_GROUP_LABELS) as MaterialGroup[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {MATERIAL_GROUP_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={add} data-testid="material-add">
              Add
            </Button>
          </div>

          <div>
            <Label className="text-xs">Admin-defined materials</Label>
            {custom.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                None yet. Built-in materials are always available and can't be removed.
              </p>
            ) : (
              <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
                {custom.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-1.5 text-sm"
                  >
                    <span>
                      {c.label}{" "}
                      <span className="text-[11px] text-muted-foreground">
                        · {MATERIAL_GROUP_LABELS[c.group]}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        removeCategory(c.key);
                        toast.success(`Removed "${c.label}".`);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialAdjustmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const recordAdjustment = useMaterialVault((s) => s.recordAdjustment);
  const categories = useMaterialVault((s) => s.categories);
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
              {categories.find((c) => c.key === category)?.label ?? category} balance by{" "}
              {Math.abs(Number(deltaG) || 0).toFixed(3)} g. This action is audited and cannot be
              silently undone. Continue?
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
