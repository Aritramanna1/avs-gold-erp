import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { postUniversalTransaction } from "@/lib/transaction-types-store";

export type TransferStatus = "draft" | "in_transit" | "received" | "cancelled";

export interface TransferItem {
  stockItemId: string;
  itemCode: string;
  grossMg: number;
  fineMg: number;
}

export interface StockTransferVoucher {
  id: string;
  branchId: string;
  voucherNumber: string;
  fromLocation: string;
  toLocation: string;
  status: TransferStatus;
  itemCount: number;
  totalGrossMg: number;
  totalFineMg: number;
  items: TransferItem[];
  sentAt: string | null;
  receivedAt: string | null;
  discrepancyNotes: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  branch_id: string;
  voucher_number: string;
  from_location: string;
  to_location: string;
  status: TransferStatus;
  item_count: number;
  total_gross_mg: number;
  total_fine_mg: number;
  items: TransferItem[];
  sent_at: string | null;
  received_at: string | null;
  discrepancy_notes: string | null;
  created_at: string;
};

function fromRow(row: Row): StockTransferVoucher {
  return {
    id: row.id,
    branchId: row.branch_id,
    voucherNumber: row.voucher_number,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    status: row.status,
    itemCount: row.item_count,
    totalGrossMg: row.total_gross_mg,
    totalFineMg: row.total_fine_mg,
    items: Array.isArray(row.items) ? row.items : [],
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    discrepancyNotes: row.discrepancy_notes,
    createdAt: row.created_at,
  };
}

function makeVoucherNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `STX-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

interface StockTransferState {
  vouchers: StockTransferVoucher[];
  loading: boolean;
  loadError: string | null;
  hydrate: (branchId?: string) => Promise<void>;
  createTransfer: (input: {
    branchId: string;
    fromLocation: string;
    toLocation: string;
    items: TransferItem[];
  }) => Promise<StockTransferVoucher>;
  markReceived: (id: string, discrepancyNotes?: string) => Promise<void>;
}

export const useStockTransfers = create<StockTransferState>()((set, get) => ({
  vouchers: [],
  loading: false,
  loadError: null,

  hydrate: async (branchId) => {
    set({ loading: true, loadError: null });
    try {
      let query = supabase
        .from("stock_transfer_vouchers" as never)
        .select(
          "id,branch_id,voucher_number,from_location,to_location,status,item_count,total_gross_mg,total_fine_mg,items,sent_at,received_at,discrepancy_notes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (branchId) query = query.eq("branch_id", branchId);
      const { data, error } = await query;
      if (error) throw error;
      set({
        vouchers: ((data ?? []) as unknown as Row[]).map(fromRow),
        loading: false,
        loadError: null,
      });
    } catch (err) {
      set({
        loading: false,
        loadError: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (get().loading) set({ loading: false });
    }
  },

  createTransfer: async ({ branchId, fromLocation, toLocation, items }) => {
    const voucherNumber = makeVoucherNumber();
    const totalGrossMg = items.reduce((s, i) => s + i.grossMg, 0);
    const totalFineMg = items.reduce((s, i) => s + i.fineMg, 0);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("stock_transfer_vouchers" as never)
      .insert({
        branch_id: branchId,
        voucher_number: voucherNumber,
        from_location: fromLocation,
        to_location: toLocation,
        status: "in_transit",
        item_count: items.length,
        total_gross_mg: totalGrossMg,
        total_fine_mg: totalFineMg,
        items,
        sent_at: now,
        updated_at: now,
      } as never)
      .select(
        "id,branch_id,voucher_number,from_location,to_location,status,item_count,total_gross_mg,total_fine_mg,items,sent_at,received_at,discrepancy_notes,created_at",
      )
      .single();
    if (error) throw error;

    await postUniversalTransaction({
      transactionCode: "STOCK_TRANSFER",
      voucherNumber,
      grossWeightMg: totalGrossMg,
      netWeightMg: totalGrossMg,
      fineGoldDebitMg: totalFineMg,
      fineGoldCreditMg: totalFineMg,
      metadata: { fromLocation, toLocation, itemCount: items.length, transferId: (data as Row).id },
    });

    const created = fromRow(data as unknown as Row);
    set((s) => ({ vouchers: [created, ...s.vouchers] }));
    return created;
  },

  markReceived: async (id, discrepancyNotes) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("stock_transfer_vouchers" as never)
      .update({
        status: "received",
        received_at: now,
        discrepancy_notes: discrepancyNotes ?? null,
        updated_at: now,
      } as never)
      .eq("id", id);
    if (error) throw error;
    await get().hydrate();
  },
}));
