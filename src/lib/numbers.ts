import { getNextSequenceNumber, SequenceType } from "./sequence-manager";

/**
 * Dynamic, non-typed interface for official ERP document sequence generation.
 * Forwards directly to the unified, financial-year-aware central SequenceManager.
 */
export async function generateNumber(
  type: any, // Accepts any dynamically passed identifier
  options: Record<string, any> = {},
): Promise<string> {
  // Normalize type string to SequenceType
  let normalizedType: SequenceType = "order";
  const typeStr = String(type).toLowerCase();

  if (typeStr === "order" || typeStr === "orders") {
    normalizedType = "order";
  } else if (typeStr === "invoice" || typeStr === "invoices") {
    normalizedType = "invoice";
  } else if (typeStr === "jobcard" || typeStr === "job_cards" || typeStr === "job_card") {
    normalizedType = "jobcard";
  } else if (typeStr === "repair" || typeStr === "repairs") {
    normalizedType = "repair";
  } else if (typeStr === "gold_settlement" || typeStr === "expense" || typeStr === "voucher") {
    normalizedType = "gold_settlement";
  } else if (typeStr === "design") {
    normalizedType = "design";
  } else if (typeStr === "daily_close") {
    normalizedType = "daily_close";
  } else if (typeStr === "customer") {
    normalizedType = "customer";
  } else if (typeStr === "worker" || typeStr === "karigar") {
    normalizedType = "worker";
  }

  return getNextSequenceNumber(normalizedType);
}

/**
 * Official Order sequence generation shortcut.
 */
export async function generateOrderNumber(options?: Record<string, any>): Promise<string> {
  return getNextSequenceNumber("order");
}

/**
 * Official Invoice sequence generation shortcut.
 */
export async function generateInvoiceNumber(options?: Record<string, any>): Promise<string> {
  return getNextSequenceNumber("invoice");
}

/**
 * Official Job Card sequence generation shortcut.
 */
export async function generateJobCardNumber(options?: Record<string, any>): Promise<string> {
  return getNextSequenceNumber("jobcard");
}

/**
 * Format amount in Rupees with Indian currency localization.
 */
export function formatCurrencyRupees(amountInRupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInRupees);
}

