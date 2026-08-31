/**
 * Material movement report — opening → closing per material/type from movement log.
 * Derived from material_vault_movements; not a second inventory authority.
 */
import {
  computeMaterialStockItems,
  type MaterialCategoryDef,
  type MaterialMovement,
} from "@/lib/material-vault-store";
import type { ManufacturingMaterial } from "@/lib/manufacturing-materials-store";

export interface MaterialMovementReportFilters {
  materialCategory?: string;
  materialType?: string;
  metal?: string;
  purity?: number;
  movementType?: string;
  fromTs?: number;
  toTs?: number;
}

export interface MaterialMovementReportRow {
  categoryKey: string;
  categoryLabel: string;
  metal: string;
  materialType?: string;
  purity: number;
  openingMg: number;
  additionsMg: number;
  consumptionMg: number;
  adjustmentsMg: number;
  closingMg: number;
}

function movementDeltaForReport(m: MaterialMovement): {
  additions: number;
  consumption: number;
  adjustments: number;
} {
  const d = m.deltaMg;
  if (m.type === "adjustment") {
    return { additions: 0, consumption: 0, adjustments: d };
  }
  if (d >= 0) return { additions: d, consumption: 0, adjustments: 0 };
  return { additions: 0, consumption: -d, adjustments: 0 };
}

export function buildMaterialMovementReport(input: {
  movements: MaterialMovement[];
  categories: MaterialCategoryDef[];
  materials?: ManufacturingMaterial[];
  filters?: MaterialMovementReportFilters;
}): MaterialMovementReportRow[] {
  const { movements, categories, materials = [], filters = {} } = input;
  const catLabel = new Map(categories.map((c) => [c.key, c.label]));
  const typeByKey = new Map(
    materials.map((m) => [m.vaultCategoryKey, m.materialType]),
  );

  const filtered = movements.filter((m) => {
    if (filters.materialCategory && m.category !== filters.materialCategory) return false;
    if (filters.metal && (m.metal ?? "Gold") !== filters.metal) return false;
    if (filters.purity != null && (m.purity ?? 0) !== filters.purity) return false;
    if (filters.movementType && m.type !== filters.movementType) return false;
    const mt = typeByKey.get(m.category) ?? (m as { materialType?: string }).materialType;
    if (filters.materialType && mt !== filters.materialType) return false;
    if (filters.fromTs != null && m.ts < filters.fromTs) return false;
    if (filters.toTs != null && m.ts > filters.toTs) return false;
    return true;
  });

  const asOfEnd = filters.toTs ?? Number.MAX_SAFE_INTEGER;
  const beforePeriod = movements.filter((m) => {
    if (filters.fromTs == null) return false;
    if (m.ts >= filters.fromTs) return false;
    if (filters.materialCategory && m.category !== filters.materialCategory) return false;
    if (filters.metal && (m.metal ?? "Gold") !== filters.metal) return false;
    if (filters.purity != null && (m.purity ?? 0) !== filters.purity) return false;
    return true;
  });

  const stockKeys = new Set<string>();
  for (const m of [...beforePeriod, ...filtered]) {
    stockKeys.add(`${m.category}|${m.metal ?? "Gold"}|${m.purity ?? 0}`);
  }

  const rows: MaterialMovementReportRow[] = [];
  for (const key of stockKeys) {
    const [categoryKey, metal, purityStr] = key.split("|");
    const purity = Number(purityStr) || 0;
    const openingMg = beforePeriod
      .filter(
        (m) =>
          m.category === categoryKey &&
          (m.metal ?? "Gold") === metal &&
          (m.purity ?? 0) === purity,
      )
      .reduce((s, m) => s + m.deltaMg, 0);

    let additionsMg = 0;
    let consumptionMg = 0;
    let adjustmentsMg = 0;
    for (const m of filtered.filter(
      (x) =>
        x.category === categoryKey &&
        (x.metal ?? "Gold") === metal &&
        (x.purity ?? 0) === purity &&
        x.ts <= asOfEnd,
    )) {
      const split = movementDeltaForReport(m);
      additionsMg += split.additions;
      consumptionMg += split.consumption;
      adjustmentsMg += split.adjustments;
    }

    rows.push({
      categoryKey,
      categoryLabel: catLabel.get(categoryKey) ?? categoryKey,
      metal,
      materialType: typeByKey.get(categoryKey),
      purity,
      openingMg,
      additionsMg,
      consumptionMg,
      adjustmentsMg,
      closingMg: openingMg + additionsMg - consumptionMg + adjustmentsMg,
    });
  }

  return rows.sort((a, b) =>
    `${a.materialType ?? ""}${a.categoryLabel}`.localeCompare(
      `${b.materialType ?? ""}${b.categoryLabel}`,
    ),
  );
}

/** Snapshot stock items grouped by material type for unified stock view. */
export function groupStockByMaterialType(input: {
  movements: MaterialMovement[];
  categories: MaterialCategoryDef[];
  materials: ManufacturingMaterial[];
}): Record<string, ReturnType<typeof computeMaterialStockItems>> {
  const items = computeMaterialStockItems(input.movements, input.categories);
  const typeByKey = new Map(
    input.materials.map((m) => [m.vaultCategoryKey, m.materialType]),
  );
  const groups: Record<string, typeof items> = {
    gold: [],
    silver: [],
    copper: [],
    other: [],
    unclassified: [],
  };
  for (const item of items) {
    const mt = typeByKey.get(item.category);
    const metal = (item.metal ?? "Gold").toLowerCase();
    if (mt === "silver" || metal === "silver") groups.silver.push(item);
    else if (mt === "copper" || metal === "copper") groups.copper.push(item);
    else if (mt === "gold" || metal === "gold") groups.gold.push(item);
    else if (mt === "other") groups.other.push(item);
    else groups.unclassified.push(item);
  }
  return groups;
}
