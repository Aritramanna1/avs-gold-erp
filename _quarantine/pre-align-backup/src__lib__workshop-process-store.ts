/**
 * MTJ ERP — Workshop Processes (V1.1 Phase 3)
 *
 * Shared framework for KDM, Meena, Stone Setting, Polish, and Cutting —
 * process-specific configuration comes from Settings
 * (WorkshopProcessConfig, see settings-store.ts), the accounting itself is
 * identical across all five: issue gold to the karigar doing the work,
 * record what came back, compute loss/recovery against the process's
 * allowedLossPct, post to the Gold Vault, and audit.
 *
 * Never call sourced/checked balances from anywhere but useLedger — this
 * store keeps no gold balance of its own, only the transaction history.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useLedger } from "./ledger-store";
import { useSettings, type WorkshopProcessType } from "./settings-store";
import { fetchWorkshopProcessTransactions } from "./custody-flow-query";

export interface WorkshopProcessTransaction {
  id: string;
  processType: WorkshopProcessType;
  createdAt: number;
  karigarId: string;
  karigarName: string;
  jobCardId?: string;
  weightBeforeMg: number;
  weightAfterMg: number;
  purity: number;
  /** weightBefore - weightAfter, floor 0. */
  actualLossMg: number;
  /** From the process's WorkshopProcessConfig at the time of this transaction. */
  allowedLossMg: number;
  /** actualLoss - allowedLoss, floor 0 — flagged, never silently absorbed. */
  excessLossMg: number;
  recoveryMg: number;
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

interface WorkshopProcessState {
  transactions: WorkshopProcessTransaction[];
  refresh: () => Promise<void>;
  /** Issues gold from the vault to a karigar for a given process. */
  issue: (input: {
    processType: WorkshopProcessType;
    karigarId: string;
    karigarName: string;
    jobCardId?: string;
    weightBeforeMg: number;
    purity: number;
    stoneCount?: number;
    stoneWeightMg?: number;
    remarks?: string;
  }) => Promise<WorkshopProcessTransaction>;
  /** Records the process's completion: what came back, recovery, labour. */
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
      throw new Error(`${cfg.label} is disabled in Settings — enable it before issuing gold.`);
    }
    const id = makeId();
    const issueEntry = await useLedger.getState().append({
      type: "workshop_process_gold_issued",
      netFineMg: 0, // internal transfer: vault -> karigar, total under management unchanged
      deltas: { vault: -input.weightBeforeMg, karigar: input.weightBeforeMg },
      purity: input.purity as any,
      fineMg: input.weightBeforeMg,
      reference: id,
      notes: `${cfg.label} issued to ${input.karigarName}${input.jobCardId ? ` (job card ${input.jobCardId})` : ""}`,
    });

    const tx: WorkshopProcessTransaction = {
      id,
      processType: input.processType,
      createdAt: Date.now(),
      karigarId: input.karigarId,
      karigarName: input.karigarName,
      jobCardId: input.jobCardId,
      weightBeforeMg: input.weightBeforeMg,
      weightAfterMg: 0,
      purity: input.purity,
      actualLossMg: 0,
      allowedLossMg: Math.round((input.weightBeforeMg * cfg.allowedLossPct) / 100),
      excessLossMg: 0,
      recoveryMg: 0,
      stoneCount: input.stoneCount,
      stoneWeightMg: input.stoneWeightMg,
      labourChargesPaise: 0,
      remarks: input.remarks,
      status: "issued",
      ledgerRefIssue: issueEntry.id,
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
    const actualLossMg = Math.max(0, tx.weightBeforeMg - input.weightAfterMg);
    const excessLossMg = Math.max(0, actualLossMg - tx.allowedLossMg);
    const recoveryMg = input.recoveryMg ?? 0;

    // Gold physically returns from the karigar: finished/returned weight plus
    // any separately recovered material (dust/scrap), matching melt-store's
    // recovery pattern. Unrecovered loss simply leaves total-under-management
    // (karigar bucket debited for the full issued amount, only the recovered
    // portion re-enters the vault) — never forced to zero out artificially.
    const returnedMg = input.weightAfterMg + recoveryMg;
    const returnEntry = await useLedger.getState().append({
      type: "workshop_process_recovery_received",
      netFineMg: -(tx.weightBeforeMg - returnedMg),
      deltas: { karigar: -tx.weightBeforeMg, vault: returnedMg },
      purity: tx.purity as any,
      fineMg: returnedMg,
      reference: id,
      notes: `${cfg.label} completed by ${tx.karigarName} — returned ${input.weightAfterMg}mg${recoveryMg ? ` + ${recoveryMg}mg recovery` : ""}${excessLossMg > 0 ? ` (EXCESS LOSS ${excessLossMg}mg beyond allowed ${tx.allowedLossMg}mg)` : ""}`,
    });

    // The return entry carries the physical balance change. This separate
    // zero-balance event makes the measured loss independently visible in the
    // running Workshop Books and audit trail without double-counting it.
    const lossEntry = await useLedger.getState().append({
      type: "workshop_process_loss",
      netFineMg: 0,
      deltas: {},
      purity: tx.purity as any,
      fineMg: actualLossMg,
      reference: id,
      notes: `${cfg.label} loss: before ${tx.weightBeforeMg}mg, after ${input.weightAfterMg}mg, loss ${actualLossMg}mg, allowed ${tx.allowedLossMg}mg, recovery ${recoveryMg}mg${input.remarks ? ` — ${input.remarks}` : ""}`,
    });

    const updated: WorkshopProcessTransaction = {
      ...tx,
      weightAfterMg: input.weightAfterMg,
      actualLossMg,
      excessLossMg,
      recoveryMg,
      stoneCount: input.stoneCount ?? tx.stoneCount,
      stoneWeightMg: input.stoneWeightMg ?? tx.stoneWeightMg,
      labourChargesPaise: input.labourChargesPaise ?? 0,
      remarks: input.remarks ?? tx.remarks,
      status: "completed",
      ledgerRefReturn: returnEntry.id,
      ledgerRefLoss: lossEntry.id,
    };
    await processRepository.save(updated);
    await get().refresh();
    return updated;
  },
}));
