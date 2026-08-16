/**
 * Maps canonical communication events → email template types.
 */
import type { EmailTemplateType } from "./email-templates";
import type { CommunicationEventKey } from "./platform/communication-events";

const EVENT_EMAIL_MAP: Partial<Record<CommunicationEventKey, EmailTemplateType>> = {
  "portal.invited": "portal_invitation",
  "auth.password_reset": "password_reset",
  "auth.otp_login": "otp_login",
  "invoice.ready": "invoice_ready",
  "payment.received": "payment_receipt",
  "payment.due": "payment_reminder",
  "order.created": "order_confirmation",
  "order.ready": "order_ready",
  "document.ready": "document_ready",
  "support.updated": "support_update",
  "subscription.amc_reminder": "amc_renewal_reminder",
  "subscription.plan_renewal": "amc_renewal_reminder",
  "credits.low": "low_credits",
  "credits.purchased": "credits_purchased",
  "report.daily": "daily_management_report",
  "report.weekly": "weekly_business_summary",
  "report.monthly": "monthly_statement",
};

export function eventKeyToEmailTemplate(
  eventKey: CommunicationEventKey,
  payload?: Record<string, unknown>,
): EmailTemplateType | null {
  if (eventKey === "portal.invited" && payload) {
    const portal = String(payload.portal ?? payload.role ?? "");
    if (portal.includes("customer")) return "customer_portal_invitation";
    if (portal.includes("karigar") || portal.includes("worker")) return "karigar_portal_invitation";
    if (portal.includes("supplier") || portal.includes("vendor"))
      return "supplier_portal_invitation";
    if (portal === "internal") return "internal_user_invitation";
  }
  return EVENT_EMAIL_MAP[eventKey] ?? null;
}
