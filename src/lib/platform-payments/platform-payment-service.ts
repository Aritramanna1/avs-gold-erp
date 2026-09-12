/**
 * Platform Payment Service — client facade (no secrets; calls edge API only).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";

export type PlatformPaymentAction =
  "create_order" | "create_payment_link" | "purchase_plan" | "credit_topup";

export interface PaymentCheckoutSession {
  ok: boolean;
  orderId?: string;
  amountPaise?: number;
  keyId?: string;
  invoiceId?: string;
  shortUrl?: string;
  credits?: number;
  returnUrl?: string;
  error?: string;
}

export interface PaymentConfiguration {
  environment: "test" | "live";
  currency: string;
  cashAllowedLocations: string[];
  enabledMethods: string[];
}

export interface PlatformInvoiceRow {
  id: string;
  invoiceNo: string;
  totalPaise: number;
  balancePaise: number;
  paidPaise: number;
  status: string;
  itemType: string | null;
  createdAt: string;
}

export interface PlatformReceiptRow {
  id: string;
  receiptNo: string;
  amountPaise: number;
  paymentMethod: string;
  issuedAt: string;
  invoiceId: string | null;
}

async function callPaymentApi(
  action: PlatformPaymentAction,
  payload: Record<string, unknown>,
): Promise<PaymentCheckoutSession> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!url || !token) return { ok: false, error: "Sign in required" };

  const res = await fetch(`${url}/functions/v1/platform-payment-api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = (await res.json()) as PaymentCheckoutSession & { error?: string };
  if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Payment request failed" };
  return body;
}

export async function fetchPaymentConfiguration(): Promise<PaymentConfiguration | null> {
  const { data } = await supabase
    .from("payment_configuration" as never)
    .select("environment, currency, default_collection_policy, enabled_methods")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const policy = (row.default_collection_policy ?? {}) as { cash_allowed_locations?: string[] };
  return {
    environment: (row.environment as "test" | "live") ?? "test",
    currency: String(row.currency ?? "INR"),
    cashAllowedLocations: policy.cash_allowed_locations ?? ["Ichalkaranji", "Kolhapur"],
    enabledMethods: (row.enabled_methods as string[]) ?? ["card", "upi", "netbanking", "wallet"],
  };
}

export async function updatePaymentConfiguration(patch: {
  environment?: "test" | "live";
  cashAllowedLocations?: string[];
  enabledMethods?: string[];
}): Promise<boolean> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.environment) updates.environment = patch.environment;
  if (patch.cashAllowedLocations) {
    updates.default_collection_policy = { cash_allowed_locations: patch.cashAllowedLocations };
  }
  if (patch.enabledMethods) updates.enabled_methods = patch.enabledMethods;
  const { error } = await supabase
    .from("payment_configuration" as never)
    .update(updates as never)
    .eq("id", 1);
  return !error;
}

export async function fetchTenantInvoices(): Promise<PlatformInvoiceRow[]> {
  const { data } = await supabase
    .from("platform_invoices" as never)
    .select("id, invoice_no, total_paise, balance_paise, paid_paise, status, item_type, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    invoiceNo: String(r.invoice_no),
    totalPaise: Number(r.total_paise ?? 0),
    balancePaise: Number(r.balance_paise ?? 0),
    paidPaise: Number(r.paid_paise ?? 0),
    status: String(r.status),
    itemType: r.item_type != null ? String(r.item_type) : null,
    createdAt: String(r.created_at),
  }));
}

export async function fetchTenantReceipts(): Promise<PlatformReceiptRow[]> {
  const { data } = await supabase
    .from("platform_receipts" as never)
    .select("id, receipt_no, amount_paise, payment_method, issued_at, platform_invoice_id")
    .order("issued_at", { ascending: false })
    .limit(30);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    receiptNo: String(r.receipt_no),
    amountPaise: Number(r.amount_paise ?? 0),
    paymentMethod: String(r.payment_method),
    issuedAt: String(r.issued_at),
    invoiceId: r.platform_invoice_id != null ? String(r.platform_invoice_id) : null,
  }));
}

export async function createInternalPaymentOrder(
  planCode: string,
  billingPeriod: "monthly" | "annual" = "monthly",
  firmId?: string,
): Promise<PaymentCheckoutSession> {
  try {
    const res = await fetch("/api/payments/create-order.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_code: planCode,
        billing_period: billingPeriod,
        tenant_id: firmId,
        return_url:
          typeof window !== "undefined"
            ? `${window.location.origin}/settings/license?payment=callback`
            : undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          ok: true,
          orderId: data.razorpay_order_id,
          amountPaise: data.amount_paise,
          keyId: data.key_id,
          invoiceId: data.internal_payment_id,
          returnUrl: typeof data.return_url === "string" ? data.return_url : undefined,
        };
      }
    }
  } catch {
    // Fallback to Edge API
  }
  return callPaymentApi("purchase_plan", { planCode, productId: DEFAULT_AVS_PRODUCT });
}

export async function startPlanPurchase(planCode: string, productId = DEFAULT_AVS_PRODUCT) {
  return createInternalPaymentOrder(planCode, "monthly");
}

export async function startInvoicePayment(platformInvoiceId: string, amountPaise: number) {
  return callPaymentApi("create_order", { platformInvoiceId, amountPaise });
}

export async function verifyPaymentCallback(input: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  internal_payment_id?: string;
}) {
  const res = await fetch("/api/payments/callback.php", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...input, is_api: true }),
  });
  return res.json();
}

export async function startCreditTopUp(credits: number, walletType: "ai" | "whatsapp" = "ai") {
  return callPaymentApi("credit_topup", { credits, walletType });
}

export async function createPaymentLink(platformInvoiceId: string) {
  return callPaymentApi("create_payment_link", { platformInvoiceId });
}

export async function proposeCashCollection(input: {
  firmId: string;
  platformInvoiceId: string;
  amountPaise: number;
  collectionLocation: string;
  collector: string;
  receiptNo?: string;
  notes?: string;
  proofAttachmentUrl?: string;
}) {
  const { data, error } = await supabase.rpc(
    "propose_cash_collection" as never,
    {
      p_firm_id: input.firmId,
      p_platform_invoice_id: input.platformInvoiceId,
      p_amount_paise: input.amountPaise,
      p_collection_location: input.collectionLocation,
      p_collector: input.collector,
      p_receipt_no: input.receiptNo ?? null,
      p_notes: input.notes ?? null,
      p_proof_attachment_url: input.proofAttachmentUrl ?? null,
    } as never,
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...(data as object) };
}

export async function confirmCashCollection(cashCollectionId: string, overrideReason?: string) {
  const { data, error } = await supabase.rpc(
    "confirm_cash_collection" as never,
    {
      p_cash_collection_id: cashCollectionId,
      p_override_reason: overrideReason ?? null,
    } as never,
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...(data as object) };
}

export async function fetchPurchasablePlans() {
  const { data } = await supabase
    .from("platform_plans" as never)
    .select("code, name, description, price_minor, billing_cycle, is_active")
    .eq("is_active", true)
    .not("code", "like", "trial%")
    .order("price_minor", { ascending: true });
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    code: String(r.code),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    pricePaise: Number(r.price_minor ?? 0),
    billingCycle: r.billing_cycle != null ? String(r.billing_cycle) : null,
  }));
}

export type PurchasablePlan = Awaited<ReturnType<typeof fetchPurchasablePlans>>[number];

export interface AdminPlatformInvoiceRow extends PlatformInvoiceRow {
  firmId: string;
  firmName: string | null;
}

export interface PlatformPaymentRow {
  id: string;
  firmId: string;
  invoiceId: string | null;
  amountPaise: number;
  status: string;
  method: string | null;
  capturedAt: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
}

export interface TenantPaymentLinkRow {
  id: string;
  invoiceId: string;
  shortUrl: string;
  status: string;
  createdAt: string;
}

export interface CashCollectionRow {
  id: string;
  firmId: string;
  invoiceId: string;
  amountPaise: number;
  collectionLocation: string;
  collector: string;
  status: string;
  receiptNo: string | null;
  overrideReason: string | null;
  createdAt: string;
}

export interface SettlementRow {
  id: string;
  razorpaySettlementId: string;
  amountPaise: number;
  feesPaise: number;
  status: string;
  settledAt: string | null;
  utr: string | null;
}

export async function fetchAllPlatformInvoices(): Promise<AdminPlatformInvoiceRow[]> {
  const { data } = await supabase
    .from("platform_invoices" as never)
    .select(
      "id, invoice_no, firm_id, total_paise, balance_paise, paid_paise, status, item_type, created_at, organizations(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => {
    const org = r.organizations as { name?: string } | null;
    return {
      id: String(r.id),
      invoiceNo: String(r.invoice_no),
      firmId: String(r.firm_id),
      firmName: org?.name ?? null,
      totalPaise: Number(r.total_paise ?? 0),
      balancePaise: Number(r.balance_paise ?? 0),
      paidPaise: Number(r.paid_paise ?? 0),
      status: String(r.status),
      itemType: r.item_type != null ? String(r.item_type) : null,
      createdAt: String(r.created_at),
    };
  });
}

export async function fetchTenantPayments(): Promise<PlatformPaymentRow[]> {
  const { data } = await supabase
    .from("platform_payments" as never)
    .select(
      "id, firm_id, platform_invoice_id, amount_paise, status, method, captured_at, razorpay_payment_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(40);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    firmId: String(r.firm_id),
    invoiceId: r.platform_invoice_id != null ? String(r.platform_invoice_id) : null,
    amountPaise: Number(r.amount_paise ?? 0),
    status: String(r.status),
    method: r.method != null ? String(r.method) : null,
    capturedAt: r.captured_at != null ? String(r.captured_at) : null,
    razorpayPaymentId: r.razorpay_payment_id != null ? String(r.razorpay_payment_id) : null,
    createdAt: String(r.created_at),
  }));
}

export async function fetchTenantPaymentLinks(): Promise<TenantPaymentLinkRow[]> {
  const { data } = await supabase
    .from("payment_links" as never)
    .select("id, platform_invoice_id, short_url, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    invoiceId: String(r.platform_invoice_id),
    shortUrl: String(r.short_url),
    status: String(r.status),
    createdAt: String(r.created_at),
  }));
}

export async function fetchPlatformPayments(): Promise<PlatformPaymentRow[]> {
  const { data } = await supabase
    .from("platform_payments" as never)
    .select(
      "id, firm_id, platform_invoice_id, amount_paise, status, method, captured_at, razorpay_payment_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    firmId: String(r.firm_id),
    invoiceId: r.platform_invoice_id != null ? String(r.platform_invoice_id) : null,
    amountPaise: Number(r.amount_paise ?? 0),
    status: String(r.status),
    method: r.method != null ? String(r.method) : null,
    capturedAt: r.captured_at != null ? String(r.captured_at) : null,
    razorpayPaymentId: r.razorpay_payment_id != null ? String(r.razorpay_payment_id) : null,
    createdAt: String(r.created_at ?? ""),
  }));
}

export async function fetchCashCollections(): Promise<CashCollectionRow[]> {
  const { data } = await supabase
    .from("cash_collections" as never)
    .select(
      "id, firm_id, platform_invoice_id, amount_paise, collection_location, collector, status, receipt_no, override_reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    firmId: String(r.firm_id),
    invoiceId: String(r.platform_invoice_id),
    amountPaise: Number(r.amount_paise ?? 0),
    collectionLocation: String(r.collection_location),
    collector: String(r.collector),
    status: String(r.status),
    receiptNo: r.receipt_no != null ? String(r.receipt_no) : null,
    overrideReason: r.override_reason != null ? String(r.override_reason) : null,
    createdAt: String(r.created_at),
  }));
}

export async function fetchSettlements(): Promise<SettlementRow[]> {
  const { data } = await supabase
    .from("settlements" as never)
    .select("id, razorpay_settlement_id, amount_paise, fees_paise, status, settled_at, utr")
    .order("settled_at", { ascending: false })
    .limit(50);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    razorpaySettlementId: String(r.razorpay_settlement_id),
    amountPaise: Number(r.amount_paise ?? 0),
    feesPaise: Number(r.fees_paise ?? 0),
    status: String(r.status),
    settledAt: r.settled_at != null ? String(r.settled_at) : null,
    utr: r.utr != null ? String(r.utr) : null,
  }));
}

export async function recordPlatformRefund(input: {
  paymentId: string;
  amountPaise: number;
  razorpayRefundId?: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc(
    "record_platform_refund" as never,
    {
      p_payment_id: input.paymentId,
      p_amount_paise: input.amountPaise,
      p_razorpay_refund_id: input.razorpayRefundId ?? null,
      p_reason: input.reason ?? null,
    } as never,
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, ...(data as object) };
}

export async function createCommercialInvoice(input: {
  firmId: string;
  billingName: string;
  lines: Array<{
    itemType: string;
    description: string;
    quantity?: number;
    unitPricePaise: number;
    taxRatePct?: number;
    metadata?: Record<string, unknown>;
  }>;
  primaryItemType?: string;
}) {
  const { data, error } = await supabase.rpc(
    "create_platform_commercial_invoice" as never,
    {
      p_firm_id: input.firmId,
      p_billing_name: input.billingName,
      p_lines: input.lines.map((l) => ({
        item_type: l.itemType,
        description: l.description,
        quantity: l.quantity ?? 1,
        unit_price_paise: l.unitPricePaise,
        tax_rate_pct: l.taxRatePct ?? 0,
        metadata: l.metadata ?? {},
      })),
      p_primary_item_type: input.primaryItemType ?? input.lines[0]?.itemType ?? null,
    } as never,
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, ...(data as object) };
}
