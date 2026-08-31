import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { MfgBillStatus } from "@/lib/manufacturing-bill-store";

const REPORT_ROW_LIMIT = 1000;

export interface ManufacturingReportBill {
  id: string;
  billNo: string;
  createdAt: string;
  status: MfgBillStatus;
  branchId: string | null;
  itemName: string;
  karigarName: string | null;
  totalGoldIssuedFineMg: number;
  totalGoldReturnedFineMg: number;
  actualWastagePct: number;
  labourChargesPaise: number;
}

export interface ManufacturingReportSummary {
  totalCount: number;
  rows: ManufacturingReportBill[];
  capped: boolean;
}

type ManufacturingReportRow = {
  id: string;
  bill_no: string | null;
  created_at: string | null;
  status: string | null;
  branch_id: string | null;
  item_name: string | null;
  karigar_name: string | null;
  total_gold_issued_fine_mg: number | null;
  total_gold_returned_fine_mg: number | null;
  actual_wastage_pct: number | null;
  labour_charges_paise: number | null;
};

function normalizeStatus(status: string | null): MfgBillStatus {
  if (status === "finalised" || status === "delivered" || status === "settled") return status;
  return "draft";
}

export async function fetchManufacturingReportBills({
  from,
  to,
  branchId,
}: {
  from: string;
  to: string;
  branchId?: string | null;
}): Promise<ManufacturingReportSummary> {
  let query = supabase
    .from("manufacturing_bills")
    .select(
      "id,bill_no,created_at,status,branch_id,item_name,karigar_name,total_gold_issued_fine_mg,total_gold_returned_fine_mg,actual_wastage_pct,labour_charges_paise",
      { count: "exact" },
    )
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`)
    .order("created_at", { ascending: false })
    .range(0, REPORT_ROW_LIMIT - 1);

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    totalCount: count ?? data?.length ?? 0,
    capped: (count ?? 0) > REPORT_ROW_LIMIT,
    rows: ((data ?? []) as ManufacturingReportRow[]).map((row) => ({
      id: row.id,
      billNo: row.bill_no ?? row.id,
      createdAt: row.created_at ?? new Date(0).toISOString(),
      status: normalizeStatus(row.status),
      branchId: row.branch_id,
      itemName: row.item_name ?? "Manufacturing item",
      karigarName: row.karigar_name,
      totalGoldIssuedFineMg: Number(row.total_gold_issued_fine_mg ?? 0),
      totalGoldReturnedFineMg: Number(row.total_gold_returned_fine_mg ?? 0),
      actualWastagePct: Number(row.actual_wastage_pct ?? 0),
      labourChargesPaise: Number(row.labour_charges_paise ?? 0),
    })),
  };
}
