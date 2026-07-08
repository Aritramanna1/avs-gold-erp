/**
 * MTJ ERP — Placeholder context builder for WhatsApp templates.
 * Pulls live values out of the existing Zustand stores so the user
 * never types raw numbers when sending a message.
 */
import { useOrders, paiseToRupees } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs, REPAIR_STATUS_LABELS } from "@/lib/repair-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";

export type PlaceholderCtx = Record<string, string>;

export interface BuildCtxArgs {
  orderId?: string;
  jobId?: string;
  invoiceId?: string;
  repairId?: string;
  customerId?: string;
  karigarId?: string;
}

const BLANK = "—";

/** Pretty grams (without unit) from mg integer, or BLANK. */
function g(mg: number | undefined | null): string {
  if (!mg) return BLANK;
  return `${mgToGrams(mg)} g`;
}

export function buildContext(args: BuildCtxArgs): PlaceholderCtx {
  const ctx: PlaceholderCtx = {};
  const settings = useSettings.getState();
  const people = usePeople.getState().people;
  const orders = useOrders.getState().orders;
  const jobs = useJobCards.getState().jobs;
  const invoices = useBilling.getState().invoices;
  const repairs = useRepairs.getState().repairs;

  // Firm
  ctx.firm_name = settings.firm.shopName;
  ctx.firm_phone = settings.firm.phone || BLANK;
  ctx.shop_address = settings.firm.address || BLANK;

  const order = args.orderId ? orders.find((o) => o.id === args.orderId) : undefined;
  const job = args.jobId
    ? jobs.find((j) => j.id === args.jobId)
    : order
      ? jobs.find((j) => j.orderId === order.id)
      : undefined;
  const invoice = args.invoiceId
    ? invoices.find((i) => i.id === args.invoiceId)
    : order
      ? invoices.find((i) => i.orderId === order.id)
      : undefined;
  const repair = args.repairId ? repairs.find((r) => r.id === args.repairId) : undefined;

  const customerId =
    args.customerId ??
    order?.customerId ??
    job?.customerId ??
    invoice?.customerId ??
    repair?.customerId;
  const karigarId = args.karigarId ?? order?.karigarId ?? job?.karigarId;

  const customer = customerId ? people.find((p) => p.id === customerId) : undefined;
  const karigar = karigarId ? people.find((p) => p.id === karigarId) : undefined;

  ctx.customer_name = customer?.fullName ?? BLANK;
  ctx.customer_phone = customer?.phone ?? BLANK;
  ctx.karigar_name = karigar?.fullName ?? BLANK;
  ctx.karigar_phone = karigar?.phone ?? BLANK;

  ctx.order_number = order?.orderNo ?? BLANK;
  ctx.job_card_number = job?.jobNo ?? BLANK;
  ctx.item_name = order?.item.itemName ?? job?.itemName ?? BLANK;
  ctx.category = order?.item.category ?? job?.category ?? BLANK;
  ctx.purity = String(order?.item.purity ?? job?.purity ?? BLANK);
  ctx.gross_weight = g(order?.item.grossMg ?? job?.targetGrossMg);
  ctx.net_weight = g(order?.item.netMg ?? job?.targetNetMg);
  ctx.fine_weight = g(order?.item.fineMg ?? job?.targetFineMg);
  ctx.delivery_date = order?.expectedDelivery ?? job?.expectedDelivery ?? BLANK;
  ctx.due_date = ctx.delivery_date;

  ctx.invoice_number = invoice?.invoiceNo ?? BLANK;
  ctx.invoice_amount = invoice ? `₹ ${paiseToRupees(invoice.grandTotalPaise)}` : BLANK;
  ctx.paid_amount = invoice ? `₹ ${paiseToRupees(invoice.paidPaise)}` : BLANK;
  ctx.outstanding_amount = invoice ? `₹ ${paiseToRupees(invoice.balancePaise)}` : BLANK;
  ctx.payment_due_date = invoice
    ? new Date(invoice.createdAt + 7 * 86400000).toISOString().slice(0, 10)
    : BLANK;

  ctx.repair_number = repair?.repairNo ?? BLANK;
  ctx.repair_status = repair ? REPAIR_STATUS_LABELS[repair.status] : BLANK;

  ctx.gold_issued = BLANK;
  ctx.gold_received = g(job?.workReceipt?.finishedFineMg);
  ctx.current_status = order
    ? order.status
    : job
      ? job.status
      : repair
        ? REPAIR_STATUS_LABELS[repair.status]
        : new Date().toLocaleDateString("en-IN");

  return ctx;
}

const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function renderTemplate(body: string, ctx: PlaceholderCtx): string {
  return body.replace(TOKEN_RE, (_m, key: string) => {
    const v = ctx[key.toLowerCase()];
    return v != null && v !== "" ? v : BLANK;
  });
}

/** List of placeholders referenced by a template body, in order of first use. */
export function tokensIn(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  body.replace(TOKEN_RE, (_m, k: string) => {
    const kk = k.toLowerCase();
    if (!seen.has(kk)) {
      seen.add(kk);
      out.push(kk);
    }
    return "";
  });
  return out;
}
