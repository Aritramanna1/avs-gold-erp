import { createFileRoute, useParams, useNavigate, useRouterState } from "@tanstack/react-router";
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
  DialogDescription,
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
import { Hammer, Plus, CheckCircle, PackageCheck } from "lucide-react";
import {
  useWorkshopProcess,
  computeWorkshopProcessPosition,
  processIssuesFromVault,
  type WorkshopProcessTransaction,
} from "@/lib/workshop-process-store";
import { useSettings, type WorkshopProcessType } from "@/lib/settings-store";
import { usePeople } from "@/lib/people-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { useLedger } from "@/lib/ledger-store";
import { useOrders } from "@/lib/orders-store";
import { useMaterialVault, DEFAULT_MATERIAL_CATEGORIES } from "@/lib/material-vault-store";
import { useManufacturingMaterials } from "@/lib/manufacturing-materials-store";
import {
  workshopProcessMaterialToVaultCategory,
  RETURN_VAULT_MOVEMENT_TYPE,
} from "@/lib/material-vault-sync";
import { assertTransactionGoldIssueFromLedger } from "@/lib/transaction-ledger-guards";
import { VaultGoldStockSelect } from "@/components/VaultGoldStockSelect";
import type { VaultGoldPurityLine } from "@/lib/vault-gold-stock";
import { computeFineGold } from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { mgToGrams, gramsToMg, COMMON_PURITIES } from "@/lib/gold";
import { toast } from "sonner";
import { TransactionModuleNav } from "@/components/transaction-module-nav";
import {
  captureWorkshopProcessIssue,
  captureWorkshopProcessComplete,
  PENDING_SYNC_GOLD,
} from "@/lib/offline";
import { OnlineRequiredError } from "@/lib/offline/queue";

const MFG_MATERIAL_CATEGORIES = DEFAULT_MATERIAL_CATEGORIES.filter(
  (c) => c.group === "manufacturing_materials",
);

type ListFilter = "all" | "open" | "completed" | "overdue";

export const Route = createFileRoute("/workshop/process/$type")({
  head: ({ params }) => ({
    meta: [{ title: `${processLabel(params.type)} · AVS ERP` }],
  }),
  component: WorkshopProcessPage,
});

function getProcessConfig(type: string) {
  const processes = useSettings.getState().workshopProcesses || [];
  return processes.find(
    (p) =>
      p.processType === type ||
      p.id === type ||
      p.id === `wp_${type}` ||
      p.label.toLowerCase().replace(/\s+/g, "_") === type.toLowerCase(),
  );
}

function processLabel(type: string): string {
  const custom = getProcessConfig(type);
  if (custom) return custom.label;
  const labels: Record<string, string> = {
    kdm: "Manufacturing Material Making",
    meena: "Meena (Enamel)",
    stone_setting: "Stone Setting",
    polish: "Polish",
    cutting: "Cutting",
    casting: "Casting",
    filing: "Filing / Ghasai",
    setting: "Setting / Jadhai",
    engraving: "Engraving / Chhilai",
    plating: "Plating / Electroplating",
    rhodium: "Rhodium / Two-Tone",
    outside_work: "Outside Work / Bahar Ka Kaam",
  };
  return labels[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLabourPaymentProcess(type: WorkshopProcessType): boolean {
  const cfg = getProcessConfig(type);
  if (cfg) return cfg.labourRatePaise > 0 || cfg.labourCalcMethod !== "per_gram";
  return type === "stone_setting" || type === "cutting" || type === "setting" || type === "engraving" || type === "plating" || type === "rhodium";
}

function safeGramsToMg(val: string): number {
  try {
    return gramsToMg(val);
  } catch {
    return 0;
  }
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function WorkshopProcessPage() {
  const { type } = useParams({ from: "/workshop/process/$type" });
  const searchOrderId = useRouterState({
    select: (s) => {
      const raw = s.location.search;
      if (typeof raw === "string") {
        return new URLSearchParams(raw).get("orderId") ?? undefined;
      }
      if (raw && typeof raw === "object" && "orderId" in raw) {
        const v = (raw as { orderId?: unknown }).orderId;
        return typeof v === "string" ? v : undefined;
      }
      return undefined;
    },
  });
  const navigate = useNavigate();
  const processType = type as WorkshopProcessType;

  // Canonical polishing is the WIP Polishing module — not a vault-issue process book.
  useEffect(() => {
    if (processType === "polish") {
      void navigate({ to: "/workshop/polishing", replace: true });
    }
  }, [processType, navigate]);

  const fromVault = processIssuesFromVault(processType);
  const isMeena = processType === "meena";
  const { transactions, refresh } = useWorkshopProcess();
  const cfg = useSettings((s) => s.workshopProcesses.find((p) => p.processType === processType));
  const isEnabledInWorkflow = useWorkflowEngine((s) => s.isProcessEnabled(processType));
  const people = usePeople((s) => s.people);
  const workflowConfig = useWorkflowEngine((s) => s.config);
  const meenaProcessType = workflowConfig.meenaProcessType ?? "outside";

  const karigars = useMemo(() => {
    const active = people.filter((p) => p.active);
    if (isMeena) {
      if (meenaProcessType === "outside") {
        const outside = active.filter(
          (p) =>
            p.type === "outside_karigar" ||
            p.type === "outside_worker" ||
            p.type === "vendor" ||
            p.type === "service_provider",
        );
        if (outside.length > 0) return outside;
      } else {
        const inHouse = active.filter((p) => p.type === "karigar" || p.type === "worker");
        if (inHouse.length > 0) return inHouse;
      }
    }
    return active.filter(
      (p) =>
        p.type === "karigar" ||
        p.type === "worker" ||
        p.type === "outside_karigar" ||
        p.type === "outside_worker",
    );
  }, [people, isMeena, meenaProcessType]);

  const labourPayOnly = isLabourPaymentProcess(processType);
  const entries = useLedger((s) => s.entries);
  const appendVault = useMaterialVault((s) => s.append);
  const allOrders = useOrders((s) => s.orders);
  const mfgMaterials = useManufacturingMaterials((s) => s.materials);
  const refreshMaterials = useManufacturingMaterials((s) => s.refresh);

  const materialOptions = useMemo(() => {
    const active = mfgMaterials.filter((m) => m.active);
    if (active.length > 0) {
      return active.map((m) => ({ key: m.vaultCategoryKey, label: m.name }));
    }
    return MFG_MATERIAL_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));
  }, [mfgMaterials]);

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [completeTx, setCompleteTx] = useState<WorkshopProcessTransaction | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [karigarId, setKarigarId] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [weightGrams, setWeightGrams] = useState("");
  const [purity, setPurity] = useState("916");
  const [vaultStockId, setVaultStockId] = useState("");
  const [vaultLine, setVaultLine] = useState<VaultGoldPurityLine | null>(null);
  const [materialCategory, setMaterialCategory] = useState("");
  const [expectedReadyDate, setExpectedReadyDate] = useState("");
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

  useEffect(() => {
    if (fromVault) void refreshMaterials();
  }, [fromVault, refreshMaterials]);

  useEffect(() => {
    if (materialOptions.length && !materialCategory) {
      setMaterialCategory(materialOptions[0].key);
    }
  }, [materialOptions, materialCategory]);

  useEffect(() => {
    if (isMeena && searchOrderId) {
      setOrderId(searchOrderId);
    }
  }, [isMeena, searchOrderId]);

  const filteredAll = useMemo(
    () => transactions.filter((t) => t.processType === processType),
    [transactions, processType],
  );

  const position = useMemo(
    () => computeWorkshopProcessPosition(filteredAll, processType, todayYmd()),
    [filteredAll, processType],
  );

  const filtered = useMemo(() => {
    const today = todayYmd();
    if (listFilter === "open") return filteredAll.filter((t) => t.status === "issued");
    if (listFilter === "completed") return filteredAll.filter((t) => t.status === "completed");
    if (listFilter === "overdue") {
      return filteredAll.filter(
        (t) =>
          t.status === "issued" && !!t.expectedReadyDate && t.expectedReadyDate < today,
      );
    }
    return filteredAll;
  }, [filteredAll, listFilter]);

  function openComplete(tx: WorkshopProcessTransaction) {
    setCompleteTx(tx);
    setWeightAfterGrams(mgToGrams(tx.weightBeforeMg));
    setRecoveryGrams("");
    setLabourRs(cfg ? (cfg.labourRatePaise / 100).toFixed(2) : "");
    setCompleteRemarks("");
  }

  function resetIssueForm() {
    setKarigarId("");
    setOrderId("none");
    setWeightGrams("");
    setPurity("916");
    setVaultStockId("");
    setVaultLine(null);
    setMaterialCategory(materialOptions[0]?.key ?? "kdm_balls");
    setExpectedReadyDate("");
    setStoneCount("");
    setStoneWeightGrams("");
    setRemarks("");
  }

  async function handleIssue() {
    if (!isEnabledInWorkflow) {
      toast.error(`Process "${processLabel(processType)}" is disabled under current Workflow Engine configuration.`);
      return;
    }
    if (!karigarId) {
      toast.error("Select a karigar.");
      return;
    }
    if (fromVault && !materialCategory) {
      toast.error("Select a manufacturing material type.");
      return;
    }
    if ((fromVault || isMeena) && !expectedReadyDate.trim()) {
      toast.error(
        fromVault
          ? "Enter the material ready / delivery date."
          : "Enter the expected ready / return date.",
      );
      return;
    }
    const weightBeforeMg = safeGramsToMg(weightGrams);
    if (weightBeforeMg <= 0) {
      toast.error("Enter weight greater than 0 g.");
      return;
    }
    const purityPermille = fromVault
      ? vaultLine?.purity ?? (parseInt(purity, 10) || 0)
      : parseInt(purity, 10) || 0;
    if (!purityPermille) {
      toast.error(fromVault ? "Select gold from live Gold Vault stock." : "Enter purity.");
      return;
    }
    setSaving(true);
    try {
      const rules = currentGoldCalculationRules();
      const fineMg = computeFineGold(
        { module: "karigar_issue", grossMg: weightBeforeMg, purityPermille },
        rules,
      ).fineMg;

      if (fromVault) {
        assertTransactionGoldIssueFromLedger({
          entries,
          purityPermille,
          fineMg,
          grossMg: weightBeforeMg,
          vaultStockLineId: vaultStockId,
        });
      }

      const karigar = karigars.find((k) => k.id === karigarId);
      const matLabel =
        materialOptions.find((c) => c.key === materialCategory)?.label ?? materialCategory;
      const linkedOrder =
        isMeena && orderId !== "none"
          ? allOrders.find((o) => o.id === orderId)
          : undefined;

      const queued = await captureWorkshopProcessIssue({
        processType,
        karigarId,
        karigarName: karigar?.fullName ?? "—",
        orderId: linkedOrder?.id,
        orderNo: linkedOrder?.orderNo,
        weightBeforeMg,
        purity: purityPermille,
        vaultStockLineId: fromVault ? vaultStockId : undefined,
        materialCategoryKey: fromVault ? materialCategory : undefined,
        materialCategoryLabel: fromVault ? matLabel : undefined,
        expectedReadyDate: expectedReadyDate || undefined,
        stoneCount:
          processType === "stone_setting"
            ? Math.max(0, parseInt(stoneCount || "0", 10))
            : undefined,
        stoneWeightMg:
          processType === "stone_setting" && stoneWeightGrams
            ? safeGramsToMg(stoneWeightGrams)
            : undefined,
        remarks: remarks.trim() || undefined,
      });

      // MMM: Gold Vault already debited in store. Do NOT debit Material Vault
      // finished category on issue (that invented −loss stock). Credit on complete.

      if (queued.mode === "queued") {
        toast.message(PENDING_SYNC_GOLD);
      } else {
        toast.success(
          fromVault
            ? "Manufacturing Material Making issued from live Gold Vault."
            : "Meena send recorded (WIP — vault unchanged).",
        );
        if (isMeena && linkedOrder?.id) {
          const { markOrderJobsOutsideProcessing } = await import("@/lib/jobcards-store");
          await markOrderJobsOutsideProcessing(
            linkedOrder.id,
            `Meena send → ${karigar?.fullName ?? karigarId}`,
            "meena",
          );
        }
      }
      setIssueDialogOpen(false);
      resetIssueForm();
    } catch (e) {
      toast.error(
        e instanceof OnlineRequiredError
          ? e.message
          : String(e instanceof Error ? e.message : "Send failed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!completeTx) return;
    setSaving(true);
    try {
      const weightAfterMg = safeGramsToMg(weightAfterGrams);
      const recoveryMg = safeGramsToMg(recoveryGrams);
      const queued = await captureWorkshopProcessComplete(completeTx.id, {
        weightAfterMg,
        recoveryMg,
        labourChargesPaise: Math.round(parseFloat(labourRs || "0") * 100),
        remarks: completeRemarks || undefined,
      });

      // Credit finished manufacturing material only after ledger complete succeeds (not offline-queued).
      if (
        queued.mode !== "queued" &&
        processIssuesFromVault(completeTx.processType) &&
        completeTx.materialCategoryKey
      ) {
        const { data } = await supabase.auth.getSession();
        const actor = {
          actorId: data.session?.user.id ?? null,
          actorEmail: data.session?.user.email ?? null,
        };
        if (weightAfterMg > 0) {
          const vaultCategory = workshopProcessMaterialToVaultCategory(
            completeTx.materialCategoryKey,
          );
          await appendVault({
            category: vaultCategory,
            type: RETURN_VAULT_MOVEMENT_TYPE,
            deltaMg: weightAfterMg,
            grossMg: weightAfterMg,
            purity: completeTx.purity,
            reference: completeTx.karigarName,
            remarks: completeTx.materialCategoryLabel ?? completeTx.materialCategoryKey,
            ...actor,
          });
        }
        if (recoveryMg > 0) {
          await appendVault({
            category: "recovery_gold",
            type: RETURN_VAULT_MOVEMENT_TYPE,
            deltaMg: recoveryMg,
            grossMg: recoveryMg,
            purity: completeTx.purity,
            reference: completeTx.karigarName,
            remarks: "MMM recovery",
            ...actor,
          });
        }
      }

      if (queued.mode === "queued") {
        toast.message(PENDING_SYNC_GOLD);
      } else {
        toast.success(
          fromVault
            ? "Completed — finished material credited to Material Vault."
            : "Received — loss recorded on the Meena register (vault unchanged).",
        );
        if (isMeena && completeTx.orderId) {
          const { clearOrderJobsOutsideProcessing } = await import("@/lib/jobcards-store");
          await clearOrderJobsOutsideProcessing(
            completeTx.orderId,
            `Meena receive ← ${completeTx.karigarName}`,
          );
        }
      }
      setCompleteTx(null);
    } catch (e) {
      toast.error(
        e instanceof OnlineRequiredError
          ? e.message
          : String(e instanceof Error ? e.message : "Could not complete"),
      );
    } finally {
      setSaving(false);
    }
  }

  const primaryActionLabel = fromVault ? "Issue from Vault" : "Send";
  const statusOpenLabel = fromVault ? "Receivable" : "Sent";
  const completeLabel = fromVault ? "Complete" : "Receive";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <TransactionModuleNav />
      {!isEnabledInWorkflow && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-md text-sm font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>
            This workshop process is currently <strong>disabled</strong> under the authoritative Workflow Engine configuration.
          </span>
        </div>
      )}
      <PageHeader
        title={processLabel(processType)}
        subtitle={
          labourPayOnly
            ? "Weight tracking only. Labour / charges for outsource karigars go under Receipts & Payments or Attendance & Payroll — not allocated process loss."
            : fromVault
              ? `Convert vault gold into manufacturing materials. Allowed loss ${cfg?.allowedLossPct ?? "—"}%. Open issues stay receivable until complete.`
              : isMeena
                ? "Manufacturing step on work already in process. Send weight before → receive weight after. Optional order link. Does not issue from Gold Vault."
                : cfg
                  ? `Allowed loss ${cfg.allowedLossPct}% — labour ${cfg.labourCalcMethod.replace("_", " ")}`
                  : "No configuration found — add one under Settings → Workshop Processes"
        }
        actions={
          <Button
            onClick={() => setIssueDialogOpen(true)}
            className="gap-2"
            disabled={!cfg?.active || !isEnabledInWorkflow}
          >
            <Plus className="h-4 w-4" />
            {primaryActionLabel}
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open</p>
            <p className="text-lg font-semibold font-mono">{position.openCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Outstanding fine
            </p>
            <p className="text-lg font-semibold font-mono text-gold">
              {mgToGrams(position.outstandingFineMg)} g
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</p>
            <p
              className={`text-lg font-semibold font-mono ${position.overdueCount > 0 ? "text-red-400" : ""}`}
            >
              {position.overdueCount}
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-end gap-2 col-span-2 md:col-span-1">
          {(["all", "open", "completed", "overdue"] as ListFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={listFilter === f ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => setListFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="block md:hidden divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No {processLabel(processType)} transactions yet.
              </div>
            ) : (
              filtered.map((tx) => {
                const overdue =
                  tx.status === "issued" &&
                  !!tx.expectedReadyDate &&
                  tx.expectedReadyDate < todayYmd();
                return (
                  <div key={tx.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{tx.karigarName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          Before {mgToGrams(tx.weightBeforeMg)} g
                          {tx.status === "completed"
                            ? ` · After ${mgToGrams(tx.weightAfterMg)} g`
                            : ""}
                          {tx.materialCategoryLabel ? ` · ${tx.materialCategoryLabel}` : ""}
                          {tx.expectedReadyDate ? ` · Ready ${tx.expectedReadyDate}` : ""}
                          {tx.orderNo ? ` · ${tx.orderNo}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge
                          className={
                            tx.status === "completed"
                              ? "bg-green-500/15 text-green-400 border-green-500/30 text-[10px] border"
                              : "bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] border"
                          }
                        >
                          {tx.status === "completed" ? "Completed" : statusOpenLabel}
                        </Badge>
                        {overdue ? (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] border">
                            Overdue
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {tx.status === "issued" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full min-h-[var(--touch-target)] text-green-400 border-green-500/30"
                        onClick={() => openComplete(tx)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {completeLabel}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Karigar
                  </TableHead>
                  {fromVault ? (
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                      Material
                    </TableHead>
                  ) : null}
                  {isMeena ? (
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                      Order
                    </TableHead>
                  ) : null}
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Weight Before (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                    Weight After (g)
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Ready
                  </TableHead>
                  {!labourPayOnly ? (
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                      Loss (g)
                    </TableHead>
                  ) : null}
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
                    <TableCell
                      colSpan={fromVault || isMeena ? 9 : 8}
                      className="text-center text-muted-foreground py-12"
                    >
                      <Hammer className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No {processLabel(processType)} transactions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tx) => {
                    const overdue =
                      tx.status === "issued" &&
                      !!tx.expectedReadyDate &&
                      tx.expectedReadyDate < todayYmd();
                    return (
                      <TableRow key={tx.id} className="border-border hover:bg-card/60">
                        <TableCell className="text-sm">{tx.karigarName}</TableCell>
                        {fromVault ? (
                          <TableCell className="text-xs">
                            {tx.materialCategoryLabel ?? "—"}
                          </TableCell>
                        ) : null}
                        {isMeena ? (
                          <TableCell className="text-xs font-mono">{tx.orderNo ?? "—"}</TableCell>
                        ) : null}
                        <TableCell className="text-right font-mono text-sm">
                          {mgToGrams(tx.weightBeforeMg)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {tx.status === "completed" ? mgToGrams(tx.weightAfterMg) : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {tx.expectedReadyDate ?? "—"}
                          {overdue ? (
                            <span className="ml-1 text-red-400 text-[10px]">Overdue</span>
                          ) : null}
                        </TableCell>
                        {!labourPayOnly ? (
                          <TableCell className="text-right font-mono text-sm text-red-400">
                            {tx.status === "completed" && tx.actualLossMg > 0
                              ? mgToGrams(tx.actualLossMg)
                              : "—"}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Badge
                            className={
                              tx.status === "completed"
                                ? "bg-green-500/15 text-green-400 border-green-500/30 text-[10px] border"
                                : "bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] border"
                            }
                          >
                            {tx.status === "completed" ? "Completed" : statusOpenLabel}
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
                              {completeLabel}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              {fromVault ? (
                <Hammer className="h-5 w-5" />
              ) : (
                <PackageCheck className="h-5 w-5" />
              )}
              {fromVault
                ? `Issue from Vault — ${processLabel(processType)}`
                : `Send to ${processLabel(processType)}`}
            </DialogTitle>
            <DialogDescription>
              {fromVault
                ? "Draw live Gold Vault stock. Material stays receivable until complete."
                : "WIP already in manufacturing — weight before only. Vault is not debited."}
            </DialogDescription>
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

            {isMeena ? (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Production order (optional — link when sending Meena work)
                </label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No order</SelectItem>
                    {allOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.orderNo} · {o.item.itemName || o.item.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {fromVault ? (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Manufacturing material type *
                </label>
                <Select value={materialCategory} onValueChange={setMaterialCategory}>
                  <SelectTrigger data-testid="process-issue-material-select">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialOptions.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {fromVault ? (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Issue from Gold Vault *</label>
                <VaultGoldStockSelect
                  value={vaultStockId}
                  onChange={(id, line) => {
                    setVaultStockId(id);
                    setVaultLine(line);
                    if (line) setPurity(String(line.purity));
                  }}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  {fromVault ? "Weight Before (g)" : "Weight before send (g)"}
                </label>
                <Input
                  placeholder="0.000"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Purity (‰)</label>
                {fromVault ? (
                  <Input value={purity} readOnly className="bg-muted/40 font-mono" />
                ) : (
                  <Select value={purity} onValueChange={setPurity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_PURITIES.map((p) => (
                        <SelectItem key={p.value} value={String(p.value)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {fromVault ? "Material ready / delivery date *" : "Expected ready / return date *"}
              </label>
              <Input
                type="date"
                value={expectedReadyDate}
                onChange={(e) => setExpectedReadyDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Narration</label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIssueDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleIssue()} disabled={saving} className="gap-2">
              {saving ? "Saving…" : primaryActionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeTx} onOpenChange={(open) => !open && setCompleteTx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              <CheckCircle className="h-5 w-5" />
              {completeLabel} — {processLabel(processType)}
            </DialogTitle>
          </DialogHeader>
          {completeTx && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground space-y-1">
                <span className="block">
                  Weight before:{" "}
                  <span className="font-mono text-gold">
                    {mgToGrams(completeTx.weightBeforeMg)} g
                  </span>
                  {!labourPayOnly ? (
                    <>
                      {" "}
                      — Allowed loss:{" "}
                      <span className="font-mono">{mgToGrams(completeTx.allowedLossMg)} g</span>
                    </>
                  ) : null}
                </span>
                {completeTx.materialCategoryLabel ? (
                  <span className="block">Material: {completeTx.materialCategoryLabel}</span>
                ) : null}
                {completeTx.expectedReadyDate ? (
                  <span className="block">Ready date: {completeTx.expectedReadyDate}</span>
                ) : null}
                {completeTx.orderNo ? (
                  <span className="block">Order: {completeTx.orderNo}</span>
                ) : null}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Weight after (g)</label>
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
                    disabled={!cfg?.recoveryApplicable || labourPayOnly || isMeena}
                  />
                </div>
              </div>
              {!labourPayOnly && fromVault ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Labour Charges (Rs.)</label>
                  <Input value={labourRs} onChange={(e) => setLabourRs(e.target.value)} />
                </div>
              ) : null}
              {!labourPayOnly && isMeena ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Labour Charges (Rs.)</label>
                  <Input value={labourRs} onChange={(e) => setLabourRs(e.target.value)} />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Narration</label>
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
            <Button onClick={() => void handleComplete()} disabled={saving} className="gap-2">
              {saving ? "Saving…" : completeLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
