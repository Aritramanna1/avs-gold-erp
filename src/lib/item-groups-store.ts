/**
 * Item Groups — firm-scoped grouping for Item Master (ITEM_AND_MATERIAL_MASTER.md §2.1).
 */
import { create } from "zustand";
import type { Json } from "@/integrations/supabase/types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { resolveFirmIdForQuery } from "@/lib/firm-scoped-query";

export interface ItemGroup {
  id: string;
  firm_id: string;
  group_code: string;
  group_name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

interface ItemGroupsState {
  groups: ItemGroup[];
  loading: boolean;
  hydrated: boolean;
  /** False when QA migration 20260830280000 is not applied (table missing). */
  schemaAvailable: boolean | null;
  load: () => Promise<void>;
  save: (
    group: Partial<ItemGroup> & Pick<ItemGroup, "group_code" | "group_name">,
  ) => Promise<ItemGroup | null>;
  remove: (id: string) => Promise<boolean>;
}

export const useItemGroups = create<ItemGroupsState>((set, get) => ({
  groups: [],
  loading: false,
  hydrated: false,
  schemaAvailable: null,
  load: async () => {
    set({ loading: true });
    try {
      const firmId = await resolveFirmIdForQuery();
      if (!firmId) {
        set({ groups: [], hydrated: true, schemaAvailable: null });
        return;
      }
      const { data, error } = await supabase
        .from("item_groups")
        .select("*")
        .eq("firm_id", firmId)
        .order("sort_order")
        .order("group_name");
      if (error) {
        const code = String((error as { code?: string }).code ?? "");
        const msg = String(error.message ?? "");
        if (
          code === "PGRST205" ||
          code === "42P01" ||
          /item_groups/.test(msg) && /does not exist|not found|404/i.test(msg)
        ) {
          set({ groups: [], hydrated: true, schemaAvailable: false });
          return;
        }
        throw error;
      }
      set({ groups: (data ?? []) as ItemGroup[], hydrated: true, schemaAvailable: true });
    } catch (err) {
      console.warn("[ItemGroups] load failed:", err);
      set({ hydrated: true, schemaAvailable: false });
    } finally {
      set({ loading: false });
    }
  },
  save: async (group) => {
    const firmId = await resolveFirmIdForQuery();
    if (!firmId) throw new Error("Firm scope required to save item group.");
    const row = {
      ...group,
      firm_id: firmId,
      metadata: (group.metadata ?? {}) as Json,
      updated_at: new Date().toISOString(),
    };
    if (group.id) {
      const { data, error } = await supabase
        .from("item_groups")
        .update(row)
        .eq("id", group.id)
        .eq("firm_id", firmId)
        .select("*")
        .single();
      if (error) throw error;
      const saved = data as ItemGroup;
      set({ groups: get().groups.map((g) => (g.id === saved.id ? saved : g)) });
      return saved;
    }
    const { data, error } = await supabase.from("item_groups").insert(row).select("*").single();
    if (error) throw error;
    const saved = data as ItemGroup;
    set({ groups: [...get().groups, saved] });
    return saved;
  },
  remove: async (id) => {
    const firmId = await resolveFirmIdForQuery();
    if (!firmId) return false;
    const { error } = await supabase.from("item_groups").delete().eq("id", id).eq("firm_id", firmId);
    if (error) throw error;
    set({ groups: get().groups.filter((g) => g.id !== id) });
    return true;
  },
}));
