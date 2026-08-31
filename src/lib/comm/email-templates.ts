/**
 * AVS Central Email Template Engine — 20+ professional templates.
 * Brand-aware, sanitized HTML, safe variable substitution.
 */

export type EmailTemplateType =
  | "welcome_product"
  | "trial_welcome"
  | "trial_expiring"
  | "trial_expired"
  | "plan_upgraded"
  | "internal_user_invitation"
  | "portal_invitation"
  | "customer_portal_invitation"
  | "karigar_portal_invitation"
  | "supplier_portal_invitation"
  | "password_reset"
  | "otp_login"
  | "invoice_ready"
  | "payment_receipt"
  | "payment_reminder"
  | "order_confirmation"
  | "order_ready"
  | "document_ready"
  | "support_update"
  | "security_alert"
  | "amc_renewal_reminder"
  | "low_credits"
  | "credits_purchased"
  | "daily_management_report"
  | "weekly_business_summary"
  | "monthly_statement"
  | "order_delayed"
  | "order_delivered"
  | "credit_note"
  | "document_cancelled"
  | "financial_report"
  | "settlement_receipt";

export interface EmailTemplateVariables {
  firmName?: string;
  productName?: string;
  recipientName: string;
  recipientEmail: string;
  roleOrPortal?: string;
  actionUrl?: string;
  supportUrl?: string;
  otpCode?: string;
  documentType?: string;
  documentNumber?: string;
  amountFormatted?: string;
  dueDate?: string;
  ticketNumber?: string;
  ticketSubject?: string;
  ticketStatus?: string;
  alertDetails?: string;
  logoUrl?: string;
  reportPeriod?: string;
  creditsBalance?: string;
  trialStartsAt?: string;
  trialEndsAt?: string;
  planName?: string;
  inviteCode?: string;
  branchName?: string;
  expiryHours?: string;
  expiryDays?: string;
  reasonText?: string;
  revisedDate?: string;
  parentInvoiceNo?: string;
  auditReference?: string;
  goldEquivalent?: string;
  reportTitle?: string;
}

const ACTION_BLUE = "#0066cc";
const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const HAIRLINE = "#e0e0e0";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function interpolate(template: string, vars: EmailTemplateVariables): string {
  const map: Record<string, string> = {
    customer_name: vars.recipientName,
    recipient_name: vars.recipientName,
    tenant_name: vars.firmName ?? "",
    firm_name: vars.firmName ?? "",
    product_name: vars.productName ?? "AVS ERP",
    invoice_number: vars.documentNumber ?? "",
    document_number: vars.documentNumber ?? "",
    document_type: vars.documentType ?? "",
    amount: vars.amountFormatted ?? "",
    due_date: vars.dueDate ?? "",
    document_url: vars.actionUrl ?? "",
    action_url: vars.actionUrl ?? "",
    support_url: vars.supportUrl ?? "",
    otp_code: vars.otpCode ?? "",
    role: vars.roleOrPortal ?? "",
    portal: vars.roleOrPortal ?? "",
    invite_code: vars.inviteCode ?? "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => escapeHtml(map[key] ?? ""));
}

function brandedShell(opts: {
  firm: string;
  product: string;
  body: string;
  logoUrl?: string;
}): string {
  // Absolute PNG fallback so system templates never ship without a logo.
  const logoSrc =
    opts.logoUrl && opts.logoUrl.trim()
      ? opts.logoUrl.trim()
      : "https://maatarajewellers.shop/assets/ornexa-logo-full.png";
  return `
<div style="max-width:600px;margin:0 auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border:1px solid ${HAIRLINE};background:#ffffff;border-radius:12px;overflow:hidden;">
  <div style="padding:24px 28px;border-bottom:4px solid #C8A24B;background:#0F172A;text-align:center;">
    <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(opts.firm)}" width="180" style="display:block;margin:0 auto 10px;max-height:56px;max-width:180px;object-fit:contain;border:0;" />
    <div style="font-size:17px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(opts.firm)}</div>
    <div style="font-size:12px;color:#94A3B8;margin-top:2px;">${escapeHtml(opts.product)}</div>
  </div>
  <div style="padding:28px;color:${INK};font-size:15px;line-height:1.5;">${opts.body}</div>
  <div style="padding:16px 28px;border-top:1px solid ${HAIRLINE};background:#fafafc;font-size:11px;color:${MUTED};">
  Automated message from ${escapeHtml(opts.firm)}. For support, contact sales@arivahly.in.
  </div>
</div>`;
}

function ctaButton(label: string, url?: string): string {
  const href = url?.trim();
  if (!href) return "";
  const safeHref = href.replace(/"/g, "%22");
  return `<div style="margin:24px 0;text-align:center;"><a href="${safeHref}" style="background:${ACTION_BLUE};color:#fff;text-decoration:none;padding:11px 22px;border-radius:9999px;font-size:15px;font-weight:500;display:inline-block;">${escapeHtml(label)}</a></div>`;
}

const INVITE_ANCHOR_RE = /<a\s[^>]*href=["'][^"']*invite\/accept/i;

function portalInviteDetailsBlock(vars: EmailTemplateVariables): string {
  const code = vars.inviteCode?.trim();
  const url = vars.actionUrl?.trim();
  if (!code && !url) return "";
  const safeUrl = url ? url.replace(/"/g, "%22") : "";
  return (
    `<div style="margin:20px 0;padding:16px;border:1px solid ${HAIRLINE};border-radius:8px;background:#f5f5f7;">` +
    (code
      ? `<p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Your invitation code:</p>` +
        `<p style="margin:0 0 12px;font-family:ui-monospace,monospace;font-size:18px;font-weight:600;letter-spacing:0.05em;">${escapeHtml(code)}</p>`
      : "") +
    (url
      ? `<p style="margin:0 0 4px;font-size:13px;color:${MUTED};">Invitation link:</p>` +
        `<p style="margin:0;font-size:13px;word-break:break-all;"><a href="${safeUrl}" style="color:${ACTION_BLUE};">${escapeHtml(url)}</a></p>`
      : "") +
    `<p style="margin:12px 0 0;font-size:12px;color:${MUTED};">Valid for 24 hours.</p></div>`
  );
}

/** Client-side safety net: ensure portal invite emails include link + code. */
export function ensurePortalInviteEmailContent(
  html: string,
  text: string,
  actionUrl: string,
  inviteCode?: string,
): { html: string; text: string } {
  const url = actionUrl.trim();
  const code = inviteCode?.trim() ?? "";
  if (!url && !code) return { html, text };

  let outHtml = html;
  const needsAnchor = url && !INVITE_ANCHOR_RE.test(html);
  const needsCodeBlock = code && !html.includes(code);
  if (needsAnchor || needsCodeBlock) {
    const safeUrl = url.replace(/"/g, "%22");
    const cta = needsAnchor
      ? `<div style="margin:24px 0;text-align:center;"><a href="${safeUrl}" ` +
        `style="background:${ACTION_BLUE};color:#fff;text-decoration:none;padding:11px 22px;border-radius:9999px;` +
        `font-size:15px;font-weight:500;display:inline-block;">Accept Invitation &amp; Create Account</a></div>`
      : "";
    const codeBlock = code
      ? `<div style="margin:16px 0;padding:14px;border:1px solid ${HAIRLINE};border-radius:8px;background:#f5f5f7;text-align:center;">` +
        `<p style="margin:0 0 6px;font-size:12px;color:${MUTED};">Invitation code</p>` +
        `<p style="margin:0;font-family:ui-monospace,monospace;font-size:17px;font-weight:600;">${escapeHtml(code)}</p></div>`
      : "";
    const linkLine = url
      ? `<p style="font-size:12px;color:${MUTED};text-align:center;word-break:break-all;">Or open: ${escapeHtml(url)}</p>`
      : "";
    const injected = `${cta}${codeBlock}${linkLine}<p style="font-size:12px;color:${MUTED};text-align:center;">Valid for 24 hours.</p>`;
    const marker = `<div style="padding:28px;color:${INK};font-size:15px;line-height:1.5;">`;
    outHtml = html.includes(marker) ? html.replace(marker, `${marker}${injected}`) : `${html}${injected}`;
  }

  let outText = text;
  const textParts: string[] = [];
  if (code && !text.includes(code)) textParts.push(`Invitation code: ${code}`);
  if (url && !/invite\/accept/i.test(text)) textParts.push(`Accept invitation: ${url}`);
  if (textParts.length > 0) {
    outText = `${text.trim()}\n\n${textParts.join("\n")}\n\nValid for 24 hours.`;
  }

  return { html: outHtml, text: outText };
}

function simpleTemplate(
  subject: string,
  bodyHtml: string,
  text: string,
  vars: EmailTemplateVariables,
): { subject: string; html: string; text: string } {
  const firm = vars.firmName || "AVS ERP";
  const product = vars.productName || "AVS ERP by Arivahly Venture Sphere";
  return {
    subject: interpolate(subject, vars),
    html: brandedShell({ firm, product, body: interpolate(bodyHtml, vars), logoUrl: vars.logoUrl }),
    text: interpolate(text, vars),
  };
}

export function renderEmailTemplate(
  templateType: EmailTemplateType,
  vars: EmailTemplateVariables,
): { subject: string; html: string; text: string } {
  switch (templateType) {
    case "welcome_product":
      return simpleTemplate(
        "Welcome to {{product_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your account for <strong>{{tenant_name}}</strong> on {{product_name}} is ready.</p>${ctaButton("Open Dashboard", vars.actionUrl)}`,
        "Welcome to {{product_name}}. Open: {{action_url}}",
        vars,
      );
    case "trial_welcome":
      return simpleTemplate(
        "Your 14-day AVS ERP trial is ready",
        `<p>Hello {{recipient_name}},</p><p>Welcome to AVS ERP by Arivahly Venture Sphere. Your 14-day trial for <strong>{{tenant_name}}</strong> is active.${vars.trialStartsAt ? ` Trial starts <strong>${escapeHtml(vars.trialStartsAt)}</strong>.` : ""}${vars.trialEndsAt ? ` Trial ends <strong>${escapeHtml(vars.trialEndsAt)}</strong>.` : ""} Gold Vault, karigar books, billing, and onboarding are ready in your workshop firm.</p>${ctaButton("Open AVS ERP", vars.actionUrl)}<p style="font-size:12px;color:${MUTED};">This is your firm only — not another jeweller&apos;s data. Questions: sales@arivahly.in</p>`,
        "Your 14-day AVS ERP trial for {{tenant_name}} is ready. Open: {{action_url}}",
        vars,
      );
    case "trial_expiring":
      return simpleTemplate(
        "Your AVS ERP trial ends soon",
        `<p>Hello {{recipient_name}},</p><p>the AVS ERP trial for <strong>{{tenant_name}}</strong> ends soon${vars.trialEndsAt ? ` on <strong>${escapeHtml(vars.trialEndsAt)}</strong>` : ""}. Your gold, parties, and documents stay in the firm. Contact sales to continue on a manufacturing edition.</p>${ctaButton("Contact sales", vars.actionUrl || "https://maatarajewellers.shop/contact?intent=sales")}`,
        "AVS ERP trial for {{tenant_name}} is ending. Contact sales: {{action_url}}",
        vars,
      );
    case "trial_expired":
      return simpleTemplate(
        "Your AVS ERP trial has ended",
        `<p>Hello {{recipient_name}},</p><p>The 14-day AVS ERP trial for <strong>{{tenant_name}}</strong> has ended${vars.trialEndsAt ? ` (${escapeHtml(vars.trialEndsAt)})` : ""}. Records are retained. Write to sales@arivahly.in to renew or upgrade.</p>${ctaButton("Talk to sales", vars.actionUrl || "https://maatarajewellers.shop/contact?intent=sales")}`,
        "AVS ERP trial ended for {{tenant_name}}. Contact sales@arivahly.in",
        vars,
      );
    case "plan_upgraded":
      return simpleTemplate(
        "Plan upgraded — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your AVS ERP subscription for <strong>{{tenant_name}}</strong> has been upgraded${vars.planName ? ` to <strong>${escapeHtml(vars.planName)}</strong>` : ""}${vars.amountFormatted ? `. Amount: <strong>${escapeHtml(vars.amountFormatted)}</strong>` : ""}.</p><p>Full manufacturing entitlements are now active.</p>${ctaButton("Open AVS ERP", vars.actionUrl)}`,
        "Plan upgraded for {{tenant_name}}. Open: {{action_url}}",
        vars,
      );
    case "internal_user_invitation":
      return simpleTemplate(
        "Invitation to join {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>You have been invited as <strong>{{role}}</strong>${vars.branchName ? ` at branch <strong>${escapeHtml(vars.branchName)}</strong>` : ""}.</p>${portalInviteDetailsBlock({ ...vars, inviteCode: vars.inviteCode })}${ctaButton("Accept Invitation", vars.actionUrl)}<p style="font-size:12px;color:${MUTED};">Link expires in 7 days.</p>`,
        "Invitation to {{tenant_name}} as {{role}}. Code: {{invite_code}}\nLink: {{action_url}}\nValid for 7 days.",
        vars,
      );
    case "portal_invitation":
    case "customer_portal_invitation":
      return simpleTemplate(
        "Invitation — Customer Portal · {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p><strong>{{tenant_name}}</strong> has invited you to the Customer Portal on AVS ERP. Accept below to create your secure login, then view orders, invoices, and documents for this firm only.</p>${portalInviteDetailsBlock(vars)}${ctaButton("Accept Invitation & Create Account", vars.actionUrl)}`,
        "{{tenant_name}} invited you to the Customer Portal.\nCode: {{invite_code}}\nLink: {{action_url}}\nValid for 24 hours.",
        vars,
      );
    case "karigar_portal_invitation":
      return simpleTemplate(
        "Invitation — Karigar Portal · {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p><strong>{{tenant_name}}</strong> has invited you to the Karigar Portal on AVS ERP. Accept below to create your secure login, then view job assignments, gold book entries, and returns.</p>${portalInviteDetailsBlock(vars)}${ctaButton("Accept Invitation & Create Account", vars.actionUrl)}`,
        "{{tenant_name}} invited you to the Karigar Portal.\nCode: {{invite_code}}\nLink: {{action_url}}\nValid for 24 hours.",
        vars,
      );
    case "supplier_portal_invitation":
      return simpleTemplate(
        "Invitation — Supplier Portal · {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p><strong>{{tenant_name}}</strong> has invited you to the Supplier Portal on AVS ERP. Accept below to create your secure login, then view purchase orders and supply documents.</p>${portalInviteDetailsBlock(vars)}${ctaButton("Accept Invitation & Create Account", vars.actionUrl)}`,
        "{{tenant_name}} invited you to the Supplier Portal.\nCode: {{invite_code}}\nLink: {{action_url}}\nValid for 24 hours.",
        vars,
      );
    case "password_reset":
      return simpleTemplate(
        "Password reset — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>We received a password reset request.</p>${vars.otpCode ? `<p style="text-align:center;font-size:24px;letter-spacing:4px;font-weight:600;">${escapeHtml(vars.otpCode)}</p>` : ""}${ctaButton("Reset Password", vars.actionUrl)}<p style="font-size:12px;color:${MUTED};">If you did not request this, ignore this email.</p>`,
        "Password reset: {{action_url}} OTP: {{otp_code}}",
        vars,
      );
    case "otp_login":
      return simpleTemplate(
        "Your login code — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your one-time login code:</p><p style="text-align:center;font-size:28px;letter-spacing:6px;font-weight:600;">${escapeHtml(vars.otpCode ?? "------")}</p><p style="font-size:12px;color:${MUTED};">Expires in 10 minutes. Do not share this code.</p>`,
        "Login code: {{otp_code}}",
        vars,
      );
    case "invoice_ready":
      return simpleTemplate(
        "Invoice {{invoice_number}} from {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> for <strong>{{amount}}</strong> is ready.</p>${ctaButton("View Invoice", vars.actionUrl)}`,
        "Invoice {{invoice_number}}: {{document_url}}",
        vars,
      );
    case "payment_receipt":
      return simpleTemplate(
        "Payment receipt — {{invoice_number}}",
        `<p>Dear {{recipient_name}},</p><p>We received your payment of <strong>{{amount}}</strong> for {{document_type}} {{invoice_number}}.</p>${ctaButton("View Receipt", vars.actionUrl)}`,
        "Payment receipt {{invoice_number}}: {{document_url}}",
        vars,
      );
    case "payment_reminder":
      return simpleTemplate(
        "Payment reminder — {{invoice_number}}",
        `<p>Dear {{recipient_name}},</p><p>Outstanding amount <strong>{{amount}}</strong> is due${vars.dueDate ? ` by <strong>${escapeHtml(vars.dueDate)}</strong>` : ""}.</p>${ctaButton("View Statement", vars.actionUrl)}`,
        "Payment due {{amount}} for {{invoice_number}}",
        vars,
      );
    case "order_confirmation":
      return simpleTemplate(
        "Order confirmed — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Your order has been confirmed. We will notify you when it is ready.</p>${ctaButton("Track Order", vars.actionUrl)}`,
        "Order confirmed. Track: {{action_url}}",
        vars,
      );
    case "order_ready":
      return simpleTemplate(
        "Your order is ready — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Your order is ready for collection or dispatch.</p>${ctaButton("View Details", vars.actionUrl)}`,
        "Order ready: {{action_url}}",
        vars,
      );
    case "document_ready":
      return simpleTemplate(
        "{{document_type}} {{document_number}} from {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Your {{document_type}} <strong>{{document_number}}</strong> is ready.</p>${ctaButton("View Document", vars.actionUrl)}`,
        "{{document_type}} {{document_number}}: {{document_url}}",
        vars,
      );
    case "support_update":
      return simpleTemplate(
        "Support ticket {{ticket_number}} updated",
        `<p>Hello {{recipient_name}},</p><p>Ticket <strong>${escapeHtml(vars.ticketNumber ?? "")}</strong>: ${escapeHtml(vars.ticketSubject ?? "")}</p><p>Status: <strong>${escapeHtml(vars.ticketStatus ?? "")}</strong></p>${ctaButton("View Ticket", vars.actionUrl)}`,
        "Ticket {{ticket_number}} status: {{ticket_status}}",
        vars,
      );
    case "security_alert":
      return simpleTemplate(
        "Security alert — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>${escapeHtml(vars.alertDetails ?? "A security event was detected on your account.")}</p>${ctaButton("Review Security", vars.actionUrl)}`,
        "Security alert: {{alert_details}}",
        vars,
      );
    case "amc_renewal_reminder":
      return simpleTemplate(
        "AMC renewal reminder — {{product_name}}",
        `<p>Dear {{recipient_name}},</p><p>Your AMC for {{product_name}} is due for renewal${vars.dueDate ? ` on <strong>${escapeHtml(vars.dueDate)}</strong>` : ""}.</p>${ctaButton("Renew Now", vars.actionUrl)}`,
        "AMC renewal due. Renew: {{action_url}}",
        vars,
      );
    case "low_credits":
      return simpleTemplate(
        "Low credits alert — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your credit balance is low${vars.creditsBalance ? ` (<strong>${escapeHtml(vars.creditsBalance)}</strong> remaining)` : ""}. Top up to avoid service interruption.</p>${ctaButton("Buy Credits", vars.actionUrl)}`,
        "Low credits. Top up: {{action_url}}",
        vars,
      );
    case "credits_purchased":
      return simpleTemplate(
        "Credits purchased — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your credit purchase was successful${vars.amountFormatted ? ` for <strong>${escapeHtml(vars.amountFormatted)}</strong>` : ""}.</p>${ctaButton("View Wallet", vars.actionUrl)}`,
        "Credits purchased successfully.",
        vars,
      );
    case "daily_management_report":
      return simpleTemplate(
        "Daily report — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your daily management report${vars.reportPeriod ? ` for <strong>${escapeHtml(vars.reportPeriod)}</strong>` : ""} is attached or available below.</p>${ctaButton("Open Report", vars.actionUrl)}`,
        "Daily report: {{action_url}}",
        vars,
      );
    case "weekly_business_summary":
      return simpleTemplate(
        "Weekly summary — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your weekly business summary is ready.</p>${ctaButton("Open Report", vars.actionUrl)}`,
        "Weekly summary: {{action_url}}",
        vars,
      );
    case "monthly_statement":
      return simpleTemplate(
        "Monthly statement — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Your monthly statement/report is ready.</p>${ctaButton("Open Report", vars.actionUrl)}`,
        "Monthly statement: {{action_url}}",
        vars,
      );
    case "order_delayed":
      return simpleTemplate(
        "Important Update: Order {{document_number}} Delayed — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>We sincerely apologize, but your order <strong>{{document_number}}</strong> has experienced a short delay${vars.reasonText ? ` due to <em>${escapeHtml(vars.reasonText)}</em>` : ""}.${vars.revisedDate ? `<br/>The revised estimated completion date is <strong>${escapeHtml(vars.revisedDate)}</strong>.` : ""}</p><p>Your updated order slip is attached for your reference.</p>${ctaButton("Track Order Status", vars.actionUrl)}`,
        "Order {{document_number}} is delayed. Revised date: " + (vars.revisedDate || "Upcoming") + ". Track: {{action_url}}",
        vars,
      );
    case "order_delivered":
      return simpleTemplate(
        "Order {{document_number}} Delivered — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>We are delighted to confirm that your order <strong>{{document_number}}</strong> has been successfully completed and delivered.</p><p>Thank you for choosing <strong>{{tenant_name}}</strong>. Your official delivery document is attached.</p>${ctaButton("View Order Details", vars.actionUrl)}`,
        "Order {{document_number}} delivered. View: {{action_url}}",
        vars,
      );
    case "credit_note":
      return simpleTemplate(
        "Credit Note {{document_number}} Issued — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Credit Note <strong>{{document_number}}</strong> has been issued${vars.parentInvoiceNo ? ` against invoice <strong>${escapeHtml(vars.parentInvoiceNo)}</strong>` : ""}${vars.amountFormatted ? ` for <strong>${escapeHtml(vars.amountFormatted)}</strong>` : ""}${vars.goldEquivalent ? ` (${escapeHtml(vars.goldEquivalent)})` : ""}.${vars.reasonText ? `<br/>Reason: ${escapeHtml(vars.reasonText)}` : ""}</p><p>The full Credit Note document is attached.</p>${ctaButton("View Credit Note", vars.actionUrl)}`,
        "Credit Note {{document_number}} issued. View: {{action_url}}",
        vars,
      );
    case "document_cancelled":
      return simpleTemplate(
        "Correction Notice: Document {{document_number}} Cancelled — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Please note that document <strong>{{document_number}}</strong> was created in error and has been officially <strong>cancelled/voided</strong> in our system.</p><p style="color:#b91c1c;font-weight:600;">Please do not consider the previous document valid.</p>${vars.auditReference ? `<p style="font-size:12px;color:${MUTED};">Audit Reference ID: <code>${escapeHtml(vars.auditReference)}</code></p>` : ""}`,
        "Notice: Document {{document_number}} has been cancelled/voided. Audit Ref: " + (vars.auditReference || "—"),
        vars,
      );
    case "financial_report":
      return simpleTemplate(
        (vars.reportTitle || "Financial Report") + " ({{report_period}}) — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>Please find attached the requested <strong>${escapeHtml(vars.reportTitle || "Financial Statement")}</strong>${vars.reportPeriod ? ` for the period <strong>${escapeHtml(vars.reportPeriod)}</strong>` : ""}.</p><p>A copy of the complete high-fidelity PDF report is attached to this email.</p>`,
        "Financial Report: " + (vars.reportTitle || "Statement") + " for " + (vars.reportPeriod || "selected period"),
        vars,
      );
    case "settlement_receipt":
      return simpleTemplate(
        "Gold Settlement {{document_number}} — {{tenant_name}}",
        `<p>Dear {{recipient_name}},</p><p>Gold settlement <strong>{{document_number}}</strong>${vars.goldEquivalent ? ` for <strong>${escapeHtml(vars.goldEquivalent)}</strong>` : ""}${vars.amountFormatted ? ` (Cash Equiv: ${escapeHtml(vars.amountFormatted)})` : ""} has been confirmed and settled.</p><p>Your complete settlement document is attached.</p>${ctaButton("View Settlement", vars.actionUrl)}`,
        "Settlement {{document_number}} completed. View: {{action_url}}",
        vars,
      );
    default:
      return simpleTemplate(
        "Notification from {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>${escapeHtml(vars.alertDetails ?? "You have a new notification.")}</p>`,
        "Notification from {{tenant_name}}",
        vars,
      );
  }
}

export const PLATFORM_EMAIL_TEMPLATE_CATALOG: Array<{
  key: EmailTemplateType;
  name: string;
  category: string;
}> = [
  { key: "welcome_product", name: "Welcome to Product", category: "onboarding" },
  { key: "trial_welcome", name: "Trial welcome", category: "onboarding" },
  { key: "trial_expiring", name: "Trial expiring", category: "onboarding" },
  { key: "trial_expired", name: "Trial expired", category: "onboarding" },
  { key: "plan_upgraded", name: "Plan upgraded", category: "billing" },
  { key: "amc_renewal_reminder", name: "AMC Renewal Reminder", category: "billing" },
  { key: "low_credits", name: "Low Credits Alert", category: "billing" },
  { key: "credits_purchased", name: "Credits Purchased", category: "billing" },
];

export const FIRM_EMAIL_TEMPLATE_CATALOG: Array<{
  key: EmailTemplateType;
  name: string;
  category: string;
}> = [
  { key: "internal_user_invitation", name: "Internal User Invitation", category: "auth" },
  { key: "portal_invitation", name: "Portal Invitation", category: "auth" },
  { key: "customer_portal_invitation", name: "Customer Portal Invitation", category: "auth" },
  { key: "karigar_portal_invitation", name: "Karigar Portal Invitation", category: "auth" },
  { key: "supplier_portal_invitation", name: "Supplier Portal Invitation", category: "auth" },
  { key: "password_reset", name: "Password Reset", category: "auth" },
  { key: "otp_login", name: "Login OTP Code", category: "auth" },
  { key: "invoice_ready", name: "Invoice Ready", category: "documents" },
  { key: "payment_receipt", name: "Payment Receipt", category: "documents" },
  { key: "payment_reminder", name: "Outstanding Reminder", category: "documents" },
  { key: "order_confirmation", name: "Order Confirmation", category: "orders" },
  { key: "order_ready", name: "Order Ready", category: "orders" },
  { key: "document_ready", name: "Document Ready", category: "documents" },
  { key: "support_update", name: "Support Ticket Update", category: "support" },
  { key: "security_alert", name: "Security Alert", category: "support" },
  { key: "daily_management_report", name: "Daily Management Report", category: "reports" },
  { key: "weekly_business_summary", name: "Weekly Business Summary", category: "reports" },
  { key: "monthly_statement", name: "Monthly Statement", category: "reports" },
];

/** Full catalog — platform + firm (used for DB seed). */
export const EMAIL_TEMPLATE_CATALOG = [
  ...PLATFORM_EMAIL_TEMPLATE_CATALOG,
  ...FIRM_EMAIL_TEMPLATE_CATALOG,
];

export const PLATFORM_EMAIL_TEMPLATE_KEYS = new Set(
  PLATFORM_EMAIL_TEMPLATE_CATALOG.map((t) => t.key),
);

export function isPlatformEmailTemplateKey(key: string): boolean {
  return PLATFORM_EMAIL_TEMPLATE_KEYS.has(key as EmailTemplateType);
}

export const PLACEHOLDER_EMAIL_VARS: EmailTemplateVariables = {
  recipientName: "{{recipient_name}}",
  recipientEmail: "{{recipient_email}}",
  firmName: "{{tenant_name}}",
  productName: "{{product_name}}",
  actionUrl: "{{action_url}}",
  supportUrl: "{{support_url}}",
  documentNumber: "{{invoice_number}}",
  documentType: "{{document_type}}",
  amountFormatted: "{{amount}}",
  dueDate: "{{due_date}}",
  otpCode: "{{otp_code}}",
  roleOrPortal: "{{role}}",
  inviteCode: "{{invite_code}}",
};

export function renderPlaceholderEmailTemplate(templateType: EmailTemplateType) {
  return renderEmailTemplate(templateType, PLACEHOLDER_EMAIL_VARS);
}
