import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Recycle,
  Plus,
  Printer,
  Layers,
  ArrowRight,
  Sparkles,
  Scale,
  Building2,
} from "lucide-react";
import { useMetalConversion } from "@/lib/metal-conversion-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams, gramsToMg, fineGoldMgFromTouchPercent } from "@/lib/gold";
import {
  useGoldInventoryStore,
  type PhysicalForm,
  ensureGoldInventoryLoaded,
} from "@/lib/gold-inventory-store";
import { GoldLineageTracker } from "@/components/stock/GoldLineageTracker";
import { toast } from "sonner";

export const Route = createFileRoute("/conversion/")({
  head: () => ({ meta: [{ title: "Metal Conversion & Inventory Engine · AVS Gold ERP" }] }),
  component: ConversionIndex,
});

function safeGramsToMg(val: string): number {
  try {
    return gramsToMg(val);
  } catch {
    return 0;
  }
}

function purityValue(value: string): number {
  return Number(value.split(":").pop() ?? 0);
}

function ConversionIndex() {
  const { records, refresh } = useMetalConversion();
  const purities = useSettings((s) => s.purities);
  const alloyFormulas = useSettings((s) => s.alloyFormulas);

  // Real Gold Inventory Store integration
  const {
    inventoryLots,
    executeMetalConversion,
    getTotalPhysicalGoldPosition,
    hydrate: hydrateGoldInventory,
  } = useGoldInventoryStore();

  const [activeTab, setActiveTab] = useState<"batches" | "lineage">("batches");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Real Lot Sourced Conversion Form
  const [selectedSourceLotId, setSelectedSourceLotId] = useState<string>("");
  const [sourceGrossInput, setSourceGrossInput] = useState<string>("");
  const [targetPurityKarat, setTargetPurityKarat] = useState<"24K" | "22K" | "18K" | "14K">("22K");
  const [targetTouch, setTargetTouch] = useState<number>(91.6);
  const [alloyType, setAlloyType] = useState<
    "copper_silver_master" | "pure_copper" | "pure_silver" | "fine_gold_999"
  >("copper_silver_master");
  const [alloyAddedG, setAlloyAddedG] = useState<string>("0");
  const [expectedLossG, setExpectedLossG] = useState<string>("0.100");
  const [targetVault, setTargetVault] = useState<string>("Main Strongroom");
  const [targetForm, setTargetForm] = useState<PhysicalForm>("granules");
  const [operator, setOperator] = useState("Master Melter");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
    void ensureGoldInventoryLoaded();
  }, [refresh]);

  const activeLots = useMemo(
    () => inventoryLots.filter((l) => l.isActive && l.availableGrossG > 0),
    [inventoryLots],
  );
  const selectedLot = useMemo(
    () => activeLots.find((l) => l.id === selectedSourceLotId),
    [activeLots, selectedSourceLotId],
  );

  // When source lot selected, default gross input to full lot or available
  useEffect(() => {
    if (selectedLot && !sourceGrossInput) {
      setSourceGrossInput(selectedLot.availableGrossG.toFixed(3));
    }
  }, [selectedLot, sourceGrossInput]);

  // Preview uses same ÷999 engine as ledger (touch % → per-mille → fineGoldMg).
  const parsedSourceGross = parseFloat(sourceGrossInput || "0");
  const sourceFineGoldG = selectedLot
    ? fineGoldMgFromTouchPercent(gramsToMg(parsedSourceGross), selectedLot.touchPurity) / 1000
    : 0;
  const parsedAlloyAdded = parseFloat(alloyAddedG || "0");
  const parsedLoss = parseFloat(expectedLossG || "0");
  const expectedTotalGrossOutput = Math.max(0, parsedSourceGross + parsedAlloyAdded - parsedLoss);
  const expectedTotalFineOutput =
    fineGoldMgFromTouchPercent(gramsToMg(expectedTotalGrossOutput), targetTouch) / 1000;

  function resetForm() {
    setSelectedSourceLotId("");
    setSourceGrossInput("");
    setTargetPurityKarat("22K");
    setTargetTouch(91.6);
    setAlloyAddedG("0");
    setExpectedLossG("0.100");
    setNotes("");
  }

  async function handleExecuteConversion() {
    if (!selectedLot) {
      toast.error("Please select a source metal lot from inventory.");
      return;
    }
    if (parsedSourceGross <= 0 || parsedSourceGross > selectedLot.availableGrossG) {
      toast.error(`Invalid gross weight. Available: ${selectedLot.availableGrossG.toFixed(3)}g`);
      return;
    }

    setSaving(true);
    try {
      // 1. Execute Real Inventory Lot conversion
      const res = await executeMetalConversion({
        sourceLotId: selectedLot.id,
        sourceGrossG: parsedSourceGross,
        sourceTouch: selectedLot.touchPurity,
        targetPurityKarat,
        targetTouch,
        alloyType,
        alloyAddedG: parsedAlloyAdded,
        expectedLossG: parsedLoss,
        targetVault,
        targetForm,
        notes: notes || undefined,
        operatorName: operator,
      });

      if (!res.success) {
        toast.error(res.error || "Inventory conversion failed.");
        setSaving(false);
        return;
      }

      // Canonical RPC conversion only — legacy metal-conversion-store is read-only history.
      await refresh();
      await hydrateGoldInventory();

      toast.success(`Conversion complete! Output Lot: ${res.outputLot?.lotNumber}`);
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(String(e?.message || "Conversion execution error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Metal Conversion & Inventory Engine"
        subtitle="Real inventory lot sourcing, purity conversion, master alloy formulation, and multi-ledger gold balance reconciliation."
        actions={
          <Button
            onClick={() => {
              if (activeLots.length > 0 && !selectedSourceLotId) {
                setSelectedSourceLotId(activeLots[0].id);
                setSourceGrossInput(activeLots[0].availableGrossG.toFixed(3));
              }
              setDialogOpen(true);
            }}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="h-4 w-4" />
            New Conversion Batch
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="batches" className="text-xs gap-1.5">
            <Recycle className="h-3.5 w-3.5" /> Conversion Batches ({records.length})
          </TabsTrigger>
          <TabsTrigger value="lineage" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Gold Stock & Traceability Lineage
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Batches Register */}
        <TabsContent value="batches" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardContent className="p-0">
              {/* Desktop View */}
              <div className="overflow-x-auto">
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
                        Input Fine (g)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Output Fine (g)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Melting Loss (g)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                        Operator
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
                          No conversion batches recorded yet. Click &quot;New Conversion Batch&quot;
                          to source metal from the vault.
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
                            {mgToGrams(r.inputFineMg)} g
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-emerald-500 font-bold">
                            {mgToGrams(r.actualOutputFineMg)} g
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-rose-500">
                            {r.conversionLossMg > 0
                              ? `${mgToGrams(r.conversionLossMg)} g`
                              : "0.000 g"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.operator}
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
        </TabsContent>

        {/* TAB 2: Multi-Dimensional Gold Position & Lineage */}
        <TabsContent value="lineage" className="mt-4">
          <GoldLineageTracker />
        </TabsContent>
      </Tabs>

      {/* ── Real Inventory-Driven Conversion Modal ───────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-amber-500">
              <Recycle className="h-5 w-5" />
              Sourced Metal Conversion & Melting Batch
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select available physical metal lots directly from vault inventory. Calculations
              automatically balance pure fine gold.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            {/* Step 1: Select Source Inventory Lot */}
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-amber-500" />
                  1. Source Metal Lot in Vault Custody *
                </label>
                <Badge variant="outline" className="text-[10px]">
                  {activeLots.length} Lots Available
                </Badge>
              </div>

              <select
                value={selectedSourceLotId}
                onChange={(e) => {
                  setSelectedSourceLotId(e.target.value);
                  const lot = activeLots.find((l) => l.id === e.target.value);
                  if (lot) setSourceGrossInput(lot.availableGrossG.toFixed(3));
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs font-mono"
              >
                <option value="">-- Choose Vault Lot --</option>
                {activeLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNumber} ({lot.purityKarat} · {lot.touchPurity}% · {lot.physicalForm}) —
                    Avail: {lot.availableGrossG.toFixed(3)}g [{lot.vaultLocation}]
                  </option>
                ))}
              </select>

              {selectedLot && (
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-1.5 bg-card rounded border">
                    <span className="text-[10px] text-muted-foreground block">
                      Available Gross:
                    </span>
                    <span className="font-bold">{selectedLot.availableGrossG.toFixed(3)} g</span>
                  </div>
                  <div className="p-1.5 bg-card rounded border">
                    <span className="text-[10px] text-muted-foreground block">Touch Purity:</span>
                    <span className="font-bold">{selectedLot.touchPurity.toFixed(2)}%</span>
                  </div>
                  <div className="p-1.5 bg-card rounded border">
                    <span className="text-[10px] text-muted-foreground block">Available Fine:</span>
                    <span className="font-bold text-amber-600">
                      {selectedLot.availableFineG.toFixed(3)} g
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Source Gross Weight & Destination Karat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground block mb-1">
                  Gross Weight To Convert (g) *
                </label>
                <Input
                  type="number"
                  placeholder="0.000"
                  value={sourceGrossInput}
                  onChange={(e) => setSourceGrossInput(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Target Karat Purity *</label>
                <select
                  value={targetPurityKarat}
                  onChange={(e) => {
                    const k = e.target.value as any;
                    setTargetPurityKarat(k);
                    if (k === "24K") setTargetTouch(99.9);
                    if (k === "22K") setTargetTouch(91.6);
                    if (k === "18K") setTargetTouch(75.0);
                    if (k === "14K") setTargetTouch(58.5);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="24K">24K Fine Gold (99.90% Touch)</option>
                  <option value="22K">22K Hallmark Gold (91.60% Touch)</option>
                  <option value="18K">18K Diamond Jewellery (75.00% Touch)</option>
                  <option value="14K">14K Export Grade (58.50% Touch)</option>
                </select>
              </div>
            </div>

            {/* Step 3: Master Alloy & Loss Allowance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-muted-foreground block mb-1">Master Alloy Addition</label>
                <select
                  value={alloyType}
                  onChange={(e) => setAlloyType(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="copper_silver_master">Copper-Silver Master Alloy</option>
                  <option value="pure_copper">Electrolytic Copper (Red)</option>
                  <option value="pure_silver">Fine Silver 999 (Green)</option>
                  <option value="fine_gold_999">Fine Gold 999 Granules</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Alloy Added Weight (g)</label>
                <Input
                  type="number"
                  placeholder="0.000"
                  value={alloyAddedG}
                  onChange={(e) => setAlloyAddedG(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">
                  Expected Melting Loss (g)
                </label>
                <Input
                  type="number"
                  placeholder="0.100"
                  value={expectedLossG}
                  onChange={(e) => setExpectedLossG(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Step 4: Destination Vault & Physical Output Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-muted-foreground block mb-1">Target Vault Location</label>
                <select
                  value={targetVault}
                  onChange={(e) => setTargetVault(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="Main Strongroom">Main Strongroom</option>
                  <option value="Casting Vault">Casting Vault</option>
                  <option value="Scrap Crucible Tray">Scrap Crucible Tray</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Target Physical Form</label>
                <select
                  value={targetForm}
                  onChange={(e) => setTargetForm(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="granules">Granules (for Casting)</option>
                  <option value="bar">Solid Ingot / Bar</option>
                  <option value="sheet">Rolling Mill Sheet</option>
                  <option value="wire">Drawing Wire</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Master Operator</label>
                <Input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Live Calculation Reconciler */}
            <div className="p-3.5 rounded-lg border bg-amber-500/5 border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Live Fine Gold Conservation Audit
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                >
                  Strict Zero-Leak Balance
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">
                    Source Fine (999):
                  </span>
                  <span className="font-bold text-amber-600">{sourceFineGoldG.toFixed(3)} g</span>
                </div>
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Alloy Added:</span>
                  <span className="font-bold text-foreground">
                    +{parsedAlloyAdded.toFixed(3)} g
                  </span>
                </div>
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">Output Gross Wt:</span>
                  <span className="font-bold text-foreground">
                    {expectedTotalGrossOutput.toFixed(3)} g
                  </span>
                </div>
                <div className="p-1.5 rounded bg-card border">
                  <span className="text-[10px] text-muted-foreground block">
                    Output Fine (999):
                  </span>
                  <span className="font-bold text-emerald-600">
                    {expectedTotalFineOutput.toFixed(3)} g
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
              onClick={handleExecuteConversion}
              disabled={saving || !selectedLot || parsedSourceGross <= 0}
              className="h-8 text-xs gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Recycle className="h-4 w-4" />
              {saving ? "Posting to Vault & Ledgers…" : "Execute Conversion Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
