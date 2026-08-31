import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Hammer, Plus, CheckCircle } from "lucide-react";
import { useWorkshopProcess, type WorkshopProcessTransaction } from "@/lib/workshop-process-store";
import { useSettings, type WorkshopProcessType } from "@/lib/settings-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { toast } from "sonner";

export const Route = createFileRoute("/workshop/process/$type")({
  head: ({ params }) => ({
    meta: [{ title: `${processLabel(params.type)} · AVS Gold ERP` }],
  }),
  component: WorkshopProcessPage,
});

function processLabel(type: string): string {
  const labels: Record<string, string> = {
    kdm: "KDM",
    meena: "Meena (Enamel)",
    stone_setting: "Stone Setting",
    polish: "Polish",
    cutting: "Cutting",
  };
  return labels[type] ?? type;
}

function safeGramsToMg(val: string): number {
  try {
    return gramsToMg(val);
  } catch {
    return 0;
  }
}

function WorkshopProcessPage() {
  const { type } = useParams({ from: "/workshop/process/$type" });
  const processType = type as WorkshopProcessType;
  const { transactions, refresh, issue, complete } = useWorkshopProcess();
  const cfg = useSettings((s) => s.workshopProcesses.find((p) => p.processType === processType));
  const people = usePeople((s) => s.people);
  const karigars = useMemo(() => people.filter((p) => p.type === "karigar" && p.active), [people]);

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [completeTx, setCompleteTx] = useState<WorkshopProcessTransaction | null>(null);
  const [karigarId, setKarigarId] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [purity, setPurity] = useState("916");
  const [stoneCount, setStoneCount] = useState("");
  const [stoneWeightGrams, setStoneWeightGrams] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const [weightAfterGrams, setWeightAfterGrams] = useState("");
  const [recoveryGrams, setRecoveryGrams] = useState("");
  const [labourRs, setLabourRs] = useState("");
  const [completeRemarks, setCompleteRemarks] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => transactions.filter((t) => t.processType === processType),
    [transactions, processType],
  );

  function openComplete(tx: WorkshopProcessTransaction) {
    setCompleteTx(tx);
    setWeightAfterGrams(mgToGrams(tx.weightBeforeMg));
    setRecoveryGrams("");
    setLabourRs(cfg ? (cfg.labourRatePaise / 100).toFixed(2) : "");
    setCompleteRemarks("");
  }

  async function handleIssue() {
    if (!karigarId) {
      toast.error("Select a karigar.");
      return;
    }
    setSaving(true);
    try {
      const karigar = karigars.find((k) => k.id === karigarId);
      await issue({
        processType,
        karigarId,
        karigarName: karigar?.fullName ?? "—",
        weightBeforeMg: safeGramsToMg(weightGrams),
        purity: parseInt(purity, 10) || 916,
        stoneCount:
          processType === "stone_setting"
            ? Math.max(0, parseInt(stoneCount || "0", 10))
            : undefined,
        stoneWeightMg:
          processType === "stone_setting" && stoneWeightGrams
            ? safeGramsToMg(stoneWeightGrams)
            : undefined,
        remarks: remarks || undefined,
      });
      toast.success(`${processLabel(processType)} gold issued — Gold Vault updated.`);
      setIssueDialogOpen(false);
      setKarigarId("");
      setWeightGrams("");
      setStoneCount("");
      setStoneWeightGrams("");
      setRemarks("");
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : "Issue failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!completeTx) return;
    setSaving(true);
    try {
      await complete(completeTx.id, {
        weightAfterMg: safeGramsToMg(weightAfterGrams),
        recoveryMg: safeGramsToMg(recoveryGrams),
        labourChargesPaise: Math.round(parseFloat(labourRs || "0") * 100),
        remarks: completeRemarks || undefined,
      });
      toast.success(`${processLabel(processType)} completed — Gold Vault and Audit Trail updated.`);
      setCompleteTx(null);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : "Could not complete"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title={processLabel(processType)}
        subtitle={
          cfg
            ? `Allowed loss ${cfg.allowedLossPct}% — labour ${cfg.labourCalcMethod.replace("_", " ")}`
            : "No configuration found — add one under Settings → Workshop Processes"
        }
        actions={
          <Button
            onClick={() => setIssueDialogOpen(true)}
            className="gap-2"
            disabled={!cfg?.active}
          >
            <Plus className="h-4 w-4" />
            Issue Gold
          </Button>
        }
      />

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Karigar
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Weight Before (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Weight After (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Actual Loss (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Excess Loss (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <Hammer className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No {processLabel(processType)} transactions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tx) => (
                    <TableRow key={tx.id} className="border-border hover:bg-card/60">
                      <TableCell className="text-sm">{tx.karigarName}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {mgToGrams(tx.weightBeforeMg)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {tx.status === "completed" ? mgToGrams(tx.weightAfterMg) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-400">
                        {tx.status === "completed" && tx.actualLossMg > 0
                          ? mgToGrams(tx.actualLossMg)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {tx.excessLossMg > 0 ? (
                          <span className="text-red-500 font-bold">
                            {mgToGrams(tx.excessLossMg)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            tx.status === "completed"
                              ? "bg-green-500/15 text-green-400 border-green-500/30 text-[10px] border"
                              : "bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] border"
                          }
                        >
                          {tx.status === "completed" ? "Completed" : "Issued"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.status === "issued" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => openComplete(tx)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              <Hammer className="h-5 w-5" />
              Issue Gold — {processLabel(processType)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Karigar</label>
              <Select value={karigarId} onValueChange={setKarigarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select karigar" />
                </SelectTrigger>
                <SelectContent>
                  {karigars.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Weight Before (g)</label>
                <Input
                  placeholder="0.000"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Purity (‰)</label>
                <Input value={purity} onChange={(e) => setPurity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Remarks</label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            {processType === "stone_setting" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Stone Count</label>
                  <Input
                    type="number"
                    min="0"
                    value={stoneCount}
                    onChange={(e) => setStoneCount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Stone Weight (g)</label>
                  <Input
                    value={stoneWeightGrams}
                    onChange={(e) => setStoneWeightGrams(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIssueDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleIssue} disabled={saving} className="gap-2">
              {saving ? "Issuing…" : "Issue Gold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={!!completeTx} onOpenChange={(open) => !open && setCompleteTx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              <CheckCircle className="h-5 w-5" />
              Complete — {processLabel(processType)}
            </DialogTitle>
          </DialogHeader>
          {completeTx && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Weight before:{" "}
                <span className="font-mono text-gold">
                  {mgToGrams(completeTx.weightBeforeMg)} g
                </span>{" "}
                — Allowed loss:{" "}
                <span className="font-mono">{mgToGrams(completeTx.allowedLossMg)} g</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Weight After (g)</label>
                  <Input
                    value={weightAfterGrams}
                    onChange={(e) => setWeightAfterGrams(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Recovery (g)</label>
                  <Input
                    value={recoveryGrams}
                    onChange={(e) => setRecoveryGrams(e.target.value)}
                    disabled={!cfg?.recoveryApplicable}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Labour Charges (Rs.)</label>
                <Input value={labourRs} onChange={(e) => setLabourRs(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Remarks</label>
                <Input
                  value={completeRemarks}
                  onChange={(e) => setCompleteRemarks(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setCompleteTx(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={saving} className="gap-2">
              {saving ? "Saving…" : "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
