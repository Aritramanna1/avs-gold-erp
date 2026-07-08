/**
 * Global Search (Priority 5) — full-text search across real business
 * records (people, orders, invoices, stock items), distinct from the
 * command palette (GlobalCommandPalette.tsx), which only navigates
 * between MODULES, not records. Reads directly from each store's
 * already-loaded in-memory state — no new query/index infrastructure,
 * since these stores already hold the full working set client-side.
 */
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useBilling } from "@/lib/billing-store";
import { useStock } from "@/lib/stock-store";

export type SearchResultType = "person" | "order" | "invoice" | "stock_item";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

function norm(s: string): string {
  return s.toLowerCase();
}

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = norm(query);
  return fields.some((f) => f && norm(f).includes(q));
}

/**
 * Searches every indexed entity type for `query`, capped at `limit` results
 * per type (not globally) so one very common term doesn't crowd out other
 * result types entirely. Returns [] for an empty/whitespace-only query
 * rather than "everything" — a global search returning the entire
 * database on an empty string is a footgun, not a feature.
 */
export function searchAll(query: string, limitPerType = 10): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  const people = usePeople
    .getState()
    .people.filter((p) => matches(q, p.fullName, p.phone, p.email, p.aadhaar, p.pan))
    .slice(0, limitPerType);
  for (const p of people) {
    results.push({
      type: "person",
      id: p.id,
      title: p.fullName,
      subtitle: p.phone,
      route: `/people?selected=${p.id}`,
    });
  }

  const orders = useOrders
    .getState()
    .orders.filter((o) => matches(q, o.orderNo))
    .slice(0, limitPerType);
  for (const o of orders) {
    results.push({
      type: "order",
      id: o.id,
      title: o.orderNo,
      subtitle: o.status,
      route: `/orders?selected=${o.id}`,
    });
  }

  const invoices = useBilling
    .getState()
    .invoices.filter((inv) => matches(q, inv.invoiceNo, inv.customerName, inv.customerPhone))
    .slice(0, limitPerType);
  for (const inv of invoices) {
    results.push({
      type: "invoice",
      id: inv.id,
      title: inv.invoiceNo,
      subtitle: inv.customerName,
      route: `/billing/${inv.id}`,
    });
  }

  const stockItems = useStock
    .getState()
    .items.filter((i) => matches(q, i.itemCode, i.barcode, i.itemName, i.huid))
    .slice(0, limitPerType);
  for (const i of stockItems) {
    results.push({
      type: "stock_item",
      id: i.id,
      title: i.itemName,
      subtitle: `${i.itemCode} · ${i.barcode}`,
      route: `/stock?selected=${i.id}`,
    });
  }

  return results;
}
