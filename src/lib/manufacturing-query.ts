import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { MfgBillStatus } from "@/lib/manufacturing-bill-store";

export interface ManufacturingRecentBill {
  id: string;
  billNo: string;
  status: MfgBillStatus;
  customerName?: string | null;
  jobNo?: string | null;
  itemName?: string | null;
  createdAt?: string | null;
}

export interface ManufacturingWorkspaceSummary {
  openJobCards: number;
  totalBills: number;
  draftBills: number;
  finalisedBills: number;
  recentBills: ManufacturingRecentBill[];
}

type ManufacturingRecentBillRow = {
  id: string;
  bill_no: string | null;
  status: string | null;
  customer_name: string | null;
  job_no: string | null;
  item_name: string | null;
  created_at: string | null;
};

async function exactCount(table: "job_cards" | "manufacturing_bills", apply?: (query: any) => any) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchManufacturingWorkspaceSummary(input: {
  branchId?: string | null;
  recentLimit?: number;
}): Promise<ManufacturingWorkspaceSummary> {
  const branchId = input.branchId ?? null;
  const recentLimit = Math.max(1, Math.min(input.recentLimit ?? 8, 25));
  const byBranch = (query: any) => (branchId ? query.eq("branch_id", branchId) : query);

  const [openJobCards, totalBills, draftBills, finalisedBills, recentBillsRes] = await Promise.all([
    exactCount("job_cards", (query) => {
      const scoped = branchId ? query.filter("data->>branchId", "eq", branchId) : query;
      return scoped.not("status", "in", "(closed,completed,cancelled,delivered)");
    }),
    exactCount("manufacturing_bills", byBranch),
    exactCount("manufacturing_bills", (query) => byBranch(query).eq("status", "draft")),
    exactCount("manufacturing_bills", (query) => byBranch(query).eq("status", "finalised")),
    byBranch(
      supabase
        .from("manufacturing_bills")
        .select("id,bill_no,status,customer_name,job_no,item_name,created_at")
        .order("created_at", { ascending: false })
        .limit(recentLimit),
    ),
  ]);

  if (recentBillsRes.error) throw new Error(recentBillsRes.error.message);

  return {
    openJobCards,
    totalBills,
    draftBills,
    finalisedBills,
    recentBills: ((recentBillsRes.data ?? []) as ManufacturingRecentBillRow[]).map((row) => ({
      id: row.id,
      billNo: row.bill_no ?? row.id,
      status: (row.status ?? "draft") as MfgBillStatus,
      customerName: row.customer_name,
      jobNo: row.job_no,
      itemName: row.item_name,
      createdAt: row.created_at,
    })),
  };
}
