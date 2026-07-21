/**
 * MTJ ERP — Gold Ledger Store
 *
 * Persistent, append-only log of gold movements. Each entry records the
 * **change** it makes to the five buckets of gold under management:
 *
 *   vault | karigar | finished | customer | scrap
 *
 * Bucket balances are derived (never stored separately) so the ledger is
 * the single source of truth.
 *
 * Phase 1 only writes `opening_vault` entries. Future phases add the rest.
 */

import { create } from "zustand";
import type { GoldForm, Purity } from "./gold";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";
import { assertPeriodOpen, ensureFinancialLocksLoaded } from "./financial-lock-store";
import { useWorkflowEngine } from "./workflow-engine";

export type MovementType =
  | "opening_vault"
  | "closing_stock"
  | "purchase"
  | "transfer_between_departments"
  | "customer_gold_received"
  | "old_gold_received"
  | "issue_to_karigar"
  | "receive_from_karigar"
  | "scrap_returned"
  | "dust_returned"
  | "wastage"
  | "overloss"
  | "finished_item_created"
  | "sale"
  /** Job-work delivery to a jeweller: bills making charges only, gold stays
   *  customer-owned. Reduces the jeweller's outstanding gold owed back to
   *  them (deltas.customer), not a vault/finished-goods sale like "sale". */
  | "job_work_delivery"
  | "customer_gold_credit_applied"
  | "worker_gold_advance"
  | "worker_wastage_gold_return"
  | "adjustment"
  | "reversal"
  | "gold_overdraft_issue"
  | "melt_scrap_input"
  | "melt_dust_input"
  | "melt_recovery_received"
  | "melt_loss"
  | "sent_to_polisher"
  | "received_from_polisher";

export type Bucket = "vault" | "karigar" | "finished" | "customer" | "jeweller" | "scrap";

export interface BucketDeltas {
  vault?: number; // signed mg
  karigar?: number;
  finished?: number;
  customer?: number;
  /** Gold supplied to jewellers, not yet settled or returned. */
  jeweller?: number;
  scrap?: number;
}

export interface LedgerEntry {
  id: string;
  createdAt: number; // epoch ms
  type: MovementType;
  /** Net change to total gold under management for this entry, in mg.
   *  Positive = gold entered the system, negative = gold left, 0 = internal transfer. */
  netFineMg: number;
  /** Per-bucket signed mg changes. Must sum to netFineMg. */
  deltas: BucketDeltas;
  /** Original gross weight (mg) and purity for traceability. Optional for synthetic entries. */
  grossMg?: number;
  purity?: Purity;
  fineMg?: number;
  form?: GoldForm;
  notes?: string;
  /** Optional human reference, e.g. opening vault notes, slip number later. */
  reference?: string;
}

export interface BucketBalances {
  vault: number;
  karigar: number;
  finished: number;
  customer: number;
  jeweller: number;
  scrap: number;
}

export interface PurityHolding {
  purity: number;
  grossMg: number;
  fineMg: number;
}

export interface BucketBreakdown {
  fineMg: number;
  grossMg: number;
  purities: Record<number, PurityHolding>;
}

export interface BalanceSheet {
  buckets: BucketBalances;
  bucketBreakdowns: Record<Bucket, BucketBreakdown>;
  totalUnderManagement: number;
  totalPhysicalUnderManagement: number;
  ledgerTotal: number;
  discrepancyMg: number;
  balanced: boolean;
  entryCount: number;
}

interface LedgerState {
  entries: LedgerEntry[];
  refresh: () => Promise<void>;
  append: (
    entry: Omit<LedgerEntry, "id" | "createdAt"> & { id?: string; createdAt?: number },
  ) => Promise<LedgerEntry>;
  reverse: (id: string, reason: string) => Promise<LedgerEntry | null>;
  reset: () => void;
}

function makeId(): string {
  // Browser crypto when available, fallback for SSR
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const ledgerRepository = createRepository<LedgerEntry>("gold_ledger");

export const useLedger = create<LedgerState>()((set, get) => ({
  entries: [],
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    let q = supabase
      .from("gold_ledger")
      .select("data")
      .order("ts", { ascending: true })
      .limit(10000);
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      console.error("Error fetching ledger from database:", error);
      return;
    }
    const rows = (data ?? [])
      .map((r) => r.data as LedgerEntry | null)
      .filter((e): e is LedgerEntry => !!e && !!e.id && typeof e.netFineMg === "number");
    set({ entries: rows });
  },
  append: async (input) => {
    const entry: LedgerEntry = {
      id: input.id ?? makeId(),
      createdAt: input.createdAt ?? Date.now(),
      ...input,
    };
    // Defensive: sum of deltas must equal netFineMg
    const sum =
      (entry.deltas.vault ?? 0) +
      (entry.deltas.karigar ?? 0) +
      (entry.deltas.finished ?? 0) +
      (entry.deltas.customer ?? 0) +
      (entry.deltas.jeweller ?? 0) +
      (entry.deltas.scrap ?? 0);
    if (sum !== entry.netFineMg) {
      throw new Error(
        `Ledger entry rejected: bucket deltas (${sum} mg) do not match netFineMg (${entry.netFineMg} mg).`,
      );
    }
    // Financial lock: a month-end-closed period rejects new postings dated inside it.
    // Uses the active working branch (same inference supabase-write.ts already applies
    // to gold_ledger rows lacking an explicit branchId) since LedgerEntry itself carries
    // no branch field at this layer. Configurable via Settings → Workflow
    // (financialLockEnforcementEnabled) — defaults on; disabling is a
    // deliberate, audited admin decision, not a silent default.
    if (useWorkflowEngine.getState().config.financialLockEnforcementEnabled) {
      await ensureFinancialLocksLoaded();
      assertPeriodOpen(
        useSettings.getState().selectedBranchId || "MAIN",
        new Date(entry.createdAt).toISOString(),
      );
    }
    await ledgerRepository.save(entry);
    await get().refresh();
    // Every Gold Ledger posting is audited — best-effort so a logging
    // failure never blocks the posting itself (same pattern this store's
    // own reverse() already uses, and base-repository.ts's recordAuditBestEffort).
    try {
      const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/integrations/supabase/client"),
      ]);
      const { data } = await sb.auth.getSession();
      await appendAudit({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: `gold_ledger.${entry.type}`,
        entityType: "gold_ledger",
        entityId: entry.id,
        before: null,
        after: entry,
        deviceId: null,
      });
    } catch (err) {
      console.error("[LedgerStore] Failed to audit-log entry:", err);
    }
    return entry;
  },
  reverse: async (id, reason) => {
    const original = get().entries.find((e) => e.id === id);
    if (!original) return null;
    const negate = (n?: number) => (n ? -n : 0);
    const reversal: LedgerEntry = {
      id: makeId(),
      createdAt: Date.now(),
      type: "reversal",
      netFineMg: -original.netFineMg,
      deltas: {
        vault: negate(original.deltas.vault),
        karigar: negate(original.deltas.karigar),
        finished: negate(original.deltas.finished),
        customer: negate(original.deltas.customer),
        jeweller: negate(original.deltas.jeweller),
        scrap: negate(original.deltas.scrap),
      },
      notes: `Reversal of ${original.type} (${original.id}): ${reason}`,
      reference: original.id,
    };
    await ledgerRepository.save(reversal);
    await get().refresh();
    // Financial reversals must be independently auditable — best-effort so a
    // logging failure never blocks the reversal itself (same pattern as
    // base-repository.ts's recordAuditBestEffort).
    try {
      const [{ append }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/integrations/supabase/client"),
      ]);
      const { data } = await sb.auth.getSession();
      await append({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: "gold_ledger.reverse",
        entityType: "gold_ledger",
        entityId: reversal.id,
        before: original,
        after: reversal,
        deviceId: null,
      });
    } catch (err) {
      console.error("[LedgerStore] Failed to audit-log reversal:", err);
    }
    return reversal;
  },
  reset: () => set({ entries: [] }),
}));

export function computeBalances(entries: LedgerEntry[]): BalanceSheet {
  const buckets: BucketBalances = {
    vault: 0,
    karigar: 0,
    finished: 0,
    customer: 0,
    jeweller: 0,
    scrap: 0,
  };

  const bucketBreakdowns: Record<Bucket, BucketBreakdown> = {
    vault: { fineMg: 0, grossMg: 0, purities: {} },
    karigar: { fineMg: 0, grossMg: 0, purities: {} },
    finished: { fineMg: 0, grossMg: 0, purities: {} },
    customer: { fineMg: 0, grossMg: 0, purities: {} },
    jeweller: { fineMg: 0, grossMg: 0, purities: {} },
    scrap: { fineMg: 0, grossMg: 0, purities: {} },
  };

  let ledgerTotal = 0;

  for (const e of entries) {
    ledgerTotal += e.netFineMg;
    const purity = e.purity ?? 999;

    const bucketKeys: Bucket[] = ["vault", "karigar", "finished", "customer", "jeweller", "scrap"];
    for (const b of bucketKeys) {
      const deltaFine = e.deltas[b] ?? 0;
      if (deltaFine !== 0) {
        buckets[b] += deltaFine;

        // Calculate gross change exactly
        let deltaGross = 0;
        if (e.grossMg != null && e.fineMg != null && e.fineMg !== 0) {
          deltaGross = Math.round(deltaFine * (e.grossMg / e.fineMg));
        } else {
          deltaGross = Math.round((deltaFine * 1000) / purity);
        }

        const breakdown = bucketBreakdowns[b];
        breakdown.fineMg += deltaFine;
        breakdown.grossMg += deltaGross;

        if (!breakdown.purities[purity]) {
          breakdown.purities[purity] = { purity, grossMg: 0, fineMg: 0 };
        }
        breakdown.purities[purity].fineMg += deltaFine;
        breakdown.purities[purity].grossMg += deltaGross;
      }
    }
  }

  const totalUnderManagement =
    buckets.vault +
    buckets.karigar +
    buckets.finished +
    buckets.customer +
    buckets.jeweller +
    buckets.scrap;

  let totalPhysicalUnderManagement = 0;
  for (const b of Object.values(bucketBreakdowns)) {
    totalPhysicalUnderManagement += b.grossMg;
  }

  const discrepancyMg = totalUnderManagement - ledgerTotal;

  return {
    buckets,
    bucketBreakdowns,
    totalUnderManagement,
    totalPhysicalUnderManagement,
    ledgerTotal,
    discrepancyMg,
    balanced: discrepancyMg === 0,
    entryCount: entries.length,
  };
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  opening_vault: "Opening Stock",
  closing_stock: "Closing Stock",
  purchase: "Purchase",
  transfer_between_departments: "Transfer Between Departments",
  customer_gold_received: "Customer Gold Received",
  old_gold_received: "Gold Received from Customer",
  issue_to_karigar: "Issue to Karigar",
  receive_from_karigar: "Receive from Karigar",
  scrap_returned: "Scrap Returned",
  dust_returned: "Dust / Sweeping Returned",
  wastage: "Wastage",
  overloss: "Overloss",
  finished_item_created: "Finished Item Created",
  sale: "Sale",
  job_work_delivery: "Job-Work Delivery",
  customer_gold_credit_applied: "Customer Gold Credit Applied",
  worker_gold_advance: "Worker Gold Advance",
  worker_wastage_gold_return: "Worker Wastage Gold Return",
  adjustment: "Adjustment",
  reversal: "Reversal",
  gold_overdraft_issue: "Gold Overdraft Issue",
  melt_scrap_input: "Melt — Scrap Input",
  melt_dust_input: "Melt — Dust/Sweepings Input",
  melt_recovery_received: "Melt — Recovery Received",
  melt_loss: "Melt — Loss",
  sent_to_polisher: "Sent to Polisher",
  received_from_polisher: "Received from Polisher",
};
