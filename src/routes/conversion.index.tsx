import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Recycle, Plus, Printer, Sparkles, Building2 } from "lucide-react";
import { useMetalConversion } from "@/lib/metal-conversion-store";
import { useSettings } from "@/lib/settings-store";
import { gramsToMg, mgToGrams } from "@/lib/gold";
import { calculatePurityConversion } from "@/lib/purity-conversion";
import { GoldPurityHelper } from "@/components/gold-purity-helper";
import { DecimalInput } from "@/components/ui/decimal-input";
import { computeFineGold, canOverrideSourcePurity, resolveSourcePurityPolicy } from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules, useGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { usePurityGradesStore } from "@/lib/purity-grades-store";
import { useLedger } from "@/lib/ledger-store";
import {
  buildVaultGoldPurityLines,
  type VaultGoldPurityLine,
} from "@/lib/vault-gold-stock";
import { toast } from "sonner";
import type { AlloyConversionLine } from "@/lib/metal-conversion-store";
import { useManufacturingMaterials, materialTypeLabel } from "@/lib/manufacturing-materials-store";
import { calculateComposition } from "@/lib/metal-composition-engine";
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

export const Route = createFileRoute("/conversion/")({
  head: () => ({ meta: [{ title: "Metal Conversion · AVS ERP" }] }),
  component: ConversionIndex,
});

/** Vault / scrap purity line from the gold ledger (gold only — not material vault). */
type VaultStockLine = VaultGoldPurityLine;

function stockOptionLabel(stock: VaultStockLine): string {
  const touch = Number.isInteger(stock.touchPct)
    ? String(stock.touchPct)
    : stock.touchPct.toFixed(1);
  return `${stock.location} · ${stock.purity}‰ / ${touch}% — Available: ${mgToGrams(stock.availableGrossMg)} g gross (${mgToGrams(stock.availableFineMg)} g fine)`;
}

function goingGrossMg(r: {
  sourceGrossMg?: number;
  inputFineMg: number;
}): number {
  return r.sourceGrossMg && r.sourceGrossMg > 0 ? r.sourceGrossMg : r.inputFineMg;
}

function comingGrossMg(r: {
  destGrossMg?: number;
  actualOutputFineMg: number;
}): number {
  return r.destGrossMg && r.destGrossMg > 0 ? r.destGrossMg : r.actualOutputFineMg;
}

function ConversionIndex() {
  const { records, refresh, convert } = useMetalConversion();
  const alloyFormulas = useSettings((s) => s.alloyFormulas);
  const userRole = useSettings((s) => s.currentUserRole);
  const ledgerEntries = useLedger((s) => s.entries);
  const rulesDoc = useGoldCalculationRules((s) => s.doc);
  const sourcePolicy = resolveSourcePurityPolicy("conversion", rulesDoc);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState("");
  const [sourceGrossInput, setSourceGrossInput] = useState("");
  const [targetPurityPermille, setTargetPurityPermille] = useState(916);
  const [overrideSourcePurity, setOverrideSourcePurity] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [alloyAddedG, setAlloyAddedG] = useState("0");
  const [alloyLines, setAlloyLines] = useState<AlloyConversionLine[]>([]);
  const [expectedLossG, setExpectedLossG] = useState("0");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  const purityGrades = usePurityGradesStore((s) => s.grades);
  const goldGrades = useMemo(() => {
    const active = purityGrades
      .filter((g) => g.isActive && g.metalType === "gold")
      .sort((a, b) => b.touchPermille - a.touchPermille);
    if (active.length > 0) return active;
    return [
      {
        id: "916",
        karatLabel: "22K / 916",
        touchPermille: 916,
        metalType: "gold" as const,
        isActive: true,
        isSystem: true,
        sortOrder: 0,
      },
      {
        id: "999",
        karatLabel: "24K / 999",
        touchPermille: 999,
        metalType: "gold" as const,
        isActive: true,
        isSystem: true,
        sortOrder: 1,
      },
      {
        id: "750",
        karatLabel: "18K / 750",
        touchPermille: 750,
        metalType: "gold" as const,
        isActive: true,
        isSystem: true,
        sortOrder: 2,
      },
    ];
  }, [purityGrades]);

  const manufacturingMaterials = useManufacturingMaterials((s) => s.materials);
  const refreshMaterials = useManufacturingMaterials((s) => s.refresh);

  useEffect(() => {
    void refreshMaterials();
  }, [refreshMaterials]);

  const reload = useCallback(async () => {
    setLoadingStock(true);
    setLoadError(null);
    try {
      await Promise.all([refresh(), useLedger.getState().refresh()]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load conversion data.");
    } finally {
      setLoadingStock(false);
    }
  }, [refresh]);

  useEffect(() => {
    void reload();
    void usePurityGradesStore.getState().hydrate();
    void import("@/lib/gold-calculation-rules-store").then(({ useGoldCalculationRules }) =>
      useGoldCalculationRules.getState().hydrate(),
    );
  }, [reload]);

  const availableGoldStock = useMemo(
    () => buildVaultGoldPurityLines(ledgerEntries),
    [ledgerEntries],
  );
  const selectedStock = useMemo(
    () => availableGoldStock.find((l) => l.id === selectedStockId),
    [availableGoldStock, selectedStockId],
  );

  const allowOverride = canOverrideSourcePurity(sourcePolicy, userRole);
  const ledgerLinePurity = selectedStock?.purity ?? 0;
  const sourcePurityOverridden =
    overrideSourcePurity != null &&
    overrideSourcePurity > 0 &&
    overrideSourcePurity !== ledgerLinePurity;
  const effectiveSourcePurity =
    sourcePolicy.mode === "manual"
      ? overrideSourcePurity && overrideSourcePurity > 0
        ? overrideSourcePurity
        : ledgerLinePurity
      : sourcePurityOverridden && allowOverride
        ? (overrideSourcePurity as number)
        : ledgerLinePurity;

  const goldGradeOptions = useMemo(
    () => goldGrades.map((g) => ({ label: g.karatLabel, value: g.touchPermille })),
    [goldGrades],
  );

  useEffect(() => {
    if (selectedStock && sourcePolicy.mode !== "manual") {
      setOverrideSourcePurity(null);
      setOverrideReason("");
    }
  }, [selectedStockId, sourcePolicy.mode, selectedStock]);

  useEffect(() => {
    if (!selectedStockId || !(effectiveSourcePurity > 0)) return;
    let weightMg = 0;
    try {
      weightMg = gramsToMg(sourceGrossInput || "0");
    } catch {
      return;
    }
    if (!(weightMg > 0)) return;
    try {
      const fromPm = effectiveSourcePurity;
      const r = calculatePurityConversion({
        weightMg,
        fromPurityPermille: fromPm,
        toPurityPermille: targetPurityPermille,
      });
      setAlloyAddedG(mgToGrams(r.alloyMg));
      const formula = alloyFormulas.find(
        (f) =>
          f.active &&
          f.fromPurityPermille === fromPm &&
          f.toPurityPermille === targetPurityPermille,
      );
      if (formula?.components?.length) {
        const comp = calculateComposition({
          inputWeightMg: weightMg,
          sourcePurityPermille: fromPm,
          formula: {
            id: formula.id,
            metal: formula.metal ?? "Gold",
            targetPurityPermille: formula.toPurityPermille,
            fineMetalPermille: formula.fromPurityPermille,
            components: formula.components.map((c) => ({
              metal: c.metal,
              permille: c.permille,
              weightMg: 0,
            })),
            effectiveFrom: formula.effectiveFrom ?? "2026-01-01",
            version: formula.version ?? 1,
            active: formula.active,
            expectedLossPct: formula.expectedLossPct,
          },
        });
        setAlloyLines(
          comp.components
            .filter((c) => c.weightMg > 0)
            .map((c) => {
              const master = manufacturingMaterials.find(
                (m) => m.name.toLowerCase() === c.metal.toLowerCase(),
              );
              return {
                materialId: master?.id,
                material: master?.name ?? c.metal,
                materialType: master?.materialType ?? (c.metal.toLowerCase().includes("silver") ? "silver" : c.metal.toLowerCase().includes("copper") ? "copper" : "other"),
                weightMg: c.weightMg,
                purityPermille: 0,
                categoryKey: master?.vaultCategoryKey,
              } satisfies AlloyConversionLine;
            }),
        );
      } else if (r.alloyMg > 0) {
        setAlloyLines([{ material: "Alloy", materialType: "other", weightMg: r.alloyMg, purityPermille: 0 }]);
      } else {
        setAlloyLines([]);
      }
      if (formula && formula.expectedLossPct > 0) {
        const lossMg = Math.round((r.equivalentGrossMg * formula.expectedLossPct) / 100);
        setExpectedLossG(mgToGrams(lossMg));
      }
    } catch {
      /* leave alloy as-is */
    }
  }, [
    selectedStockId,
    sourceGrossInput,
    targetPurityPermille,
    alloyFormulas,
    effectiveSourcePurity,
    manufacturingMaterials,
  ]);

  let sourceGrossMg = 0;
  try {
    sourceGrossMg = gramsToMg(sourceGrossInput || "0");
  } catch {
    sourceGrossMg = 0;
  }
  const sourceFineMg = selectedStock
    ? computeFineGold(
        {
          module: "conversion",
          grossMg: sourceGrossMg,
          purityPermille: effectiveSourcePurity,
          tanchPct: selectedStock.touchPct,
        },
        currentGoldCalculationRules(),
      ).fineMg
    : 0;
  let alloyAddedMg = 0;
  try {
    alloyAddedMg =
      alloyLines.length > 0
        ? alloyLines.reduce((s, l) => s + (l.weightMg > 0 ? l.weightMg : 0), 0)
        : gramsToMg(alloyAddedG || "0");
  } catch {
    alloyAddedMg = 0;
  }
  let expectedLossMg = 0;
  try {
    expectedLossMg = gramsToMg(expectedLossG || "0");
  } catch {
    expectedLossMg = 0;
  }
  const expectedTotalGrossOutputMg = Math.max(0, sourceGrossMg + alloyAddedMg - expectedLossMg);
  const destPurityPermille = targetPurityPermille;
  const expectedTotalFineOutputMg = computeFineGold(
    {
      module: "conversion",
      grossMg: expectedTotalGrossOutputMg,
      purityPermille: destPurityPermille,
    },
    currentGoldCalculationRules(),
  ).fineMg;

  const hasFormula = useMemo(() => {
    if (!selectedStock || !(effectiveSourcePurity > 0)) return false;
    return alloyFormulas.some(
      (f) =>
        f.active &&
        f.fromPurityPermille === effectiveSourcePurity &&
        f.toPurityPermille === destPurityPermille,
    );
  }, [alloyFormulas, selectedStock, destPurityPermille, effectiveSourcePurity]);

  function resetForm() {
    setSelectedStockId("");
    setSourceGrossInput("");
    setTargetPurityPermille(916);
    setOverrideSourcePurity(null);
    setOverrideReason("");
    setAlloyAddedG("0");
    setAlloyLines([]);
    setExpectedLossG("0");
    setResponsiblePerson("");
    setNotes("");
    setConfirmOpen(false);
  }

  function validateConversionInputs(): string | null {
    if (!selectedStock) return "Select gold from the vault (by purity).";
    if (!(sourceGrossMg > 0)) return "Enter gross weight to convert.";
    if (!(effectiveSourcePurity > 0)) return "Source purity is required.";
    if (sourcePolicy.mode === "manual" && !(overrideSourcePurity && overrideSourcePurity > 0)) {
      return "Enter source purity (manual policy).";
    }
    if (
      sourcePurityOverridden &&
      sourcePolicy.requireOverrideReason &&
      !overrideReason.trim()
    ) {
      return "Override reason is required when changing ledger-line purity.";
    }
    if (sourceFineMg <= 0 || sourceFineMg > selectedStock.availableFineMg) {
      return `Invalid weight. Available fine: ${mgToGrams(selectedStock.availableFineMg)} g at ${ledgerLinePurity}‰`;
    }
    if (!hasFormula) {
      return `No active conversion formula from ${effectiveSourcePurity} to ${destPurityPermille}. Add one under Settings → Alloy formulas.`;
    }
    return null;
  }

  function handleRequestConvert() {
    const err = validateConversionInputs();
    if (err) {
      toast.error(err);
      return;
    }
    if (sourcePolicy.requireConfirmBeforePost !== false) {
      setConfirmOpen(true);
      return;
    }
    void handleExecuteConversion();
  }

  async function handleExecuteConversion() {
    if (!selectedStock) return;
    const err = validateConversionInputs();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    setConfirmOpen(false);
    try {
      const record = await convert({
        sourcePurity: effectiveSourcePurity,
        ledgerLinePurity: ledgerLinePurity,
        destPurity: destPurityPermille,
        sourceBucket: selectedStock.bucket,
        inputFineMg: sourceFineMg,
        sourceGrossMg,
        destGrossMg: expectedTotalGrossOutputMg,
        actualOutputFineMg: expectedTotalFineOutputMg,
        alloyAddedMg,
        alloyLines: alloyLines.filter((l) => l.weightMg > 0),
        operator: responsiblePerson.trim() || "—",
        sourcePurityMode: sourcePolicy.mode,
        sourcePurityOverridden,
        sourcePurityOverrideReason: sourcePurityOverridden
          ? overrideReason.trim() || undefined
          : undefined,
        notes:
          [
            notes.trim(),
            `From ${selectedStock.location}`,
            `Ledger line ${ledgerLinePurity}‰`,
            sourcePurityOverridden
              ? `Source purity overridden to ${effectiveSourcePurity}‰${overrideReason.trim() ? ` (${overrideReason.trim()})` : ""}`
              : `Source purity ${effectiveSourcePurity}‰`,
            `Target ${destPurityPermille}‰`,
            expectedLossMg > 0 ? `Expected melt loss ${mgToGrams(expectedLossMg)} g` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      });
      await useLedger.getState().refresh();
      toast.success(
        `Conversion ${record.batchNo}: going −${mgToGrams(sourceGrossMg)} g gross (${effectiveSourcePurity}‰) → coming +${mgToGrams(record.destGrossMg ?? record.actualOutputFineMg)} g gross (${destPurityPermille}‰)`,
      );
      setDialogOpen(false);
      resetForm();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Metal Conversion"
        subtitle="Takes gold out of the vault/scrap ledger (going) and posts converted gold back into Gold Vault stock (coming). Weights shown are gross first — fine follows your Pure-gold threshold under Customization → Calculations."
        actions={
          <Button
            onClick={() => {
              if (availableGoldStock.length > 0 && !selectedStockId) {
                setSelectedStockId(availableGoldStock[0].id);
                setSourceGrossInput(
                  Number(mgToGrams(availableGoldStock[0].availableGrossMg)).toFixed(3),
                );
              }
              setDialogOpen(true);
            }}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="h-4 w-4" />
            New Conversion
          </Button>
        }
      />

      {loadError ? <p className="text-sm text-destructive font-mono">{loadError}</p> : null}

      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-amber-500" />
              Current gold stock (from ledger)
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/ledger">Open Gold Vault ledger</Link>
            </Button>
          </div>
          {loadingStock ? (
            <p className="text-xs text-muted-foreground">Loading balances…</p>
          ) : availableGoldStock.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No vault/scrap fine balances yet. Add opening vault gold under Gold Ledger first.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {availableGoldStock.map((line) => (
                <div
                  key={line.id}
                  className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="font-medium">
                    {line.location} · {line.purity}‰
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {mgToGrams(line.availableGrossMg)} g gross · {mgToGrams(line.availableFineMg)} g
                    fine
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="block md:hidden divide-y divide-border">
            {records.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No conversions recorded yet.
              </div>
            ) : (
              records.map((r) => (
                <Link
                  key={r.id}
                  to="/conversion/slip/$id"
                  params={{ id: r.id }}
                  className="block p-3.5 hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-amber-500">{r.batchNo}</p>
                      <p className="text-sm mt-1">
                        {r.sourcePurity} → {r.destPurity}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.operator} · going {mgToGrams(goingGrossMg(r))} g · coming{" "}
                        {mgToGrams(comingGrossMg(r))} g
                      </p>
                    </div>
                    <span className="text-xs text-amber-500 shrink-0 inline-flex items-center gap-1">
                      <Printer className="h-3.5 w-3.5" /> Slip
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Batch No
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Purity Conversion
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Going (gross g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Coming (gross g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Melting Loss (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Responsible
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Slip
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <Recycle className="h-8 w-8 mx-auto mb-2 opacity-30 text-amber-500" />
                      No conversions yet. Convert gold from vault purity balances.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => (
                    <TableRow key={r.id} className="border-border hover:bg-card/60">
                      <TableCell className="font-mono text-xs font-semibold text-amber-500">
                        {r.batchNo}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{r.sourcePurity}</span> →{" "}
                        <span className="font-medium text-amber-600">{r.destPurity}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {mgToGrams(goingGrossMg(r))} g
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-500 font-bold">
                        {mgToGrams(comingGrossMg(r))} g
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-rose-500">
                        {r.conversionLossMg > 0
                          ? `${mgToGrams(r.conversionLossMg)} g`
                          : "0.000 g"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.operator || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to="/conversion/slip/$id"
                          params={{ id: r.id }}
                          className="inline-flex items-center gap-1 text-xs text-amber-500 hover:underline"
                        >
                          <Printer className="h-3.5 w-3.5" /> Slip
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-amber-500">
              <Recycle className="h-5 w-5" />
              Convert Gold
            </DialogTitle>
            <DialogDescription className="text-xs">
              Going: deduct source gross from the ledger. Coming: post converted gross back into
              Gold Vault at the new purity. Fine equals gross when purity is at/above your Pure-gold
              threshold (Customization → Calculations).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-amber-500" />
                  1. Source gold (ledger stock) *
                </label>
                <Badge variant="outline" className="text-[10px]">
                  {loadingStock
                    ? "Loading vault…"
                    : `${availableGoldStock.length} purity lines`}
                </Badge>
              </div>

              <select
                value={selectedStockId}
                onChange={(e) => {
                  setSelectedStockId(e.target.value);
                  const stock = availableGoldStock.find((l) => l.id === e.target.value);
                  if (stock) {
                    setSourceGrossInput(Number(mgToGrams(stock.availableGrossMg)).toFixed(3));
                  }
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs font-mono"
              >
                <option value="">-- Choose vault gold --</option>
                {availableGoldStock.map((stock) => (
                  <option key={stock.id} value={stock.id}>
                    {stockOptionLabel(stock)}
                  </option>
                ))}
              </select>

              {availableGoldStock.length === 0 && !loadingStock && (
                <p className="text-[11px] text-amber-700">
                  No vault or scrap fine gold on the ledger yet. Post opening / purchase into Gold
                  Vault first.
                </p>
              )}

              {selectedStock && (
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-1.5 bg-card rounded border">
                    <span className="text-[10px] text-muted-foreground block">Available gross</span>
                    <span className="font-bold">
                      {mgToGrams(selectedStock.availableGrossMg)} g
                    </span>
                  </div>
                  <div className="p-1.5 bg-card rounded border">
                    <span className="text-[10px] text-muted-foreground block">Touch</span>
                    <span className="font-bold">{selectedStock.touchPct.toFixed(2)}%</span>
                  </div>
                  <div className="p-1.5 bg-card rounded border">
                    <span className="text-[10px] text-muted-foreground block">Available fine</span>
                    <span className="font-bold text-amber-600">
                      {mgToGrams(selectedStock.availableFineMg)} g
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground block mb-1">Gross weight to convert (g) *</label>
                <DecimalInput
                  placeholder="0.000"
                  value={sourceGrossInput}
                  onChange={setSourceGrossInput}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">Target purity *</label>
                <select
                  value={String(targetPurityPermille)}
                  onChange={(e) => setTargetPurityPermille(Number(e.target.value))}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {goldGrades.map((g) => (
                    <option key={g.id} value={g.touchPermille}>
                      {g.karatLabel} ({g.touchPermille}‰)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedStock && (
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-muted-foreground">
                    Source purity (‰) · policy: {sourcePolicy.mode}
                  </label>
                  <Badge variant="outline" className="text-[10px]">
                    Ledger line {ledgerLinePurity}‰
                  </Badge>
                </div>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono"
                  value={
                    sourcePolicy.mode === "manual" || allowOverride
                      ? String(overrideSourcePurity ?? (ledgerLinePurity || ""))
                      : String(ledgerLinePurity || "")
                  }
                  disabled={sourcePolicy.mode === "ledger_line" || !allowOverride}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setOverrideSourcePurity(Number.isFinite(n) && n > 0 ? Math.round(n) : null);
                  }}
                />
                {sourcePurityOverridden && allowOverride ? (
                  <Input
                    className="h-8 text-xs"
                    placeholder={
                      sourcePolicy.requireOverrideReason
                        ? "Override reason (required) *"
                        : "Override reason (optional)"
                    }
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                ) : null}
              </div>
            )}

            <GoldPurityHelper
              weightG={sourceGrossInput}
              fromPurity={effectiveSourcePurity || undefined}
              toPurity={destPurityPermille}
              purityOptions={goldGradeOptions}
              lockedWeight
              lockedFrom={sourcePolicy.mode === "ledger_line" || !allowOverride}
              onToPurityChange={setTargetPurityPermille}
              onFromPurityChange={(pm) => {
                if (allowOverride || sourcePolicy.mode === "manual") {
                  setOverrideSourcePurity(pm);
                }
              }}
              onApplyAlloyG={setAlloyAddedG}
            />

            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground text-xs">Alloy components</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() =>
                    setAlloyLines((prev) => [
                      ...prev,
                      { material: "Alloy", materialType: "other", weightMg: 0, purityPermille: 0 },
                    ])
                  }
                >
                  + Add line
                </Button>
              </div>
              {alloyLines.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Total alloy: {mgToGrams(alloyAddedMg)} g (from formula or manual entry below)
                </p>
              ) : (
                <div className="space-y-2">
                  {alloyLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Material</label>
                        <select
                          value={line.materialId ?? line.material}
                          onChange={(e) => {
                            const master = manufacturingMaterials.find((m) => m.id === e.target.value || m.name === e.target.value);
                            setAlloyLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      materialId: master?.id,
                                      material: master?.name ?? e.target.value,
                                      materialType: master?.materialType ?? l.materialType,
                                      categoryKey: master?.vaultCategoryKey,
                                    }
                                  : l,
                              ),
                            );
                          }}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value={line.material}>{line.material}</option>
                          {manufacturingMaterials
                            .filter((m) => m.active)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({materialTypeLabel(m)})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Weight (g)</label>
                        <DecimalInput
                          placeholder="0.000"
                          value={mgToGrams(line.weightMg)}
                          onChange={(g) => {
                            let mg = 0;
                            try {
                              mg = gramsToMg(g || "0");
                            } catch {
                              mg = 0;
                            }
                            setAlloyLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, weightMg: mg } : l)),
                            );
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Type</label>
                        <Badge variant="outline" className="text-[10px] h-8 px-2">
                          {line.materialType ?? "other"}
                        </Badge>
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-1 text-destructive"
                          onClick={() => setAlloyLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Total alloy: {mgToGrams(alloyAddedMg)} g
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-muted-foreground block mb-1">Alloy total (g) — override</label>
                <DecimalInput
                  placeholder="0.000"
                  value={alloyAddedG}
                  onChange={(g) => {
                    setAlloyAddedG(g);
                    if (alloyLines.length <= 1) {
                      let mg = 0;
                      try {
                        mg = gramsToMg(g || "0");
                      } catch {
                        mg = 0;
                      }
                      setAlloyLines([{ material: "Alloy", materialType: "other", weightMg: mg, purityPermille: 0 }]);
                    }
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">Expected melt loss (g)</label>
                <DecimalInput
                  placeholder="0.100"
                  value={expectedLossG}
                  onChange={setExpectedLossG}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">Responsible person</label>
                <Input
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  placeholder="Who is doing this melt"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-muted-foreground block mb-1">Notes</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="h-8 text-xs"
              />
            </div>

            {selectedStock && !hasFormula && (
              <p className="text-[11px] text-destructive">
                Add an alloy formula {effectiveSourcePurity} → {destPurityPermille} under Settings
                before converting.
              </p>
            )}

            <div className="p-3.5 rounded-lg border bg-amber-500/5 border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Fine gold audit
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Source fine</span>
                  <span className="font-bold text-amber-600">{mgToGrams(sourceFineMg)} g</span>
                </div>
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Alloy</span>
                  <span className="font-bold">+{mgToGrams(alloyAddedMg)} g</span>
                </div>
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Output gross</span>
                  <span className="font-bold">{mgToGrams(expectedTotalGrossOutputMg)} g</span>
                </div>
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Output fine</span>
                  <span className="font-bold text-emerald-600">
                    {mgToGrams(expectedTotalFineOutputMg)} g
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleRequestConvert()}
              disabled={saving || !selectedStock || sourceGrossMg <= 0 || !hasFormula}
              className="h-8 text-xs gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Recycle className="h-4 w-4" />
              {saving ? "Posting to Gold Vault…" : "Review & convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm conversion?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <span className="block">
                Going: −{mgToGrams(sourceGrossMg)} g gross at {effectiveSourcePurity}‰ (
                {mgToGrams(sourceFineMg)} g fine) from {selectedStock?.location ?? "ledger"}.
              </span>
              <span className="block">
                Coming: +{mgToGrams(expectedTotalGrossOutputMg)} g gross at {destPurityPermille}‰ (
                {mgToGrams(expectedTotalFineOutputMg)} g fine) into Gold Vault.
              </span>
              {sourcePurityOverridden ? (
                <span className="block text-amber-700">
                  Source purity overridden from ledger line {ledgerLinePurity}‰
                  {overrideReason.trim() ? ` — ${overrideReason.trim()}` : ""}.
                </span>
              ) : null}
              <span className="block font-medium text-foreground">
                Post these Gold Vault ledger entries now?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>No</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void handleExecuteConversion();
              }}
            >
              Yes, post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
