/**
 * Supplier goods-receipt (purchase entry). The Supabase side of this
 * (supplier_purchases table + post_supplier_purchase/reverse_supplier_purchase
 * RPCs) already existed fully-formed — this store is the missing frontend
 * wiring: it calls the atomic post RPC (which writes the purchase row AND
 * posts the gold vault ledger entry/entries in one transaction) instead of
 * inserting into supplier_purchases directly.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { tryPostUniversalLedgerMirror } from "@/lib/universal-transaction-bridge";

export interface SupplierPurchase {
  id: string;
  purchaseNo: string;
  supplierId: string;
  branchId: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  metal: string;
  purityPermille: number | null;
  grossMg: number;
  fineMg: number;
  goldPaidFineMg: number;
  subtotalPaise: number;
  gstRatePct: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  reversed: boolean;
  createdAt: string;
}

export interface NewSupplierPurchase {
  supplierId: string;
  branchId?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  metal?: string;
  purityPermille: number;
  grossMg: number;
  fineMg: number;
  goldPaidFineMg?: number;
  subtotalPaise?: number;
  gstRatePct?: number;
  gstPaise?: number;
  totalPaise?: number;
  paidPaise?: number;
  duePaise?: number;
  vaultCategory?: string;
}

interface SupplierPurchaseRow {
  id: string;
  purchase_no: string;
  supplier_id: string;
  branch_id: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  metal: string;
  purity_permille: number | null;
  gross_mg: number;
  fine_mg: number;
  gold_paid_fine_mg: number;
  subtotal_paise: number;
  gst_rate_pct: number;
  gst_paise: number;
  total_paise: number;
  paid_paise: number;
  due_paise: number;
  data: { reversedAt?: number } | null;
  created_at: string;
}

function fromRow(row: SupplierPurchaseRow): SupplierPurchase {
  return {
    id: row.id,
    purchaseNo: row.purchase_no,
    supplierId: row.supplier_id,
    branchId: row.branch_id,
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date,
    metal: row.metal,
    purityPermille: row.purity_permille,
    grossMg: row.gross_mg,
    fineMg: row.fine_mg,
    goldPaidFineMg: row.gold_paid_fine_mg ?? 0,
    subtotalPaise: row.subtotal_paise,
    gstRatePct: row.gst_rate_pct,
    gstPaise: row.gst_paise,
    totalPaise: row.total_paise,
    paidPaise: row.paid_paise,
    duePaise: row.due_paise,
    reversed: !!(row.data?.reversedAt && row.data.reversedAt > 0),
    createdAt: row.created_at,
  };
}

export async function fetchSupplierPurchases(): Promise<SupplierPurchase[]> {
  const { data, error } = await supabase
    .from("supplier_purchases" as never)
    .select(
      "id,purchase_no,supplier_id,branch_id,invoice_no,invoice_date,metal,purity_permille,gross_mg,fine_mg,gold_paid_fine_mg,subtotal_paise,gst_rate_pct,gst_paise,total_paise,paid_paise,due_paise,data,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message ?? "Could not load supplier purchases.");
  return ((data ?? []) as unknown as SupplierPurchaseRow[]).map(fromRow);
}

interface SupplierPurchaseState {
  purchases: SupplierPurchase[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (input: NewSupplierPurchase) => Promise<SupplierPurchase>;
  reverse: (id: string) => Promise<void>;
  reset: () => void;
}

export const useSupplierPurchases = create<SupplierPurchaseState>()((set, get) => ({
  purchases: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      set({ purchases: await fetchSupplierPurchases() });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    const payload = {
      supplierId: input.supplierId,
      branchId: input.branchId,
      invoiceNo: input.invoiceNo,
      invoiceDate: input.invoiceDate,
      metal: input.metal ?? "Gold",
      purityPermille: input.purityPermille,
      grossMg: input.grossMg,
      fineMg: input.fineMg,
      goldPaidFineMg: input.goldPaidFineMg ?? 0,
      subtotalPaise: input.subtotalPaise ?? 0,
      gstRatePct: input.gstRatePct ?? 0,
      gstPaise: input.gstPaise ?? 0,
      totalPaise: input.totalPaise ?? 0,
      paidPaise: input.paidPaise ?? 0,
      duePaise: input.duePaise ?? 0,
      vaultCategory: input.vaultCategory,
    };
    const { data, error } = await supabase.rpc(
      "post_supplier_purchase" as never,
      {
        p_payload: payload,
      } as never,
    );
    if (error) throw new Error(error.message ?? "Could not post supplier purchase.");
    const result = data as unknown as { id: string };
    await get().refresh();
    const created = get().purchases.find((p) => p.id === result.id);
    if (!created) throw new Error("Purchase posted but could not be reloaded.");
    void tryPostUniversalLedgerMirror({
      voucherKind: "supplier_purchase",
      voucherNumber: created.purchaseNo,
      counterpartyId: created.supplierId,
      grossWeightMg: created.grossMg,
      fineGoldDebitMg: created.fineMg,
      cashCreditPaise: created.totalPaise,
      metadata: { purchaseId: created.id },
    }).catch(() => undefined);
    return created;
  },
  reverse: async (id) => {
    const { error } = await supabase.rpc(
      "reverse_supplier_purchase" as never,
      {
        p_purchase_id: id,
      } as never,
    );
    if (error) throw new Error(error.message ?? "Could not reverse supplier purchase.");
    await get().refresh();
  },
  reset: () => set({ purchases: [] }),
}));
