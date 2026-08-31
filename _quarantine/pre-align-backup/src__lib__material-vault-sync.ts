/**
 * Workflow integration glue — maps the free-text material labels used by
 * Worker Issue (worker-gold-book-store.ts's WORKER_ISSUE_MATERIALS) and Worker
 * Return (worker-return-store.ts's COMMON_RETURN_MATERIALS) onto the Gold &
 * Material Vault's category keys (material-vault-store.ts), so both
 * dialogs can synchronize the vault without duplicating this mapping.
 *
 * Not a new module in its own right — this is the single place the
 * "automatic synchronization" requirement's category translation lives, so
 * Issue and Return can never drift into inconsistent mappings.
 */
import type { MaterialMovementType } from "./material-vault-store";

/** Gold/Material Issue material → vault category. */
export function issueMaterialToVaultCategory(material: string): string {
  switch (material) {
    case "Gold":
      return "raw_gold";
    case "KDM":
      return "kdm";
    case "Ball":
      return "ball";
    case "Wire":
      return "wire";
    case "Die":
      return "other_material";
    case "Finding":
      return "findings";
    default:
      return "other_material";
  }
}

/**
 * Worker Return material → vault category, or `null` if this return type
 * should NOT sync to the Material Vault. "Finished Product" is deliberately
 * excluded: finished jewellery gold is already tracked by ledger-store.ts's
 * `finished` bucket (see worker-return-dialog.tsx's `isFinished` branch),
 * and the Material Vault's categories (Raw Gold, KDM, Scrap, etc.) have no
 * "Finished Product" slot — double-booking it into `raw_gold` or any other
 * category would silently inflate that category's balance with gold that
 * has already left raw-material form.
 */
export function returnMaterialToVaultCategory(material: string): string | null {
  switch (material) {
    case "Scrap":
      return "scrap";
    case "Filings":
      return "scrap";
    case "Leftover Gold":
      return "raw_gold";
    case "Finished Product":
      return null;
    default:
      return "other_material";
  }
}

export const ISSUE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "worker_issue";
export const RETURN_VAULT_MOVEMENT_TYPE: MaterialMovementType = "worker_return";

/** Outside Work issue material → vault category (mirrors issueMaterialToVaultCategory()'s
 *  mapping, plus "Chain" — an outside-work-specific material). */
export function outsideWorkIssueMaterialToVaultCategory(material: string): string {
  if (material === "Chain") return "other_material";
  return issueMaterialToVaultCategory(material);
}

/** Outside Work receive material → vault category, or `null` to skip syncing
 *  (mirrors returnMaterialToVaultCategory()'s "Finished Product" exclusion —
 *  already tracked by ledger-store.ts's `finished`/`karigar` buckets). */
export function outsideWorkReceiveMaterialToVaultCategory(material: string): string | null {
  return returnMaterialToVaultCategory(material);
}

export const OUTSIDE_WORK_ISSUE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "outside_work";
export const OUTSIDE_WORK_RECEIVE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "outside_work";
