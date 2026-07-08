/**
 * Content Builder — generates message bodies from invoice/order data.
 * Separated from providers so the same content can go to any channel.
 */
import type { CommRequest, ResolvedContent, MessageTemplate } from "./types";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useSettings } from "@/lib/settings-store";

// ── WhatsApp text builders ──────────────────────────────────────────────────

function buildDocumentReference(req: CommRequest): {
  text: string;
  attachmentUrls: string[];
} {
  if (typeof window === "undefined") return { text: "", attachmentUrls: [] };
  const route =
    req.linkedType === "order" ? `/orders/print/${req.linkedId}` : `/billing/print/${req.linkedId}`;
  const url = `${window.location.origin}${route}`;
  return { text: `\nDocument: ${url}`, attachmentUrls: [url] };
}

function buildInvoiceWaText(
  req: CommRequest,
  shopName: string,
): { text: string; params: string[]; attachmentUrls: string[] } {
  const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
  if (!inv) return { text: "", params: [], attachmentUrls: [] };
  const total = paiseToRupees(inv.subtotalPaise + inv.gstPaise);
  const docRef = buildDocumentReference(req);
  const text =
    `Namaste ${inv.customerName}!\n` +
    `Your Invoice *${inv.invoiceNo}* is ready.\n` +
    `Total: *₹ ${total}*\n` +
    `Thank you — ${shopName}${docRef.text}`;
  return {
    text,
    params: [inv.customerName, inv.invoiceNo, String(total), shopName],
    attachmentUrls: docRef.attachmentUrls,
  };
}

function buildPaymentReminderWaText(
  req: CommRequest,
  shopName: string,
): { text: string; params: string[]; attachmentUrls: string[] } {
  const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
  if (!inv) return { text: "", params: [], attachmentUrls: [] };
  const balance = paiseToRupees(inv.balancePaise);
  const docRef = buildDocumentReference(req);
  const text =
    `Namaste ${inv.customerName},\n` +
    `Invoice *${inv.invoiceNo}* has ₹ *${balance}* outstanding.\n` +
    `Please clear the balance at your earliest convenience. Thank you — ${shopName}${docRef.text}`;
  return {
    text,
    params: [inv.customerName, inv.invoiceNo, String(balance), shopName],
    attachmentUrls: docRef.attachmentUrls,
  };
}

function buildOrderReadyWaText(
  req: CommRequest,
  shopName: string,
): { text: string; params: string[]; attachmentUrls: string[] } {
  const order = useOrders.getState().orders.find((o) => o.id === req.linkedId);
  if (!order) return { text: "", params: [], attachmentUrls: [] };
  const docRef = buildDocumentReference(req);
  const text =
    `Great news!\n` +
    `Your Order *${order.orderNo}* (${order.item.itemName}) is ready for collection.\n` +
    `Please visit ${shopName} to pick it up.\n` +
    `Thank you!${docRef.text}`;
  return {
    text,
    params: [order.orderNo, order.item.itemName, shopName],
    attachmentUrls: docRef.attachmentUrls,
  };
}

// ── Email HTML builders ─────────────────────────────────────────────────────

function buildInvoiceEmailHtml(invoiceId: string): string {
  const inv = useBilling.getState().invoices.find((i) => i.id === invoiceId);
  const s = useSettings.getState();
  if (!inv) return "<p>Invoice not found.</p>";
  const shopName = s.firm.shopName;
  const itemRows = inv.items
    .map(
      (it) =>
        `<tr><td>${it.itemName}</td><td style="text-align:right">₹${paiseToRupees(it.lineTotalPaise)}</td></tr>`,
    )
    .join("");
  return `
    <p>Namaste <strong>${inv.customerName}</strong>,</p>
    <p>Your invoice <strong>${inv.invoiceNo}</strong> from ${shopName}:</p>
    <table border="0" cellpadding="8" style="width:100%;border-collapse:collapse;border:1px solid #eee">
      <thead><tr style="background:#f5f5f5"><th>Item</th><th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr><td><strong>Grand Total</strong></td><td style="text-align:right"><strong>₹${paiseToRupees(inv.subtotalPaise + inv.gstPaise)}</strong></td></tr>
        ${inv.balancePaise > 0 ? `<tr><td>Outstanding</td><td style="text-align:right;color:red">₹${paiseToRupees(inv.balancePaise)}</td></tr>` : ""}
      </tfoot>
    </table>
    <p>Thank you for your business!</p>
    <p><em>${shopName}</em></p>
  `;
}

// ── Main resolver ───────────────────────────────────────────────────────────

export async function buildContent(req: CommRequest): Promise<ResolvedContent> {
  const s = useSettings.getState();
  const shopName = s.firm.shopName;

  const builders: Partial<Record<MessageTemplate, () => ResolvedContent>> = {
    invoice: () => {
      const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
      const { text, params, attachmentUrls } = buildInvoiceWaText(req, shopName);
      return {
        subject: inv ? `Invoice ${inv.invoiceNo} — ${shopName}` : "Your Invoice",
        textBody: text,
        htmlBody: buildInvoiceEmailHtml(req.linkedId),
        templateParams: params,
        attachmentUrls,
      };
    },
    receipt: () => {
      const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
      const text = inv
        ? `Namaste ${inv.customerName}! ₹${paiseToRupees(inv.paidPaise)} received. Invoice: ${inv.invoiceNo}. Thank you — ${shopName}`
        : "";
      return { subject: "Payment Receipt", textBody: text, templateParams: [] };
    },
    estimate: () => {
      const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
      const text = inv
        ? `Namaste ${inv.customerName}! Your Estimate is ready. Total: ₹${paiseToRupees(inv.subtotalPaise)}. Valid 7 days. — ${shopName}`
        : "";
      return { subject: "Estimate / Quotation", textBody: text, templateParams: [] };
    },
    advance_receipt: () => {
      const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
      const text = inv
        ? `Namaste ${inv.customerName}! Advance payment received. Invoice: ${inv.invoiceNo}. Thank you — ${shopName}`
        : "";
      return { subject: "Advance Receipt", textBody: text, templateParams: [] };
    },
    payment_reminder: () => {
      const { text, params, attachmentUrls } = buildPaymentReminderWaText(req, shopName);
      const inv = useBilling.getState().invoices.find((i) => i.id === req.linkedId);
      return {
        subject: inv ? `Payment Reminder — ${inv.invoiceNo}` : "Payment Reminder",
        textBody: text,
        templateParams: params,
        attachmentUrls,
      };
    },
    order_ready: () => {
      const { text, params, attachmentUrls } = buildOrderReadyWaText(req, shopName);
      return {
        subject: "Your Order is Ready!",
        textBody: text,
        templateParams: params,
        attachmentUrls,
      };
    },
    repair_ready: () => {
      const text = `Your repair job is ready for collection from ${shopName}. Job ID: ${req.linkedId}. Thank you!`;
      return { subject: "Repair Ready for Collection", textBody: text, templateParams: [] };
    },
    job_assignment: () => {
      const job = useJobCards.getState().jobs.find((j) => j.id === req.linkedId);
      const text = job
        ? `Job Card *${job.jobNo}* assigned — ${job.itemName}. Delivery: ${job.expectedDelivery || "TBD"}. — ${shopName}`
        : "";
      return { subject: "Job Card Assigned", textBody: text, templateParams: [] };
    },
    otp: () => {
      return {
        subject: `OTP — ${shopName}`,
        textBody: `Your OTP for ${shopName} ERP login. Please check your email.`,
        templateParams: [],
      };
    },
    promotional: () => {
      return {
        subject: `Message from ${shopName}`,
        textBody: (req.variables?.["message"] as string) || `Greetings from ${shopName}!`,
        templateParams: [],
      };
    },
    manufacturing_bill: () => {
      return {
        subject: "Manufacturing Account Bill",
        textBody: `Manufacturing bill from ${shopName}`,
        templateParams: [],
      };
    },
    order_confirmation: () => {
      const order = useOrders.getState().orders.find((o) => o.id === req.linkedId);
      const text = order
        ? `Namaste! Your Order *${order.orderNo}* (${order.item.itemName}) has been confirmed at ${shopName}. We'll notify you once it's ready.`
        : `Your order has been confirmed at ${shopName}.`;
      return { subject: "Order Confirmed", textBody: text, templateParams: [] };
    },
    order_delivered: () => {
      const order = useOrders.getState().orders.find((o) => o.id === req.linkedId);
      const text = order
        ? `Namaste! Your Order *${order.orderNo}* (${order.item.itemName}) has been delivered. Thank you for choosing ${shopName}!`
        : `Your order has been delivered. Thank you for choosing ${shopName}!`;
      return { subject: "Order Delivered", textBody: text, templateParams: [] };
    },
    gold_settlement_reminder: () => {
      const text = `Reminder: a gold settlement is pending at ${shopName}. Please review and complete it at your earliest convenience.`;
      return { subject: "Gold Settlement Pending", textBody: text, templateParams: [] };
    },
    business_report: () => {
      const reportBody = (req.variables?.["reportBody"] as string) || "";
      const reportTitle = (req.variables?.["reportTitle"] as string) || "Business Report";
      return {
        subject: `${reportTitle} — ${shopName}`,
        textBody: reportBody,
        htmlBody: `<pre style="font-family:inherit">${reportBody}</pre>`,
        templateParams: [],
      };
    },
  };

  const builder = builders[req.template];
  if (builder) return builder();

  return {
    subject: `Message from ${shopName}`,
    textBody: `Message regarding ${req.template} (${req.linkedId})`,
  };
}
