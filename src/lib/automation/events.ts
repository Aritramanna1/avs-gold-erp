/**
 * Native ERP Automation Engine — Central Event Registry
 *
 * Strongly-typed event registry across all ERP business domains:
 * Auth, Customer/CRM, Quotations, Appointments, Supplier/Purchase,
 * Stock/Ready Stock/Variance, Sales/Billing, Karigar/Manufacturing,
 * Payroll/Stay, Expenses, Approvals, Reconciliations, EOD/EOM,
 * Payments, Subscriptions, Webhooks, Documents, Security, and Health.
 */

export const ERP_EVENT_CATEGORIES = [
  "auth",
  "customer",
  "quotation",
  "appointment",
  "supplier",
  "stock",
  "sales",
  "karigar",
  "payroll",
  "expense",
  "approval",
  "reconciliation",
  "payment",
  "webhook",
  "subscription",
  "document",
  "security",
  "health",
] as const;

export type ERPEventCategory = (typeof ERP_EVENT_CATEGORIES)[number];

export type ERPEventType =
  // Auth & Tenant
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "USER_CREATED"
  | "USER_INVITED"
  | "USER_ROLE_CHANGED"
  | "TENANT_CREATED"
  | "BRANCH_CREATED"

  // Customer & CRM
  | "LEAD_CREATED"
  | "ENQUIRY_RECEIVED"
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_PURCHASED"
  | "CUSTOMER_PAYMENT_DUE"
  | "CUSTOMER_PAYMENT_RECEIVED"
  | "CUSTOMER_BIRTHDAY_DUE"
  | "CUSTOMER_ANNIVERSARY_DUE"
  | "CUSTOMER_FOLLOWUP_DUE"
  | "CUSTOMER_INACTIVE_FLAGGED"
  | "CUSTOMER_HIGH_VALUE_REVIEW"

  // Quotation & Appointment
  | "QUOTATION_CREATED"
  | "QUOTATION_SENT"
  | "QUOTATION_VIEWED"
  | "QUOTATION_ACCEPTED"
  | "QUOTATION_REJECTED"
  | "QUOTATION_EXPIRED"
  | "QUOTATION_CONVERTED_TO_SALE"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_APPROACHING"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_MISSED"

  // Supplier & Purchase
  | "SUPPLIER_CREATED"
  | "PURCHASE_CREATED"
  | "PURCHASE_RECEIVED"
  | "PURCHASE_PAYMENT_DUE"
  | "PURCHASE_PAYMENT_RECEIVED"

  // Stock, Ready Stock & Variance
  | "STOCK_CREATED"
  | "STOCK_UPDATED"
  | "STOCK_RECEIVED"
  | "STOCK_ISSUED"
  | "STOCK_TRANSFERRED"
  | "STOCK_ADJUSTED"
  | "STOCK_COUNTED"
  | "STOCK_VARIANCE_DETECTED"
  | "STOCK_LOW"
  | "STOCK_ZERO"
  | "STOCK_SLOW_MOVING"
  | "STOCK_DEAD"
  | "STOCK_RESERVED"
  | "STOCK_SOLD"
  | "STOCK_RETURNED"
  | "READY_STOCK_CREATED"
  | "READY_STOCK_IMPORTED"
  | "BARCODE_REQUIRED"
  | "BARCODE_GENERATED"

  // Sales & Invoicing
  | "SALE_DRAFT_CREATED"
  | "SALE_CONFIRMED"
  | "SALE_CANCELLED"
  | "SALE_RETURNED"
  | "INVOICE_CREATED"
  | "INVOICE_PAID"
  | "INVOICE_PARTIAL"
  | "INVOICE_OVERDUE"

  // Karigar / Manufacturing
  | "KARIGAR_ISSUE_CREATED"
  | "KARIGAR_RECEIPT_CREATED"
  | "KARIGAR_SETTLEMENT_CREATED"
  | "KARIGAR_OVERLOSS_RECORDED"
  | "KARIGAR_ADVANCE_CREATED"
  | "KARIGAR_WASTAGE_CALCULATED"
  | "KARIGAR_WEEKLY_ALLOWANCE_POSTED"

  // Payroll, Staff & Stay
  | "PAYROLL_ATTENDANCE_RECORDED"
  | "PAYROLL_ATTENDANCE_MISSING"
  | "WORKER_STAY_STARTED"
  | "WORKER_STAY_ENDED"
  | "SALARY_CALCULATED"
  | "SALARY_SETTLEMENT_CREATED"

  // Expenses & Approvals
  | "EXPENSE_CREATED"
  | "EXPENSE_APPROVED"
  | "EXPENSE_PAID"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_REJECTED"

  // Reconciliation & EOD/EOM
  | "RECONCILIATION_RUN"
  | "RECONCILIATION_MISMATCH_DETECTED"
  | "EOD_CLOSING_INITIATED"
  | "EOD_CLOSING_COMPLETED"
  | "EOM_PERIOD_CLOSING_AUDIT"

  // Payments & Webhooks
  | "PAYMENT_CREATED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "WEBHOOK_RECEIVED"
  | "WEBHOOK_FAILED"

  // Subscriptions & Platform
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_EXPIRING"
  | "SUBSCRIPTION_EXPIRED"
  | "TENANT_SUSPENDED"

  // Document, Security & Health
  | "DOCUMENT_CREATED"
  | "DOCUMENT_PRINTED"
  | "DOCUMENT_SHARED"
  | "SECURITY_ALERT"
  | "FAILED_LOGIN_THRESHOLD"
  | "UNUSUAL_ACTIVITY"
  | "SYSTEM_HEALTH_FAILED"
  | "SYSTEM_HEALTH_RECOVERED"
  | "BACKUP_FAILED"
  | "BACKUP_COMPLETED";

export interface ERPEventContext {
  tenantId: string;
  branchId?: string;
  actorId?: string;
  actorType: "user" | "system" | "scheduler" | "webhook";
  correlationId: string;
  idempotencyKey?: string;
  timestamp: string;
}

export interface ERPEvent<T = Record<string, unknown>> {
  id: string;
  type: ERPEventType;
  category: ERPEventCategory;
  context: ERPEventContext;
  payload: T;
}

export function getEventCategory(eventType: ERPEventType): ERPEventCategory {
  if (
    eventType.startsWith("AUTH_") ||
    eventType.startsWith("USER_") ||
    eventType.startsWith("TENANT_") ||
    eventType.startsWith("BRANCH_")
  ) {
    return "auth";
  }
  if (eventType.startsWith("CUSTOMER_") || eventType === "LEAD_CREATED" || eventType === "ENQUIRY_RECEIVED") {
    return "customer";
  }
  if (eventType.startsWith("QUOTATION_")) return "quotation";
  if (eventType.startsWith("APPOINTMENT_")) return "appointment";
  if (eventType.startsWith("SUPPLIER_") || eventType.startsWith("PURCHASE_")) return "supplier";
  if (eventType.startsWith("STOCK_") || eventType.startsWith("READY_STOCK_") || eventType.startsWith("BARCODE_")) return "stock";
  if (eventType.startsWith("SALE_") || eventType.startsWith("INVOICE_")) return "sales";
  if (eventType.startsWith("KARIGAR_")) return "karigar";
  if (eventType.startsWith("PAYROLL_") || eventType.startsWith("WORKER_") || eventType.startsWith("SALARY_")) return "payroll";
  if (eventType.startsWith("EXPENSE_")) return "expense";
  if (eventType.startsWith("APPROVAL_")) return "approval";
  if (eventType.startsWith("RECONCILIATION_") || eventType.startsWith("EOD_") || eventType.startsWith("EOM_")) return "reconciliation";
  if (eventType.startsWith("PAYMENT_")) return "payment";
  if (eventType.startsWith("WEBHOOK_")) return "webhook";
  if (eventType.startsWith("SUBSCRIPTION_") || eventType === "TENANT_SUSPENDED") return "subscription";
  if (eventType.startsWith("DOCUMENT_")) return "document";
  if (eventType.startsWith("SECURITY_") || eventType.startsWith("FAILED_LOGIN_") || eventType.startsWith("UNUSUAL_")) return "security";
  return "health";
}

export function createERPEvent<T = Record<string, unknown>>(
  type: ERPEventType,
  payload: T,
  context: Partial<ERPEventContext> & { tenantId: string },
): ERPEvent<T> {
  const timestamp = context.timestamp || new Date().toISOString();
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const correlationId = context.correlationId || id;
  const category = getEventCategory(type);

  return {
    id,
    type,
    category,
    context: {
      tenantId: context.tenantId,
      branchId: context.branchId,
      actorId: context.actorId || "system",
      actorType: context.actorType || "system",
      correlationId,
      idempotencyKey: context.idempotencyKey,
      timestamp,
    },
    payload,
  };
}
