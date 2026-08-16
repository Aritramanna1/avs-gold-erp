/**
 * AVS Central Email Template Engine — 20+ professional templates.
 * Brand-aware, sanitized HTML, safe variable substitution.
 */

export type EmailTemplateType =
  | "welcome_product"
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
  | "monthly_statement";

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
    product_name: vars.productName ?? "Ornexa",
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
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => escapeHtml(map[key] ?? ""));
}

function brandedShell(opts: {
  firm: string;
  product: string;
  body: string;
  logoUrl?: string;
}): string {
  const logo = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${escapeHtml(opts.firm)}" style="height:36px;margin-bottom:8px;" />`
    : "";
  return `
<div style="max-width:600px;margin:0 auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border:1px solid ${HAIRLINE};background:#ffffff;">
  <div style="padding:24px 28px;border-bottom:1px solid ${HAIRLINE};background:#f5f5f7;">
    ${logo}
    <div style="font-size:17px;font-weight:600;color:${INK};letter-spacing:-0.02em;">${escapeHtml(opts.firm)}</div>
    <div style="font-size:12px;color:${MUTED};margin-top:2px;">${escapeHtml(opts.product)}</div>
  </div>
  <div style="padding:28px;color:${INK};font-size:15px;line-height:1.5;">${opts.body}</div>
  <div style="padding:16px 28px;border-top:1px solid ${HAIRLINE};background:#fafafc;font-size:11px;color:${MUTED};">
  Automated message from ${escapeHtml(opts.firm)}. For support, contact your administrator.
  </div>
</div>`;
}

function ctaButton(label: string, url?: string): string {
  if (!url) return "";
  return `<div style="margin:24px 0;text-align:center;"><a href="${escapeHtml(url)}" style="background:${ACTION_BLUE};color:#fff;text-decoration:none;padding:11px 22px;border-radius:9999px;font-size:15px;font-weight:500;display:inline-block;">${escapeHtml(label)}</a></div>`;
}

function simpleTemplate(
  subject: string,
  bodyHtml: string,
  text: string,
  vars: EmailTemplateVariables,
): { subject: string; html: string; text: string } {
  const firm = vars.firmName || "AVS";
  const product = vars.productName || "Ornexa";
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
    case "internal_user_invitation":
      return simpleTemplate(
        "Invitation to join {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>You have been invited as <strong>{{role}}</strong>.</p>${ctaButton("Accept Invitation", vars.actionUrl)}<p style="font-size:12px;color:${MUTED};">Link expires in 48 hours.</p>`,
        "Invitation to {{tenant_name}} as {{role}}: {{action_url}}",
        vars,
      );
    case "portal_invitation":
    case "customer_portal_invitation":
      return simpleTemplate(
        "Your Customer Portal — {{tenant_name}}",
        `<p>Welcome {{recipient_name}},</p><p>Access invoices, orders, and documents on the Customer Portal.</p>${ctaButton("Access Portal", vars.actionUrl)}`,
        "Customer portal: {{action_url}}",
        vars,
      );
    case "karigar_portal_invitation":
      return simpleTemplate(
        "Karigar Portal Access — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>View your job assignments and gold book on the Karigar Portal.</p>${ctaButton("Open Karigar Portal", vars.actionUrl)}`,
        "Karigar portal: {{action_url}}",
        vars,
      );
    case "supplier_portal_invitation":
      return simpleTemplate(
        "Supplier Portal Access — {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>View purchase orders and supply documents.</p>${ctaButton("Open Supplier Portal", vars.actionUrl)}`,
        "Supplier portal: {{action_url}}",
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
    default:
      return simpleTemplate(
        "Notification from {{tenant_name}}",
        `<p>Hello {{recipient_name}},</p><p>${escapeHtml(vars.alertDetails ?? "You have a new notification.")}</p>`,
        "Notification from {{tenant_name}}",
        vars,
      );
  }
}

export const EMAIL_TEMPLATE_CATALOG: Array<{
  key: EmailTemplateType;
  name: string;
  category: string;
}> = [
  { key: "welcome_product", name: "Welcome to Product", category: "onboarding" },
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
  { key: "amc_renewal_reminder", name: "AMC Renewal Reminder", category: "billing" },
  { key: "low_credits", name: "Low Credits Alert", category: "billing" },
  { key: "credits_purchased", name: "Credits Purchased", category: "billing" },
  { key: "daily_management_report", name: "Daily Management Report", category: "reports" },
  { key: "weekly_business_summary", name: "Weekly Business Summary", category: "reports" },
  { key: "monthly_statement", name: "Monthly Statement", category: "reports" },
];
