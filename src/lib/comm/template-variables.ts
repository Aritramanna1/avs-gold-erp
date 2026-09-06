/**
 * AVS ERP — Communication Template Variable Namespaces
 *
 * Strict context separation between Retail Showroom and Manufacturing Workshop variables.
 * Cross-context variable contamination is strictly forbidden.
 */

export const RETAIL_TEMPLATE_VARIABLES = [
  "{{retail.customer.name}}",
  "{{retail.product.name}}",
  "{{retail.invoice.number}}",
  "{{retail.invoice.amount}}",
  "{{retail.appointment.date}}",
  "{{retail.gold_wallet.balance}}",
  "{{retail.shop.name}}",
] as const;

export const MANUFACTURING_TEMPLATE_VARIABLES = [
  "{{manufacturing.customer.name}}",
  "{{manufacturing.job.number}}",
  "{{manufacturing.request.number}}",
  "{{manufacturing.production.status}}",
  "{{manufacturing.item.number}}",
  "{{manufacturing.huid}}",
  "{{manufacturing.delivery.number}}",
  "{{manufacturing.invoice.number}}",
  "{{manufacturing.estimate.amount}}",
  "{{manufacturing.workshop.name}}",
] as const;

export const SUPPLIER_TEMPLATE_VARIABLES = [
  "{{supplier.name}}",
  "{{supplier.po.number}}",
  "{{supplier.po.amount}}",
  "{{supplier.invoice.number}}",
  "{{supplier.delivery.date}}",
  "{{supplier.delivery.status}}",
  "{{supplier.payment.status}}",
  "{{supplier.outstanding.amount}}",
  "{{supplier.contact.name}}",
] as const;

export type RetailVariable = (typeof RETAIL_TEMPLATE_VARIABLES)[number];
export type ManufacturingVariable = (typeof MANUFACTURING_TEMPLATE_VARIABLES)[number];
export type SupplierVariable = (typeof SUPPLIER_TEMPLATE_VARIABLES)[number];

export function validateTemplateVariables(
  templateText: string,
  context: "retail" | "manufacturing" | "supplier",
): { valid: boolean; disallowedVariables: string[] } {
  const disallowed: string[] = [];
  const variableRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = variableRegex.exec(templateText)) !== null) {
    const fullVar = `{{${match[1]}}}`;
    const prefix = match[1].split(".")[0];
    if (context === "manufacturing" && (prefix === "retail" || prefix === "supplier")) {
      disallowed.push(fullVar);
    }
    if (context === "retail" && (prefix === "manufacturing" || prefix === "supplier")) {
      disallowed.push(fullVar);
    }
    if (context === "supplier" && (prefix === "retail" || prefix === "manufacturing")) {
      disallowed.push(fullVar);
    }
  }

  return {
    valid: disallowed.length === 0,
    disallowedVariables: disallowed,
  };
}
