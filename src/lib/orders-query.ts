import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { normalizeOrder, type Order, type OrderStatus, type OrderType } from "@/lib/orders-store";

export interface OrdersPageInput {
  page: number;
  pageSize: number;
  query?: string;
  status?: "all" | OrderStatus;
  type?: "all" | OrderType;
  branchId?: string | null;
}

export interface OrdersPageResult {
  orders: Order[];
  totalCount: number;
}

export async function fetchOrdersPage(input: OrdersPageInput): Promise<OrdersPageResult> {
  const page = Math.max(1, input.page || 1);
  const pageSize = Math.max(1, input.pageSize || 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const query = input.query?.trim();

  let request = supabase
    .from("orders")
    .select("data", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.branchId)
    request = request.filter("data->>branchId", "eq", input.branchId) as typeof request;
  if (input.status && input.status !== "all") {
    request = request.filter("data->>status", "eq", input.status) as typeof request;
  }
  if (input.type && input.type !== "all") {
    request = request.filter("data->>type", "eq", input.type) as typeof request;
  }
  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    request = request.or(
      `data->>orderNo.ilike.%${escaped}%,data->design->>customerCode.ilike.%${escaped}%,data->design->>designNumber.ilike.%${escaped}%`,
    ) as typeof request;
  }

  const { data, error, count } = await request;
  if (error) throw new Error(error.message);

  return {
    orders: (data ?? [])
      .map((row) => row.data as Order | null)
      .filter((order): order is Order => !!order?.id && !!order?.orderNo)
      .map(normalizeOrder),
    totalCount: count ?? 0,
  };
}
