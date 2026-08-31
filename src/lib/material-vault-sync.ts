/**
 * Workflow integration glue — maps the free-text material labels used by
 * Worker Issue (worker-gold-book-store.ts's WORKER_ISSUE_MATERIALS) and Worker
 * Return (worker-return-store.ts's COMMON_RETURN_MATERIALS) onto the Gold &
 * Material Vault's category keys (material-vault-store.ts), so both
 * dialogs can synchronize the vault without duplicating this mapping.
 *
 * Issuable gold stock is filings (and other manufacturing materials), not
 * "Raw Gold". Legacy "Gold" → raw_gold mapping remains only for old rows.
 */
import type { MaterialMovementType } from "./material-vault-store";
import { useManufacturingMaterials } from "./manufacturing-materials-store";

function masterCategoryForMaterial(material: string): string | null {
  const trimmed = material.trim();
  if (!trimmed) return null;
  const master = useManufacturingMaterials
    .getState()
    .materials.find((m) => m.active && m.name.toLowerCase() === trimmed.toLowerCase());
  return master?.vaultCategoryKey ?? null;
}

/** Gold/Material Issue material → vault category. */
export function issueMaterialToVaultCategory(material: string): string {
  const fromMaster = masterCategoryForMaterial(material);
  if (fromMaster) return fromMaster;

  const key = material.trim().toLowerCase();
  switch (key) {
    case "filings":
    case "filings / dust":
    case "filing":
    case "dust":
      return "filings";
    case "gold":
      // Legacy issue label — kept for historical sync only. New issue UIs
      // must not offer "Gold"/raw gold; use Filings from stock instead.
      return "raw_gold";
    case "kdm":
    case "kdm balls":
      return "kdm_balls";
    case "ball":
      return "kdm_balls";
    case "wire":
      return "wire";
    case "chain":
    case "chains":
      return "chains";
    case "finding":
    case "findings":
      return "findings";
    case "tube":
      return "tube";
    case "die":
    case "patti":
    case "stone":
    case "item / ornaments":
    case "other":
      return "other_material";
    default:
      if (key.includes("filing") || key.includes("dust")) return "filings";
      if (key.includes("wire")) return "wire";
      if (key.includes("kdm") || key.includes("ball")) return "kdm_balls";
      if (key.includes("chain")) return "chains";
      return "other_material";
  }
}

/**
 * Worker Return material → vault category, or `null` if this return type
 * should NOT sync to the Material Vault. "Finished Product" is deliberately
 * excluded: finished jewellery gold is already tracked by ledger-store.ts's
 * `finished` bucket (see worker-return-dialog.tsx's `isFinished` branch).
 */
export function returnMaterialToVaultCategory(material: string): string | null {
  const fromMaster = masterCategoryForMaterial(material);
  if (fromMaster) return fromMaster;

  const key = material.trim().toLowerCase();
  switch (material) {
    case "Scrap":
      return "scrap";
    case "Filings":
    case "Filings / Dust":
      return "filings";
    case "Leftover Gold":
    case "Gold":
      // Leftover / returned gold goes to filings stock (issuable), not raw_gold.
      return "filings";
    case "Finished Product":
      return null;
    case "KDM":
    case "Ball":
      return "kdm_balls";
    case "Wire":
      return "wire";
    case "Finding":
      return "findings";
    case "Chain":
      return "chains";
    default:
      if (key.includes("kdm") || key.includes("ball")) return "kdm_balls";
      if (key.includes("wire")) return "wire";
      if (key.includes("chain")) return "chains";
      if (key.includes("finding")) return "findings";
      if (key.includes("filing") || key.includes("dust")) return "filings";
      if (key.includes("scrap")) return "scrap";
      if (key.includes("gold")) return "filings";
      return "other_material";
  }
}

export const ISSUE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "worker_issue";
export const RETURN_VAULT_MOVEMENT_TYPE: MaterialMovementType = "worker_return";

/** Outside Work issue material → vault category. */
export function outsideWorkIssueMaterialToVaultCategory(material: string): string {
  if (material === "Chain") return "chains";
  return issueMaterialToVaultCategory(material);
}

/** Outside Work receive material → vault category, or `null` to skip syncing. */
export function outsideWorkReceiveMaterialToVaultCategory(material: string): string | null {
  return returnMaterialToVaultCategory(material);
}

export const OUTSIDE_WORK_ISSUE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "outside_work";
export const OUTSIDE_WORK_RECEIVE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "outside_work";

/** Manufacturing Material Making / Meena process issue → Material Vault. */
export const WORKSHOP_PROCESS_ISSUE_VAULT_MOVEMENT_TYPE: MaterialMovementType = "worker_issue";

export function workshopProcessMaterialToVaultCategory(materialOrCategoryKey: string): string {
  const key = materialOrCategoryKey.trim().toLowerCase();
  if (
    [
      "kdm_balls",
      "chains",
      "findings",
      "locks",
      "jump_rings",
      "components",
      "wire",
      "tube",
      "other_material",
      "filings",
    ].includes(key)
  ) {
    return key;
  }
  return issueMaterialToVaultCategory(materialOrCategoryKey);
}
