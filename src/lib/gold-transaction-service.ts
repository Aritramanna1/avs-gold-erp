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
 *     one Supabase transaction through the execute_gold_transaction RPC.
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
import { getCloudDataClient } from "@/lib/providers/data-provider";
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

export async function executeGoldTransaction(
  input: GoldTransactionInput,
): Promise<GoldTransactionResult> {
  if (!input.category || !input.deltaMg) {
    throw new Error("Gold transaction requires a category and a non-zero weight.");
  }

  const supabase = getCloudDataClient();
  const { data, error } = await supabase.rpc("execute_gold_transaction", {
    p_category: input.category,
    p_purity: input.purity || 0,
    p_delta_mg: input.deltaMg,
    p_gross_mg: input.grossMg,
    p_movement_type: input.movementType,
    p_ledger_movement: input.ledgerMovement,
    p_branch_id: input.branchId,
    p_reference: input.reference ?? "",
    p_notes: input.notes ?? "",
    p_actor_id: input.actorId ?? "",
    p_actor_email: input.actorEmail ?? "",
    p_worker_id: input.workerId,
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
