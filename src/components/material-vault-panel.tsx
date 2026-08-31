import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  type MaterialMovement,
} from "@/lib/material-vault-store";
import { mgToGrams, gramsToMg, getCaratLabel } from "@/lib/gold";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { toast } from "sonner";
import { Coins, Wrench, Recycle, Settings2 } from "lucide-react";
import { GoldPurityHelper } from "@/components/gold-purity-helper";
import {
  useManufacturingMaterials,
  materialTypeLabel,
  type ManufacturingMaterialType,
} from "@/lib/manufacturing-materials-store";
import {
  buildMaterialMovementReport,
  groupStockByMaterialType,
} from "@/lib/material-movement-report";

const GROUP_ICONS: Record<MaterialGroup, typeof Coins> = {
  gold: Coins,
  manufacturing_materials: Wrench,
  recovery: Recycle,
};

function materialSourceDest(m: MaterialMovement): { source: string; dest: string } {
  switch (m.type) {
    case "worker_issue":
      return { source: "Vault", dest: "Karigar" };
    case "worker_return":
      return { source: "Karigar", dest: "Vault" };
    case "outside_work":
      return m.deltaMg < 0
        ? { source: "Vault", dest: "Outside Work" }
        : { source: "Outside Work", dest: "Vault" };
    case "purchase":
      return { source: "Supplier", dest: "Vault" };
    case "conversion_out":
      return { source: "Vault", dest: "Conversion" };
    case "conversion_in":
      return { source: "Conversion", dest: "Vault" };
    case "gold_sale":
      return { source: "Vault", dest: "Sale" };
    case "adjustment":
      return m.deltaMg < 0
        ? { source: "Vault", dest: "Adjustment" }
        : { source: "Adjustment", dest: "Vault" };
    default:
      return m.deltaMg < 0
        ? { source: "Vault", dest: MATERIAL_MOVEMENT_LABELS[m.type] ?? m.type }
        : { source: MATERIAL_MOVEMENT_LABELS[m.type] ?? m.type, dest: "Vault" };
  }
}

function materialParty(m: MaterialMovement): string {
  if (m.relatedOrderId) return `Order ${m.relatedOrderId}`;
  if (m.reference?.trim()) return m.reference.trim();
  return "—";
}

/**
 * Gold & Material Vault panel - grouped balances (Gold / Manufacturing
 * Materials / Recovery), the Material Conversion transaction, an authorized
 * Adjustment entry (the only manual-edit path), and full transaction
 * history. Every balance shown here is derived from material-vault-store.ts's
 * movement log - nothing here writes a balance directly.
 */
export function MaterialVaultPanel() {
  const movements = useMaterialVault((s) => s.movements);
  const categories = useMaterialVault((s) => s.categories);
  const refresh = useMaterialVault((s) => s.refresh);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState<string>("all");
  const manufacturingMaterials = useManufacturingMaterials((s) => s.materials);
  const refreshManufacturingMaterials = useManufacturingMaterials((s) => s.refresh);

  useEffect(() => {
    void refreshManufacturingMaterials();
  }, [refreshManufacturingMaterials]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const hydrate = async () => {
      try {
        await refresh();
        attempts += 1;
        // Auth/session hydration can reset in-memory stores after the first
        // route paint. Retry a few times so a Supabase-backed movement
        // is reloaded after that boundary without polling forever.
        if (!cancelled && attempts < 3 && useMaterialVault.getState().movements.length === 0) {
          window.setTimeout(() => void hydrate(), 500);
        }
      } catch {
        if (!cancelled && attempts < 3) {
          attempts += 1;
          window.setTimeout(() => void hydrate(), 500);
        }
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
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
  const stockByMetal = useMemo(
    () => groupStockByMaterialType({ movements, categories, materials: manufacturingMaterials }),
    [movements, categories, manufacturingMaterials],
  );
  const movementReport = useMemo(() => {
    const fromTs = reportFrom ? new Date(reportFrom).getTime() : undefined;
    return buildMaterialMovementReport({
      movements,
      categories,
      materials: manufacturingMaterials,
      filters: {
        fromTs,
        materialType: reportTypeFilter === "all" ? undefined : reportTypeFilter,
      },
    });
  }, [movements, categories, manufacturingMaterials, reportFrom, reportTypeFilter]);

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

      <GoldPurityHelper className="no-print" />

      <div className="rounded-md border border-gold/40 bg-gold/5 p-5">
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
            <div key={group} className="rounded-md border border-border bg-card p-5">
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

      <div className="rounded-md border border-border bg-card p-5">
        <h3 className="font-serif text-lg text-gold mb-3">
          Multi-metal stock (separate balances — never summed across metals)
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(["gold", "silver", "copper", "other"] as const).map((metalKey) => {
            const items = stockByMetal[metalKey] ?? [];
            const totalMg = items.reduce((s, it) => s + it.weightMg, 0);
            return (
              <div key={metalKey} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {metalKey.charAt(0).toUpperCase() + metalKey.slice(1)}
                </div>
                <div className="font-mono text-lg text-gold">{mgToGrams(totalMg)} g</div>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto text-xs">
                  {items.length === 0 ? (
                    <span className="text-muted-foreground">No stock</span>
                  ) : (
                    items.map((it) => (
                      <div key={it.key} className="flex justify-between gap-2">
                        <span className="truncate">{it.label}</span>
                        <span className="font-mono shrink-0">{mgToGrams(it.weightMg)} g</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <h3 className="font-serif text-lg text-gold flex-1">Material movement report</h3>
          <div>
            <Label className="text-xs">From date</Label>
            <Input
              type="date"
              className="h-8 w-40"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Material type</Label>
            <Select value={reportTypeFilter} onValueChange={setReportTypeFilter}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="copper">Copper</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {movementReport.length === 0 ? (
          <p className="text-sm text-muted-foreground">No movements for selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Material</th>
                  <th className="text-left">Type</th>
                  <th className="text-right">Opening</th>
                  <th className="text-right">Additions</th>
                  <th className="text-right">Consumption</th>
                  <th className="text-right">Adjustments</th>
                  <th className="text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {movementReport.map((row) => (
                  <tr key={`${row.categoryKey}-${row.metal}-${row.purity}`} className="border-b border-border/60">
                    <td className="py-2">{row.categoryLabel}</td>
                    <td className="text-muted-foreground">{row.materialType ?? row.metal}</td>
                    <td className="text-right font-mono">{mgToGrams(row.openingMg)} g</td>
                    <td className="text-right font-mono text-emerald-600">+{mgToGrams(row.additionsMg)} g</td>
                    <td className="text-right font-mono text-destructive">−{mgToGrams(row.consumptionMg)} g</td>
                    <td className="text-right font-mono">{mgToGrams(row.adjustmentsMg)} g</td>
                    <td className="text-right font-mono font-semibold">{mgToGrams(row.closingMg)} g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <h3 className="font-serif text-lg text-gold mb-3">
          Stock Items (by material &amp; purity)
        </h3>
        {stockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No material stock yet. Use "Add / Manage Stock" to record material in.
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
                {stockItems.map((it) => {
                  const master = manufacturingMaterials.find((m) => m.vaultCategoryKey === it.category);
                  return (
                  <tr key={it.key} className="border-b border-border/60">
                    <td className="py-2 font-medium">
                      {it.label}
                      {master ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {materialTypeLabel(master)}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground">
                      {it.purity > 0 ? getCaratLabel(it.purity) : "Non-gold"}
                    </td>
                    <td className="text-right font-mono">{mgToGrams(it.weightMg)} g</td>
                    <td className="text-right font-mono text-gold">
                      {it.fineMg > 0 ? `${mgToGrams(it.fineMg)} g` : "-"}
                    </td>
                    <td className="pl-4 text-muted-foreground">{it.unit}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <h3 className="font-serif text-lg text-gold mb-3">Transaction History</h3>
        {sortedMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No material vault transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[1100px] text-sm border-collapse"
              data-testid="material-vault-history"
            >
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 whitespace-nowrap">Date / Time</th>
                  <th className="text-left px-2 whitespace-nowrap">Voucher / Ref</th>
                  <th className="text-left px-2 whitespace-nowrap">Material</th>
                  <th className="text-right px-2 whitespace-nowrap">Qty / Weight</th>
                  <th className="text-left px-2 whitespace-nowrap">From</th>
                  <th className="text-left px-2 whitespace-nowrap">To</th>
                  <th className="text-left px-2 whitespace-nowrap">Party / Worker</th>
                  <th className="text-left px-2 whitespace-nowrap">Status</th>
                  <th className="text-left px-2 whitespace-nowrap">Narration</th>
                  <th className="text-right px-2 whitespace-nowrap">Running balance</th>
                </tr>
              </thead>
              <tbody>
                {sortedMovements.map((m) => {
                  const { source, dest } = materialSourceDest(m);
                  const catLabel =
                    categories.find((c) => c.key === m.category)?.label ?? m.category;
                  const voucher = m.reference ?? m.id;
                  return (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                        {new Date(m.ts).toLocaleString("en-IN")}
                      </td>
                      <td
                        className="px-2 text-xs font-mono text-gold max-w-[140px] truncate"
                        title={voucher}
                      >
                        {voucher}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <div className="text-sm">{catLabel}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {MATERIAL_MOVEMENT_LABELS[m.type]}
                          {m.purity ? ` · ${m.purity}` : ""}
                        </div>
                      </td>
                      <td
                        className={`px-2 text-right font-mono whitespace-nowrap ${
                          m.deltaMg < 0 ? "text-destructive" : "text-emerald-600"
                        }`}
                      >
                        {m.deltaMg > 0 ? "+" : ""}
                        {mgToGrams(m.deltaMg)} g
                      </td>
                      <td className="px-2 text-xs whitespace-nowrap">{source}</td>
                      <td className="px-2 text-xs whitespace-nowrap">{dest}</td>
                      <td
                        className="px-2 text-xs max-w-[140px] truncate"
                        title={materialParty(m)}
                      >
                        {materialParty(m)}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                          Posted
                        </span>
                      </td>
                      <td
                        className="px-2 text-xs text-muted-foreground max-w-[180px] truncate"
                        title={m.remarks ?? ""}
                      >
                        {m.remarks ?? "—"}
                        {m.conversionLossMg != null && (
                          <span className="block text-[10px] text-amber-600">
                            Loss: {mgToGrams(m.conversionLossMg)} g
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-right font-mono font-semibold whitespace-nowrap">
                        {mgToGrams(m.balanceAfterMg)} g
                      </td>
                    </tr>
                  );
                })}
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
 * Add / manage material stock - the working entry path for manufacturing
 * materials (balls, chains, findings, components). Outside work stays on the
 * Outside Work book; internal material making uses Manufacturing Material Making.
 */
const STOCK_ACTIONS = [
  { value: "purchase", label: "Purchase / Add Stock", sign: 1 },
  { value: "worker_return", label: "Return from Worker (In)", sign: 1 },
  { value: "worker_issue", label: "Issue to Worker (Out)", sign: -1 },
] as const;

function MaterialStockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const appendMovement = useMaterialVault((s) => s.append);
  const movements = useMaterialVault((s) => s.movements);
  const configuredPurities = useSettings((s) => s.purities);
  const metals = useMemo(
    () =>
      Array.from(
        new Set(
          configuredPurities
            .map((p) => (p.metal ?? "Gold").trim() || "Gold")
            .filter(Boolean),
        ),
      ).sort(),
    [configuredPurities],
  );
  const [metal, setMetal] = useState("Gold");
  const [category, setCategory] = useState("kdm_balls");
  const [purity, setPurity] = useState("916");
  const [action, setAction] = useState<(typeof STOCK_ACTIONS)[number]["value"]>("purchase");
  const [weightG, setWeightG] = useState("");
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("kdm_balls");
      setMetal("Gold");
      setPurity("916");
      setAction("purchase");
      setWeightG("");
      setReference("");
      setNarration("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = configuredPurities.find((p) => (p.metal ?? "Gold") === metal && p.active);
    if (
      first &&
      !configuredPurities.some(
        (p) => (p.metal ?? "Gold") === metal && String(p.permille) === purity,
      )
    ) {
      setPurity(String(first.permille));
    }
  }, [open, configuredPurities, metal, purity]);

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
      // Stock is tracked per material and purity - check this exact stock item.
      const available = movements
        .filter(
          (m) =>
            m.category === category &&
            (m.metal ?? "Gold") === metal &&
            (m.purity ?? 0) === purityVal,
        )
        .reduce((s, m) => s + m.deltaMg, 0);
      if (Math.abs(deltaMg) > available) {
        setError(
          `Issue exceeds stock - available ${(available / 1000).toFixed(3)} g of this material at this purity.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      await appendMovement({
        category,
        metal,
        type: action,
        deltaMg,
        grossMg: gramsToMg(n),
        purity: purityVal || undefined,
        reference: reference.trim() || undefined,
        remarks: narration.trim() || undefined,
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
      });

      // Gold fine stock must also move the Gold Ledger / Khata vault (or scrap)
      // so Material Vault and Gold Passbook stay aligned.
      const fineBearingGold =
        metal === "Gold" &&
        purityVal > 0 &&
        (category === "filings" || category === "raw_gold" || category === "scrap");
      const fineBearingPrecious =
        (metal === "Silver" || metal === "Copper") && purityVal > 0;
      if (fineBearingGold || fineBearingPrecious) {
        const { fineGoldMg } = await import("@/lib/gold");
        const { useLedger } = await import("@/lib/ledger-store");
        const { assertVaultGoldIssueAvailable } = await import("@/lib/vault-gold-stock");
        const fineAbs = fineGoldMg(gramsToMg(n), purityVal);
        const fineSigned = fineAbs * sign;
        const bucket = category === "scrap" ? "scrap" : "vault";
        const metalCode =
          metal === "Silver" ? "silver" : metal === "Copper" ? "copper" : "gold";
        if (sign < 0 && fineBearingGold) {
          assertVaultGoldIssueAvailable({
            entries: useLedger.getState().entries,
            purityPermille: purityVal,
            fineMg: fineAbs,
            grossMg: gramsToMg(n),
            bucket,
          });
        }
        await useLedger.getState().append({
          type: sign > 0 ? "purchase" : "adjustment",
          metalCode,
          netFineMg: fineSigned,
          deltas: { [bucket]: fineSigned },
          grossMg: gramsToMg(n),
          purity: purityVal as never,
          fineMg: fineAbs,
          reference: reference.trim() || undefined,
          notes:
            narration.trim() ||
            (sign > 0
              ? `Material Vault purchase into ${bucket} · ${category} · ${n} g @ ${purityVal} (${metal})`
              : `Material Vault stock issue from ${bucket} · ${category} · ${n} g @ ${purityVal} (${metal})`),
        });
      }

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
            <Label>Precious metal *</Label>
            <Select value={metal} onValueChange={setMetal}>
              <SelectTrigger data-testid="stock-metal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metals.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Material *</Label>
            <CategorySelect value={category} onChange={setCategory} testId="stock-category" />
          </div>
          <div>
            <Label>Purity / Touch *</Label>
            <Select value={purity} onValueChange={setPurity}>
              <SelectTrigger data-testid="stock-purity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Non-gold / Accessory</SelectItem>
                {configuredPurities
                  .filter((p) => (p.metal ?? "Gold") === metal && p.active)
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.permille)}>
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
              placeholder="Supplier, worker, order..."
            />
          </div>
          <div>
            <Label>Narration (optional)</Label>
            <Textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Purpose of this stock movement"
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
            <Wrench className="h-4 w-4" /> {saving ? "Saving..." : "Record Stock"}
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
        <SelectValue placeholder="Select material..." />
      </SelectTrigger>
      <SelectContent>
        {categories
          .filter((c) => c.key)
          .map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Manage Materials - admin-configurable material list. New materials persist and
 * appear in every material dropdown. Built-ins can't be removed; admin-defined
 * ones can. Nothing about the material list is hard-coded.
 */
function MaterialManageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useMaterialVault((s) => s.categories);
  const registerCategory = useMaterialVault((s) => s.registerCategory);
  const removeCategory = useMaterialVault((s) => s.removeCategory);
  const createMaterial = useManufacturingMaterials((s) => s.create);
  const manufacturingMaterials = useManufacturingMaterials((s) => s.materials);
  const removeMaterial = useManufacturingMaterials((s) => s.remove);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<MaterialGroup>("manufacturing_materials");
  const [materialType, setMaterialType] = useState<ManufacturingMaterialType>("other");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const defaultKeys = new Set(DEFAULT_MATERIAL_CATEGORIES.map((c) => c.key));
  const custom = categories.filter((c) => !defaultKeys.has(c.key));

  async function add() {
    const label = name.trim();
    if (!label) return;
    if (materialType === "other" && !customTypeLabel.trim()) {
      toast.error("Enter a custom type label for Other materials.");
      return;
    }
    setSaving(true);
    try {
      const created = await createMaterial({
        name: label,
        materialType,
        customTypeLabel: materialType === "other" ? customTypeLabel.trim() : undefined,
      });
      registerCategory({
        key: created.vaultCategoryKey,
        label: created.name,
        group: materialType === "gold" ? "gold" : group,
      });
      setName("");
      setCustomTypeLabel("");
      toast.success(`Material "${label}" added (${materialTypeLabel(created)}).`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add material.");
    } finally {
      setSaving(false);
    }
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
              <Label className="text-xs">Material name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fine Silver, Copper Wire, KDM"
              />
            </div>
            <div>
              <Label className="text-xs">Material type *</Label>
              <Select
                value={materialType}
                onValueChange={(v) => setMaterialType(v as ManufacturingMaterialType)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="copper">Copper</SelectItem>
                  <SelectItem value="other">Other / Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {materialType === "other" ? (
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">Custom type label *</Label>
                <Input
                  value={customTypeLabel}
                  onChange={(e) => setCustomTypeLabel(e.target.value)}
                  placeholder="e.g. Solder, Enamel"
                />
              </div>
            ) : null}
            <div>
              <Label className="text-xs">Vault group</Label>
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
            <Button onClick={() => void add()} disabled={saving} data-testid="material-add">
              Add
            </Button>
          </div>

          <div>
            <Label className="text-xs">Master materials (name + type)</Label>
            {manufacturingMaterials.filter((m) => m.active).length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                No master materials yet. Built-in vault categories remain available.
              </p>
            ) : (
              <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                {manufacturingMaterials
                  .filter((m) => m.active)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-1.5 text-sm"
                    >
                      <span>
                        {m.name}{" "}
                        <Badge variant="outline" className="text-[10px] ml-1">
                          {materialTypeLabel(m)}
                        </Badge>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          void removeMaterial(m.id);
                          removeCategory(m.vaultCategoryKey);
                          toast.success(`Retired "${m.name}".`);
                        }}
                      >
                        Retire
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Legacy admin-defined categories</Label>
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
                        - {MATERIAL_GROUP_LABELS[c.group]}
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
  const [category, setCategory] = useState("filings");
  const [deltaG, setDeltaG] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("filings");
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
            <Label>Adjustment (g) - negative to reduce *</Label>
            <Input
              value={deltaG}
              onChange={(e) => setDeltaG(e.target.value)}
              placeholder="e.g. -0.500 or 2.000"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Reason / Narration *</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required - physical stock count correction, etc."
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
            <Settings2 className="h-4 w-4" /> {saving ? "Saving..." : "Record Adjustment"}
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
