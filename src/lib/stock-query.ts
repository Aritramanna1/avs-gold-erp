import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { StockItem, StockStatus } from "@/lib/stock-store";

export interface StockPageQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: StockStatus | "all";
  branchId?: string | null;
}

export interface StockPageResult {
  items: StockItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  availableCount: number;
}

type InventoryRow = {
  id: string;
  item_code: string | null;
  barcode: string | null;
  huid: string | null;
  item_name: string | null;
  category: string | null;
  status: StockStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
  data: Partial<StockItem> | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function clampPage(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) return 1;
  return Math.floor(value);
}

function clampPageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(value)));
}

function remoteLike(query: string): string {
  const cleaned = query.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  return `%${cleaned}%`;
}

function rowToStockItem(row: InventoryRow): StockItem | null {
  const data = row.data ?? {};
  const id = data.id ?? row.id;
  const itemCode = data.itemCode ?? row.item_code ?? "";
  const itemName = data.itemName ?? row.item_name ?? "";
  if (!id || !itemCode || !itemName) return null;

  return {
    id,
    itemCode,
    barcode: data.barcode ?? row.barcode ?? "",
    itemName,
    category: data.category ?? row.category ?? "",
    purity: data.purity ?? 0,
    grossMg: data.grossMg ?? 0,
    netMg: data.netMg ?? 0,
    fineMg: data.fineMg ?? 0,
    huid: data.huid ?? row.huid ?? undefined,
    makingChargePct: data.makingChargePct,
    makingChargePerGPaise: data.makingChargePerGPaise,
    piecesCount: data.piecesCount,
    caratsCount: data.caratsCount,
    pricePaise: data.pricePaise,
    status: data.status ?? row.status ?? "available",
    location: data.location ?? "safe",
    linkedOrderId: data.linkedOrderId,
    linkedJobId: data.linkedJobId,
    linkedCustomerId: data.linkedCustomerId,
    lotId: data.lotId,
    notes: data.notes,
    imageStoragePath: data.imageStoragePath,
    createdAt: data.createdAt ?? (Date.parse(row.created_at ?? "") || Date.now()),
    updatedAt: data.updatedAt ?? (Date.parse(row.updated_at ?? "") || Date.now()),
  };
}

function applyFilters(
  query: any,
  input: Required<Pick<StockPageQuery, "status">> & StockPageQuery,
) {
  let next = query;
  if (input.branchId) next = next.filter("data->>branchId", "eq", input.branchId);
  if (input.status && input.status !== "all") next = next.eq("status", input.status);
  const q = input.query?.trim();
  if (q) {
    const like = remoteLike(q);
    next = next.or(
      `item_name.ilike.${like},item_code.ilike.${like},barcode.ilike.${like},huid.ilike.${like},category.ilike.${like}`,
    );
  }
  return next;
}

export async function fetchStockPage(input: StockPageQuery = {}): Promise<StockPageResult> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const status = input.status ?? "all";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const db = supabase as any;

  const baseSelect =
    "id,item_code,barcode,huid,item_name,category,status,created_at,updated_at,data";
  const pageQuery = applyFilters(
    db
      .from("inventory")
      .select(baseSelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    { ...input, status },
  );
  const availableQuery = applyFilters(
    db.from("inventory").select("id", { count: "exact", head: true }).eq("status", "available"),
    { ...input, status: "all" },
  );

  const [pageResult, availableResult] = await Promise.all([pageQuery, availableQuery]);
  if (pageResult.error) throw new Error(pageResult.error.message ?? "Could not load inventory.");
  if (availableResult.error) {
    throw new Error(availableResult.error.message ?? "Could not load inventory metrics.");
  }

  const rows = ((pageResult.data ?? []) as InventoryRow[])
    .map(rowToStockItem)
    .filter((item): item is StockItem => !!item);

  return {
    items: rows,
    page,
    pageSize,
    totalCount: pageResult.count ?? rows.length,
    availableCount: availableResult.count ?? 0,
  };
}
