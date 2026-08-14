/**
 * MTJ ERP — Stock & Barcode store
 * Manual stock entry (pilot). Weights mg, money paise, purity per-mille.
 * Stock entries are NON-LEDGER (do not touch Gold Balance Sheet) until linked
 * to a Receive-Work / Opening-Stock flow in a later phase.
 */
import { create } from "zustand";
import { fineGoldMg } from "@/lib/gold";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";

export type StockStatus = "available" | "sold" | "reserved" | "repair" | "scrap";
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  available: "Available",
  sold: "Sold",
  reserved: "Reserved",
  repair: "In Repair",
  scrap: "Scrap",
};

export type StockLocation = "safe" | "vault" | "counter" | "transit" | "outside_vendor";
export const STOCK_LOCATION_LABELS: Record<StockLocation, string> = {
  safe: "Safe",
  vault: "Vault",
  counter: "Counter / Showroom",
  transit: "Transit",
  outside_vendor: "Outside Vendor",
};
export const STOCK_LOCATIONS: StockLocation[] = [
  "safe",
  "vault",
  "counter",
  "transit",
  "outside_vendor",
];

export interface StockItem {
  id: string;
  itemCode: string;
  barcode: string;
  itemName: string;
  category: string;
  purity: number;
  grossMg: number;
  netMg: number;
  fineMg: number;
  huid?: string;
  /** Making charge as % of gold value — the jewellery-industry convention. Preferred over the legacy per-gram rate below. */
  makingChargePct?: number;
  /** @deprecated Legacy flat per-gram rate, kept only to render old stock rows that predate makingChargePct. New/edited items should always set makingChargePct instead. */
  makingChargePerGPaise?: number;
  /** Piece count for "piece"-basis making charges (e.g. loose bangles, findings sold per unit). Defaults to 1 when unset. */
  piecesCount?: number;
  /** Total carats for "carat"-basis making charges (stone-set items priced by carat, not weight). */
  caratsCount?: number;
  pricePaise?: number;
  status: StockStatus;
  location: StockLocation;
  linkedOrderId?: string;
  linkedJobId?: string;
  linkedCustomerId?: string;
  /** Lot/batch this item was received or manufactured under — see lot-store.ts. */
  lotId?: string;
  notes?: string;
  imageStoragePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StockMovement {
  id: string;
  ts: number;
  itemId: string;
  kind: "stock_in" | "transfer" | "adjustment" | "status_change";
  fromLocation?: StockLocation;
  toLocation?: StockLocation;
  fromStatus?: StockStatus;
  toStatus?: StockStatus;
  notes?: string;
}

export interface TagSettings {
  shopName: string;
  showPrice: boolean;
  showHuid: boolean;
  showMaking: boolean;
  tagSize: string; // e.g. "40x25mm"
}

interface StockState {
  items: StockItem[];
  movements: StockMovement[];
  tagSettings: TagSettings;
  refresh: () => Promise<void>;
  add: (
    i: Omit<StockItem, "id" | "createdAt" | "updatedAt" | "itemCode" | "barcode" | "fineMg"> & {
      itemCode?: string;
      barcode?: string;
    },
  ) => Promise<StockItem>;
  update: (id: string, patch: Partial<StockItem>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  transfer: (
    id: string,
    toLocation: StockLocation,
    notes?: string,
  ) => Promise<StockMovement | null>;
  changeStatus: (
    id: string,
    toStatus: StockStatus,
    notes?: string,
  ) => Promise<StockMovement | null>;
  /**
   * Ready Stock (V1.1 Phase 5): unlike add() (manual, non-ledger stock entry
   * — e.g. transfers/repairs), this is gold entering the business's finished
   * inventory with nothing else already accounting for it, so it MUST post
   * to the Gold Vault. "manufactured" = made in-house with no customer order
   * behind it (finished_item_created, same type a customer job uses).
   * "purchased" = bought ready-made (ready_stock_purchase_received).
   */
  addReadyStock: (
    i: Omit<StockItem, "id" | "createdAt" | "updatedAt" | "itemCode" | "barcode" | "fineMg"> & {
      itemCode?: string;
      barcode?: string;
    },
    source: "manufactured" | "purchased",
  ) => Promise<StockItem>;
  /**
   * Ready Stock Billing (V1.1 Phase 5): marks a sold item and posts the
   * matching Gold Vault exit — the counterpart to addReadyStock() above.
   * Call this from the ready-stock billing flow (billingType "ready_stock"
   * on billing-store.ts's Invoice) once payment is recorded; it does not
   * create the invoice itself — reuses the existing invoice pipeline.
   */
  sellReadyStock: (id: string, invoiceNo: string) => Promise<void>;
  findByBarcode: (barcode: string) => StockItem | undefined;
  setTagSettings: (patch: Partial<TagSettings>) => void;
  nextItemCode: () => string;
  nextBarcode: () => string;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const inventoryRepository = createRepository<StockItem>("inventory");
const stockMovementRepository = createRepository<StockMovement>("stock_movements");
const STOCK_COMPAT_CACHE_LIMIT = 500;
const STOCK_MOVEMENT_COMPAT_CACHE_LIMIT = 1000;

export const useStock = create<StockState>()((set, get) => ({
  items: [],
  movements: [],
  tagSettings: {
    shopName: "",
    showPrice: false,
    showHuid: true,
    showMaking: false,
    tagSize: "40x25mm",
  },
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
    ];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    // Compatibility cache only; /stock uses Supabase range/count pagination.
    let inventoryQ = supabase
      .from("inventory")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(STOCK_COMPAT_CACHE_LIMIT);
    if (bid) inventoryQ = inventoryQ.filter("data->>branchId", "eq", bid) as typeof inventoryQ;
    let movsQ = supabase
      .from("stock_movements")
      .select("data")
      .order("ts", { ascending: false })
      .limit(STOCK_MOVEMENT_COMPAT_CACHE_LIMIT);
    if (bid) movsQ = movsQ.filter("data->>branchId", "eq", bid) as typeof movsQ;
    const [itemsRes, movsRes] = await Promise.all([inventoryQ, movsQ]);
    if (itemsRes.error) {
      console.error("Error fetching inventory from database:", itemsRes.error);
      return;
    }
    if (movsRes.error) {
      console.error("Error fetching stock movements from database:", movsRes.error);
      return;
    }
    const items = (itemsRes.data ?? [])
      .map((r) => r.data as StockItem | null)
      .filter((i): i is StockItem => !!i && !!i.id && !!i.itemCode);
    const movements = (movsRes.data ?? [])
      .map((r) => r.data as StockMovement | null)
      .filter((m): m is StockMovement => !!m && !!m.id && !!m.itemId);
    set({ items, movements });
  },
  nextItemCode: () => {
    const year = new Date().getFullYear();
    const head = `MTJ-${year}-`;
    const nums = get()
      .items.map((i) => i.itemCode)
      .filter((c) => c.startsWith(head))
      .map((c) => Number(c.slice(head.length)))
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${head}${String(next).padStart(4, "0")}`;
  },
  nextBarcode: () => {
    // 12-digit numeric; suitable for Code128
    const stamp = Date.now().toString().slice(-10);
    const r = Math.floor(10 + Math.random() * 89).toString();
    return `${stamp}${r}`;
  },
  add: async (input) => {
    const now = Date.now();
    const itemCode = input.itemCode || get().nextItemCode();
    const barcode = input.barcode || get().nextBarcode();
    const fineMg = fineGoldMg(input.netMg, input.purity);
    const item: StockItem = {
      id: makeId(),
      itemCode,
      barcode,
      fineMg,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    const mv: StockMovement = {
      id: makeId(),
      ts: now,
      itemId: item.id,
      kind: "stock_in",
      toLocation: item.location,
      toStatus: item.status,
      notes: "Manual stock entry",
    };
    await inventoryRepository.save(item);
    await stockMovementRepository.save(mv);
    // Optimistic local update — realtime will confirm from DB
    set((s) => ({ items: [item, ...s.items], movements: [mv, ...s.movements] }));
    return item;
  },
  addReadyStock: async (input, source) => {
    const { useLedger } = await import("./ledger-store");
    const fineMg = fineGoldMg(input.netMg, input.purity);
    await useLedger.getState().append({
      type: source === "manufactured" ? "finished_item_created" : "ready_stock_purchase_received",
      netFineMg: fineMg,
      deltas: { finished: fineMg },
      grossMg: input.grossMg,
      purity: input.purity as any,
      fineMg,
      reference: input.itemCode,
      notes: `Ready stock (${source}): ${input.itemName}`,
    });
    return get().add(input);
  },
  sellReadyStock: async (id, invoiceNo) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) throw new Error("Stock item not found.");
    if (item.status === "sold") throw new Error("This item is already marked sold.");
    const { useLedger } = await import("./ledger-store");
    await useLedger.getState().append({
      type: "sale",
      netFineMg: -item.fineMg,
      deltas: { finished: -item.fineMg },
      grossMg: item.grossMg,
      purity: item.purity,
      fineMg: item.fineMg,
      reference: invoiceNo,
      notes: `Ready stock sold — ${item.itemName} (${item.itemCode}), Invoice ${invoiceNo}`,
    });
    await get().changeStatus(id, "sold", `Sold against Invoice ${invoiceNo}`);
  },
  update: async (id, patch) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const updated = {
      ...item,
      ...patch,
      fineMg:
        patch.netMg != null || patch.purity != null
          ? fineGoldMg(patch.netMg ?? item.netMg, patch.purity ?? item.purity)
          : item.fineMg,
      updatedAt: Date.now(),
    };
    await inventoryRepository.save(updated);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }));
  },
  remove: async (id) => {
    const item = get().items.find((i) => i.id === id);
    // Find movements linked to this item
    const linkedMovs = get().movements.filter((m) => m.itemId === id);
    await inventoryRepository.delete(id);
    for (const m of linkedMovs) {
      await stockMovementRepository.delete(m.id);
    }
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
      movements: s.movements.filter((m) => m.itemId !== id),
    }));
    // Deleting a stock item is irreversible and high-risk — always audited.
    try {
      const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/lib/providers/data-provider"),
      ]);
      const { data } = await sb.auth.getSession();
      await appendAudit({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: "stock.delete",
        entityType: "inventory_items",
        entityId: id,
        before: item ?? null,
        after: null,
        deviceId: null,
      });
    } catch (err) {
      console.error("[Stock] Failed to audit-log deletion:", err);
    }
  },
  transfer: async (id, toLocation, notes) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.location === toLocation) return null;
    const mv: StockMovement = {
      id: makeId(),
      ts: Date.now(),
      itemId: id,
      kind: "transfer",
      fromLocation: item.location,
      toLocation,
      notes,
    };
    const updated = { ...item, location: toLocation, updatedAt: Date.now() };
    await inventoryRepository.save(updated);
    await stockMovementRepository.save(mv);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? updated : i)),
      movements: [mv, ...s.movements],
    }));
    return mv;
  },
  changeStatus: async (id, toStatus, notes) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.status === toStatus) return null;
    const mv: StockMovement = {
      id: makeId(),
      ts: Date.now(),
      itemId: id,
      kind: "status_change",
      fromStatus: item.status,
      toStatus,
      notes,
    };
    const updated = { ...item, status: toStatus, updatedAt: Date.now() };
    await inventoryRepository.save(updated);
    await stockMovementRepository.save(mv);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? updated : i)),
      movements: [mv, ...s.movements],
    }));
    return mv;
  },
  findByBarcode: (barcode) => {
    const b = barcode.trim();
    if (!b) return undefined;
    return get().items.find((i) => i.barcode === b || i.itemCode.toLowerCase() === b.toLowerCase());
  },
  setTagSettings: (patch) => set({ tagSettings: { ...get().tagSettings, ...patch } }),
}));
