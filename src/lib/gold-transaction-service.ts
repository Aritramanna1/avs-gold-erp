/**
 * Gold Transaction Service — the SINGLE path every physical gold/material
 * movement must go through. Validates stock, then atomically updates:
 *
 *   1. Material Vault (material_vault_movements) — the per-category/purity
 *      Gold Stock ledger, the master inventory.
 *   2. Gold Ledger (gold_ledger) — the company-wide vault/karigar bucket
 *      movement every other report reads.
 *   3. Worker Gold Book (worker_transactions) — only when this transaction
 *      has a worker leg (issue/return to a person).
 *
 * "Atomic" means different things per mode, matching how every other write
 * in this app already works (see base-repository.ts):
 *   - Offline / Hybrid (local-first — both have database.localPrimary=true):
 *     one local SQLite transaction (runLocal — real BEGIN/COMMIT/ROLLBACK).
 *     Hybrid's outbox then syncs each row to Supabase in the background,
 *     eventually-consistent, exactly like every other table already does —
 *     this service does not change that sync model, only makes the
 *     REAL-TIME local balance correct and consistent across all three books.
 *   - Online (pure cloud, no local DB): the execute_gold_transaction
 *     Postgres RPC (see supabase/migrations/20260722010000_gold_transaction_rpc.sql),
 *     a single function body — Postgres functions are one implicit
 *     transaction, so any raised exception rolls back every insert made so
 *     far in that call.
 *
 * No caller should ever write to material_vault_movements, gold_ledger, or
 * worker_transactions directly for a physical movement — go through here so
 * Gold Stock can never end up out of sync with the rest of the app.
 */
import { getRuntimeProviders } from "@/lib/providers/runtime-providers";
import { getCloudDataClient } from "@/lib/providers/data-provider";
import { runLocal, selectAll, upsertRow, enqueueOutbox } from "@/lib/local-db";
import type { MovementType } from "@/lib/ledger-store";
import type { MaterialMovementType } from "@/lib/material-vault-store";
import type { WorkerGoldBookEntry } from "@/lib/worker-gold-book-store";

export class InsufficientStockError extends Error {
  constructor(
    public available: number,
    public requested: number,
    public category: string,
    public purity: number,
  ) {
    super(
      `Not enough Gold Stock — ${(available / 1000).toFixed(3)}g available, ${(requested / 1000).toFixed(3)}g requested (${category}${purity > 0 ? ` ${purity}` : ""})`,
    );
    this.name = "InsufficientStockError";
  }
}

export interface GoldTransactionInput {
  /** Material Vault category — "raw_gold" | "wire" | "kdm" | ... (see material-vault-store.ts). */
  category: string;
  /** Per-mille purity; 0 for non-gold/accessory materials. Never mixed across purities. */
  purity: number;
  /** Signed: negative = leaves Gold Stock (issue), positive = enters it (return). */
  deltaMg: number;
  grossMg: number;
  movementType: MaterialMovementType;
  ledgerMovement: MovementType;
  branchId: string;
  reference?: string;
  notes?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  /** Present only when this transaction has a worker leg (issue/return to a person). */
  workerId?: string;
  workerEntry?: WorkerGoldBookEntry;
}

export interface GoldTransactionResult {
  vaultMovementId: string;
  ledgerEntryId: string;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Current Gold Stock for one category+purity, read the same way both execution paths validate it. */
function localAvailableMg(category: string, purity: number): number {
  const rows = selectAll("material_vault_movements") as { data: unknown }[];
  return rows.reduce((sum, row) => {
    const d = row.data as any;
    if (d?.category === category && (d?.purity ?? 0) === purity) {
      return sum + (Number(d.deltaMg) || 0);
    }
    return sum;
  }, 0);
}

export async function executeGoldTransaction(
  input: GoldTransactionInput,
): Promise<GoldTransactionResult> {
  if (!input.category || !input.deltaMg) {
    throw new Error("Gold transaction requires a category and a non-zero weight.");
  }

  const { database } = await getRuntimeProviders();

  if (!database.localPrimary) {
    // Pure "online" mode (no local DB) — the Postgres RPC is the only place
    // this transaction can be atomic.
    const supabase = getCloudDataClient();
    const { data, error } = await supabase.rpc("execute_gold_transaction", {
      p_category: input.category,
      p_purity: input.purity || 0,
      p_delta_mg: input.deltaMg,
      p_gross_mg: input.grossMg,
      p_movement_type: input.movementType,
      p_ledger_movement: input.ledgerMovement,
      p_branch_id: input.branchId,
      p_reference: input.reference ?? null,
      p_notes: input.notes ?? null,
      p_actor_id: input.actorId ?? null,
      p_actor_email: input.actorEmail ?? null,
      p_worker_id: input.workerId ?? null,
      p_worker_entry:
        (input.workerEntry as unknown as import("@/integrations/supabase/types").Json) ?? null,
    });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_STOCK")) {
        throw new InsufficientStockError(0, -input.deltaMg, input.category, input.purity || 0);
      }
      throw new Error(error.message || "Gold transaction failed.");
    }
    const result = data as unknown as { vaultMovementId: string; ledgerEntryId: string };
    await refreshGoldStores();
    return { vaultMovementId: result.vaultMovementId, ledgerEntryId: result.ledgerEntryId };
  }

  // Offline / Hybrid — one local SQLite transaction. Hybrid's outbox syncs
  // each row to Supabase afterwards, same as every other local-first write.
  const result = await runLocal(() => {
    if (input.deltaMg < 0) {
      const available = localAvailableMg(input.category, input.purity || 0);
      if (available + input.deltaMg < 0) {
        throw new InsufficientStockError(
          available,
          -input.deltaMg,
          input.category,
          input.purity || 0,
        );
      }
    }

    const now = new Date().toISOString();
    const vaultId = makeId("mv");
    const vaultData = {
      id: vaultId,
      category: input.category,
      purity: input.purity || 0,
      type: input.movementType,
      deltaMg: input.deltaMg,
      grossMg: input.grossMg,
      reference: input.reference,
      remarks: input.notes,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      createdAt: Date.now(),
    };
    upsertRow("material_vault_movements", { id: vaultId, data: vaultData, updated_at: now });
    enqueueOutbox(
      `material_vault_movements:${vaultId}:${Date.now()}`,
      "material_vault_movements",
      vaultId,
      "insert",
      vaultData,
    );

    const ledgerId = makeId("gl");
    const deltas = input.workerEntry
      ? { vault: input.deltaMg, karigar: -input.deltaMg }
      : { vault: input.deltaMg };
    const netFineMg = input.workerEntry ? 0 : input.deltaMg;
    const ledgerData = {
      id: ledgerId,
      createdAt: Date.now(),
      type: input.ledgerMovement,
      netFineMg,
      deltas,
      grossMg: input.grossMg,
      purity: input.purity,
      fineMg: input.grossMg,
      reference: input.reference,
      notes: input.notes,
      branchId: input.branchId,
    };
    upsertRow("gold_ledger", {
      id: ledgerId,
      ts: now,
      movement: input.ledgerMovement,
      net_fine_mg: netFineMg,
      bucket_deltas: deltas,
      reference: input.reference ?? null,
      note: input.notes ?? null,
      gross_mg: input.grossMg,
      purity: input.purity,
      fine_mg: input.grossMg,
      data: ledgerData,
    });
    enqueueOutbox(
      `gold_ledger:${ledgerId}:${Date.now()}`,
      "gold_ledger",
      ledgerId,
      "insert",
      ledgerData,
    );

    if (input.workerEntry) {
      const entry = input.workerEntry;
      upsertRow("worker_transactions", {
        id: entry.id,
        worker_id: input.workerId ?? entry.workerId,
        kind: entry.type === "given" ? "gold_book_given" : "gold_book_return",
        ts: now,
        amount_paise: 0,
        gold_mg: input.grossMg,
        branch_id: input.branchId,
        data: entry,
      });
      enqueueOutbox(
        `worker_transactions:${entry.id}:${Date.now()}`,
        "worker_transactions",
        entry.id,
        "insert",
        entry,
      );
    }

    return { vaultMovementId: vaultId, ledgerEntryId: ledgerId };
  });
  await refreshGoldStores();
  return result;
}

/** Refresh every in-memory projection after the atomic transaction commits. */
export async function refreshGoldStores(): Promise<void> {
  const [{ useMaterialVault }, { useLedger }, { useWorkerGoldBook }] = await Promise.all([
    import("./material-vault-store"),
    import("./ledger-store"),
    import("./worker-gold-book-store"),
  ]);
  await Promise.all([
    useMaterialVault.getState().refresh(),
    useLedger.getState().refresh(),
    useWorkerGoldBook.getState().refresh(),
  ]);
}
