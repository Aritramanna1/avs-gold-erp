import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Recycle, Plus, Printer } from "lucide-react";
import { useMetalConversion } from "@/lib/metal-conversion-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { toast } from "sonner";

export const Route = createFileRoute("/conversion/")({
  head: () => ({ meta: [{ title: "Metal Conversion · AVS Gold ERP" }] }),
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
  const { records, refresh, convert } = useMetalConversion();
  const purities = useSettings((s) => s.purities);
  const alloyFormulas = useSettings((s) => s.alloyFormulas);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sourcePurity, setSourcePurity] = useState("");
  const [destPurity, setDestPurity] = useState("");
  const [inputGrams, setInputGrams] = useState("");
  const [actualOutputGrams, setActualOutputGrams] = useState("");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const formula = useMemo(
    () =>
      alloyFormulas.find(
        (f) =>
          f.active &&
          f.fromPurityPermille === purityValue(sourcePurity) &&
          f.toPurityPermille === purityValue(destPurity),
      ),
    [alloyFormulas, sourcePurity, destPurity],
  );

  const inputFineMg = safeGramsToMg(inputGrams);
  const expectedOutputMg = formula
    ? Math.round(inputFineMg * (1 - formula.expectedLossPct / 100))
    : 0;
  const calculatedAlloyMg = formula
    ? Math.max(0, Math.round((inputFineMg * formula.alloyRatioMgPer1000) / 1000))
    : 0;

  function resetForm() {
    setSourcePurity("");
    setDestPurity("");
    setInputGrams("");
    setActualOutputGrams("");
    setOperator("");
    setNotes("");
  }

  async function handleSave() {
    if (!sourcePurity || !destPurity || !operator) {
      toast.error("Source purity, destination purity, and operator are required.");
      return;
    }
    setSaving(true);
    try {
      await convert({
        sourcePurity: purityValue(sourcePurity),
        destPurity: purityValue(destPurity),
        inputFineMg,
        actualOutputFineMg: safeGramsToMg(actualOutputGrams),
        alloyAddedMg: calculatedAlloyMg,
        operator,
        notes: notes || undefined,
      });
      toast.success("Conversion recorded — Gold Vault updated.");
      setDialogOpen(false);
      resetForm();
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : "Conversion failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Metal Conversion"
        subtitle="Purity conversion — source and destination purity, alloy added, loss and recovery"
        actions={
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Conversion
          </Button>
        }
      />

      <Card className="border-border">
        <CardContent className="p-0">
          {/* Mobile View */}
          <div className="block md:hidden divide-y divide-border">
            {records.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Recycle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No conversions yet. Create one to get started.
              </div>
            ) : (
              records.map((r) => (
                <div key={r.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-gold">{r.batchNo}</span>
                    <span className="text-xs text-muted-foreground font-medium">{r.operator}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>
                      Purity:{" "}
                      <strong className="font-medium text-foreground">
                        {r.sourcePurity} → {r.destPurity}
                      </strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 bg-muted/20 p-2 rounded-lg text-center font-mono text-[10px]">
                    <div>
                      <span className="text-[8px] text-muted-foreground block uppercase font-sans">
                        Input
                      </span>
                      <span>{mgToGrams(r.inputFineMg)}g</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground block uppercase font-sans">
                        Output
                      </span>
                      <span className="text-green-400 font-semibold">
                        {mgToGrams(r.actualOutputFineMg)}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground block uppercase font-sans">
                        Loss
                      </span>
                      <span className="text-red-400 font-semibold">
                        {r.conversionLossMg > 0 ? `${mgToGrams(r.conversionLossMg)}g` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground block uppercase font-sans">
                        Recovery
                      </span>
                      <span>{r.recoveryMg > 0 ? `${mgToGrams(r.recoveryMg)}g` : "—"}</span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Link
                      to="/conversion/slip/$id"
                      params={{ id: r.id }}
                      className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Batch No
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Purity
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Input (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Output (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Loss (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Recovery (g)
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      <Recycle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No conversions yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => (
                    <TableRow key={r.id} className="border-border hover:bg-card/60">
                      <TableCell className="font-mono text-xs font-semibold text-gold">
                        {r.batchNo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.sourcePurity} → {r.destPurity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {mgToGrams(r.inputFineMg)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-400">
                        {mgToGrams(r.actualOutputFineMg)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-400">
                        {r.conversionLossMg > 0 ? mgToGrams(r.conversionLossMg) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.recoveryMg > 0 ? mgToGrams(r.recoveryMg) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.operator}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          to="/conversion/slip/$id"
                          params={{ id: r.id }}
                          className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
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
        <DialogContent className="max-w-lg w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              <Recycle className="h-5 w-5" />
              New Metal Conversion
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Source Purity</label>
                <Select value={sourcePurity} onValueChange={setSourcePurity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {purities.map((p) => (
                      <SelectItem key={p.id} value={`${p.metal ?? "Gold"}:${p.permille}`}>
                        {p.metal ?? "Gold"} · {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Destination Purity</label>
                <Select value={destPurity} onValueChange={setDestPurity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {purities.map((p) => (
                      <SelectItem key={p.id} value={`${p.metal ?? "Gold"}:${p.permille}`}>
                        {p.metal ?? "Gold"} · {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sourcePurity && destPurity && !formula && (
              <p className="text-xs text-red-400">
                No conversion formula configured for this pair — add one under Settings → Workshop
                Processes before saving.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Input Weight (g, fine)</label>
                <Input
                  placeholder="0.000"
                  value={inputGrams}
                  onChange={(e) => setInputGrams(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Actual Output (g, fine)</label>
                <Input
                  placeholder="0.000"
                  value={actualOutputGrams}
                  onChange={(e) => setActualOutputGrams(e.target.value)}
                />
              </div>
            </div>

            {formula && inputGrams && (
              <p className="text-xs text-muted-foreground">
                Expected output:{" "}
                <span className="text-gold font-mono">{mgToGrams(expectedOutputMg)} g</span> (@{" "}
                {formula.expectedLossPct}% expected loss)
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Calculated Alloy (mg)</label>
                <Input value={calculatedAlloyMg || ""} readOnly aria-readonly="true" />
                <p className="text-[11px] text-muted-foreground">
                  From the active Settings formula.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Operator</label>
                <Input value={operator} onChange={(e) => setOperator(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Recycle className="h-4 w-4" />
              {saving ? "Saving…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
