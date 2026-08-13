import { dataProvider } from "@/lib/providers/data-provider";

const supabase = dataProvider as any;

export type PlatformFirmStats = {
  firm_id: string;
  invoices: number;
  invoiceValueMinor: number;
  orders: number;
  openOrders: number;
  jobCards: number;
  users: number;
  platformBills: number;
};

type PlatformFirmStatsRow = {
  firm_id: string;
  invoices: number | string | null;
  invoice_value_minor: number | string | null;
  orders: number | string | null;
  open_orders: number | string | null;
  job_cards: number | string | null;
  users: number | string | null;
  platform_bills: number | string | null;
};

type FirmRef = {
  id: string;
};

const CLOSED_ORDER_STATUSES = ["completed", "cancelled", "delivered", "closed"];

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyStats(firmId: string): PlatformFirmStats {
  return {
    firm_id: firmId,
    invoices: 0,
    invoiceValueMinor: 0,
    orders: 0,
    openOrders: 0,
    jobCards: 0,
    users: 0,
    platformBills: 0,
  };
}

function fromRpcRow(row: PlatformFirmStatsRow): PlatformFirmStats {
  return {
    firm_id: row.firm_id,
    invoices: toNumber(row.invoices),
    invoiceValueMinor: toNumber(row.invoice_value_minor),
    orders: toNumber(row.orders),
    openOrders: toNumber(row.open_orders),
    jobCards: toNumber(row.job_cards),
    users: toNumber(row.users),
    platformBills: toNumber(row.platform_bills),
  };
}

async function exactCount(table: string, firmId: string, configure?: (q: any) => any) {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("firm_id", firmId);
  if (configure) q = configure(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function boundedInvoiceValue(firmId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("grand_total_paise")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as Array<{ grand_total_paise: number | null }>).reduce(
    (sum, row) => sum + Number(row.grand_total_paise ?? 0),
    0,
  );
}

async function fetchStatsFallback(firms: FirmRef[]): Promise<PlatformFirmStats[]> {
  return Promise.all(
    firms.map(async (firm) => {
      const [invoices, invoiceValueMinor, orders, openOrders, jobCards, users, platformBills] =
        await Promise.all([
          exactCount("invoices", firm.id),
          boundedInvoiceValue(firm.id),
          exactCount("orders", firm.id),
          exactCount("orders", firm.id, (q) =>
            q.not("status", "in", `(${CLOSED_ORDER_STATUSES.join(",")})`),
          ),
          exactCount("job_cards", firm.id),
          exactCount("user_profiles", firm.id),
          exactCount("platform_billing_documents", firm.id),
        ]);
      return {
        firm_id: firm.id,
        invoices,
        invoiceValueMinor,
        orders,
        openOrders,
        jobCards,
        users,
        platformBills,
      };
    }),
  );
}

export async function fetchPlatformFirmStats(firms: FirmRef[]): Promise<PlatformFirmStats[]> {
  if (firms.length === 0) return [];
  const { data, error } = await supabase.rpc("get_platform_firm_stats");
  if (!error && data) {
    const rows = (data as PlatformFirmStatsRow[]).map(fromRpcRow);
    const byFirm = new Map(rows.map((row) => [row.firm_id, row]));
    return firms.map((firm) => byFirm.get(firm.id) ?? emptyStats(firm.id));
  }
  console.warn(
    "Platform firm stats RPC unavailable; using bounded Supabase query fallback.",
    error,
  );
  return fetchStatsFallback(firms);
}
