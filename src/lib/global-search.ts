/**
 * Global search across already-loaded business records.
 *
 * The command palette first searches already-loaded stores for instant UX,
 * then asks Supabase for central records that are not loaded in the current
 * workspace. Results are filtered by destination route before rendering, and
 * Supabase/RLS remains the authoritative protection layer.
 */
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useBilling } from "@/lib/billing-store";
import { useStock } from "@/lib/stock-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { hasRoutePermission } from "@/lib/permissions";
import { useSettings } from "@/lib/settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type SearchResultType =
  "person" | "order" | "invoice" | "stock_item" | "job" | "party" | "document" | "branch" | "tag";

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

function matches(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = norm(query);
  return fields.some((field) => field && norm(field).includes(q));
}

function remoteLike(query: string): string {
  const cleaned = query.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  return `%${cleaned}%`;
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.type}:${result.id}:${result.route}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function searchAll(
  query: string,
  limitPerType = 10,
  role = useSettings.getState().currentUserRole,
): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const person of usePeople
    .getState()
    .people.filter((p) => matches(q, p.fullName, p.phone, p.email, p.aadhaar, p.pan))
    .slice(0, limitPerType)) {
    results.push({
      type: "person",
      id: person.id,
      title: person.fullName,
      subtitle: person.phone || person.email || person.type,
      route: `/people?selected=${person.id}`,
    });
  }

  for (const order of useOrders
    .getState()
    .orders.filter((o) => matches(q, o.orderNo, o.item?.itemName, o.productionType))
    .slice(0, limitPerType)) {
    results.push({
      type: "order",
      id: order.id,
      title: order.orderNo,
      subtitle: order.status,
      route: `/orders?selected=${order.id}`,
    });
  }

  for (const invoice of useBilling
    .getState()
    .invoices.filter((inv) => matches(q, inv.invoiceNo, inv.customerName, inv.customerPhone))
    .slice(0, limitPerType)) {
    results.push({
      type: "invoice",
      id: invoice.id,
      title: invoice.invoiceNo,
      subtitle: invoice.customerName,
      route: `/billing/${invoice.id}`,
    });
  }

  for (const item of useStock
    .getState()
    .items.filter((i) => matches(q, i.itemCode, i.barcode, i.itemName, i.huid))
    .slice(0, limitPerType)) {
    results.push({
      type: "stock_item",
      id: item.id,
      title: item.itemName,
      subtitle: [item.itemCode, item.barcode].filter(Boolean).join(" - "),
      route: `/stock?selected=${item.id}`,
    });
  }

  for (const job of useJobCards
    .getState()
    .jobs.filter((j) => matches(q, j.jobNo, j.orderNo, j.itemName, j.customerName, j.karigarName))
    .slice(0, limitPerType)) {
    results.push({
      type: "job",
      id: job.id,
      title: job.jobNo,
      subtitle: `${job.orderNo ?? "No order"} - ${JOB_STATUS_LABELS[job.status] ?? job.status}`,
      route: `/workshop/${job.id}`,
    });
  }

  return dedupeResults(results).filter((result) => hasRoutePermission(role, result.route));
}

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function searchRemote(
  query: string,
  limitPerType = 8,
  role = useSettings.getState().currentUserRole,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const like = remoteLike(q);
  const db = supabase as any;

  const [parties, branches, inventory, invoices, billingDocs, barcodes] = await Promise.all([
    safeSelect<{
      id: string;
      party_code: string | null;
      display_name: string;
      party_kind: string;
      primary_phone: string | null;
      primary_email: string | null;
      gstin: string | null;
      status: string;
    }>(() =>
      db
        .from("central_parties")
        .select("id,party_code,display_name,party_kind,primary_phone,primary_email,gstin,status")
        .or(
          `display_name.ilike.${like},party_code.ilike.${like},primary_phone.ilike.${like},primary_email.ilike.${like},gstin.ilike.${like}`,
        )
        .limit(limitPerType),
    ),
    safeSelect<{
      id: string;
      name: string;
      code: string | null;
      manager_name: string | null;
      phone: string | null;
      active: boolean | null;
    }>(() =>
      db
        .from("branches")
        .select("id,name,code,manager_name,phone,active")
        .or(`name.ilike.${like},code.ilike.${like},manager_name.ilike.${like},phone.ilike.${like}`)
        .limit(limitPerType),
    ),
    safeSelect<{
      id: string;
      item_code: string | null;
      barcode: string | null;
      huid: string | null;
      item_name: string;
      category: string | null;
      status: string | null;
    }>(() =>
      db
        .from("inventory")
        .select("id,item_code,barcode,huid,item_name,category,status")
        .or(
          `item_name.ilike.${like},item_code.ilike.${like},barcode.ilike.${like},huid.ilike.${like}`,
        )
        .limit(limitPerType),
    ),
    safeSelect<{
      id: string;
      invoice_no: string;
      status: string;
      data: Record<string, unknown> | null;
    }>(() =>
      db
        .from("invoices")
        .select("id,invoice_no,status,data")
        .or(`invoice_no.ilike.${like},status.ilike.${like}`)
        .limit(limitPerType),
    ),
    safeSelect<{
      id: string;
      document_no: string | null;
      document_type: string | null;
      status: string | null;
      data: Record<string, unknown> | null;
    }>(() =>
      db
        .from("platform_billing_documents")
        .select("id,document_no,document_type,status,data")
        .or(`document_no.ilike.${like},document_type.ilike.${like},status.ilike.${like}`)
        .limit(limitPerType),
    ),
    safeSelect<{
      id: string;
      data: Record<string, unknown> | null;
    }>(() =>
      db
        .from("manufacturing_barcodes")
        .select("id,data")
        .limit(limitPerType * 8),
    ),
  ]);

  const results: SearchResult[] = [
    ...parties.map((party) => ({
      type: "party" as const,
      id: party.id,
      title: party.display_name,
      subtitle: [
        party.party_code,
        party.party_kind,
        party.primary_phone ?? party.primary_email,
        party.status,
      ]
        .filter(Boolean)
        .join(" - "),
      route: `/people?central=${party.id}`,
    })),
    ...branches.map((branch) => ({
      type: "branch" as const,
      id: branch.id,
      title: branch.name,
      subtitle: [
        branch.code,
        branch.manager_name,
        branch.phone,
        branch.active === false ? "inactive" : "active",
      ]
        .filter(Boolean)
        .join(" - "),
      route: `/settings/branch-settings?branch=${branch.id}`,
    })),
    ...inventory.map((item) => ({
      type: "stock_item" as const,
      id: item.id,
      title: item.item_name,
      subtitle: [item.item_code, item.barcode, item.huid, item.status].filter(Boolean).join(" - "),
      route: `/stock?selected=${item.id}`,
    })),
    ...invoices.map((invoice) => ({
      type: "invoice" as const,
      id: invoice.id,
      title: invoice.invoice_no,
      subtitle: String(invoice.status ?? "invoice"),
      route: `/billing/${invoice.id}`,
    })),
    ...billingDocs.map((doc) => ({
      type: "document" as const,
      id: doc.id,
      title: doc.document_no ?? doc.id,
      subtitle: [
        doc.document_type,
        doc.status,
        typeof doc.data?.description === "string" ? doc.data.description : null,
      ]
        .filter(Boolean)
        .join(" - "),
      route: `/platform/billing-print/${doc.id}`,
    })),
    ...barcodes
      .map((tag) => {
        const data = tag.data ?? {};
        const barcodeNumber = typeof data.barcodeNumber === "string" ? data.barcodeNumber : null;
        const tagNumber = typeof data.tagNumber === "string" ? data.tagNumber : null;
        const internalProductId =
          typeof data.internalProductId === "string" ? data.internalProductId : null;
        const description =
          typeof data.productDescription === "string" ? data.productDescription : null;
        const status = typeof data.status === "string" ? data.status : null;
        const title = barcodeNumber ?? tagNumber ?? internalProductId ?? tag.id;
        return {
          type: "tag" as const,
          id: tag.id,
          title,
          subtitle: [description, tagNumber, status].filter(Boolean).join(" - "),
          route: `/barcode?selected=${tag.id}`,
        };
      })
      .filter((tag) => matches(q, tag.title, tag.subtitle))
      .slice(0, limitPerType),
  ];

  return dedupeResults(results).filter((result) => hasRoutePermission(role, result.route));
}
