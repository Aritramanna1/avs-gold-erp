/** @deprecated Use @/lib/platform-payments/platform-payment-service */
export {
  fetchPurchasablePlans,
  fetchTenantInvoices as fetchTenantPlatformInvoices,
  startPlanPurchase,
  startInvoicePayment,
  type PaymentCheckoutSession as RazorpayCheckoutSession,
  type PlatformInvoiceRow,
} from "@/lib/platform-payments/platform-payment-service";

export type PurchasablePlan = Awaited<
  ReturnType<
    typeof import("@/lib/platform-payments/platform-payment-service").fetchPurchasablePlans
  >
>[number];
