import { allowNegativeStock } from "./invoice-due";
import { getCaratLabel, mgToGrams } from "./gold";
import {
  computeMaterialStockItems,
  useMaterialVault,
} from "./material-vault-store";
import { issueMaterialToVaultCategory } from "./material-vault-sync";
import type { ManufacturingMaterialType } from "./manufacturing-materials-store";

/** Available milligrams for one material category × purity in the Material Vault. */
export function availableMaterialStockMg(
  materialOrCategory: string,
  purity: number,
  metal = "Gold",
): number {
  const category = issueMaterialToVaultCategory(materialOrCategory);
  const { movements, categories } = useMaterialVault.getState();
  const items = computeMaterialStockItems(movements, categories);
  const purityKey = purity > 0 ? purity : 0;
  const item = items.find(
    (i) => i.category === category && i.purity === purityKey && (i.metal ?? "Gold") === metal,
  );
  return item?.weightMg ?? 0;
}

export interface AlloyStockLine {
  material: string;
  weightMg: number;
  purityPermille?: number;
  categoryKey?: string;
  metal?: string;
  materialType?: ManufacturingMaterialType | string;
}

export function materialStockCaption(material: string, purity: number, issueMg: number): string {
  const available = availableMaterialStockMg(material, purity);
  const purityLabel = purity > 0 ? getCaratLabel(purity) : "unspecified purity";
  const issuing = issueMg > 0 ? `${mgToGrams(issueMg)} g issuing` : "nothing issuing yet";
  return `${material} (${purityLabel}): ${mgToGrams(available)} g in vault · ${issuing}`;
}

export function assertMaterialIssueStock(material: string, purity: number, issueMg: number): void {
  if (issueMg <= 0) return;
  if (allowNegativeStock()) return;
  const available = availableMaterialStockMg(material, purity);
  if (issueMg > available) {
    const purityLabel = purity > 0 ? getCaratLabel(purity) : "unspecified purity";
    throw new Error(
      `Insufficient ${material} (${purityLabel}) in Material Vault. Issuing ${mgToGrams(issueMg)} g; available ${mgToGrams(available)} g. Add stock in Ledger → Material Vault first.`,
    );
  }
}

/** Validate each alloy line has sufficient stock before conversion posting. */
export function assertAlloyLinesStock(lines: AlloyStockLine[]): void {
  if (allowNegativeStock()) return;
  for (const line of lines) {
    if (!(line.weightMg > 0)) continue;
    const category = line.categoryKey ?? issueMaterialToVaultCategory(line.material);
    const metal = line.metal ?? line.material;
    const purity = line.purityPermille ?? 0;
    const available = availableMaterialStockMg(category, purity, metal);
    if (line.weightMg > available) {
      const purityLabel = purity > 0 ? getCaratLabel(purity) : "unspecified purity";
      const typeLabel = line.materialType ? String(line.materialType) : metal;
      throw new Error(
        `Insufficient ${typeLabel} stock for conversion: need ${mgToGrams(line.weightMg)} g of ${line.material} (${purityLabel}); available ${mgToGrams(available)} g. Add stock in Material Vault first.`,
      );
    }
  }
}
