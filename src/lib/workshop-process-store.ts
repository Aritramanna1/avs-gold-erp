/**
 * Workshop Processes — Manufacturing Material Making (`kdm`) and Meena.
 *
 * MMM (`kdm`): vault issue of gold into manufacturing materials + material
 * category + expected ready date; complete returns fine to vault.
 *
 * Meena: manufacturing step on WIP already in process — send weight-before /
 * receive weight-after with optional order/job. No Gold Vault debit on send.
 *
 * Never keep independent gold balances here — useLedger is SoT for vault.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useLedger } from "./ledger-store";
import { useSettings, type WorkshopProcessType } from "./settings-store";
import { fetchWorkshopProcessTransactions } from "./custody-flow-query";
import { computeFineGold, isJewelleryCalcFeatureEnabled } from "./gold-calculation-rules";
import { currentGoldCalculationRules } from "./gold-calculation-rules-store";

export interface WorkshopProcessTransaction {
  id: string;
  processType: WorkshopProcessType;
  createdAt: number;
  karigarId: string;
  karigarName: string;
  jobCardId?: string;
  /** Linked production order (Meena send encouraged). */
  orderId?: string;
  orderNo?: string;
  weightBeforeMg: number;
  weightAfterMg: number;
  purity: number;
  /** Fine gold of weightBefore at issue purity (canonical ledger amount). */
  fineBeforeMg?: number;
  /** weightBefore - weightAfter, floor 0 (gross). */
  actualLossMg: number;
  /** From the process's WorkshopProcessConfig at the time of this transaction. */
  allowedLossMg: number;
  /** actualLoss - allowedLoss, floor 0 — flagged, never silently absorbed. */
  excessLossMg: number;
  recoveryMg: number;
  /** Manufacturing Material Making — typed category (not remarks-only). */
  materialCategoryKey?: string;
  materialCategoryLabel?: string;
  /** Expected ready / return date (YYYY-MM-DD). */
  expectedReadyDate?: string;
  /** Live vault stock line used for MMM issue (audit). */
  vaultStockLineId?: string;
  /** Stone Setting traceability; absent for other processes. */
  stoneCount?: number;
  stoneWeightMg?: number;
  labourChargesPaise: number;
  remarks?: string;
  status: "issued" | "completed";
  ledgerRefIssue: string;
  ledgerRefReturn?: string;
  /** Explicit zero-balance ledger event so loss is visible in Workshop Books. */
  ledgerRefLoss?: string;
}

export interface WorkshopProcessPosition {
  openCount: number;
  outstandingFineMg: number;
  overdueCount: number;
}

/** Open issued rows = receivable until completed. */
export function computeWorkshopProcessPosition(
  txns: WorkshopProcessTransaction[],
  processType?: WorkshopProcessType,
  todayYmd: string = new Date().toISOString().slice(0, 10),
): WorkshopProcessPosition {
  const scoped = processType ? txns.filter((t) => t.processType === processType) : txns;
  const open = scoped.filter((t) => t.status === "issued");
  return {
    openCount: open.length,
    outstandingFineMg: open.reduce(
      (s, t) => s + (t.fineBeforeMg ?? 0),
      0,
    ),
    overdueCount: open.filter(
      (t) => !!t.expectedReadyDate && t.expectedReadyDate < todayYmd,
    ).length,
  };
}

/** True when this process draws gold from the vault (MMM only). */
export function processIssuesFromVault(processType: WorkshopProcessType): boolean {
  return processType === "kdm";
}

interface WorkshopProcessState {
  transactions: WorkshopProcessTransaction[];
  refresh: () => Promise<void>;
  issue: (input: {
    processType: WorkshopProcessType;
    karigarId: string;
    karigarName: string;
    jobCardId?: string;
    orderId?: string;
    orderNo?: string;
    weightBeforeMg: number;
    purity: number;
    stoneCount?: number;
    stoneWeightMg?: number;
    remarks?: string;
    materialCategoryKey?: string;
    materialCategoryLabel?: string;
    expectedReadyDate?: string;
    /** Required for MMM when vault stock lines are mandatory. */
    vaultStockLineId?: string;
  }) => Promise<WorkshopProcessTransaction>;
  complete: (
    id: string,
    input: {
      weightAfterMg: number;
      recoveryMg?: number;
      stoneCount?: number;
      stoneWeightMg?: number;
      labourChargesPaise?: number;
      remarks?: string;
    },
  ) => Promise<WorkshopProcessTransaction>;
}

const processRepository = createRepository<WorkshopProcessTransaction>(
  "workshop_process_transactions",
);

function makeId(): string {
  return `wpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function configFor(processType: WorkshopProcessType) {
  const cfg = useSettings.getState().workshopProcesses.find((p) => p.processType === processType);
  if (!cfg) {
    throw new Error(
      `No workshop process configuration for "${processType}". Add one under Settings before issuing.`,
    );
  }
  return cfg;
}

export const useWorkshopProcess = create<WorkshopProcessState>()((set, get) => ({
  transactions: [],
  refresh: async () => {
    set({ transactions: await fetchWorkshopProcessTransactions() });
  },
  issue: async (input) => {
    const cfg = configFor(input.processType);
    if (!cfg.active) {
      throw new Error(`${cfg.label} is disabled in Settings — enable it before sending.`);
    }
    const fromVault = processIssuesFromVault(input.processType);
    if (fromVault) {
      if (!input.materialCategoryKey?.trim()) {
        throw new Error("Select a manufacturing material type.");
      }
      if (!input.expectedReadyDate?.trim()) {
        throw new Error("Enter the material ready / delivery date.");
      }
    } else if (input.processType === "meena" && !input.expectedReadyDate?.trim()) {
      throw new Error("Enter the expected ready / return date.");
    }

    const rules = currentGoldCalculationRules();
    const computed = computeFineGold(
      {
        module: "karigar_issue",
        grossMg: input.weightBeforeMg,
        purityPermille: input.purity,
      },
      rules,
    );
    const fineBeforeMg = computed.fineMg;
    const id = makeId();

    let issueEntryId: string;
    if (fromVault) {
      const ledgerEntries = useLedger.getState().entries;
      const { assertTransactionGoldIssueFromLedger } = await import("./transaction-ledger-guards");
      assertTransactionGoldIssueFromLedger({
        entries: ledgerEntries,
        purityPermille: input.purity,
        fineMg: fineBeforeMg,
        grossMg: input.weightBeforeMg,
        vaultStockLineId: input.vaultStockLineId,
      });
      const issueEntry = await useLedger.getState().append({
        type: "workshop_process_gold_issued",
        netFineMg: 0,
        deltas: { vault: -fineBeforeMg, karigar: fineBeforeMg },
        purity: input.purity as never,
        fineMg: fineBeforeMg,
        grossMg: input.weightBeforeMg,
        formulaSnapshot: computed.snapshot,
        reference: id,
        notes: `${cfg.label} issued to ${input.karigarName}${input.materialCategoryLabel ? ` · ${input.materialCategoryLabel}` : ""}${input.jobCardId ? ` (job card ${input.jobCardId})` : ""}`,
        karigarId: input.karigarId,
      });
      issueEntryId = issueEntry.id;
    } else {
      // Meena / step processes: WIP custody register — no vault debit.
      const issueEntry = await useLedger.getState().append({
        type: "workshop_process_gold_issued",
        netFineMg: 0,
        deltas: {},
        purity: input.purity as never,
        fineMg: fineBeforeMg,
        grossMg: input.weightBeforeMg,
        formulaSnapshot: computed.snapshot,
        reference: id,
        notes: `${cfg.label} send (WIP): ${input.karigarName}, weight before ${input.weightBeforeMg}mg${input.orderNo ? ` · Order ${input.orderNo}` : ""}${input.jobCardId ? ` (job ${input.jobCardId})` : ""} — vault unchanged`,
        karigarId: input.karigarId,
      });
      issueEntryId = issueEntry.id;
    }

    const tx: WorkshopProcessTransaction = {
      id,
      processType: input.processType,
      createdAt: Date.now(),
      karigarId: input.karigarId,
      karigarName: input.karigarName,
      jobCardId: input.jobCardId,
      orderId: input.orderId,
      orderNo: input.orderNo,
      weightBeforeMg: input.weightBeforeMg,
      weightAfterMg: 0,
      purity: input.purity,
      fineBeforeMg,
      actualLossMg: 0,
      allowedLossMg: Math.round((input.weightBeforeMg * cfg.allowedLossPct) / 100),
      excessLossMg: 0,
      recoveryMg: 0,
      materialCategoryKey: input.materialCategoryKey,
      materialCategoryLabel: input.materialCategoryLabel,
      expectedReadyDate: input.expectedReadyDate,
      vaultStockLineId: input.vaultStockLineId,
      stoneCount: input.stoneCount,
      stoneWeightMg: input.stoneWeightMg,
      labourChargesPaise: 0,
      remarks: input.remarks,
      status: "issued",
      ledgerRefIssue: issueEntryId,
    };
    await processRepository.save(tx);
    await get().refresh();
    return tx;
  },
  complete: async (id, input) => {
    const tx = get().transactions.find((t) => t.id === id);
    if (!tx) throw new Error("Workshop process transaction not found.");
    if (tx.status === "completed") throw new Error("This transaction is already completed.");

    const cfg = configFor(tx.processType);
    const fromVault = processIssuesFromVault(tx.processType);
    const rules = currentGoldCalculationRules();
    const actualLossMg = Math.max(0, tx.weightBeforeMg - input.weightAfterMg);
    const excessLossMg = Math.max(0, actualLossMg - tx.allowedLossMg);
    const recoveryMg = input.recoveryMg ?? 0;

    const issuedFine =
      tx.fineBeforeMg ??
      computeFineGold(
        { module: "karigar_issue", grossMg: tx.weightBeforeMg, purityPermille: tx.purity },
        rules,
      ).fineMg;

    const afterComputed = computeFineGold(
      {
        module: "karigar_return",
        grossMg: input.weightAfterMg,
        purityPermille: tx.purity,
      },
      rules,
    );
    const recoveryComputed =
      recoveryMg > 0
        ? computeFineGold(
            {
              module: "karigar_return",
              grossMg: recoveryMg,
              purityPermille: tx.purity,
            },
            rules,
          )
        : null;
    const returnedFine = afterComputed.fineMg + (recoveryComputed?.fineMg ?? 0);
    const lossFine = Math.max(0, issuedFine - returnedFine);

    let returnEntryId: string;
    if (fromVault) {
      const returnEntry = await useLedger.getState().append({
        type: "workshop_process_recovery_received",
        netFineMg: -lossFine,
        deltas: { karigar: -issuedFine, vault: returnedFine },
        purity: tx.purity as never,
        fineMg: returnedFine,
        grossMg: input.weightAfterMg + recoveryMg,
        formulaSnapshot: afterComputed.snapshot,
        reference: id,
        notes: `${cfg.label} completed by ${tx.karigarName} — returned ${input.weightAfterMg}mg${recoveryMg ? ` + ${recoveryMg}mg recovery` : ""} (fine ${returnedFine}mg)${excessLossMg > 0 ? ` (EXCESS LOSS ${excessLossMg}mg beyond allowed ${tx.allowedLossMg}mg)` : ""}`,
        karigarId: tx.karigarId,
      });
      returnEntryId = returnEntry.id;
    } else {
      const returnEntry = await useLedger.getState().append({
        type: "workshop_process_recovery_received",
        netFineMg: 0,
        deltas: {},
        purity: tx.purity as never,
        fineMg: returnedFine,
        grossMg: input.weightAfterMg + recoveryMg,
        formulaSnapshot: afterComputed.snapshot,
        reference: id,
        notes: `${cfg.label} receive (WIP): ${tx.karigarName} — after ${input.weightAfterMg}mg, before ${tx.weightBeforeMg}mg, loss ${actualLossMg}mg gross / ${lossFine}mg fine — vault unchanged`,
        karigarId: tx.karigarId,
      });
      returnEntryId = returnEntry.id;
    }

    const lossEntry = isJewelleryCalcFeatureEnabled("automaticLoss", rules)
      ? await useLedger.getState().append({
          type: "workshop_process_loss",
          netFineMg: 0,
          deltas: {},
          purity: tx.purity as never,
          fineMg: lossFine,
          reference: id,
          notes: `${cfg.label} loss: before ${tx.weightBeforeMg}mg, after ${input.weightAfterMg}mg, loss ${actualLossMg}mg gross / ${lossFine}mg fine, allowed ${tx.allowedLossMg}mg, recovery ${recoveryMg}mg${input.remarks ? ` — ${input.remarks}` : ""}`,
        })
      : { id: "" };

    const updated: WorkshopProcessTransaction = {
      ...tx,
      weightAfterMg: input.weightAfterMg,
      fineBeforeMg: issuedFine,
      actualLossMg,
      excessLossMg,
      recoveryMg,
      stoneCount: input.stoneCount ?? tx.stoneCount,
      stoneWeightMg: input.stoneWeightMg ?? tx.stoneWeightMg,
      labourChargesPaise: input.labourChargesPaise ?? 0,
      remarks: input.remarks ?? tx.remarks,
      status: "completed",
      ledgerRefReturn: returnEntryId,
      ledgerRefLoss: lossEntry.id,
    };
    await processRepository.save(updated);
    await get().refresh();
    void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("manufacturing"));
    return updated;
  },
}));
