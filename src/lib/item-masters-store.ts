/**
 * Item Masters — canonical SKU/material definitions (ITEM_AND_MATERIAL_MASTER.md).
 */
import { create } from "zustand";
import type { Json } from "@/integrations/supabase/types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface ItemMaster {
  id: string;
  firm_id: string | null;
  item_code: string;
  item_name: string;
  item_group: string | null;
  item_group_id: string | null;
  category: string;
  metal_type: string;
  purity_stamp: string;
  default_touch_pct: number;
  fine_calculation_mode: string;
  labour_basis: string;
  default_making_rate_paise: number;
  min_making_charge_paise: number;
  allowed_wastage_pct: number;
  stock_method: string;
  tag_weight_deduction_mg: number;
  huid_applicable: boolean;
  hsn_code: string;
  is_active: boolean;
  design_code: string | null;
  collection_name: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

import { resolveFirmIdForQuery } from "@/lib/firm-scoped-query";

interface ItemMastersState {
  items: ItemMaster[];
  loading: boolean;
  hydrated: boolean;
  load: () => Promise<void>;
  save: (item: Partial<ItemMaster> & Pick<ItemMaster, "item_code" | "item_name" | "category">) => Promise<ItemMaster | null>;
  remove: (id: string) => Promise<boolean>;
}

export const useItemMasters = create<ItemMastersState>((set, get) => ({
  items: [],
  loading: false,
  hydrated: false,
  load: async () => {
    set({ loading: true });
    try {
      const firmId = await resolveFirmIdForQuery();
      if (!firmId) {
        set({ items: [], hydrated: true });
        return;
      }
      const { data, error } = await supabase
        .from("item_masters")
        .select("*")
        .eq("firm_id", firmId)
        .order("item_name");
      if (error) throw error;
      set({ items: (data ?? []) as ItemMaster[], hydrated: true });
    } catch (err) {
      console.warn("[ItemMasters] load failed:", err);
    } finally {
      set({ loading: false });
    }
  },
  save: async (item) => {
    const firmId = await resolveFirmIdForQuery();
    if (!firmId) throw new Error("Firm scope required to save item master.");
    const row = {
      ...item,
      firm_id: firmId,
      metadata: (item.metadata ?? {}) as Json,
      updated_at: new Date().toISOString(),
    };
    if (item.id) {
      const { data, error } = await supabase
        .from("item_masters")
        .update(row)
        .eq("id", item.id)
        .eq("firm_id", firmId)
        .select("*")
        .single();
      if (error) throw error;
      const saved = data as ItemMaster;
      set({ items: get().items.map((i) => (i.id === saved.id ? saved : i)) });
      return saved;
    }
    const { data, error } = await supabase.from("item_masters").insert(row).select("*").single();
    if (error) throw error;
    const saved = data as ItemMaster;
    set({ items: [saved, ...get().items] });
    return saved;
  },
  remove: async (id) => {
    const firmId = await resolveFirmIdForQuery();
    if (!firmId) return false;
    const { error } = await supabase
      .from("item_masters")
      .delete()
      .eq("id", id)
      .eq("firm_id", firmId);
    if (error) return false;
    set({ items: get().items.filter((i) => i.id !== id) });
    return true;
  },
}));
