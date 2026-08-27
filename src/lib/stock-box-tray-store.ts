import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type BoxTrayType = "box" | "tray" | "display";

export interface StockBoxTray {
  id: string;
  branchId: string;
  code: string;
  name: string;
  trayType: BoxTrayType;
  stockLocation: string;
  capacityItems: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  tray_type: BoxTrayType;
  stock_location: string;
  capacity_items: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

function fromRow(row: Row): StockBoxTray {
  return {
    id: row.id,
    branchId: row.branch_id,
    code: row.code,
    name: row.name,
    trayType: row.tray_type,
    stockLocation: row.stock_location,
    capacityItems: row.capacity_items,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

interface StockBoxTrayState {
  trays: StockBoxTray[];
  loading: boolean;
  hydrated: boolean;
  lastError: string | null;
  hydrate: (branchId?: string) => Promise<void>;
  upsert: (input: Omit<StockBoxTray, "id" | "createdAt"> & { id?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useStockBoxTrays = create<StockBoxTrayState>()((set, get) => ({
  trays: [],
  loading: false,
  hydrated: false,
  lastError: null,

  hydrate: async (branchId) => {
    set({ loading: true, lastError: null });
    try {
      let query = supabase
        .from("stock_box_trays" as never)
        .select(
          "id,branch_id,code,name,tray_type,stock_location,capacity_items,notes,is_active,created_at",
        )
        .order("code", { ascending: true });
      if (branchId) query = query.eq("branch_id", branchId);
      const { data, error } = await query;
      if (error) throw error;
      set({
        trays: ((data ?? []) as unknown as Row[]).map(fromRow),
        hydrated: true,
        loading: false,
        lastError: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[stock-box-tray] hydrate failed:", err);
      set({ hydrated: true, loading: false, lastError: message });
    }
  },

  upsert: async (input) => {
    const payload = {
      branch_id: input.branchId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      tray_type: input.trayType,
      stock_location: input.stockLocation,
      capacity_items: input.capacityItems,
      notes: input.notes,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    };
    if (input.id) {
      const { error } = await supabase
        .from("stock_box_trays" as never)
        .update(payload as never)
        .eq("id", input.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("stock_box_trays" as never).insert(payload as never);
      if (error) throw error;
    }
    await get().hydrate(input.branchId);
  },

  remove: async (id) => {
    const { error } = await supabase
      .from("stock_box_trays" as never)
      .delete()
      .eq("id", id);
    if (error) throw error;
    set((s) => ({ trays: s.trays.filter((t) => t.id !== id) }));
  },
}));
