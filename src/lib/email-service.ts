/**
 * MTJ ERP — Email Service Module
 * Handles automated Job Card, Invoice, and Receipt delivery.
 * Automatically integrates with SMTP configurations, Resend, SendGrid, or Supabase mail systems.
 */
import { useSettings } from "@/lib/settings-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useCommLog } from "@/lib/comm-log-store";
import { mgToGrams } from "@/lib/gold";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { toast } from "sonner";

export interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  error?: string;
}

/**
 * Format weight helper for email display.
 */
function fmtWeight(mg: number | undefined | null): string {
  if (!mg) return "—";
  return `${mgToGrams(mg)} g`;
}

/**
 * Generates highly polished brand wrapper.
 */
function wrapBrandHtml(title: string, innerHtml: string): string {
  const settings = useSettings.getState();
  const primaryColor = settings.branding.primaryColor || "#0F172A";
  const goldAccent = settings.branding.goldAccent || "#C8A24B";
  const shopName = settings.firm.shopName;
  const phone = settings.firm.phone || "Not specified";
  const email = settings.firm.email || "";
  const address = settings.firm.address || "Kolkata, West Bengal";
  const tagline = settings.firm.tagline || "Fine Artistry in Pure Gold";
  const website = settings.firm.website || "";
  const logoUrl = settings.firm.logoUrl || "https://img.icons8.com/color/96/jewelry.png";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #F8FAFC;
            color: #1E293B;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #FFFFFF;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
            border: 1px solid #E2E8F0;
          }
          .header {
            background-color: ${primaryColor};
            padding: 30px;
            text-align: center;
            border-bottom: 4px solid ${goldAccent};
          }
          .logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            margin-bottom: 12px;
          }
          .brand-name {
            color: #FFFFFF;
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 4px 0;
            letter-spacing: -0.5px;
          }
          .brand-tagline {
            color: #94A3B8;
            font-size: 12px;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1.5px;
          }
          .content {
            padding: 35px 30px;
          }
          .title-banner {
            text-align: center;
            margin-bottom: 30px;
          }
          .title-banner h2 {
            font-size: 20px;
            font-weight: 700;
            color: ${primaryColor};
            margin: 0 0 8px 0;
          }
          .title-banner .divider {
            height: 3px;
            width: 40px;
            background-color: ${goldAccent};
            margin: 0 auto;
            border-radius: 2px;
          }
          .card {
            border: 1px dashed #CBD5E1;
            border-radius: 12px;
            background-color: #F8FAFC;
            padding: 20px;
            margin-bottom: 25px;
          }
          .card-title {
            font-size: 11px;
            text-transform: uppercase;
            color: #64748B;
            letter-spacing: 1px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .field {
            margin-bottom: 10px;
          }
          .field-label {
            font-size: 11px;
            color: #64748B;
            margin-bottom: 3px;
          }
          .field-value {
            font-size: 14px;
            font-weight: 600;
            color: #0F172A;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .table th {
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            color: #64748B;
            padding: 10px 12px;
            border-bottom: 2px solid #E2E8F0;
          }
          .table td {
            font-size: 13px;
            padding: 12px;
            border-bottom: 1px solid #F1F5F9;
          }
          .table tr.total-row td {
            font-weight: bold;
            border-top: 2px solid #E2E8F0;
            border-bottom: none;
            background-color: #F8FAFC;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0 10px 0;
          }
          .btn {
            display: inline-block;
            background-color: ${primaryColor};
            color: #FFFFFF !important;
            padding: 14px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            border: 1px solid ${goldAccent};
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .footer {
            background-color: #F1F5F9;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #E2E8F0;
          }
          .footer-text {
            font-size: 11px;
            color: #64748B;
            line-height: 1.6;
            margin: 0;
          }
          .footer-divider {
            height: 1px;
            background-color: #E2E8F0;
            margin: 15px 0;
          }
          .socials {
            font-size: 10px;
            color: #94A3B8;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img class="logo" src="${logoUrl}" alt="${shopName}">
            <h1 class="brand-name">${shopName}</h1>
            <p class="brand-tagline">${tagline}</p>
          </div>
          <div class="content">
            ${innerHtml}
          </div>
          <div class="footer">
            <p class="footer-text"><strong>${shopName}</strong></p>
            <p class="footer-text">${address}</p>
            <p class="footer-text">Phone: ${phone}${email ? ` | Email: ${email}` : ""}</p>
            ${website ? `<p class="footer-text"><a href="${website}" style="color:#64748B;">${website}</a></p>` : ""}
            <div class="footer-divider"></div>
            <p class="footer-text" style="font-style: italic;">
              This is an automated delivery communication. All metals and stones are weighed and registered under rigorous ${shopName} security audits.
            </p>
            <p class="socials">Powered by AVS Gold ERP — Arivahly Venture Sphere</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Routes a payload through the unified Nodemailer/Hostinger "send-email" edge
 * function — the single SMTP relay backend used by the entire ERP.
 */
async function dispatchViaSmtpRelay(payload: EmailPayload): Promise<void> {
  const smtp = useSettings.getState().smtp;
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      to: payload.to,
      subject: payload.subject,
      htmlBody: payload.htmlBody,
      textBody: payload.textBody,
      smtp: {
        host: smtp.host || "smtp.hostinger.com",
        port: smtp.port || 465,
        username: smtp.username,
        password: smtp.passKey,
        from_email: smtp.fromEmail || smtp.username,
        from_name: smtp.fromName || "MTJ ERP",
        use_ssl: String(smtp.useSsl),
      },
    },
  });

  if (error) {
    throw new Error(await extractEdgeFunctionError(error, "SMTP relay error."));
  }
  if (data?.error) {
    throw new Error(data.error);
  }
}

/**
 * 1. Dispatcher: sendGenericEmail
 * Routes dispatch based on SMTP Settings in settings-store.
 * Single entry point for every transactional email in the ERP — the only
 * code path that talks to the "send-email" edge function (SMTP/Hostinger)
 * or a direct provider API (Resend/SendGrid).
 */
export async function sendGenericEmail(payload: EmailPayload): Promise<EmailDispatchResult> {
  const settings = useSettings.getState();
  const smtp = settings.smtp;
  const fromEmail = smtp.fromEmail || "";
  const fromName = smtp.fromName;

  try {
    if (smtp.apiProvider === "resend") {
      if (!smtp.apiKey) throw new Error("Resend API key not configured");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${smtp.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [payload.to],
          subject: payload.subject,
          html: payload.htmlBody,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend API error ${res.status}: ${err}`);
      }
    } else if (smtp.apiProvider === "sendgrid") {
      if (!smtp.apiKey) throw new Error("SendGrid API key not configured");
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${smtp.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }], subject: payload.subject }],
          from: { email: fromEmail, name: fromName },
          content: [{ type: "text/html", value: payload.htmlBody }],
        }),
      });
      if (!res.ok && res.status !== 202) {
        const err = await res.text();
        throw new Error(`SendGrid API error ${res.status}: ${err}`);
      }
    } else {
      // "smtp", "mock_api", "supabase", or any unrecognized provider — every
      // one of these dispatches through the single Nodemailer SMTP relay.
      await dispatchViaSmtpRelay(payload);
    }

    settings.addSecurityLog(
      "permission changed",
      `Email sent to ${payload.to}. Subject: "${payload.subject}". Provider: ${smtp.apiProvider}.`,
      payload.to,
    );

    return { success: true };
  } catch (err: any) {
    const message = err?.message || String(err);
    settings.addSecurityLog(
      "failed login",
      `Email dispatch failed to ${payload.to}. Error: ${message}`,
      payload.to,
    );
    return { success: false, error: message };
  }
}

/**
 * 2. Automated Job Card Delivery
 */
export async function sendJobCardEmail(jobId: string, recipientEmail: string): Promise<boolean> {
  const job = useJobCards.getState().jobs.find((j) => j.id === jobId);
  if (!job) {
    toast.error("Job Card not found in store.");
    return false;
  }

  const settings = useSettings.getState();
  const shopName = settings.firm.shopName;
  const subject = `[MTJ Job Card Assigned] ${job.jobNo} — ${job.itemName}`;

  const innerHtml = `
    <div class="title-banner">
      <h2>JOB CARD ASSIGNED</h2>
      <div class="divider"></div>
      <p style="font-size: 14px; color: #64748B; margin-top: 8px;">Job Card: <strong>${job.jobNo}</strong></p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155;">
      Namaste <strong>${job.karigarName || "Karigar"}</strong> ji,<br/>
      You have been assigned a manufacturing job at <strong>${shopName}</strong>. Please find the production job details below:
    </p>

    <div class="card">
      <div class="card-title">Production Job Specifications</div>
      <div class="grid" style="display: table; width: 100%;">
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 12px; width: 50%;">
            <div class="field-label">Order Number</div>
            <div class="field-value">${job.orderNo}</div>
          </div>
          <div style="display: table-cell; padding-bottom: 12px;">
            <div class="field-label">Priority</div>
            <div class="field-value" style="color: ${job.priority === "urgent" ? "#EF4444" : "#F59E0B"};">${job.priority}</div>
          </div>
        </div>
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 12px;">
            <div class="field-label">Item / Category</div>
            <div class="field-value">${job.itemName} (${job.category})</div>
          </div>
          <div style="display: table-cell; padding-bottom: 12px;">
            <div class="field-label">Required Purity</div>
            <div class="field-value">${job.purity} Purity</div>
          </div>
        </div>
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 12px;">
            <div class="field-label">Target Gross Weight</div>
            <div class="field-value">${fmtWeight(job.targetGrossMg)}</div>
          </div>
          <div style="display: table-cell; padding-bottom: 12px;">
            <div class="field-label">Target Fine Gold</div>
            <div class="field-value">${fmtWeight(job.targetFineMg)}</div>
          </div>
        </div>
        <div style="display: table-row;">
          <div style="display: table-cell;">
            <div class="field-label">Assigned At</div>
            <div class="field-value">${new Date(job.createdAt).toLocaleDateString("en-IN")}</div>
          </div>
          <div style="display: table-cell;">
            <div class="field-label">Target Delivery</div>
            <div class="field-value" style="color: #10B981;">${job.expectedDelivery || "—"}</div>
          </div>
        </div>
      </div>
    </div>

    ${
      job.notes
        ? `
      <div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 15px; border-radius: 6px; margin-bottom: 25px; font-size: 13px; color: #78350F;">
        <strong>Design / Workshop Notes:</strong> ${job.notes}
      </div>
    `
        : ""
    }

    <div class="btn-container">
      <span class="btn">Job ID: ${job.id}</span>
    </div>

    <p style="font-size: 13px; color: #64748B; text-align: center; margin-top: 15px;">
      Verify the issued gold fine weight before commencing wire drawing or melting processes.
    </p>
  `;

  const htmlBody = wrapBrandHtml(subject, innerHtml);
  const result = await sendGenericEmail({ to: recipientEmail, subject, htmlBody });

  if (result.success) {
    // Record Comm event
    useCommLog.getState().record({
      kind: "manually_sent",
      templateKind: "job_assignment",
      templateName: "Automated Job Card Assignment",
      target: "karigar",
      recipientLabel: job.karigarName || "Karigar",
      recipientPhone: recipientEmail,
      linkedType: "job",
      linkedId: jobId,
      body: `Assigned Job Card ${job.jobNo} with target fine ${fmtWeight(job.targetFineMg)}. Delivery Date: ${job.expectedDelivery}.`,
    });
    toast.success(`Job Card successfully emailed to ${recipientEmail}`);
  } else {
    toast.error(result.error || "Failed to email Job Card.");
  }
  return result.success;
}

/**
 * 3. Automated Invoice Delivery
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  recipientEmail: string,
): Promise<boolean> {
  const invoice = useBilling.getState().invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    toast.error("Invoice not found in store.");
    return false;
  }

  const settings = useSettings.getState();
  const shopName = settings.firm.shopName;
  const subject = `[TAX INVOICE] ${invoice.invoiceNo} — ${shopName}`;

  let itemsHtml = "";
  invoice.items.forEach((item) => {
    itemsHtml += `
      <tr>
        <td>
          <div style="font-weight: 600;">${item.itemName}</div>
          <div style="font-size: 11px; color: #64748B;">Purity: ${item.purity} · Gross: ${fmtWeight(item.grossMg)}</div>
        </td>
        <td style="text-align: right;">₹ ${paiseToRupees(item.makingChargesPaise + item.stoneChargesPaise)}</td>
        <td style="text-align: right; font-weight: 600;">₹ ${paiseToRupees(item.lineTotalPaise)}</td>
      </tr>
    `;
  });

  const innerHtml = `
    <div class="title-banner">
      <h2>TAX INVOICE / MEMO</h2>
      <div class="divider"></div>
      <p style="font-size: 14px; color: #64748B; margin-top: 8px;">Invoice No: <strong>${invoice.invoiceNo}</strong></p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155;">
      Namaste <strong>${invoice.customerName}</strong> ji,<br/>
      Thank you for shopping at <strong>${shopName}</strong>. Please find your itemized tax invoice below:
    </p>

    <div class="card">
      <div class="card-title">Billing Summary</div>
      <div style="display: table; width: 100%; font-size: 13px;">
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 8px; font-weight: bold; width: 35%;">Customer:</div>
          <div style="display: table-cell; padding-bottom: 8px;">${invoice.customerName}</div>
        </div>
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 8px; font-weight: bold;">Date:</div>
          <div style="display: table-cell; padding-bottom: 8px;">${new Date(invoice.createdAt).toLocaleDateString("en-IN")}</div>
        </div>
        ${
          invoice.customerGstin
            ? `
          <div style="display: table-row;">
            <div style="display: table-cell; padding-bottom: 8px; font-weight: bold;">GSTIN:</div>
            <div style="display: table-cell; padding-bottom: 8px;">${invoice.customerGstin}</div>
          </div>
        `
            : ""
        }
        <div style="display: table-row;">
          <div style="display: table-cell; font-weight: bold;">Payment Status:</div>
          <div style="display: table-cell;"><span style="background-color: ${invoice.status === "paid" ? "#D1FAE5" : "#FEE2E2"}; color: ${invoice.status === "paid" ? "#065F46" : "#991B1B"}; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600;">${invoice.status.toUpperCase()}</span></div>
        </div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Item Details</th>
          <th style="text-align: right;">Charges</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="total-row">
          <td>Subtotal (Pre-GST)</td>
          <td></td>
          <td style="text-align: right;">₹ ${paiseToRupees(invoice.subtotalPaise)}</td>
        </tr>
        ${
          invoice.gst !== "none"
            ? `
          <tr>
            <td style="color: #64748B;">CGST (1.5%) / SGST (1.5%)</td>
            <td></td>
            <td style="text-align: right; color: #64748B;">₹ ${paiseToRupees(invoice.gstPaise)}</td>
          </tr>
        `
            : ""
        }
        ${
          invoice.adjustmentPaise > 0
            ? `
          <tr>
            <td style="color: #10B981; font-weight: 600;">Advance Adjusted (-)</td>
            <td></td>
            <td style="text-align: right; color: #10B981; font-weight: 600;">₹ ${paiseToRupees(invoice.adjustmentPaise)}</td>
          </tr>
        `
            : ""
        }
        <tr style="font-size: 16px; font-weight: bold; background-color: #F8FAFC;">
          <td style="padding: 15px 12px; border-top: 2px solid #E2E8F0;">Grand Total</td>
          <td style="border-top: 2px solid #E2E8F0;"></td>
          <td style="text-align: right; padding: 15px 12px; border-top: 2px solid #E2E8F0; color: #0F172A;">₹ ${paiseToRupees(invoice.grandTotalPaise)}</td>
        </tr>
        <tr>
          <td style="color: #10B981; font-weight: 600;">Paid Amount</td>
          <td></td>
          <td style="text-align: right; color: #10B981; font-weight: 600;">₹ ${paiseToRupees(invoice.paidPaise)}</td>
        </tr>
        <tr style="border-bottom: none;">
          <td style="font-weight: bold; color: ${invoice.balancePaise > 0 ? "#EF4444" : "#10B981"};">Outstanding Balance</td>
          <td></td>
          <td style="text-align: right; font-weight: bold; color: ${invoice.balancePaise > 0 ? "#EF4444" : "#10B981"};">₹ ${paiseToRupees(invoice.balancePaise)}</td>
        </tr>
      </tbody>
    </table>

    <div class="btn-container">
      <span class="btn">Invoice Ref: ${invoice.invoiceNo || invoice.id}</span>
    </div>

    <div style="font-size: 11px; color: #64748B; background: #F8FAFC; padding: 15px; border-radius: 8px; margin-top: 25px;">
      <strong>Terms & Conditions:</strong><br/>
      ${settings.firm.terms || "Goods once sold cannot be returned. Gold purity as per hallmarking specifications."}
    </div>
  `;

  const htmlBody = wrapBrandHtml(subject, innerHtml);
  const result = await sendGenericEmail({ to: recipientEmail, subject, htmlBody });

  if (result.success) {
    // Record Comm event
    useCommLog.getState().record({
      kind: "manually_sent",
      templateKind: "payment_reminder",
      templateName: "Automated Invoice Delivery",
      target: "customer",
      recipientLabel: invoice.customerName,
      recipientPhone: recipientEmail,
      linkedType: "invoice",
      linkedId: invoiceId,
      body: `Delivered Invoice ${invoice.invoiceNo} with grand total ₹ ${paiseToRupees(invoice.grandTotalPaise)}. Outstanding: ₹ ${paiseToRupees(invoice.balancePaise)}.`,
    });
    toast.success(`Invoice successfully emailed to ${recipientEmail}`);
  } else {
    toast.error(result.error || "Failed to email Invoice.");
  }
  return result.success;
}

/**
 * 4. Automated Receipt Delivery
 */
export async function sendReceiptEmail(
  invoiceId: string,
  paymentId: string,
  recipientEmail: string,
): Promise<boolean> {
  const invoice = useBilling.getState().invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    toast.error("Invoice not found in store.");
    return false;
  }

  const payment = invoice.payments.find((p) => p.id === paymentId);
  if (!payment) {
    toast.error("Payment transaction record not found.");
    return false;
  }

  const settings = useSettings.getState();
  const shopName = settings.firm.shopName;
  const subject = `[RECEIPT] Payment Acknowledgment for Invoice ${invoice.invoiceNo}`;

  const innerHtml = `
    <div class="title-banner">
      <h2 style="color: #10B981;">PAYMENT RECEIVED</h2>
      <div class="divider" style="background-color: #10B981;"></div>
      <p style="font-size: 14px; color: #64748B; margin-top: 8px;">Receipt Voucher: <strong>REC-${payment.id.toUpperCase().slice(-6)}</strong></p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155;">
      Namaste <strong>${invoice.customerName}</strong> ji,<br/>
      We have successfully received and registered your payment. An updated account statement is available below:
    </p>

    <div class="card" style="border: 1px solid #10B981; background-color: #ECFDF5; padding: 25px;">
      <div class="card-title" style="color: #047857; font-weight: bold; font-size: 12px;">Transaction Details</div>
      
      <div style="font-size: 24px; font-weight: bold; color: #047857; margin-bottom: 15px;">
        ₹ ${paiseToRupees(payment.amountPaise)}
      </div>

      <div style="display: table; width: 100%; font-size: 13px;">
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 8px; font-weight: bold; width: 40%; color: #047857;">Payment Mode:</div>
          <div style="display: table-cell; padding-bottom: 8px; font-weight: 600; color: #0F172A;">${payment.mode.toUpperCase()}</div>
        </div>
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 8px; font-weight: bold; color: #047857;">Transaction Date:</div>
          <div style="display: table-cell; padding-bottom: 8px; color: #0F172A;">${new Date(payment.ts).toLocaleString("en-IN")}</div>
        </div>
        ${
          payment.reference
            ? `
          <div style="display: table-row;">
            <div style="display: table-cell; padding-bottom: 8px; font-weight: bold; color: #047857;">Reference / UPI ID:</div>
            <div style="display: table-cell; padding-bottom: 8px; font-family: monospace; color: #0F172A;">${payment.reference}</div>
          </div>
        `
            : ""
        }
        <div style="display: table-row;">
          <div style="display: table-cell; font-weight: bold; color: #047857;">Invoice Ref:</div>
          <div style="display: table-cell; font-weight: 600; color: #0F172A;">${invoice.invoiceNo}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Updated Balance Statement</div>
      <div style="display: table; width: 100%; font-size: 13px;">
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 8px; color: #64748B;">Invoice Grand Total:</div>
          <div style="display: table-cell; padding-bottom: 8px; text-align: right;">₹ ${paiseToRupees(invoice.grandTotalPaise)}</div>
        </div>
        <div style="display: table-row;">
          <div style="display: table-cell; padding-bottom: 8px; color: #64748B;">Total Cumulative Payments:</div>
          <div style="display: table-cell; padding-bottom: 8px; text-align: right; color: #10B981; font-weight: bold;">₹ ${paiseToRupees(invoice.paidPaise)}</div>
        </div>
        <div style="display: table-row; font-size: 15px; font-weight: bold;">
          <div style="display: table-cell; border-top: 1px solid #E2E8F0; padding-top: 10px; color: #0F172A;">Remaining Due:</div>
          <div style="display: table-cell; border-top: 1px solid #E2E8F0; padding-top: 10px; text-align: right; color: ${invoice.balancePaise > 0 ? "#EF4444" : "#10B981"};">₹ ${paiseToRupees(invoice.balancePaise)}</div>
        </div>
      </div>
    </div>

    <div class="btn-container">
      <span class="btn" style="background-color: #10B981; border-color: #059669;">Invoice Ref: ${invoice.invoiceNo || invoice.id}</span>
    </div>

    <p style="font-size: 14px; text-align: center; color: #475569; font-weight: 600; margin-top: 20px;">
      Thank you for your valuable business with ${shopName}!
    </p>
  `;

  const htmlBody = wrapBrandHtml(subject, innerHtml);
  const result = await sendGenericEmail({ to: recipientEmail, subject, htmlBody });

  if (result.success) {
    // Record Comm event
    useCommLog.getState().record({
      kind: "manually_sent",
      templateKind: "payment_reminder",
      templateName: "Automated Receipt Delivery",
      target: "customer",
      recipientLabel: invoice.customerName,
      recipientPhone: recipientEmail,
      linkedType: "invoice",
      linkedId: invoiceId,
      body: `Acknowledged Payment of ₹ ${paiseToRupees(payment.amountPaise)} via ${payment.mode} against Invoice ${invoice.invoiceNo}.`,
    });
    toast.success(`Payment receipt successfully emailed to ${recipientEmail}`);
  } else {
    toast.error(result.error || "Failed to email Payment Receipt.");
  }
  return result.success;
}
