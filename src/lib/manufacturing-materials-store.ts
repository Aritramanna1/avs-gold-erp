/**
 * Manufacturing material master — firm-scoped Name + Type (gold/silver/copper/other).
 * Balances remain derived from gold_ledger + material_vault_movements; this is master data only.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { materialKeyFromName } from "@/lib/material-vault-store";

export type ManufacturingMaterialType = "gold" | "silver" | "copper" | "other";

export interface ManufacturingMaterial {
  id: string;
  name: string;
  materialType: ManufacturingMaterialType;
  customTypeLabel?: string;
  vaultCategoryKey: string;
  preciousMetalCode?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ManufacturingMaterialRow {
  id: string;
  name: string;
  material_type: string;
  custom_type_label: string | null;
  vault_category_key: string;
  precious_metal_code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToMaterial(row: ManufacturingMaterialRow): ManufacturingMaterial {
  return {
    id: row.id,
    name: row.name,
    materialType: row.material_type as ManufacturingMaterialType,
    customTypeLabel: row.custom_type_label ?? undefined,
    vaultCategoryKey: row.vault_category_key,
    preciousMetalCode: row.precious_metal_code ?? undefined,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function materialTypeLabel(m: Pick<ManufacturingMaterial, "materialType" | "customTypeLabel">): string {
  if (m.materialType === "other" && m.customTypeLabel?.trim()) return m.customTypeLabel.trim();
  return m.materialType.charAt(0).toUpperCase() + m.materialType.slice(1);
}

export function preciousMetalNameForType(type: ManufacturingMaterialType): string {
  switch (type) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "copper":
      return "Copper";
    default:
      return "Other";
  }
}

interface ManufacturingMaterialsState {
  materials: ManufacturingMaterial[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (input: {
    name: string;
    materialType: ManufacturingMaterialType;
    customTypeLabel?: string;
    preciousMetalCode?: string;
  }) => Promise<ManufacturingMaterial>;
  update: (id: string, patch: Partial<Omit<ManufacturingMaterial, "id" | "createdAt">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  activeKarigarOptions: () => string[];
}

export const useManufacturingMaterials = create<ManufacturingMaterialsState>()((set, get) => ({
  materials: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("manufacturing_materials" as never)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      set({ materials: (data ?? []).map((r) => rowToMaterial(r as ManufacturingMaterialRow)) });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    const name = input.name.trim();
    if (!name) throw new Error("Material name is required.");
    if (input.materialType === "other" && !input.customTypeLabel?.trim()) {
      throw new Error("Custom type label is required when material type is Other.");
    }
    const vaultCategoryKey = materialKeyFromName(name);
    if (!vaultCategoryKey) throw new Error("Invalid material name.");
    const existing = get().materials.find((m) => m.vaultCategoryKey === vaultCategoryKey);
    if (existing) throw new Error(`A material named "${name}" already exists.`);

    const { data, error } = await supabase
      .from("manufacturing_materials" as never)
      .insert({
        name,
        material_type: input.materialType,
        custom_type_label: input.materialType === "other" ? input.customTypeLabel?.trim() : null,
        vault_category_key: vaultCategoryKey,
        precious_metal_code:
          input.preciousMetalCode ??
          (input.materialType !== "other" ? input.materialType : null),
        active: true,
      } as never)
      .select("*")
      .single();
    if (error) throw error;

    const material = rowToMaterial(data as ManufacturingMaterialRow);
    set({ materials: [...get().materials, material].sort((a, b) => a.name.localeCompare(b.name)) });

    try {
      const { useMaterialVault } = await import("@/lib/material-vault-store");
      const group = input.materialType === "gold" ? "gold" : "manufacturing_materials";
      useMaterialVault.getState().registerCategory({
        key: vaultCategoryKey,
        label: name,
        group,
      });
    } catch {
      /* category may already exist */
    }

    return material;
  },
  update: async (id, patch) => {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name.trim();
    if (patch.materialType !== undefined) payload.material_type = patch.materialType;
    if (patch.customTypeLabel !== undefined) payload.custom_type_label = patch.customTypeLabel;
    if (patch.preciousMetalCode !== undefined) payload.precious_metal_code = patch.preciousMetalCode;
    if (patch.active !== undefined) payload.active = patch.active;

    const { error } = await supabase
      .from("manufacturing_materials" as never)
      .update(payload as never)
      .eq("id", id);
    if (error) throw error;
    await get().refresh();
  },
  remove: async (id) => {
    const { error } = await supabase
      .from("manufacturing_materials" as never)
      .update({ active: false, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw error;
    await get().refresh();
  },
  activeKarigarOptions: () => {
    const active = get().materials.filter((m) => m.active);
    if (active.length === 0) return [];
    return active.map((m) => m.name);
  },
}));
