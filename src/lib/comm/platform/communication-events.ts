/**
 * AVS Communication Platform — canonical event types and product IDs.
 * Multi-product: Ornexa, Restaurant POS, future AVS software.
 */
import type { MessageTemplate } from "../types";

export const AVS_PRODUCT_ORNEXA = "ORNEXA" as const;
export const AVS_PRODUCT_RESTAURANT_POS = "RESTAURANT_POS" as const;
export const AVS_PRODUCT_ACCOUNTING_ERP = "ACCOUNTING_ERP" as const;
export const AVS_PRODUCT_INVENTORY_ERP = "INVENTORY_ERP" as const;

export type AvsProductId =
  | typeof AVS_PRODUCT_ORNEXA
  | typeof AVS_PRODUCT_RESTAURANT_POS
  | typeof AVS_PRODUCT_ACCOUNTING_ERP
  | typeof AVS_PRODUCT_INVENTORY_ERP;

/** Default product for this deployment */
export const DEFAULT_AVS_PRODUCT: AvsProductId = AVS_PRODUCT_ORNEXA;

export type CommunicationChannel = "email" | "whatsapp" | "sms" | "in_app";

export type CommunicationJobStatus =
  "pending" | "processing" | "completed" | "partial" | "failed" | "cancelled";

export type ChannelDeliveryStatus =
  "pending" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "skipped";

/** Canonical communication events — product-agnostic keys */
export type CommunicationEventKey =
  | "invoice.ready"
  | "payment.received"
  | "payment.due"
  | "order.created"
  | "order.progress"
  | "order.ready"
  | "document.ready"
  | "quotation.sent"
  | "portal.invited"
  | "auth.password_reset"
  | "auth.otp_login"
  | "support.updated"
  | "karigar.job_reminder"
  | "supplier.purchase_order"
  | "hallmark.memo"
  | "catalogue.share"
  | "subscription.amc_reminder"
  | "subscription.plan_renewal"
  | "credits.low"
  | "credits.purchased"
  | "report.daily"
  | "report.weekly"
  | "report.monthly";

export interface CommunicationRecipient {
  name: string;
  email?: string;
  phone?: string;
  userId?: string;
  partyId?: string;
}

export interface DispatchCommunicationEventInput {
  productId?: AvsProductId;
  eventKey: CommunicationEventKey;
  branchId?: string;
  recipient: CommunicationRecipient;
  /** Override auto-routed channels; omit to use tenant preferences */
  channels?: CommunicationChannel[];
  payload?: Record<string, string | number | boolean | null | undefined>;
  referenceType?: string;
  referenceId?: string;
  documentUrl?: string;
  /** Allow email fallback when WhatsApp fails */
  emailFallbackOnWhatsAppFailure?: boolean;
  scheduledFor?: string;
}

export interface CommunicationJobRecord {
  id: string;
  productId: string;
  eventKey: string;
  status: CommunicationJobStatus;
  channelsRequested: CommunicationChannel[];
  recipient: CommunicationRecipient;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

/** Maps legacy MessageTemplate → canonical event key */
export const LEGACY_TEMPLATE_TO_EVENT: Record<string, CommunicationEventKey> = {
  invoice: "invoice.ready",
  receipt: "payment.received",
  payment_reminder: "payment.due",
  order_confirmation: "order.created",
  order_ready: "order.ready",
  repair_ready: "order.ready",
  estimate: "quotation.sent",
  otp: "auth.otp_login",
  business_report: "report.daily",
  manufacturing_bill: "document.ready",
  delivery_challan: "document.ready",
  settlement_ready: "document.ready",
  custom: "document.ready",
};

/** Maps event key → legacy comm template for existing providers */
export const EVENT_TO_LEGACY_TEMPLATE: Partial<Record<CommunicationEventKey, MessageTemplate>> = {
  "invoice.ready": "invoice",
  "payment.received": "receipt",
  "payment.due": "payment_reminder",
  "order.created": "order_confirmation",
  "order.ready": "order_ready",
  "document.ready": "custom",
  "quotation.sent": "estimate",
  "auth.otp_login": "otp",
  "report.daily": "business_report",
  "report.weekly": "business_report",
  "report.monthly": "business_report",
};
