/**
 * MTJ ERP — Billing store (Sprint 3)
 *
 * Invoices, payments, customer ledger.
 * Weights mg, money paise, purity per-mille.
 *
 * GST pilot rule: GST = 3% (CGST 1.5 + SGST 1.5) on (making + stone) only.
 * Toggle off via settings — invoice will show "GST not applied".
 *
 * Gold ledger interaction on sale:
 *   - Finished item already lives in the `finished` bucket (from Receive Work).
 *   - Confirming the invoice appends a `sale` movement with delta finished: -fineMg.
 *   - Net total under management decreases by fineMg (gold left the shop).
 *   - Old gold / advance gold applied at order time is NOT re-counted here.
 */

import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "./settings-store";
import { useModuleStore } from "./module-store";
import { createRepository } from "./repositories/base-repository";
import { useLedger } from "./ledger-store";
import { append as appendAudit } from "./security/audit-log";
import { nextDocumentNumber } from "./document-numbering";
import { assertNetNotAboveGross } from "./gold";
import type { MakingChargeBasis } from "./calculation-engine";

export type PaymentMode =
  | "cash"
  | "upi"
  | "bank"
  | "card"
  | "cheque"
  | "gold_exchange"
  | "customer_gold_credit"
  | "advance"
  | "outstanding";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
  card: "Card",
  cheque: "Cheque",
  gold_exchange: "Gold Exchange",
  customer_gold_credit: "Customer Gold Credit",
  advance: "Advance Adjustment",
  outstanding: "Outstanding (Credit / Due)",
};

export interface InvoiceItem {
  id: string;
  stockItemId?: string;
  barcode?: string;
  itemName: string;
  category: string;
  purity: number;
  grossMg: number;
  netMg: number;
  fineMg: number;
  goldRatePerGramPaise: number; // ₹ per gram, in paise
  goldValuePaise: number; // computed
  makingChargesPaise: number;
  /** Snapshot of how makingChargesPaise was computed — immutable once posted, even if Settings → Making Charge configuration changes later. Absent on invoices created before this field existed; those remain implicitly "percentage" (their makingChargePct is still authoritative). */
  makingChargeBasis?: MakingChargeBasis;
  /** Percent for "percentage" basis, paise/unit for gross/net/fine/piece/carat, the flat amount for "flat". */
  makingChargeRatePerUnitPaise?: number;
  stoneChargesPaise: number;
  /** BIS hallmarking/certification fee for this item — tracked separately from otherChargesPaise so it's independently visible/reportable, matching stoneChargesPaise's treatment. */
  hallmarkChargesPaise: number;
  otherChargesPaise: number;
  discountPaise: number;
  lineTotalPaise: number; // gold + making + stone + hallmark + other - discount (pre-GST)
  stoneWeightMg?: number;
  diamondWeightMg?: number;
  huid?: string;
  /**
   * Making charge as a percentage of goldValuePaise — the jewellery-industry
   * convention (e.g. "12% making charge"), not a flat rupee amount. Stored so
   * the editor can round-trip the same percentage rather than back-computing
   * an approximation from makingChargesPaise. makingChargesPaise remains the
   * source of truth for totals; it is simply always derived as
   * round(goldValuePaise * makingChargePct / 100) at entry time.
   */
  makingChargePct?: number;
  /**
   * "job_work" (default): the customer (jeweller) already owns the gold —
   * bill only making/stone/hallmark/other charges, goldValuePaise is still
   * computed for reference/print but excluded from lineTotalPaise.
   * "full_value": legacy retail-style sale of workshop-owned stock (e.g.
   * ready_stock billing type) — goldValuePaise is included in the total.
   */
  chargeMode?: "job_work" | "full_value";
}

export interface PaymentRecord {
  id: string;
  ts: number;
  mode: PaymentMode;
  amountPaise: number;
  reference?: string;
  notes?: string;
  // Optional gold-exchange detail
  goldGrossMg?: number;
  goldPurity?: number;
  goldFineMg?: number;
  goldRatePerGramPaise?: number;
  goldMeltLossWtDeductionStr?: string;
  goldMeltLossPctDeductionStr?: string;
}

export interface OrderAdjustment {
  /** Cash advance carried in from the order (already received). */
  cashAdvancePaise: number;
  cashAdvanceRef?: string;
  /** Old gold / customer gold received at order time, valued for this bill. */
  goldGrossMg: number;
  goldPurity: number;
  goldFineMg: number;
  goldRatePerGramPaise: number;
  goldValuePaise: number;
  goldKind?: "old_gold" | "advance";
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "partial" | "cancelled";
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  partial: "Partially Paid",
  cancelled: "Cancelled",
};

export type GstKind = "none" | "gst3";

// Canonical home for BillingType — previously duplicated verbatim in both
// modules/billing/billingStore.ts and BillingModule.tsx. Both now import
// this instead of redefining it (billingStore.ts re-exports it, since it
// already imports other types from here and other files import BillingType
// from there).
export type BillingType =
  | "ready_stock"
  | "custom_order"
  | "repair"
  | "polishing"
  | "wholesale"
  | "advance_receipt"
  | "payment_receipt"
  | "manufacturing";

export interface Invoice {
  id: string;
  invoiceNo: string;
  createdAt: number;
  updatedAt: number;
  status: InvoiceStatus;
  /** Was already sent to add()/persisted at runtime before this field was
   *  typed (BillingModule.tsx's payload has always included it) — adding it
   *  here just gives it a real type instead of flowing through untyped. */
  billingType?: BillingType;

  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;

  orderId?: string;
  orderNo?: string;
  jobId?: string;
  jobNo?: string;

  items: InvoiceItem[];

  // Adjustments from the linked order — shown so they are not double-billed.
  orderAdjustment?: OrderAdjustment;

  gst: GstKind;
  cgstPaise: number;
  sgstPaise: number;
  gstPaise: number;
  /** TCS (Tax Collected at Source) — 0 unless Settings → Tax Configuration has it enabled and this invoice crosses the configured threshold. */
  tcsPaise: number;
  /**
   * The GST amount's fine-gold equivalent, computed only when Settings →
   * Tax Configuration's "Allow GST Payment in Gold" is on — purely
   * informational/settlement-reference; GST is never auto-converted to gold,
   * a customer choosing to pay it in gold still records an explicit
   * gold_exchange PaymentRecord like any other payment.
   */
  gstGoldEquivalentMg?: number;

  subtotalPaise: number; // sum of items pre-GST
  adjustmentPaise: number; // cashAdvance + oldGoldValue
  grandTotalPaise: number; // subtotal + gst + tcs - adjustment
  paidPaise: number; // sum of payments
  balancePaise: number; // grand - paid

  payments: PaymentRecord[];

  notes?: string;
  branchId?: string;
  saleLedgerEntryId?: string;
  /** Any other gold-ledger entries this invoice posted (overpay override, Pay-In-Gold shortfall/surplus) — reversed alongside saleLedgerEntryId on cancellation. */
  additionalLedgerEntryIds?: string[];
  cancelledAt?: number;
  cancelledReason?: string;
  cancelledBy?: string | null;
}

export interface CustomerLedgerLine {
  ts: number;
  kind: "invoice" | "payment" | "advance" | "old_gold" | "gold_credit";
  ref: string; // invoice no / payment id / order no
  refId: string;
  invoiceId?: string;
  orderId?: string;
  description: string;
  debitPaise: number; // customer owes
  creditPaise: number; // customer paid / credited
}

interface BillingState {
  invoices: Invoice[];
  gstDefault: GstKind;
  setGstDefault: (g: GstKind) => void;
  refresh: () => Promise<void>;
  add: (
    i: Omit<Invoice, "id" | "createdAt" | "updatedAt" | "payments"> & {
      invoiceNo?: string;
      payments?: PaymentRecord[];
    },
  ) => Promise<Invoice>;
  update: (id: string, patch: Partial<Invoice>) => Promise<void>;
  /**
   * Cancels an invoice and reverses every gold-ledger entry it posted
   * (saleLedgerEntryId + additionalLedgerEntryIds) via the ledger's own
   * reverse() primitive — never a raw delete, so the reversal itself is a
   * traceable, auditable ledger entry, not a silent disappearance.
   * No-ops (returns null) if the invoice is already cancelled or not found.
   */
  cancelInvoice: (
    id: string,
    reason: string,
    actor: { id: string | null; email: string | null },
  ) => Promise<Invoice | null>;
  addPayment: (
    invoiceId: string,
    p: Omit<PaymentRecord, "id" | "ts"> & { id?: string; ts?: number },
  ) => Promise<PaymentRecord | null>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

function makeId(prefix = "inv"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function makeInvoiceNo(branchId?: string): Promise<string> {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  // Branch's own Invoice Series Prefix (settings.branch-settings.tsx) overrides
  // the generic INV- prefix when set, so each branch's invoices carry its
  // configured series (e.g. "MTJ/ICH/25-26/") instead of a shared one.
  const branchPrefix = branchId
    ? useSettings.getState().getBranchSettings(branchId).invoiceSeries
    : undefined;
  const prefix = branchPrefix || `INV-${ymd}-`;
  const key = branchId ? `invoice:${branchId}:${ymd}` : `invoice:${ymd}`;
  return nextDocumentNumber(key, prefix, 3);
}

// Billing types where a line item legitimately carries no gold weight/rate
// at all (a repair or a plain cash receipt) — the one place this exemption
// is decided; see invoiceItemValidationError() below.
const SERVICE_OR_RECEIPT_BILLING_TYPES: ReadonlySet<BillingType> = new Set([
  "repair",
  "polishing",
  "advance_receipt",
  "payment_receipt",
]);

/**
 * The single rule for "is this line item complete enough to save" —
 * BillingModule.tsx's pre-save UI check and this store's own save-time
 * guard (assertInvoiceItemsValid, below) both call this instead of each
 * keeping their own copy of the condition, so the two can never drift.
 * Returns a human-readable reason the item is invalid, or null if it's fine.
 *
 * Root cause this prevents: a real competitor product accepted a fully
 * blank line item (no SKU, no weight, ₹0) into a saved bill, which then
 * surfaced as a phantom product in reporting. A jewellery item with no SKU
 * and no weight/rate is exactly that same blank-placeholder shape; a
 * service/receipt item legitimately can be ₹0 (e.g. a free warranty
 * repair), so that exemption is preserved deliberately, not accidentally.
 */
export function invoiceItemValidationError(
  it: InvoiceItem,
  billingType?: BillingType,
): string | null {
  if (!it.itemName?.trim()) return "needs a name / description";
  if (billingType && SERVICE_OR_RECEIPT_BILLING_TYPES.has(billingType)) return null;
  if (it.fineMg <= 0 || it.goldRatePerGramPaise <= 0) {
    return "needs weights, purity and a gold rate";
  }
  return null;
}

/**
 * Guards a whole invoice's line items right before they're persisted. Not
 * called on every keystroke while an item is being edited (grossMg/netMg
 * are typed independently and are legitimately transiently inconsistent
 * mid-edit) — only at the save/update choke points, so a bad pair blocks
 * the save with a clear error instead of silently reaching the ledger or a
 * printed invoice.
 */
function assertInvoiceItemsValid(items: InvoiceItem[], billingType?: BillingType): void {
  for (const it of items) {
    assertNetNotAboveGross(it.grossMg, it.netMg, `item "${it.itemName || it.id}"`);
    const error = invoiceItemValidationError(it, billingType);
    if (error) throw new Error(`Item "${it.itemName || it.id}" ${error}.`);
  }
}

export function computeItemTotals(
  it: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise">,
): { goldValuePaise: number; lineTotalPaise: number } {
  // Gold value uses NET weight (gross - less) × purity / 1000 = fine × rate / 1000
  // We use fineMg × rate(₹/g in paise) / 1000 to get paise.
  // Always computed (used for reference/print and by full_value charging),
  // even in job_work mode where it's excluded from the billed total below.
  const goldValuePaise = Math.round((it.fineMg * it.goldRatePerGramPaise) / 1000);
  const chargeMode = it.chargeMode ?? "job_work";
  const lineTotalPaise =
    (chargeMode === "full_value" ? goldValuePaise : 0) +
    it.makingChargesPaise +
    it.stoneChargesPaise +
    (it.hallmarkChargesPaise ?? 0) +
    it.otherChargesPaise -
    it.discountPaise;
  return { goldValuePaise, lineTotalPaise };
}

export function computeInvoiceTotals(
  items: InvoiceItem[],
  gst: GstKind,
  adjustment?: OrderAdjustment,
  payments: PaymentRecord[] = [],
): Pick<
  Invoice,
  | "subtotalPaise"
  | "cgstPaise"
  | "sgstPaise"
  | "gstPaise"
  | "tcsPaise"
  | "gstGoldEquivalentMg"
  | "adjustmentPaise"
  | "grandTotalPaise"
  | "paidPaise"
  | "balancePaise"
> {
  const subtotalPaise = items.reduce((s, i) => s + i.lineTotalPaise, 0);
  let cgstPaise = 0;
  let sgstPaise = 0;

  if (gst === "gst3" && useModuleStore.getState().isModuleEnabled("gst")) {
    // Dynamic GST parameters configured by the Chartered Accountant (CA)
    const gstConfig = useSettings.getState().gst;

    const ratePct = gstConfig.gstRatePct ?? 3;
    const applyOnMakingAndStoneOnly = gstConfig.applyOnMakingAndStoneOnly ?? true;

    // Hallmark charges are a service fee like making/stone charges (not the
    // gold value itself), so they belong in the same taxable base — omitting
    // them here would have silently under-collected GST on every hallmarked
    // item once hallmarkChargesPaise started being used.
    const taxableBase = applyOnMakingAndStoneOnly
      ? items.reduce(
          (s, i) => s + i.makingChargesPaise + i.stoneChargesPaise + (i.hallmarkChargesPaise ?? 0),
          0,
        )
      : subtotalPaise;

    // Total GST is computed ONCE, from the full rate — never by rounding
    // each half independently and adding them back up. Rounding cgst and
    // sgst separately (Math.round(base*halfRate/100) twice) can silently
    // disagree with the mathematically correct single-rate total by a
    // paise (e.g. base=10100, rate=3%: two independent half-roundings sum
    // to 304, but the true total is 303) — a real "round-off" defect, not
    // a rounding style choice. Splitting a single, correctly-rounded total
    // in half (remainder assigned to CGST, the conventional side for an
    // odd paise under Indian GST filing) guarantees cgst+sgst always
    // exactly equals gstPaise, with no drift either direction.
    const totalGstPaise = Math.round((taxableBase * ratePct) / 100);

    if (gstConfig.splitMode === "igst") {
      cgstPaise = 0;
      sgstPaise = totalGstPaise; // Represent as single pool
    } else {
      // Standard intra-state split (CGST + SGST) — split the single
      // correctly-rounded total instead of rounding each half separately.
      sgstPaise = Math.floor(totalGstPaise / 2);
      cgstPaise = totalGstPaise - sgstPaise;
    }
  }

  const gstPaise = cgstPaise + sgstPaise;

  // TCS — computed on the full pre-TCS invoice value once it crosses the
  // configured threshold, per Settings → Tax Configuration. Applied at
  // invoice level (not per-item), matching how Section 206C-style TCS is
  // actually collected on high-value jewellery sales.
  const taxConfig = useSettings.getState().gst;
  const preTcsTotalPaise = subtotalPaise + gstPaise;
  const tcsPaise =
    taxConfig.tcsEnabled && preTcsTotalPaise > (taxConfig.tcsThresholdPaise ?? 0)
      ? Math.round((preTcsTotalPaise * (taxConfig.tcsRatePct ?? 0)) / 100)
      : 0;

  // GST-in-gold equivalent — informational only, never auto-converts GST to
  // a gold movement. Uses the configured conversion rate, falling back to
  // the first item's own gold rate (the rate the invoice was actually
  // priced at) when no override rate is configured.
  let gstGoldEquivalentMg: number | undefined;
  if (taxConfig.allowGstPaymentInGold && gstPaise > 0) {
    const rate = taxConfig.gstGoldConversionRatePaise || items[0]?.goldRatePerGramPaise || 0;
    gstGoldEquivalentMg = rate > 0 ? Math.round((gstPaise / rate) * 1000) : 0;
  }

  const adjustmentPaise = (adjustment?.cashAdvancePaise ?? 0) + (adjustment?.goldValuePaise ?? 0);
  const grandTotalPaise = subtotalPaise + gstPaise + tcsPaise - adjustmentPaise;
  const paidPaise = payments
    .filter((p) => p.mode !== "outstanding")
    .reduce((s, p) => s + p.amountPaise, 0);
  const balancePaise = grandTotalPaise - paidPaise;

  return {
    subtotalPaise,
    cgstPaise,
    sgstPaise,
    gstPaise,
    tcsPaise,
    gstGoldEquivalentMg,
    adjustmentPaise,
    grandTotalPaise,
    paidPaise,
    balancePaise,
  };
}

/**
 * Gold-first presentation/settlement projection for an invoice.
 *
 * Money remains the legal posting currency in Invoice, but every amount can
 * be presented as fine gold using the same rate that the gold payment uses.
 * Keeping this projection here prevents BillingModule, print views, and
 * settlement views from each inventing a different gold conversion.
 */
export interface InvoiceGoldTotals {
  ratePerGramPaise: number;
  productFineMg: number;
  goldValueMg: number;
  makingChargesMg: number;
  stoneChargesMg: number;
  hallmarkChargesMg: number;
  otherChargesMg: number;
  discountMg: number;
  subtotalMg: number;
  adjustmentMg: number;
  gstMg: number;
  tcsMg: number;
  grandTotalMg: number;
  paidMg: number;
  balanceMg: number;
  physicalGoldReceivedMg: number;
}

export function paiseToFineGoldMg(paise: number, ratePerGramPaise: number): number {
  if (!Number.isFinite(paise) || !Number.isFinite(ratePerGramPaise) || ratePerGramPaise <= 0) {
    return 0;
  }
  return Math.round((paise * 1000) / ratePerGramPaise);
}

export function computeInvoiceGoldTotals(
  items: InvoiceItem[],
  totals: Pick<
    Invoice,
    "gstPaise" | "tcsPaise" | "adjustmentPaise" | "grandTotalPaise" | "paidPaise" | "balancePaise"
  >,
  payments: PaymentRecord[] = [],
  ratePerGramPaise: number,
): InvoiceGoldTotals {
  const productFineMg = items.reduce((sum, item) => sum + Math.max(0, item.fineMg), 0);
  const goldValuePaise = items.reduce((sum, item) => sum + Math.max(0, item.goldValuePaise), 0);
  const makingChargesPaise = items.reduce(
    (sum, item) => sum + Math.max(0, item.makingChargesPaise),
    0,
  );
  const stoneChargesPaise = items.reduce(
    (sum, item) => sum + Math.max(0, item.stoneChargesPaise),
    0,
  );
  const hallmarkChargesPaise = items.reduce(
    (sum, item) => sum + Math.max(0, item.hallmarkChargesPaise ?? 0),
    0,
  );
  const otherChargesPaise = items.reduce(
    (sum, item) => sum + Math.max(0, item.otherChargesPaise),
    0,
  );
  const discountPaise = items.reduce((sum, item) => sum + Math.max(0, item.discountPaise), 0);
  const physicalGoldReceivedMg = payments.reduce(
    (sum, payment) => sum + Math.max(0, payment.goldFineMg ?? 0),
    0,
  );

  return {
    ratePerGramPaise,
    productFineMg,
    goldValueMg: paiseToFineGoldMg(goldValuePaise, ratePerGramPaise),
    makingChargesMg: paiseToFineGoldMg(makingChargesPaise, ratePerGramPaise),
    stoneChargesMg: paiseToFineGoldMg(stoneChargesPaise, ratePerGramPaise),
    hallmarkChargesMg: paiseToFineGoldMg(hallmarkChargesPaise, ratePerGramPaise),
    otherChargesMg: paiseToFineGoldMg(otherChargesPaise, ratePerGramPaise),
    discountMg: paiseToFineGoldMg(discountPaise, ratePerGramPaise),
    subtotalMg: paiseToFineGoldMg(
      totals.grandTotalPaise - totals.gstPaise - totals.tcsPaise + totals.adjustmentPaise,
      ratePerGramPaise,
    ),
    adjustmentMg: paiseToFineGoldMg(totals.adjustmentPaise, ratePerGramPaise),
    gstMg: paiseToFineGoldMg(totals.gstPaise, ratePerGramPaise),
    tcsMg: paiseToFineGoldMg(totals.tcsPaise, ratePerGramPaise),
    grandTotalMg: paiseToFineGoldMg(totals.grandTotalPaise, ratePerGramPaise),
    paidMg: paiseToFineGoldMg(totals.paidPaise, ratePerGramPaise),
    balanceMg: paiseToFineGoldMg(totals.balancePaise, ratePerGramPaise),
    physicalGoldReceivedMg,
  };
}

/**
 * Splits an invoice's recorded payments by asset type — the "Payment
 * Engine" summary the Customer Settlement Slip and GST Invoice both read
 * from, rather than each re-deriving it. Every PaymentRecord already
 * carries its own `mode`; this just aggregates what's already stored, it
 * does not introduce a new payment model.
 */
export function computeInvoicePaymentSummary(
  invoice: Pick<Invoice, "payments" | "grandTotalPaise">,
): {
  totalGoldReceivedFineMg: number;
  totalCashReceivedPaise: number;
  byMode: Record<PaymentMode, number>;
  remainingBalancePaise: number;
} {
  const byMode = {} as Record<PaymentMode, number>;
  let totalGoldReceivedFineMg = 0;
  let totalCashReceivedPaise = 0;

  for (const p of invoice.payments) {
    byMode[p.mode] = (byMode[p.mode] ?? 0) + p.amountPaise;
    if (p.mode === "gold_exchange") {
      totalGoldReceivedFineMg += p.goldFineMg ?? 0;
    } else if (
      p.mode !== "outstanding" &&
      p.mode !== "customer_gold_credit" &&
      p.mode !== "advance"
    ) {
      totalCashReceivedPaise += p.amountPaise;
    }
  }

  const totalReceivedPaise = invoice.payments
    .filter((p) => p.mode !== "outstanding")
    .reduce((s, p) => s + p.amountPaise, 0);

  return {
    totalGoldReceivedFineMg,
    totalCashReceivedPaise,
    byMode,
    remainingBalancePaise: Math.max(0, invoice.grandTotalPaise - totalReceivedPaise),
  };
}

const invoiceRepository = createRepository<Invoice>("invoices");
const paymentRepository = createRepository<PaymentRecord>("payments");
const billingPreferencesRepository = createRepository<{ id: string; gstDefault: GstKind }>(
  "app_settings",
);
const invoiceAddInFlight = new Set<string>();
const BILLING_COMPAT_CACHE_LIMIT = 500;

export const useBilling = create<BillingState>()((set, get) => ({
  invoices: [],
  gstDefault: "gst3",
  setGstDefault: (g) => {
    set({ gstDefault: g });
    void billingPreferencesRepository.save({ id: "billing_prefs", gstDefault: g });
  },
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
      "firm-owner",
      "super_owner",
      "administrator",
    ];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    // Compatibility cache only; register/report screens should use paginated
    // Supabase queries or aggregates instead of loading the full invoice table.
    let invoiceQ = supabase
      .from("invoices")
      .select(
        "id,invoice_no,customer_id,order_id,status,subtotal_paise,gst_paise,grand_total_paise,paid_paise,balance_paise,created_at,updated_at,data",
      )
      .order("updated_at", { ascending: false })
      .limit(BILLING_COMPAT_CACHE_LIMIT);
    if (bid) invoiceQ = invoiceQ.filter("data->>branchId", "eq", bid) as typeof invoiceQ;
    const [invoiceRes, prefsRes] = await Promise.all([
      invoiceQ,
      supabase.from("app_settings").select("data").eq("id", "billing_prefs").maybeSingle(),
    ]);
    if (!invoiceRes.error) {
      const rows = (invoiceRes.data ?? [])
        .map((r: any) => {
          const d = (r.data as Invoice) || {};
          const id = r.id || d.id;
          const invoiceNo = r.invoice_no || d.invoiceNo;
          if (!id || !invoiceNo) return null;
          return {
            ...d,
            id,
            invoiceNo,
            customerId: d.customerId || r.customer_id || "",
            status: d.status || r.status || "draft",
            grandTotalPaise: d.grandTotalPaise ?? r.grand_total_paise ?? 0,
            paidPaise: d.paidPaise ?? r.paid_paise ?? 0,
            balancePaise: d.balancePaise ?? r.balance_paise ?? 0,
          } as Invoice;
        })
        .filter((i): i is Invoice => !!i && !!i.id && !!i.invoiceNo);
      set({ invoices: rows });
    }
    if (!prefsRes.error && prefsRes.data?.data) {
      const prefs = prefsRes.data.data as any;
      if (prefs.gstDefault) set({ gstDefault: prefs.gstDefault });
    }
  },
  add: async (input) => {
    // Guards a rapid double-click/double-submit from creating two invoices
    // for the same order/job before React's disabled state commits — same
    // class of race fixed in manufacturing-barcode-store.ts's generate().
    // Only guarded when there's a stable order/job to key on; a walk-in sale
    // with no such link has no meaningful "duplicate" concept to prevent.
    assertInvoiceItemsValid(input.items, input.billingType);
    const inFlightKey = input.orderId ?? input.jobId;
    if (inFlightKey) {
      if (invoiceAddInFlight.has(inFlightKey)) {
        throw new Error("An invoice for this order is already being saved.");
      }
      invoiceAddInFlight.add(inFlightKey);
    }
    try {
      const now = Date.now();
      const branchId =
        (input as any).branchId ?? useSettings.getState().selectedBranchId ?? undefined;
      const inv: Invoice = {
        branchId,
        id: makeId("inv"),
        createdAt: now,
        updatedAt: now,
        payments: input.payments ?? [],
        ...input,
        invoiceNo: input.invoiceNo ?? (await makeInvoiceNo(branchId)),
      };
      await invoiceRepository.save(inv);
      // Optimistic local update — realtime will confirm from DB
      set((s) => ({ invoices: [inv, ...s.invoices] }));

      // Event-driven communication automation (Plan 1 Step 9) — no-op unless
      // the "invoice_created" rule is enabled in Communication Automation
      // Settings; never blocks or can fail the invoice creation itself.
      import("@/lib/people-store")
        .then(({ usePeople }) => {
          const person = usePeople.getState().people.find((p) => p.id === (inv as any).customerId);
          return import("@/lib/comm/comm-automation").then(({ emitBusinessEvent }) =>
            emitBusinessEvent("invoice_created", {
              branchId: inv.branchId ?? "default",
              recipient: {
                name: inv.customerName,
                phone: inv.customerPhone,
                email: person?.email,
              },
              linkedId: inv.id,
              linkedType: "invoice",
            }),
          );
        })
        .catch((err) => console.error("[Billing] invoice_created automation failed:", err));

      return inv;
    } finally {
      if (inFlightKey) invoiceAddInFlight.delete(inFlightKey);
    }
  },
  update: async (id, patch) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (!inv) return;
    const updated = { ...inv, ...patch, updatedAt: Date.now() };
    assertInvoiceItemsValid(updated.items, updated.billingType);
    await invoiceRepository.save(updated);
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? updated : i)) }));
  },
  cancelInvoice: async (id, reason, actor) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (!inv || inv.status === "cancelled") return null;

    const entryIdsToReverse = [
      ...(inv.saleLedgerEntryId ? [inv.saleLedgerEntryId] : []),
      ...(inv.additionalLedgerEntryIds ?? []),
    ];
    const reverseReason = `Invoice ${inv.invoiceNo} cancelled: ${reason}`;
    for (const entryId of entryIdsToReverse) {
      try {
        await useLedger.getState().reverse(entryId, reverseReason);
      } catch (err) {
        // A missing/already-reversed entry must not block the cancellation
        // itself — it's logged so a discrepancy is investigable, never
        // silently swallowed.
        console.error(
          `[Billing] Failed to reverse ledger entry ${entryId} for invoice ${id}:`,
          err,
        );
      }
    }

    const updated: Invoice = {
      ...inv,
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledReason: reason,
      cancelledBy: actor.id,
      updatedAt: Date.now(),
    };
    await invoiceRepository.save(updated);
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? updated : i)) }));

    await appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "invoices.cancel",
      entityType: "invoices",
      entityId: id,
      before: { status: inv.status },
      after: { status: "cancelled", reason, reversedLedgerEntryIds: entryIdsToReverse },
    });

    return updated;
  },
  addPayment: async (invoiceId, p) => {
    const inv = get().invoices.find((x) => x.id === invoiceId);
    if (!inv) return null;
    // A cancelled invoice's ledger entries were already reversed by
    // cancelInvoice() — accepting a payment here would change its
    // balance/status without any corresponding ledger effect.
    if (inv.status === "cancelled") {
      throw new Error("Cannot add a payment to a cancelled invoice.");
    }
    const pay: PaymentRecord = {
      id: p.id ?? makeId("pay"),
      ts: p.ts ?? Date.now(),
      mode: p.mode,
      amountPaise: p.amountPaise,
      reference: p.reference,
      notes: p.notes,
      goldGrossMg: p.goldGrossMg,
      goldPurity: p.goldPurity,
      goldFineMg: p.goldFineMg,
      goldRatePerGramPaise: p.goldRatePerGramPaise,
    };

    // If there is an "outstanding" placeholder payment, we must reduce or remove it
    // because a real payment is being made against that outstanding balance.
    const currentPayments = [...inv.payments];
    const outstandingIdx = currentPayments.findIndex((p) => p.mode === "outstanding");
    if (outstandingIdx >= 0) {
      const outstandingPay = currentPayments[outstandingIdx];
      if (pay.amountPaise >= outstandingPay.amountPaise) {
        // Full (or over) payment of the outstanding amount — remove the placeholder
        currentPayments.splice(outstandingIdx, 1);
      } else {
        // Partial payment — reduce the placeholder
        currentPayments[outstandingIdx] = {
          ...outstandingPay,
          amountPaise: outstandingPay.amountPaise - pay.amountPaise,
        };
      }
    }

    const payments = [...currentPayments, pay];
    const totals = computeInvoiceTotals(inv.items, inv.gst, inv.orderAdjustment, payments);
    const status: InvoiceStatus =
      totals.balancePaise <= 0
        ? "paid"
        : totals.paidPaise > 0
          ? "partial"
          : inv.status === "draft"
            ? "draft"
            : "issued";
    const updatedInv = { ...inv, payments, ...totals, status, updatedAt: Date.now() };

    // Save the payment item itself for audit trailing
    await paymentRepository.save({ ...pay, invoiceId } as PaymentRecord);
    // Update the invoice (which contains nested payments array)
    await invoiceRepository.save(updatedInv);
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === invoiceId ? updatedInv : i)) }));

    // Gold Payment Logic — a customer settling (part of) this invoice in
    // gold physically hands gold to the shop, which enters the vault. This
    // is NOT a gold sale (no `sale` movement, nothing leaves the `finished`
    // bucket) — it is the mirror image of the `sale` movement this same
    // invoice may separately post: gold coming IN as payment. The Party
    // Ledger (compileCustomerLedger()) already reads this invoice's
    // `payments[]` directly, so no separate customer-ledger write is
    // needed here — recording it in the real Gold Ledger is the only gap.
    if (pay.mode === "gold_exchange" && (pay.goldFineMg ?? 0) > 0) {
      try {
        const entry = await useLedger.getState().append({
          type: "customer_gold_received",
          netFineMg: pay.goldFineMg!,
          deltas: { vault: pay.goldFineMg! },
          grossMg: pay.goldGrossMg,
          purity: pay.goldPurity as any,
          fineMg: pay.goldFineMg,
          reference: updatedInv.invoiceNo,
          notes: `Gold payment received from ${updatedInv.customerName} against Invoice ${updatedInv.invoiceNo}`,
        });
        const withLedgerLink: Invoice = {
          ...updatedInv,
          additionalLedgerEntryIds: [...(updatedInv.additionalLedgerEntryIds ?? []), entry.id],
        };
        await invoiceRepository.save(withLedgerLink);
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === invoiceId ? withLedgerLink : i)),
        }));
      } catch (err) {
        console.error("[Billing] Failed to post gold payment to Gold Ledger:", err);
      }
    }

    // Event-driven communication automation (Plan 1 Step 9) — no-op unless
    // the relevant rule is enabled; never blocks or can fail payment recording.
    import("@/lib/people-store")
      .then(({ usePeople }) => {
        const person = usePeople
          .getState()
          .people.find((pr) => pr.id === (updatedInv as any).customerId);
        const recipient = {
          name: updatedInv.customerName,
          phone: updatedInv.customerPhone,
          email: person?.email,
        };
        return import("@/lib/comm/comm-automation").then(({ emitBusinessEvent }) =>
          Promise.all([
            emitBusinessEvent("payment_received", {
              branchId: updatedInv.branchId ?? "default",
              recipient,
              linkedId: updatedInv.id,
              linkedType: "invoice",
            }),
            status === "paid"
              ? emitBusinessEvent("invoice_paid", {
                  branchId: updatedInv.branchId ?? "default",
                  recipient,
                  linkedId: updatedInv.id,
                  linkedType: "invoice",
                })
              : Promise.resolve(),
          ]),
        );
      })
      .catch((err) => console.error("[Billing] payment automation failed:", err));

    return pay;
  },
  remove: async (id) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (inv) {
      // Remove linked payments too
      for (const p of inv.payments) {
        await paymentRepository.delete(p.id);
      }
    }
    await invoiceRepository.delete(id);
    set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
  },
  reset: () => set({ invoices: [] }),
}));

/** Build a per-customer ledger from invoices. */
export function customerLedger(
  customerId: string,
  invoices: Invoice[],
): {
  lines: CustomerLedgerLine[];
  totalDebit: number;
  totalCredit: number;
  outstanding: number;
} {
  const lines: CustomerLedgerLine[] = [];
  if (!customerId || !Array.isArray(invoices)) {
    return { lines, totalDebit: 0, totalCredit: 0, outstanding: 0 };
  }
  for (const inv of invoices) {
    if (!inv || inv.customerId !== customerId) continue;
    // Adjustments first (chronologically before invoice)
    if (inv.orderAdjustment?.cashAdvancePaise) {
      lines.push({
        ts: inv.createdAt - 1,
        kind: "advance",
        ref: inv.orderNo ?? inv.invoiceNo,
        refId: inv.orderId ?? inv.id,
        orderId: inv.orderId,
        invoiceId: inv.id,
        description: `Cash advance for ${inv.orderNo ?? inv.invoiceNo}`,
        debitPaise: 0,
        creditPaise: inv.orderAdjustment.cashAdvancePaise,
      });
    }
    if (inv.orderAdjustment?.goldValuePaise) {
      lines.push({
        ts: inv.createdAt - 1,
        kind: "old_gold",
        ref: inv.orderNo ?? inv.invoiceNo,
        refId: inv.orderId ?? inv.id,
        orderId: inv.orderId,
        invoiceId: inv.id,
        description: `Old gold applied (${(inv.orderAdjustment.goldFineMg / 1000).toFixed(3)} g fine)`,
        debitPaise: 0,
        creditPaise: inv.orderAdjustment.goldValuePaise,
      });
    }
    lines.push({
      ts: inv.createdAt,
      kind: "invoice",
      ref: inv.invoiceNo,
      refId: inv.id,
      invoiceId: inv.id,
      orderId: inv.orderId,
      description: `Invoice ${inv.invoiceNo}${inv.items[0] ? ` · ${inv.items[0].itemName}` : ""}`,
      debitPaise: inv.subtotalPaise + inv.gstPaise,
      creditPaise: 0,
    });
    for (const p of inv.payments) {
      lines.push({
        ts: p.ts,
        kind: "payment",
        ref: `${inv.invoiceNo} · ${PAYMENT_MODE_LABELS[p.mode]}`,
        refId: p.id,
        invoiceId: inv.id,
        orderId: inv.orderId,
        description:
          p.notes ?? PAYMENT_MODE_LABELS[p.mode] + (p.reference ? ` · ${p.reference}` : ""),
        debitPaise: p.mode === "outstanding" ? 0 : 0,
        creditPaise: p.mode === "outstanding" ? 0 : p.amountPaise,
      });
    }
  }
  lines.sort((a, b) => a.ts - b.ts);
  const totalDebit = lines.reduce((s, l) => s + l.debitPaise, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditPaise, 0);
  return { lines, totalDebit, totalCredit, outstanding: totalDebit - totalCredit };
}

export function paiseToRupees(p: number): string {
  const abs = Math.abs(p);
  const r = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return `${p < 0 ? "-" : ""}${r.toLocaleString("en-IN")}.${c}`;
}

export function rupeesToPaise(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const s = String(input).trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
