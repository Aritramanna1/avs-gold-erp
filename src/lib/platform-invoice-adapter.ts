/**
 * Canonical platform invoice adapter — unifies print/GST views on platform_invoices.
 * Legacy platform_billing_documents remain read-only for historic records.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type PlatformPrintDoc = {
  id: string;
  firm_id: string;
  document_no: string;
  document_type: string;
  status: string;
  amount_minor: number;
  paid_minor?: number | null;
  taxable_minor: number | null;
  cgst_minor: number | null;
  sgst_minor: number | null;
  igst_minor: number | null;
  gst_minor: number | null;
  buyer_state_code: string | null;
  seller_state_code: string | null;
  issued_at: string | null;
  due_at: string | null;
  data: { description?: string; gst_rate_percent?: number; source?: string } | null;
  source: "platform_invoices" | "platform_billing_documents";
};

type LegacyDoc = PlatformPrintDoc & { source: "platform_billing_documents" };

function mapInvoiceToPrintDoc(row: Record<string, unknown>): PlatformPrintDoc {
  const subtotal = Number(row.subtotal_paise ?? 0);
  const tax = Number(row.tax_paise ?? 0);
  const total = Number(row.total_paise ?? 0);
  const gstRate = subtotal > 0 ? Math.round((tax / subtotal) * 10000) / 100 : 0;
  const isInterState = Boolean(row.igst_paise && Number(row.igst_paise) > 0);

  return {
    id: String(row.id),
    firm_id: String(row.firm_id),
    document_no: String(row.invoice_no ?? row.id),
    document_type: "tax_invoice",
    status: String(row.status ?? "issued"),
    amount_minor: total,
    paid_minor: Number(row.paid_paise ?? 0),
    taxable_minor: subtotal,
    cgst_minor: isInterState ? 0 : Math.floor(tax / 2),
    sgst_minor: isInterState ? 0 : tax - Math.floor(tax / 2),
    igst_minor: isInterState ? tax : 0,
    gst_minor: tax,
    buyer_state_code: (row.billing_state_code as string) ?? null,
    seller_state_code: null,
    issued_at: (row.issued_at as string) ?? (row.created_at as string) ?? null,
    due_at: (row.due_at as string) ?? null,
    data: {
      description: String(row.notes ?? "Platform commercial invoice"),
      gst_rate_percent: gstRate,
      source: "platform_invoices",
    },
    source: "platform_invoices",
  };
}

/** Load a platform billing document for print — tries canonical invoice first, then legacy. */
export async function loadPlatformPrintDocument(
  id: string,
): Promise<{ doc: PlatformPrintDoc | null; error: string | null }> {
  const { data: invoice, error: invErr } = await supabase
    .from("platform_invoices" as never)
    .select(
      "id,firm_id,invoice_no,status,subtotal_paise,tax_paise,total_paise,paid_paise,billing_state_code,issued_at,due_at,created_at,notes,igst_paise",
    )
    .eq("id", id)
    .maybeSingle();

  if (!invErr && invoice) {
    return { doc: mapInvoiceToPrintDoc(invoice as Record<string, unknown>), error: null };
  }

  const { data: legacy, error: legErr } = await supabase
    .from("platform_billing_documents" as never)
    .select(
      "id,firm_id,document_no,document_type,status,amount_minor,paid_minor,taxable_minor,cgst_minor,sgst_minor,igst_minor,gst_minor,buyer_state_code,seller_state_code,issued_at,due_at,data",
    )
    .eq("id", id)
    .maybeSingle();

  if (legErr || !legacy) {
    return { doc: null, error: legErr?.message ?? invErr?.message ?? "Document not found" };
  }

  return {
    doc: { ...(legacy as LegacyDoc), source: "platform_billing_documents" },
    error: null,
  };
}

/** List invoices for platform billing hub — canonical source with legacy flag. */
export async function listCanonicalPlatformInvoices(firmId?: string) {
  let query = supabase
    .from("platform_invoices" as never)
    .select(
      "id,firm_id,invoice_no,status,total_paise,paid_paise,balance_paise,billing_name,issued_at,due_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (firmId) query = query.eq("firm_id", firmId);

  const { data, error } = await query;
  return { data: data ?? [], error };
}
